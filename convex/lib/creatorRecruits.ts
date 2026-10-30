import type { Doc } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { isCreatorAccount } from '../../lib/accounts';
import { affiliateHandleError, getAffiliateSocialLinks } from '../../lib/affiliates';
import { CREATOR_CODE_PRICE, isComped, WEBSITE_PRICE } from '../../lib/pricing';
import { resolveAffiliateOffer } from './affiliateOffer';
import { isPaidInFull as ownerPaidInFull } from './ownerApp';
import { normalizeCreatorCode } from '../../lib/creatorCodes';
import { resolveReferralCode } from './referralCodes';
export { normalizeCreatorCode } from '../../lib/creatorCodes';

/** earnings.type for the creator's 5% on a recruit's sale. */
export const CREATOR_OVERRIDE_EARNING = 'creator_override';

/**
 * Submission statuses that mean the shop has PAID IN FULL on a legacy row (no
 * payment fields). `deposit_paid` (a down payment) is deliberately absent: the
 * creator override is paid only once the whole price is in.
 */
export const PAID_IN_FULL_STATUSES = ['paid', 'completed'] as const;

/**
 * Paid in full. One definition for the whole backend: convex/lib/ownerApp.ts
 * (`paidInFullAt` wins; a down payment with no balance yet is never paid in
 * full, whatever the status says; legacy rows fall back to the status).
 */
export function isPaidInFull(submission: Pick<Doc<'submissions'>, 'status' | 'paidInFullAt' | 'depositPaidAt'>): boolean {
    return ownerPaidInFull(submission);
}

/** When the shop paid in full (the v2 field first, then the legacy stamps). */
export function paidInFullTime(submission: Pick<Doc<'submissions'>, 'paidInFullAt' | 'paidAt' | 'creatorPaidAt'>): number | null {
    return submission.paidInFullAt ?? submission.paidAt ?? submission.creatorPaidAt ?? null;
}

/** A real paid sale: paid in full, not a promo site, not a giveaway. */
export function isPaidSale(submission: Doc<'submissions'>): boolean {
    return isPaidInFull(submission) && !isComped(submission) && !submission.giveawayApplication;
}

export function samePerson(value?: string | null, other?: string | null, normalize = (s: string) => s.trim().toLowerCase()) {
    if (!value || !other) return false;
    const left = normalize(value);
    return !!left && left === normalize(other);
}

const digits = (s: string) => s.replace(/\D/g, '').slice(-10);

/** An owner never earns an override on their own site. */
export function isCreatorOwnSite(submission: Doc<'submissions'>, creator: Doc<'creators'>): boolean {
    return samePerson(submission.ownerEmail, creator.email)
        || samePerson(submission.ownerPhone, creator.phone, digits);
}

export type RecruitVia = 'code' | 'install_referrer' | 'confirmed';

export type AttachResult =
    | { ok: true; alreadyLinked: boolean }
    | { ok: false; reason: 'not_field_agent' | 'not_a_creator' | 'self_referral' | 'already_recruited' | 'already_referred' | 'already_selling' };

function sameEmail(a?: string | null, b?: string | null): boolean {
    const left = (a ?? '').trim().toLowerCase();
    return !!left && left === (b ?? '').trim().toLowerCase();
}

/**
 * Link a field agent to the creator who recruited them. One level only: the
 * recruiter must be a creator (role 'affiliate'), and an affiliate can never be
 * a recruit, so a creator never earns on a recruit's recruits.
 *
 * The join date (recruitedAt) starts the 12-month override window. An agent
 * who already has a paid sale is an established seller, not a new recruit, so
 * the link is refused. The first recruiter wins; a second claim never moves an
 * agent to another creator.
 */
