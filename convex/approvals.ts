import { v } from 'convex/values';
import { internalAction, internalMutation, internalQuery } from './_generated/server';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { isCreatorAccount } from '../lib/accounts';

/**
 * Discord "new creator approval" loop.
 *
 * Mirrors the Knowledge-Hub escalation loop (convex/escalations.ts) but for
 * creator sign-ups: when a field agent passes onboarding and is awaiting admin
 * approval (quizPassedAt set, not yet certified/rejected), the bot posts them to
 * the #pending-approvals channel with ✅ and ❌ reactions. A team member reacts,
 * and the poll cron reads the reactions and certifies (✅) or rejects (❌) the
 * creator — the same effect as the admin dashboard's Approve/Reject buttons
 * (see creators.approveCreatorInternal / rejectCreatorInternal).
 *
 * Serverless, no gateway: reactions are POLLED via the REST API with the bot
 * token, because Discord does NOT deliver MESSAGE_REACTION_ADD events to
 * interaction webhooks — they require a persistent gateway connection.
 *
 * SECURITY: reacting approves/denies a REAL creator. Two gates:
 *   1. Discord channel permissions — #pending-approvals MUST be visible/reactable
 *      only to trusted team members.
 *   2. OPTIONAL role gate — if BOTH DISCORD_APPROVALS_ROLE_ID and DISCORD_GUILD_ID
 *      are set, only reactors who hold that role are honored (others are ignored).
 *      If unset, every non-bot reactor in the channel counts.
 *
 * Env: DISCORD_BOT_TOKEN (reused), DISCORD_PENDING_APPROVALS_CHANNEL_ID (the new
 * channel), DISCORD_APPROVALS_ENABLED (feature flag; default OFF),
 * DISCORD_APPROVALS_ROLE_ID (optional — pinged on each post; also the role gate
 * when DISCORD_GUILD_ID is set), DISCORD_GUILD_ID (optional — enables the gate).
 */

const DISCORD_API = 'https://discord.com/api/v10';
const APPROVE_EMOJI = '✅';
const DENY_EMOJI = '❌';
// Stop polling a post nobody resolved after this long. The creator stays pending
// in the dashboard; we just stop hitting Discord for it (safety backstop).
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
// A claimed row whose message never actually posted (action crashed between the
// claim and the POST) is cleaned up after this long so the creator can re-post.
const STALE_NO_MESSAGE_MS = 10 * 60 * 1000;

const approvalsEnabled = () => {
    const f = process.env.DISCORD_APPROVALS_ENABLED;
    return f === '1' || f === 'true';
};

function displayName(creator: Pick<Doc<'creators'>, 'firstName' | 'lastName' | 'email'>): string {
    return [creator.firstName, creator.lastName].filter(Boolean).join(' ') || creator.email || 'creator';
}

// ── DB helpers ──────────────────────────────────────────────────────

/**
 * Atomic dedup + claim: insert a fresh 'pending' row and return its id, UNLESS
 * an OPEN (pending/conflict) row already exists for this creator, in which case
 * return null. Doing the check + insert in one mutation (not a query then a
 * separate insert) prevents two overlapping poll runs from double-posting.
 */
export const claimForPost = internalMutation({
    args: { creatorId: v.id('creators'), quizPassedAt: v.number() },
    handler: async (ctx, args): Promise<Id<'approvalRequests'> | null> => {
        const creator = await ctx.db.get(args.creatorId);
        if (!isCreatorAccount(creator) || creator?.isDeleted || creator?.status === 'suspended' || creator?.status === 'deleted') return null;
        const rows = await ctx.db
            .query('approvalRequests')
            .withIndex('by_creator', (q) => q.eq('creatorId', args.creatorId))
            .collect();
        // Already handled THIS pending episode (any status — pending, resolved,
        // expired, or errored) → don't re-post. Keying on quizPassedAt (not just
        // 'open' statuses) means a deleted/expired post stays retired, while a
        // re-certification (fresh quizPassedAt) has no matching row and re-posts.
        if (rows.some((r) => r.quizPassedAt === args.quizPassedAt)) return null;
        const now = Date.now();
        return await ctx.db.insert('approvalRequests', {
            creatorId: args.creatorId,
            quizPassedAt: args.quizPassedAt,
            status: 'pending',
            createdAt: now,
            updatedAt: now,
        });
    },
});

