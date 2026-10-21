import { ConvexError, v } from 'convex/values';
import { internalMutation, internalQuery, mutation, query } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { requireAuth } from './lib/auth';
import { isCreatorAccount } from '../lib/accounts';
import { attachRecruit, creatorCard, findActiveCreator } from './lib/creatorRecruits';
import {
    ATTRIBUTION_CLICK_DEDUPE_MS, ATTRIBUTION_SUGGEST_WINDOW_MS, cleanCookieId, cleanUserAgent,
} from './lib/attribution';

/**
 * Who sent this person? Clicks on a creator's two links, the "Did <name> send
 * you?" suggestion, and the person's confirmed answer.
 * Contract: docs/v2-api-creators.md.
 *
 * Nothing here ever attributes on its own. A click only lets us ASK; the
 * person's answer (claimAttribution) is the only thing that links them.
 */

const linkKind = v.union(v.literal('shop'), v.literal('earn'));
const claimSource = v.union(v.literal('install_referrer'), v.literal('confirmed'), v.literal('code'));

type ClickInput = { handle: string; kind: 'shop' | 'earn'; cookieId?: string; ipHash?: string; userAgent?: string };

async function insertClick(ctx: MutationCtx, input: ClickInput, channel: 'web' | 'http') {
    const found = await findActiveCreator(ctx, input.handle);
    if (!found) return { recorded: false, creator: null };
    const creator = found.affiliate;
    const cookieId = cleanCookieId(input.cookieId);
    const now = Date.now();
    // The same browser re-opening the same link is one visit, not many.
    if (cookieId) {
        const recent = await ctx.db.query('attributionClicks')
            .withIndex('by_cookie', (q) => q.eq('cookieId', cookieId).gte('createdAt', now - ATTRIBUTION_CLICK_DEDUPE_MS))
            .collect();
        if (recent.some((click) => click.creatorId === creator._id && click.kind === input.kind)) {
            return { recorded: false, creator: creatorCard(creator, found.price) };
        }
    }
    await ctx.db.insert('attributionClicks', {
        creatorId: creator._id,
        handle: creator.affiliateHandle!,
        kind: input.kind,
        cookieId,
        ipHash: input.ipHash || undefined,
        userAgent: cleanUserAgent(input.userAgent),
        channel,
        createdAt: now,
    });
    return { recorded: true, creator: creatorCard(creator, found.price) };
}

/**
 * Record a visit to /a/<handle> ('shop') or /a/<handle>/earn ('earn') from the
 * web page. No IP here (a mutation cannot see it): to also match the network,
 * POST the same body to the HTTP endpoint /attribution/click instead.
 */
export const recordClick = mutation({
    args: { handle: v.string(), kind: linkKind, cookieId: v.string(), userAgent: v.optional(v.string()) },
    handler: async (ctx, args) => insertClick(ctx, args, 'web'),
});

/** Called by the /attribution/click HTTP action with the salted IP hash. */
export const recordClickInternal = internalMutation({
    args: {
        handle: v.string(), kind: linkKind, cookieId: v.optional(v.string()),
        ipHash: v.optional(v.string()), userAgent: v.optional(v.string()),
    },
    handler: async (ctx, args) => insertClick(ctx, args, 'http'),
});

async function alreadyAttributed(ctx: Pick<QueryCtx, 'db'>, clerkId: string) {
    const claimed = await ctx.db.query('creatorAttributions').withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId)).first();
    if (claimed) return true;
    const me = await ctx.db.query('creators').withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId)).unique();
    return !!me && !me.isDeleted && (me.role === 'affiliate' || !!me.recruitedByCreatorId || !!me.referredBy);
}

async function suggestFor(ctx: Pick<QueryCtx, 'db'>, input: { cookieId?: string; ipHash?: string; clerkId?: string }) {
    if (input.clerkId && await alreadyAttributed(ctx, input.clerkId)) return null;
    const since = Date.now() - ATTRIBUTION_SUGGEST_WINDOW_MS;
    const cookieId = cleanCookieId(input.cookieId);
    const [byCookie, byNetwork] = await Promise.all([
        cookieId
            ? ctx.db.query('attributionClicks').withIndex('by_cookie', (q) => q.eq('cookieId', cookieId).gte('createdAt', since)).collect()
            : Promise.resolve([] as Doc<'attributionClicks'>[]),
        input.ipHash
            ? ctx.db.query('attributionClicks').withIndex('by_ip_hash', (q) => q.eq('ipHash', input.ipHash).gte('createdAt', since)).collect()
            : Promise.resolve([] as Doc<'attributionClicks'>[]),
    ]);
    // A cookie is this exact browser; a network match is only a guess. Prefer
    // the cookie, then the most recent click.
    const ranked = [
        ...byCookie.map((click) => ({ click, matchedBy: 'cookie' as const })).sort((a, b) => b.click.createdAt - a.click.createdAt),
        ...byNetwork.map((click) => ({ click, matchedBy: 'network' as const })).sort((a, b) => b.click.createdAt - a.click.createdAt),
    ];
    for (const { click, matchedBy } of ranked) {
        const found = await findActiveCreator(ctx, click.handle);
        if (!found || found.affiliate._id !== click.creatorId) continue;
        if (input.clerkId && found.affiliate.clerkId === input.clerkId) continue;
        return { creator: creatorCard(found.affiliate, found.price), kind: click.kind, clickedAt: click.createdAt, matchedBy };
    }
    return null;
}

