import { ConvexError } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { internal } from '../_generated/api';
import { isComped } from '../../lib/pricing';

export const GIVEAWAY_CLOSED_MESSAGE = 'The free website giveaway is closed. You can still apply for a website at the regular price.';

export type GiveawayConfig = { enabled: boolean; cap: number; endsAt?: number };

/** Absent settings keep the giveaway off until an operator launches it. */
export function giveawayConfig(value: unknown): GiveawayConfig {
    if (!value || typeof value !== 'object') return { enabled: false, cap: 100 };
    const config = value as Partial<GiveawayConfig>;
    const validCap = Number.isSafeInteger(config.cap) && (config.cap ?? 0) > 0;
    const validEnd = config.endsAt === undefined || (Number.isFinite(config.endsAt) && config.endsAt >= 0);
    return {
        enabled: config.enabled === true && validCap && validEnd,
        cap: validCap ? config.cap! : 100,
        ...(validEnd && config.endsAt !== undefined ? { endsAt: config.endsAt } : {}),
    };
}

export function validateGiveawayConfig(value: unknown): GiveawayConfig {
    const config = value as Partial<GiveawayConfig> | null;
    if (!config || typeof config.enabled !== 'boolean' ||
        !Number.isSafeInteger(config.cap) || (config.cap ?? 0) <= 0 ||
        (config.endsAt !== undefined && (!Number.isFinite(config.endsAt) || config.endsAt < 0))) {
        throw new ConvexError('Giveaway settings need enabled (boolean), cap (a positive integer), and optionally endsAt (a timestamp in milliseconds).');
    }
    return giveawayConfig(config);
}

export function normalizeGiveawayPhone(phone: string): string {
    // /start accepts Philippine numbers: +63, a trunk 0, and local digits agree.
    return phone.replace(/\D/g, '').slice(-10);
}

export function normalizeGiveawayEmail(email: string): string {
    const [local, rawDomain] = email.trim().toLowerCase().split('@');
    const domain = rawDomain === 'googlemail.com' ? 'gmail.com' : rawDomain;
    const mailbox = local.split('+')[0];
    return `${domain === 'gmail.com' ? mailbox.replace(/\./g, '') : mailbox}@${domain}`;
}

/** Given sites still hold a slot. Rejected and deleted rows hold none. */
export async function readGiveaway(ctx: Pick<QueryCtx, 'db'>) {
    const setting = await ctx.db.query('settings').withIndex('by_key', (q) => q.eq('key', 'giveaway')).first();
    const config = giveawayConfig(setting?.value);
    // This indexed range is part of the mutation's read set. A concurrent insert,
    // rejection, deletion or comp conflicts and Convex retries the whole mutation.
    // Checking and inserting in one mutation prevents two last-slot reservations.
    const applications = await ctx.db.query('submissions')
        .withIndex('by_giveaway', (q) => q.eq('giveawayApplication', true))
        .collect();
    const active = applications.filter((submission) => submission.status !== 'rejected');
    const held = active.length;
    const given = active.filter(isComped).length;
    return {
        config,
        applications,
        held,
        given,
        slotsLeft: Math.max(0, config.cap - held),
        open: config.enabled && held < config.cap && (config.endsAt === undefined || Date.now() < config.endsAt),
    };
}

export function assertGiveawayIdentityAvailable(
    applications: ReadonlyArray<Doc<'submissions'>>,
    applicant: { ownerPhone: string; ownerEmail?: string; giveawayPhoneKey?: string; giveawayEmailKey?: string },
    excludeId?: Id<'submissions'>,
): void {
    const phones = new Set([normalizeGiveawayPhone(applicant.ownerPhone), applicant.giveawayPhoneKey].filter((key) => key !== undefined));
    const emails = new Set([applicant.ownerEmail ? normalizeGiveawayEmail(applicant.ownerEmail) : undefined, applicant.giveawayEmailKey].filter((key) => key !== undefined));
    if (applications.some((previous) => previous._id !== excludeId && previous.status !== 'rejected' && (
        (previous.giveawayPhoneKey !== undefined && phones.has(previous.giveawayPhoneKey)) || phones.has(normalizeGiveawayPhone(previous.ownerPhone)) ||
        (previous.giveawayEmailKey !== undefined && emails.has(previous.giveawayEmailKey)) ||
        (previous.ownerEmail !== undefined && emails.has(normalizeGiveawayEmail(previous.ownerEmail)))
    ))) {
        throw new ConvexError('A giveaway application already exists for this phone number or email address.');
    }
}

/** A rejected row lost its reservation; any restoration must reacquire it. */
export async function assertGiveawayCanActivate(ctx: MutationCtx, submission: Doc<'submissions'>): Promise<void> {
    if (!submission.giveawayApplication || submission.status !== 'rejected') return;
    const state = await readGiveaway(ctx);
    if (!state.open) throw new ConvexError(GIVEAWAY_CLOSED_MESSAGE);
    assertGiveawayIdentityAvailable(state.applications, submission, submission._id);
    if (state.held + 1 === state.config.cap) {
        await ctx.scheduler.runAfter(0, internal.discord.notifyGiveawayMilestone, {
            milestone: 'all_held', held: state.held + 1,
            given: state.given + (isComped(submission) ? 1 : 0), cap: state.config.cap,
        });
    }
    if (state.given === 99 && isComped(submission)) {
        await ctx.scheduler.runAfter(0, internal.discord.notifyGiveawayMilestone, {
            milestone: 'all_given', held: state.held + 1, given: 100, cap: state.config.cap,
        });
    }
}