export const patchApproval = internalMutation({
    args: {
        id: v.id('approvalRequests'),
        status: v.optional(
            v.union(
                v.literal('pending'),
                v.literal('approved'),
                v.literal('denied'),
                v.literal('conflict'),
                v.literal('expired'),
                v.literal('error'),
            ),
        ),
        discordChannelId: v.optional(v.string()),
        discordMessageId: v.optional(v.string()),
        resolvedBy: v.optional(v.string()),
        resolvedAt: v.optional(v.number()),
        error: v.optional(v.string()),
        lastPolledAt: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const { id, ...rest } = args;
        await ctx.db.patch(id, { ...rest, updatedAt: Date.now() });
    },
});

/** All still-pending rows (with OR without a messageId — the poller handles both). */
export const listOpen = internalQuery({
    args: {},
    handler: async (ctx) => {
        return await ctx.db
            .query('approvalRequests')
            .withIndex('by_status', (q) => q.eq('status', 'pending'))
            .collect();
    },
});

/** Creators awaiting approval (quiz passed, not certified/rejected/deleted). */
export const listPendingCreators = internalQuery({
    args: {},
    handler: async (ctx) => {
        const all = await ctx.db.query('creators').collect();
        return all
            .filter((c) => isCreatorAccount(c) && c.quizPassedAt && !c.certifiedAt && !c.rejectedAt && !c.isDeleted && c.status !== 'deleted' && c.status !== 'suspended')
            .map((c) => ({ _id: c._id }));
    },
});

// ── Discord REST ────────────────────────────────────────────────────

function botHeaders(botToken: string) {
    return { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' };
}

/**
 * Users who reacted with `emoji` (up to 100). `gone` is true when the message or
 * channel is 404/403 (deleted or access lost) so the caller can retire the row
 * instead of throwing + re-polling forever. Bot accounts carry `bot: true`.
 */
async function getReactors(
    channelId: string,
    messageId: string,
    emoji: string,
    botToken: string,
): Promise<{ users: Array<{ id: string; bot?: boolean }>; gone: boolean }> {
    const res = await fetch(
        `${DISCORD_API}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}?limit=100`,
        { headers: { Authorization: `Bot ${botToken}` } },
    );
    if (res.status === 404 || res.status === 403) return { users: [], gone: true };
    if (!res.ok) throw new Error(`get reactions ${emoji} failed (${res.status})`);
    return { users: (await res.json()) as Array<{ id: string; bot?: boolean }>, gone: false };
}

/** Does this Discord user hold the approvals role? Only called when gating is on. */
async function reactorHasRole(guildId: string, userId: string, roleId: string, botToken: string): Promise<boolean> {
    try {
        const res = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${userId}`, {
            headers: { Authorization: `Bot ${botToken}` },
        });
        if (!res.ok) {
            // 403/401 means the bot can't read members at all — the gate then
            // fails closed for EVERYONE and decisions silently stall. Surface it.
            if (res.status === 401 || res.status === 403) {
                console.warn(`[APPROVALS] role gate can't read guild members (${res.status}) — check the bot is in the guild; approvals will stall`);
            }
            return false;
        }
        const member = (await res.json()) as { roles?: string[] };
        return Array.isArray(member.roles) && member.roles.includes(roleId);
    } catch {
        return false;
    }
}

/**
 * Non-bot reactor ids allowed to DECIDE. If DISCORD_APPROVALS_ROLE_ID and
 * DISCORD_GUILD_ID are both set, only reactors holding that role are kept;
 * otherwise every non-bot reactor counts (channel permissions are the gate).
 */
async function authorizedReactorIds(
    reactors: Array<{ id: string; bot?: boolean }>,
    botToken: string,
): Promise<string[]> {
    const humans = reactors.filter((u) => !u.bot).map((u) => u.id);
    const roleId = process.env.DISCORD_APPROVALS_ROLE_ID;
    const guildId = process.env.DISCORD_GUILD_ID;
    if (!roleId || !guildId) return humans; // channel-permissions-only
    const allowed: string[] = [];
    for (const id of humans) {
        if (await reactorHasRole(guildId, id, roleId, botToken)) allowed.push(id);
    }
    return allowed;
}

