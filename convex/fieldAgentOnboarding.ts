import { v } from 'convex/values';
import { mutation } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import { requireAuth } from './lib/auth';
import { attachRecruit } from './lib/creatorRecruits';
import { isCreatorAccount } from '../lib/accounts';
import { FIELD_AGENT_DISCOVERY_SOURCES, normalizeWorkArea, normalizeWorkCity } from '../lib/fieldAgentOnboarding';
import { earnsCreatorOverride } from '../lib/pricing';

const discoverySourceValidator = v.union(
    v.literal('friend'), v.literal('facebook'), v.literal('tiktok'),
    v.literal('shop_website'), v.literal('job_post'),
);

async function requireFieldAgent(ctx: MutationCtx): Promise<Doc<'creators'>> {
    const identity = await requireAuth(ctx);
    const agent = await ctx.db.query('creators')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject)).unique();
    if (!agent || !isCreatorAccount(agent)) throw new Error('Field-agent account required');
    if (agent.isDeleted || agent.status === 'deleted' || agent.status === 'suspended') {
        throw new Error('Your account is not active');
    }
    return agent;
}

export const saveWorkArea = mutation({
    args: {
        city: v.string(),
        latitude: v.optional(v.number()),
        longitude: v.optional(v.number()),
        source: v.union(v.literal('city'), v.literal('device')),
        // Older clients save the city before discovery and call complete separately.
        finish: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const agent = await requireFieldAgent(ctx);
        const area = normalizeWorkArea(args);
        if (args.finish && !FIELD_AGENT_DISCOVERY_SOURCES.some((source) => source === agent.discoverySource)) {
            throw new Error('Save how you heard about us before continuing');
        }
        await ctx.db.patch(agent._id, {
            workCity: area.city,
            workLatitude: area.latitude,
            workLongitude: area.longitude,
            workLocationSource: area.source,
            ...(args.finish ? {
                fieldAgentOnboardingRequired: false,
                fieldAgentOnboardingCompletedAt: agent.fieldAgentOnboardingCompletedAt ?? Date.now(),
            } : {}),
        });
        return area;
    },
});

/**
 * Apply only a previously unclaimed referral, in the same transaction as discovery or completion.
 * Existing signup/link attribution always wins. No money is awarded by onboarding.
 */
async function applyOnboardingReferral(ctx: MutationCtx, agent: Doc<'creators'>, rawCode?: string) {
    const code = rawCode?.trim().toUpperCase();
    if (!code) return;
    if (code.length > 64) throw new Error('Invalid referral code');

    const existingReferral = await ctx.db.query('referrals')
        .withIndex('by_referred', (q) => q.eq('referredId', agent._id)).first();
    const existingReferrerId = agent.recruitedByCreatorId ?? agent.referredBy ?? existingReferral?.referrerId;
    if (agent.referredByCode || existingReferrerId || existingReferral) {
        const existingReferrer = existingReferrerId ? await ctx.db.get(existingReferrerId) : null;
        const existingCode = agent.referredByCode ?? existingReferral?.referralCode ?? existingReferrer?.referralCode;
        if (existingCode?.trim().toUpperCase() !== code) throw new Error('A referral has already been recorded for your account');
        return;
    }
    if (agent.fieldAgentOnboardingCompletedAt) throw new Error('Onboarding is already complete');

    const referrer = await ctx.db.query('creators')
        .withIndex('by_referral_code', (q) => q.eq('referralCode', code)).first();
    if (!referrer || referrer.isDeleted || referrer.status === 'deleted' || referrer.status === 'suspended'
        || (referrer.role === 'affiliate' && referrer.status !== 'active')
        || (!isCreatorAccount(referrer) && referrer.role !== 'affiliate')) {
        throw new Error('Invalid referral code');
    }
    if (referrer._id === agent._id || referrer.clerkId === agent.clerkId) {
        throw new Error('You cannot use your own referral code');
    }

    const now = Date.now();
    // Preserve the existing cutover: affiliate recruits use a 12-month override;
    // field-agent invites and older affiliate recruits use the legacy bonus row.
    if (referrer.role === 'affiliate' && earnsCreatorOverride(now)) {
        const result = await attachRecruit(ctx, agent, referrer, 'code', now);
        if (!result.ok) throw new Error(`This referral cannot be applied: ${result.reason}`);
    } else {
        await ctx.db.patch(agent._id, {
            referredBy: referrer._id,
            referredByCode: code,
            referredByName: [referrer.firstName, referrer.lastName].filter(Boolean).join(' '),
        });
        await ctx.db.insert('referrals', {
            referrerId: referrer._id,
            referredId: agent._id,
            referralCode: code,
            status: 'pending',
            createdAt: now,
        });
    }
}

/** Persist the first step without requiring a city or completing onboarding. */
export const saveDiscovery = mutation({
    args: {
        discoverySource: discoverySourceValidator,
        referredByCode: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const agent = await requireFieldAgent(ctx);
        await applyOnboardingReferral(ctx, agent, args.referredByCode);
        // Completed answers and attribution remain fixed; matching-code retries are safe.
        if (agent.fieldAgentOnboardingCompletedAt === undefined) {
            await ctx.db.patch(agent._id, { discoverySource: args.discoverySource });
        }
        return { saved: true };
    },
});

export const complete = mutation({
    args: {
        discoverySource: discoverySourceValidator,
        referredByCode: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const agent = await requireFieldAgent(ctx);
        if (!agent.workCity) throw new Error('Save your work city before continuing');
        normalizeWorkCity(agent.workCity);
        await applyOnboardingReferral(ctx, agent, args.referredByCode);
        if (!agent.fieldAgentOnboardingCompletedAt) {
            await ctx.db.patch(agent._id, {
                discoverySource: args.discoverySource,
                fieldAgentOnboardingRequired: false,
                fieldAgentOnboardingCompletedAt: Date.now(),
            });
        }
        return { completed: true };
    },
});