export async function attachRecruit(
    ctx: Pick<MutationCtx, 'db'>,
    recruit: Doc<'creators'>,
    recruiter: Doc<'creators'>,
    via: RecruitVia,
    now: number = Date.now(),
): Promise<AttachResult> {
    if (!isCreatorAccount(recruit) || recruit.isDeleted || recruit.status === 'deleted') return { ok: false, reason: 'not_field_agent' };
    if (recruiter.role !== 'affiliate' || recruiter.isDeleted || recruiter.status !== 'active') return { ok: false, reason: 'not_a_creator' };
    if (recruit._id === recruiter._id || recruit.clerkId === recruiter.clerkId || sameEmail(recruit.email, recruiter.email)) {
        return { ok: false, reason: 'self_referral' };
    }
    if (recruit.recruitedByCreatorId) {
        return recruit.recruitedByCreatorId === recruiter._id
            ? { ok: true, alreadyLinked: true }
            : { ok: false, reason: 'already_recruited' };
    }
    // A legacy referral row (₱1,000 track) or another referrer's code already
    // owns this agent. The two programs never both pay for one person.
    const referral = await ctx.db.query('referrals').withIndex('by_referred', (q) => q.eq('referredId', recruit._id)).first();
    if (referral) return { ok: false, reason: 'already_referred' };
    if (recruit.referredBy && recruit.referredBy !== recruiter._id) return { ok: false, reason: 'already_referred' };

    const sales = await ctx.db.query('submissions').withIndex('by_creator_id', (q) => q.eq('creatorId', recruit._id)).collect();
    if (sales.some(isPaidSale)) return { ok: false, reason: 'already_selling' };

    await ctx.db.patch(recruit._id, {
        recruitedByCreatorId: recruiter._id,
        recruitedAt: now,
        recruitedVia: via,
        referredBy: recruiter._id,
        referredByCode: recruit.referredByCode ?? recruiter.referralCode,
        referredByName: recruit.referredByName
            ?? (recruiter.affiliateDisplayName?.trim() || [recruiter.firstName, recruiter.lastName].filter(Boolean).join(' ') || undefined),
    });
    return { ok: true, alreadyLinked: false };
}

/**
 * An ACTIVE creator by an explicit page handle (`mika`) or code (`MIKA30`). Pending,
 * suspended and deleted creators resolve to nothing, so a link can never
 * attribute to an account the admin has not approved.
 */
export async function findActiveCreator(ctx: Pick<QueryCtx, 'db'>, handleOrCode: string, kind: 'handle' | 'code') {
    const raw = handleOrCode.trim();
    if (!raw || raw.length > 64) return null;
    if (kind === 'handle') {
        const handle = raw.replace(/^@/, '').toLowerCase();
        return affiliateHandleError(handle) ? null : resolveAffiliateOffer(ctx, handle);
    }
    const code = normalizeCreatorCode(raw);
    const byCode = await resolveReferralCode(ctx, code);
    if (!byCode || byCode.role !== 'affiliate' || byCode.status !== 'active' || byCode.isDeleted || !byCode.affiliateHandle) return null;
    return { affiliate: byCode, price: CREATOR_CODE_PRICE };
}

export function creatorName(creator: Doc<'creators'>): string {
    return creator.affiliateDisplayName?.trim()
        || [creator.firstName, creator.lastName].filter(Boolean).join(' ').trim()
        || (creator.affiliateHandle ? `@${creator.affiliateHandle}` : 'Tendso creator');
}

/** The public face of a creator's fixed code offer: no contact or payout data. */
export function creatorCard(creator: Doc<'creators'>, _legacyPrice?: number) {
    const price = CREATOR_CODE_PRICE;
    const listPrice = WEBSITE_PRICE;
    const saving = Math.max(0, listPrice - price);
    const message = creator.affiliateMessage?.trim();
    const socialLinks = getAffiliateSocialLinks(creator.affiliateSocialLinks, creator.affiliateSocialLink);
    return {
        handle: creator.affiliateHandle!,
        name: creatorName(creator),
        photo: creator.affiliatePhoto ?? null,
        code: creator.referralCode ?? null,
        listPrice,
        price,
        saving,
        percentOff: saving > 0 ? Math.round((saving / listPrice) * 100) : 0,
        ...(message ? { message } : {}),
        ...(Object.keys(socialLinks).length > 0 ? { socialLinks } : {}),
    };
}

/**
 * Apply an attribution the person confirmed before their field-agent account
 * existed. Called from creators.create when no referral code was typed.
 */
export async function applyPendingAgentAttribution(ctx: Pick<MutationCtx, 'db'>, recruitId: Doc<'creators'>['_id']) {
    const recruit = await ctx.db.get(recruitId);
    if (!recruit) return;
    const pending = await ctx.db.query('creatorAttributions').withIndex('by_clerk_id', (q) => q.eq('clerkId', recruit.clerkId)).first();
    if (!pending || pending.kind !== 'agent' || pending.status !== 'pending') return;
    const recruiter = await ctx.db.get(pending.creatorId);
    if (!recruiter) {
        await ctx.db.patch(pending._id, { status: 'not_applied', reason: 'not_a_creator' });
        return;
    }
    const result = await attachRecruit(ctx, recruit, recruiter, pending.source);
    await ctx.db.patch(pending._id, result.ok
        ? { status: 'applied', appliedAt: Date.now(), reason: undefined }
        : { status: 'not_applied', reason: result.reason });
}