async function editMessage(channelId: string, messageId: string, content: string, botToken: string): Promise<void> {
    await fetch(`${DISCORD_API}/channels/${channelId}/messages/${messageId}`, {
        method: 'PATCH',
        headers: botHeaders(botToken),
        body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    }).catch(() => {});
}

// ── createAndPost ───────────────────────────────────────────────────

/**
 * Record + post one pending creator to #pending-approvals and seed the ✅/❌
 * reactions. Atomically deduped so a still-pending creator is never posted twice.
 */
export const createAndPost = internalAction({
    args: { creatorId: v.id('creators') },
    handler: async (ctx, args) => {
        if (!approvalsEnabled()) return;
        const channelId = process.env.DISCORD_PENDING_APPROVALS_CHANNEL_ID;
        const botToken = process.env.DISCORD_BOT_TOKEN;
        // Don't record a row we can't post — a row with no message would block
        // re-posting (dedup) yet never be pollable, stranding the creator.
        if (!channelId || !botToken) {
            console.warn('[APPROVALS] DISCORD_PENDING_APPROVALS_CHANNEL_ID/DISCORD_BOT_TOKEN not set — skipping post.');
            return;
        }

        const creator = await ctx.runQuery(internal.creators.getByIdInternal, { id: args.creatorId });
        if (!creator) return;
        // Only post creators genuinely awaiting approval.
        const quizPassedAt = creator.quizPassedAt;
        if (!isCreatorAccount(creator) || !quizPassedAt || creator.certifiedAt || creator.rejectedAt || creator.isDeleted || creator.status === 'suspended' || creator.status === 'deleted') return;

        // Atomic dedup + claim — null means this pending episode was already posted.
        const id = await ctx.runMutation(internal.approvals.claimForPost, { creatorId: args.creatorId, quizPassedAt });
        if (!id) return;

        try {
            const name =
                [creator.firstName, creator.middleName, creator.lastName].filter(Boolean).join(' ') ||
                creator.email ||
                'New creator';
            const roleId = process.env.DISCORD_APPROVALS_ROLE_ID;
            const siteUrl = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
            const adminLink = siteUrl ? `\n🔗 ${siteUrl}/admin/creators/pending/${args.creatorId}` : '';
            const referral = creator.referredByName ? `\n🤝 Referred by ${creator.referredByName}` : '';
            const ping = roleId ? `<@&${roleId}> ` : '';

            const content =
                `${ping}🆕 **New creator awaiting approval**\n\n` +
                `**${name}**\n` +
                `📧 ${creator.email ?? '—'}\n` +
                `📱 ${creator.phone ?? '—'}` +
                referral +
                adminLink +
                `\n\nReact ${APPROVE_EMOJI} to **approve** · ${DENY_EMOJI} to **deny**.`;

            const msgRes = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
                method: 'POST',
                headers: botHeaders(botToken),
                body: JSON.stringify({
                    content,
                    // Only ping the approvals role (never @everyone / arbitrary users).
                    allowed_mentions: roleId ? { roles: [roleId] } : { parse: [] },
                }),
            });
            if (!msgRes.ok) {
                throw new Error(`post message failed (${msgRes.status}): ${(await msgRes.text().catch(() => '')).slice(0, 200)}`);
            }
            const msg = (await msgRes.json()) as { id: string };

            // Save the message id IMMEDIATELY (before seeding reactions) so a
            // later reaction-seed failure can never orphan a live message.
            await ctx.runMutation(internal.approvals.patchApproval, {
                id,
                discordChannelId: channelId,
                discordMessageId: msg.id,
            });

            // Seed the ✅/❌ options via the scheduler, spaced ~1.2s apart. Adding
            // two reactions back-to-back reliably 429s the SECOND one (Discord's
            // reaction rate limit), which used to silently drop the ❌. Spacing +
            // the 429 retry inside seedReaction makes both land. Best-effort —
            // team members can still add a reaction manually.
            await ctx.scheduler.runAfter(0, internal.approvals.seedReaction, {
                channelId,
                messageId: msg.id,
                emoji: APPROVE_EMOJI,
            });
            await ctx.scheduler.runAfter(1200, internal.approvals.seedReaction, {
                channelId,
                messageId: msg.id,
                emoji: DENY_EMOJI,
            });
            console.log('[APPROVALS] posted creator', args.creatorId, 'msg', msg.id);
        } catch (err) {
            console.error('[APPROVALS] post failed:', (err as Error).message);
            await ctx.runMutation(internal.approvals.patchApproval, {
                id,
                status: 'error',
                error: (err as Error).message,
            });
        }
    },
});