/**
 * Who to ASK about ("Did Mika send you? Yes / No"), from a click by this
 * browser's cookie in the last 24 hours. Read-only: it never attributes. For a
 * network (same IP) match, e.g. iOS first open, POST to /attribution/suggest.
 * Returns null once the signed-in person already has a creator.
 */
export const suggestAttribution = query({
    args: { cookieId: v.optional(v.string()) },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        return suggestFor(ctx, { cookieId: args.cookieId, clerkId: identity?.subject });
    },
});

/** Used by the /attribution/suggest HTTP action, which knows the IP hash. */
export const suggestInternal = internalQuery({
    args: { cookieId: v.optional(v.string()), ipHash: v.optional(v.string()), clerkId: v.optional(v.string()) },
    handler: async (ctx, args) => suggestFor(ctx, args),
});

/**
 * The signed-in person's confirmed answer to "who sent you?".
 *
 * - `source`: 'install_referrer' (Android Play referrer), 'confirmed' (said Yes
 *   to the suggestion) or 'code' (typed the code).
 * - `as`: 'agent' (field agent) or 'owner'. Inferred from the account when
 *   omitted; with no account yet it is treated as 'agent' and applied when
 *   creators.create runs.
 *
 * First claim wins. A field agent is linked to the creator for the 5%
 * override (one level, no self-referral, not once they have sold). An owner's
 * claim is what the app pre-fills as the code at checkout.
 */
export const claimAttribution = mutation({
    args: { handle: v.string(), source: claimSource, as: v.optional(v.union(v.literal('agent'), v.literal('owner'))) },
    handler: async (ctx, args) => {
        const identity = await requireAuth(ctx);
        const found = await findActiveCreator(ctx, args.handle);
        if (!found) throw new ConvexError('We could not find that creator. Check the code and try again.');
        const creator = found.affiliate;
        const email = identity.email?.trim().toLowerCase();
        if (creator.clerkId === identity.subject || (email && creator.email.trim().toLowerCase() === email)) {
            throw new ConvexError('You cannot use your own link or code.');
        }

        const me = await ctx.db.query('creators').withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject)).unique();
        const liveMe = me && !me.isDeleted ? me : null;
        if (liveMe?.role === 'affiliate') throw new ConvexError('Creator accounts cannot be referred.');
        const owner = await ctx.db.query('businessOwners').withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject)).first();
        const kind = args.as ?? (liveMe && isCreatorAccount(liveMe) ? 'agent' : owner ? 'owner' : 'agent');

        const existing = await ctx.db.query('creatorAttributions').withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject)).first();
        if (existing) {
            const first = await findActiveCreator(ctx, existing.handle);
            return {
                status: existing.creatorId === creator._id ? 'unchanged' as const : 'already_attributed' as const,
                kind: existing.kind,
                linked: existing.status === 'applied',
                reason: existing.reason ?? null,
                creator: first && first.affiliate._id === existing.creatorId ? creatorCard(first.affiliate, first.price) : null,
            };
        }

        const now = Date.now();
        const attributionId = await ctx.db.insert('creatorAttributions', {
            clerkId: identity.subject,
            creatorId: creator._id,
            handle: creator.affiliateHandle!,
            kind,
            source: args.source,
            status: kind === 'owner' ? 'applied' : 'pending',
            createdAt: now,
            appliedAt: kind === 'owner' ? now : undefined,
        });

        let linked = kind === 'owner';
        let reason: string | null = null;
        if (kind === 'agent' && liveMe) {
            const result = await attachRecruit(ctx, liveMe, creator, args.source, now);
            linked = result.ok;
            reason = result.ok ? null : result.reason;
            await ctx.db.patch(attributionId, result.ok
                ? { status: 'applied', appliedAt: now }
                : { status: 'not_applied', reason: result.reason });
        }
        return { status: 'claimed' as const, kind, linked, reason, creator: creatorCard(creator, found.price) };
    },
});

/** The signed-in person's creator, if they confirmed one: pre-fills the code at checkout. */
export const myAttribution = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return null;
        const row = await ctx.db.query('creatorAttributions').withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject)).first();
        if (!row) return null;
        const found = await findActiveCreator(ctx, row.handle);
        return {
            kind: row.kind,
            source: row.source,
            status: row.status,
            claimedAt: row.createdAt,
            // Null when the creator is no longer active: nothing to pre-fill.
            creator: found && found.affiliate._id === row.creatorId ? creatorCard(found.affiliate, found.price) : null,
        };
    },
});