/**
 * Add one reaction to a message, retrying on Discord's 429 rate limit by
 * RESCHEDULING itself with the returned retry_after (the Convex-native way to
 * delay — no setTimeout). Called via the scheduler from createAndPost so the
 * two seeds are spaced out; this handles any residual rate-limiting. Best-effort:
 * gives up after a few attempts (team members can still react manually).
 */
export const seedReaction = internalAction({
    args: {
        channelId: v.string(),
        messageId: v.string(),
        emoji: v.string(),
        attempt: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const botToken = process.env.DISCORD_BOT_TOKEN;
        if (!botToken) return;
        const res = await fetch(
            `${DISCORD_API}/channels/${args.channelId}/messages/${args.messageId}/reactions/${encodeURIComponent(args.emoji)}/@me`,
            { method: 'PUT', headers: { Authorization: `Bot ${botToken}` } },
        ).catch(() => null);
        if (!res || res.ok) return; // success (204) or network error → best-effort
        const attempt = args.attempt ?? 0;
        if (res.status === 429 && attempt < 3) {
            const body = (await res.json().catch(() => ({}))) as { retry_after?: number };
            const delayMs = Math.min(Math.ceil((body.retry_after ?? 1) * 1000) + 250, 5000);
            await ctx.scheduler.runAfter(delayMs, internal.approvals.seedReaction, {
                channelId: args.channelId,
                messageId: args.messageId,
                emoji: args.emoji,
                attempt: attempt + 1,
            });
        }
    },
});

// ── pollPending (cron) ──────────────────────────────────────────────

/**
 * Every couple of minutes (convex/crons.ts): (1) post any pending creator not yet
 * posted, then (2) for each open post — close it if the creator was already
 * resolved in the dashboard, expire it if it's too old, retire it if the message
 * was deleted, else read ✅/❌ reactions and drive the approve/deny decision.
 * No-op unless DISCORD_APPROVALS_ENABLED and the channel + bot token are set.
 */
export const pollPending = internalAction({
    args: {},
    handler: async (ctx) => {
        if (!approvalsEnabled()) return;
        const channelId = process.env.DISCORD_PENDING_APPROVALS_CHANNEL_ID;
        const botToken = process.env.DISCORD_BOT_TOKEN;
        if (!channelId || !botToken) return;

        // 1) Reconcile — post pending creators not yet posted. Isolated so a scan
        // failure can't break the reaction-polling half below.
        try {
            const pending = await ctx.runQuery(internal.approvals.listPendingCreators, {});
            for (const c of pending) {
                await ctx.runAction(internal.approvals.createAndPost, { creatorId: c._id });
            }
        } catch (err) {
            console.error('[APPROVALS] reconcile failed:', (err as Error).message);
        }

        // 2) Poll reactions on open posts and act.
        const open = await ctx.runQuery(internal.approvals.listOpen, {});
        for (const req of open) {
            try {
                // A claimed row whose message never posted (crash window) — retire it.
                if (!req.discordMessageId || !req.discordChannelId) {
                    if (Date.now() - req.createdAt > STALE_NO_MESSAGE_MS) {
                        await ctx.runMutation(internal.approvals.patchApproval, { id: req._id, status: 'error', error: 'post never completed' });
                    }
                    continue;
                }
                const chan = req.discordChannelId;
                const msg = req.discordMessageId;

                // Resolved in the admin dashboard (not via reaction) → close the row.
                // Also retire if the creator was deleted after posting (a reaction
                // must not certify a soft-deleted creator).
                const creator = await ctx.runQuery(internal.creators.getByIdInternal, { id: req.creatorId });
                if (!creator || !isCreatorAccount(creator) || creator.isDeleted || creator.status === 'suspended' || creator.status === 'deleted') {
                    await ctx.runMutation(internal.approvals.patchApproval, {
                        id: req._id,
                        status: 'error',
                        error: creator ? 'account is not an eligible field creator' : 'creator not found',
                    });
                    continue;
                }
                if (creator.certifiedAt) {
                    await ctx.runMutation(internal.approvals.patchApproval, { id: req._id, status: 'approved', resolvedAt: Date.now() });
                    await editMessage(chan, msg, `✅ **Approved** — ${displayName(creator)} is now certified. (via dashboard)`, botToken);
                    continue;
                }
                if (creator.rejectedAt) {
                    await ctx.runMutation(internal.approvals.patchApproval, { id: req._id, status: 'denied', resolvedAt: Date.now() });
                    await editMessage(chan, msg, `❌ **Denied** — ${displayName(creator)}'s application was rejected. (via dashboard)`, botToken);
                    continue;
                }

                // Backstop: stop polling posts nobody resolved (creator stays
                // pending in the dashboard — this only retires the Discord post).
                if (Date.now() - req.createdAt > MAX_AGE_MS) {
                    await ctx.runMutation(internal.approvals.patchApproval, { id: req._id, status: 'expired' });
                    await editMessage(chan, msg, `⌛ This request expired — please resolve ${displayName(creator)} in the admin dashboard.`, botToken);
                    continue;
                }

                // Read reactions.
                const [aRes, dRes] = await Promise.all([
                    getReactors(chan, msg, APPROVE_EMOJI, botToken),
                    getReactors(chan, msg, DENY_EMOJI, botToken),
                ]);
                if (aRes.gone || dRes.gone) {
                    // Message deleted / access lost — retire so we stop polling it.
                    await ctx.runMutation(internal.approvals.patchApproval, { id: req._id, status: 'error', error: 'message removed' });
                    continue;
                }
                const approvers = await authorizedReactorIds(aRes.users, botToken);
                const deniers = await authorizedReactorIds(dRes.users, botToken);

                // Contested — don't guess; leave it for a human in the dashboard.
                if (approvers.length && deniers.length) {
                    await ctx.runMutation(internal.approvals.patchApproval, { id: req._id, status: 'conflict', lastPolledAt: Date.now() });
                    await editMessage(chan, msg, `⚠️ **Conflicting reactions** — please resolve this one in the admin dashboard.`, botToken);
                    continue;
                }

                if (approvers.length) {
                    const who = approvers[0];
                    const r = await ctx.runMutation(internal.creators.approveCreatorInternal, { id: req.creatorId, approvedBy: who });
                    if (r.outcome === 'approved' || r.outcome === 'already_approved') {
                        await ctx.runMutation(internal.approvals.patchApproval, { id: req._id, status: 'approved', resolvedBy: who, resolvedAt: Date.now() });
                        await editMessage(chan, msg, `✅ **Approved** — ${r.name} is now certified. (by <@${who}>)`, botToken);
                    } else if (r.outcome === 'already_rejected') {
                        await ctx.runMutation(internal.approvals.patchApproval, { id: req._id, status: 'denied', resolvedBy: who, resolvedAt: Date.now() });
                        await editMessage(chan, msg, `❌ ${r.name} was already denied in the dashboard.`, botToken);
                    } else {
                        await ctx.runMutation(internal.approvals.patchApproval, { id: req._id, status: 'error', error: 'creator not found' });
                    }
                    continue;
                }

                if (deniers.length) {
                    const who = deniers[0];
                    const r = await ctx.runMutation(internal.creators.rejectCreatorInternal, { id: req.creatorId, rejectedBy: `discord:${who}` });
                    if (r.outcome === 'rejected' || r.outcome === 'already_rejected') {
                        await ctx.runMutation(internal.approvals.patchApproval, { id: req._id, status: 'denied', resolvedBy: who, resolvedAt: Date.now() });
                        await editMessage(chan, msg, `❌ **Denied** — ${r.name}'s application was rejected. (by <@${who}>)`, botToken);
                    } else if (r.outcome === 'already_approved') {
                        await ctx.runMutation(internal.approvals.patchApproval, { id: req._id, status: 'approved', resolvedBy: who, resolvedAt: Date.now() });
                        await editMessage(chan, msg, `✅ ${r.name} was already approved in the dashboard.`, botToken);
                    } else {
                        await ctx.runMutation(internal.approvals.patchApproval, { id: req._id, status: 'error', error: 'creator not found' });
                    }
                    continue;
                }

                // No authorized reaction yet — just record that we looked.
                await ctx.runMutation(internal.approvals.patchApproval, { id: req._id, lastPolledAt: Date.now() });
            } catch (err) {
                console.error('[APPROVALS] poll failed for', req._id, (err as Error).message);
            }
        }
    },
});
