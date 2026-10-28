import { ConvexError, v } from 'convex/values';
import { internalMutation, mutation, query } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { internal } from './_generated/api';
import { WEBSITE_PRICE, commissionFor, domainAddOnFor } from '../lib/pricing';
import { BUSINESS_TYPES } from '../lib/prospectPrefill';
import { resolveSiteSlug } from '../lib/siteSlug';
import { needsCloudflareWorker, publishAddressFor } from '../lib/publish-target';
import { requireOwner, requireOwnerOfSubmission, linkOwnerToSubmission, ownerAppPublishBlockReason, resetOwnerApproval } from './lib/ownerAuth';
import { findActiveCreator } from './lib/creatorRecruits';
import { ownerCreatorCodeBlockReason, ownerCreatorIsSelf, savedOwnerCreatorCode } from './lib/ownerCreatorCode';
import {
    BUILD_ESTIMATE_MINUTES,
    BUILD_STEPS,
    BUILD_STEP_LABELS,
    EXTRA_QUESTION_INDEX,
    GUIDED_SHOT_COUNT,
    MAX_EXTRA_SHOTS,
    MIN_REAL_PHOTOS,
    OWNER_APP_QUESTIONS,
    OWNER_APP_SOURCE,
    computeOwnerPhase,
    isOwnerApp,
    isPaidInFull,
    publishPolicyFor,
} from './lib/ownerApp';

/**
 * Owner self-serve in the app (contentSource 'owner_app'). Contract:
 * docs/v2-api-owners.md.
 *
 *   createDraft → saveAnswer / saveShot / chooseDesign (/ updateDraft) → submit
 *   → (pipeline: buildProgress.setStep ×4) → getPreview → approvePreview
 *     or requestChange → ownerPayments.createPayToken → pay (Wise / Xendit)
 *   → publishIfReady (automatic) → live.
 *
 * Every function checks the signed-in owner is linked to the submission.
 * A confirmed active creator offer is snapshotted onto the order. Otherwise
 * attribution stays with the house (SELF_SERVE_CREATOR_ID) and payout is ₱0.
 */

function reject(message: string): never {
    throw new ConvexError(message);
}

const MAX_BUSINESS_NAME = 120;
const MAX_ADDRESS = 300;
const MAX_CITY = 120;
const MAX_ANSWER = 2000;
const MAX_LABEL = 80;
const MAX_CHOICE = 80;
const MAX_CHANGE_TEXT = 1000;
const MAX_OPEN_DRAFTS = 3;
const MAX_OPEN_CHANGES = 10;
const BUSINESS_TYPE_ALLOWLIST: ReadonlySet<string> = new Set(BUSINESS_TYPES);

// Submit throttle (a submit schedules paid AI work). Same table and window as /start.
const THROTTLE_WINDOW_MS = 24 * 60 * 60 * 1000;
const PER_OWNER_DAILY_SUBMITS = 3;
const GLOBAL_DAILY_SUBMITS = 50;

function cleanText(value: string | undefined, field: string, max: number): string | undefined {
    if (value === undefined) return undefined;
    const clean = value.trim();
    if (clean.length > max) reject(`${field} is too long.`);
    return clean;
}

function r2Prefix(): string {
    const r2 = process.env.R2_PUBLIC_URL;
    if (!r2) throw new Error('R2_PUBLIC_URL not configured');
    return r2.replace(/\/$/, '');
}

/** Media must be something we signed an upload for (api.r2.generateUploadUrl). */
function requireOurUpload(url: string): string {
    const clean = url.trim();
    if (!clean.startsWith(`${r2Prefix()}/`) || clean.length > 2048) reject('Please upload through the app.');
    return clean;
}

async function houseCreatorId(ctx: MutationCtx): Promise<Id<'creators'>> {
    const configured = process.env.SELF_SERVE_CREATOR_ID;
    if (!configured) throw new Error('SELF_SERVE_CREATOR_ID is not set on this Convex deployment.');
    const id = ctx.db.normalizeId('creators', configured);
    if (!id || !(await ctx.db.get(id))) throw new Error(`SELF_SERVE_CREATOR_ID (${configured}) does not match a creators row.`);
    return id;
}

async function requireDraft(ctx: MutationCtx, submissionId: Id<'submissions'>) {
    const found = await requireOwnerOfSubmission(ctx, submissionId);
    if (!isOwnerApp(found.submission)) reject('This website was made by a field agent.');
    if (found.submission.status !== 'draft') reject('This website is already sent.');
    return found;
}

async function openChangeCount(ctx: QueryCtx | MutationCtx, submissionId: Id<'submissions'>): Promise<number> {
    const rows = await ctx.db.query('changeRequests').withIndex('by_submission', (q) => q.eq('submissionId', submissionId)).collect();
    return rows.filter((r) => r.status === 'open').length;
}

/** One site, summarised for the owner's home (also used by owners.me). */
export async function siteSummary(ctx: QueryCtx | MutationCtx, submissionId: Id<'submissions'>) {
    const s = await ctx.db.get(submissionId);
    if (!s) return null;
    const website = await ctx.db.query('generatedWebsites')
        .withIndex('by_submissionId', (q) => q.eq('submissionId', submissionId)).first();
    const openChanges = await openChangeCount(ctx, submissionId);
    const total = s.amount ?? 0;
    const paidInFull = isPaidInFull(s);
    const amountPaid = s.amountPaid ?? (paidInFull ? total : 0);
    return {
        submissionId,
        businessName: s.businessName,
        businessType: s.businessType,
        contentSource: s.contentSource ?? null,
        publishPolicy: publishPolicyFor(s),
        status: s.status,
        phase: computeOwnerPhase(s, website, openChanges),
        publishedUrl: website?.status === 'published' && !website.offlineAt ? website.publishedUrl ?? null : null,
        total,
        amountPaid,
        balanceDue: paidInFull ? 0 : Math.max(0, total - amountPaid),
        paidInFull,
        openChangeRequests: openChanges,
        createdAt: s._creationTime,
    };
}

// ==================== DRAFT ====================

export const createDraft = mutation({
    args: {
        businessType: v.string(),
        businessName: v.string(),
        address: v.optional(v.string()),
        city: v.optional(v.string()),
        province: v.optional(v.string()),
        barangay: v.optional(v.string()),
        coordinates: v.optional(v.object({ lat: v.number(), lng: v.number() })),
        shotListKey: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const owner = await requireOwner(ctx);
        const businessName = cleanText(args.businessName, 'Shop name', MAX_BUSINESS_NAME);
        if (!businessName) reject('What is your shop called?');
        if (!BUSINESS_TYPE_ALLOWLIST.has(args.businessType)) reject('Please pick what you sell from the list.');
        if (args.coordinates && !validCoordinates(args.coordinates)) reject('That map pin is not valid.');

        const links = await ctx.db.query('websiteOwnerships').withIndex('by_owner', (q) => q.eq('businessOwnerId', owner._id)).collect();
        let drafts = 0;
        for (const link of links) {
            const s = await ctx.db.get(link.submissionId);
            if (s && s.status === 'draft' && isOwnerApp(s)) drafts++;
        }
        if (drafts >= MAX_OPEN_DRAFTS) reject('You already have a website in progress. Finish that one first.');

        const houseId = await houseCreatorId(ctx);
        const attribution = await ctx.db.query('creatorAttributions')
            .withIndex('by_clerk_id', q => q.eq('clerkId', owner.clerkId)).first();
        const suggestedOffer = attribution?.kind === 'owner' && attribution.status === 'applied'
            ? await findActiveCreator(ctx, attribution.handle, 'handle') : null;
        const offer = suggestedOffer && suggestedOffer.affiliate._id === attribution?.creatorId
            && !ownerCreatorIsSelf(owner, suggestedOffer.affiliate) ? suggestedOffer : null;
        const creatorId = offer?.affiliate._id ?? houseId;
        const submissionId = await ctx.db.insert('submissions', {
            creatorId,
            businessName,
            businessType: args.businessType,
            ownerName: owner.name ?? '',
            ownerPhone: owner.phone ?? '',
            ownerEmail: owner.email,
            address: cleanText(args.address, 'Address', MAX_ADDRESS) ?? '',
            city: cleanText(args.city, 'City', MAX_CITY) ?? '',
            province: cleanText(args.province, 'Province', MAX_CITY) || undefined,
            barangay: cleanText(args.barangay, 'Barangay', MAX_CITY) || undefined,
            coordinates: args.coordinates,
            shotListKey: cleanShotListKey(args.shotListKey),
            status: 'draft',
            contentSource: OWNER_APP_SOURCE,
            // Freeze an explicitly confirmed, active creator offer; otherwise use the house.
            amount: offer?.price ?? WEBSITE_PRICE,
            creatorPayout: offer ? commissionFor(offer.price) : 0,
            websiteListPrice: offer ? WEBSITE_PRICE : undefined,
            affiliateHandle: offer?.affiliate.affiliateHandle,
            submissionType: 'standard',
            domainStatus: 'not_requested',
            domainChargedPHP: 0,
        });
        await linkOwnerToSubmission(ctx, owner._id, submissionId);
        return submissionId;
    },
});

function validCoordinates(c: { lat: number; lng: number }): boolean {
    return Number.isFinite(c.lat) && Math.abs(c.lat) <= 90 && Number.isFinite(c.lng) && Math.abs(c.lng) <= 180;
}

/** The applied creator and immutable quote, plus whether checkout may still change it. */
export const creatorCode = query({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        const { submission } = await requireOwnerOfSubmission(ctx, args.submissionId);
        const reason = await ownerCreatorCodeBlockReason(ctx, submission);
        return { applied: await savedOwnerCreatorCode(ctx, submission), editable: !reason, reason, total: submission.amount ?? 0 };
    },
});

/** Apply/remove a real creator code on the linked owner's unpaid self-serve quote. */
export const applyCreatorCode = mutation({
    args: { submissionId: v.id('submissions'), code: v.union(v.string(), v.null()) },
    handler: async (ctx, args) => {
        const { owner, submission } = await requireOwnerOfSubmission(ctx, args.submissionId);
        const reason = await ownerCreatorCodeBlockReason(ctx, submission);
        if (reason) reject(reason);
        const offer = args.code === null ? null : await findActiveCreator(ctx, args.code, 'code');
        if (args.code !== null && !offer) reject('We could not find an active creator with that code.');
        if (offer && ownerCreatorIsSelf(owner, offer.affiliate, submission)) reject('You cannot use your own creator code.');
        const websitePrice = offer?.price ?? WEBSITE_PRICE;
        const creatorPayout = offer ? commissionFor(websitePrice) : 0;
        const addon = domainAddOnFor(submission.submissionType ?? 'standard', submission.domainCostPHP, submission.domainChargedPHP);
        const amount = websitePrice + addon;
        await ctx.db.patch(args.submissionId, {
            creatorId: offer?.affiliate._id ?? await houseCreatorId(ctx),
            affiliateHandle: offer?.affiliate.affiliateHandle,
            websiteListPrice: offer ? WEBSITE_PRICE : undefined,
            amount, creatorPayout, campaign: undefined,
            ...(submission.platformFee !== undefined ? { platformFee: websitePrice - creatorPayout } : {}),
            ...(submission.balanceDue !== undefined ? { balanceDue: amount } : {}),
        });
        // Per-order offers can change; the person's first identity attribution cannot.
        if (offer) {
            const existing = await ctx.db.query('creatorAttributions').withIndex('by_clerk_id', q => q.eq('clerkId', owner.clerkId)).first();
            if (!existing) await ctx.db.insert('creatorAttributions', {
                clerkId: owner.clerkId, creatorId: offer.affiliate._id, handle: offer.affiliate.affiliateHandle!,
                kind: 'owner', source: 'code', status: 'applied', createdAt: Date.now(), appliedAt: Date.now(),
            });
        }
        return savedOwnerCreatorCode(ctx, (await ctx.db.get(args.submissionId))!);
    },
});

function cleanShotListKey(key: string | undefined): string | undefined {
    if (key === undefined) return undefined;
    const clean = key.trim().toLowerCase();
    if (!/^[a-z0-9_-]{1,32}$/.test(clean)) reject('Unknown photo list.');
    return clean;
}

export const updateDraft = mutation({
    args: {
        submissionId: v.id('submissions'),
        businessType: v.optional(v.string()),
        businessName: v.optional(v.string()),
        address: v.optional(v.string()),
        city: v.optional(v.string()),
        province: v.optional(v.string()),
        barangay: v.optional(v.string()),
        coordinates: v.optional(v.object({ lat: v.number(), lng: v.number() })),
        shotListKey: v.optional(v.string()),
        ownerName: v.optional(v.string()),
        ownerPhone: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await requireDraft(ctx, args.submissionId);
        const patch: Partial<Doc<'submissions'>> = {};
        if (args.businessType !== undefined) {
            if (!BUSINESS_TYPE_ALLOWLIST.has(args.businessType)) reject('Please pick what you sell from the list.');
            patch.businessType = args.businessType;
        }
        if (args.businessName !== undefined) {
            const name = cleanText(args.businessName, 'Shop name', MAX_BUSINESS_NAME);
            if (!name) reject('What is your shop called?');
            patch.businessName = name;
        }
        if (args.address !== undefined) patch.address = cleanText(args.address, 'Address', MAX_ADDRESS) ?? '';
        if (args.city !== undefined) patch.city = cleanText(args.city, 'City', MAX_CITY) ?? '';
        if (args.province !== undefined) patch.province = cleanText(args.province, 'Province', MAX_CITY) || undefined;
        if (args.barangay !== undefined) patch.barangay = cleanText(args.barangay, 'Barangay', MAX_CITY) || undefined;
        if (args.coordinates !== undefined) {
            if (!validCoordinates(args.coordinates)) reject('That map pin is not valid.');
            patch.coordinates = args.coordinates;
        }
        if (args.shotListKey !== undefined) patch.shotListKey = cleanShotListKey(args.shotListKey);
        if (args.ownerName !== undefined) patch.ownerName = cleanText(args.ownerName, 'Your name', 120) ?? '';
        if (args.ownerPhone !== undefined) patch.ownerPhone = cleanText(args.ownerPhone, 'Phone number', 40) ?? '';
        await ctx.db.patch(args.submissionId, patch);
        return { ok: true };
    },
});

/**
 * Save (or replace) one interview answer. index 0-9 = the ten questions,
 * 10 = "Anything else?". Text, a recording (R2 URL from api.r2.generateUploadUrl),
 * or both. Pass neither to clear the answer.
 */
export const saveAnswer = mutation({
    args: {
        submissionId: v.id('submissions'),
        index: v.number(),
        lang: v.union(v.literal('en'), v.literal('tl')),
        answerText: v.optional(v.string()),
        mediaUrl: v.optional(v.string()),
        mediaType: v.optional(v.union(v.literal('video'), v.literal('audio'))),
        durationSec: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const { submission } = await requireDraft(ctx, args.submissionId);
        if (!Number.isInteger(args.index) || args.index < 0 || args.index > EXTRA_QUESTION_INDEX) reject('Unknown question.');
        const answerText = cleanText(args.answerText, 'Answer', MAX_ANSWER) || undefined;
        const mediaUrl = args.mediaUrl ? requireOurUpload(args.mediaUrl) : undefined;
        if (mediaUrl && !args.mediaType) reject('Is this a video or a voice recording?');
        const durationSec = args.durationSec !== undefined && Number.isFinite(args.durationSec) && args.durationSec >= 0
            ? Math.min(args.durationSec, 60 * 60) : undefined;
        const rest = (submission.ownerInterview ?? []).filter((a) => a.index !== args.index);
        const q = OWNER_APP_QUESTIONS[args.index];
        const next = answerText || mediaUrl
            ? [...rest, {
                index: args.index,
                questionEn: q.en,
                questionTl: q.tl,
                lang: args.lang,
                answerText,
                mediaUrl,
                mediaType: mediaUrl ? args.mediaType : undefined,
                durationSec,
                updatedAt: Date.now(),
            }]
            : rest;
        next.sort((a, b) => a.index - b.index);
        await ctx.db.patch(args.submissionId, { ownerInterview: next });
        return { answered: next.length };
    },
});

/** Save (or replace) one photo. Guided: index 0-9 in shot-list order. Extras: extra=true, index 0-9. */
export const saveShot = mutation({
    args: {
        submissionId: v.id('submissions'),
        index: v.number(),
        url: v.string(),
        label: v.optional(v.string()),
        extra: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const { submission } = await requireDraft(ctx, args.submissionId);
        const extra = args.extra === true;
        const max = extra ? MAX_EXTRA_SHOTS : GUIDED_SHOT_COUNT;
        if (!Number.isInteger(args.index) || args.index < 0 || args.index >= max) reject('Unknown photo.');
        const url = requireOurUpload(args.url);
        const label = cleanText(args.label, 'Label', MAX_LABEL) || undefined;
        const rest = (submission.ownerShots ?? []).filter((s) => !(s.index === args.index && s.extra === extra));
        const next = [...rest, { index: args.index, url, label, extra, updatedAt: Date.now() }]
            .sort((a, b) => Number(a.extra) - Number(b.extra) || a.index - b.index);
        await ctx.db.patch(args.submissionId, { ownerShots: next });
        return { photos: next.length };
    },
});

export const removeShot = mutation({
    args: { submissionId: v.id('submissions'), index: v.number(), extra: v.optional(v.boolean()) },
    handler: async (ctx, args) => {
        const { submission } = await requireDraft(ctx, args.submissionId);
        const extra = args.extra === true;
        const next = (submission.ownerShots ?? []).filter((s) => !(s.index === args.index && s.extra === extra));
        await ctx.db.patch(args.submissionId, { ownerShots: next });
        return { photos: next.length };
    },
});

/** The design the owner picked (template code, e.g. 'barbershop:BP'); up to three picks. */
export const chooseDesign = mutation({
    args: {
        submissionId: v.id('submissions'),
        templateId: v.string(),
        templateIds: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        const { submission } = await requireOwnerOfSubmission(ctx, args.submissionId);
        if (!isOwnerApp(submission)) reject('This website was made by a field agent.');
        if (submission.ownerApprovedAt) reject('You already said this site looks good.');
        const templateId = cleanChoice(args.templateId, 'Design');
        const picks = (args.templateIds ?? [templateId]).map((t) => cleanChoice(t, 'Design'));
        if (picks.length === 0 || picks.length > 3) reject('Pick one to three designs.');
        if (!picks.includes(templateId)) picks.unshift(templateId);
        await ctx.db.patch(args.submissionId, { templateId, templateIds: picks.slice(0, 3), styleUpdatedAt: Date.now() });
        return { ok: true };
    },
});

/** Font and colour, chosen later (any time before the site is published). */
export const setStyle = mutation({
    args: {
        submissionId: v.id('submissions'),
        fontChoice: v.optional(v.string()),
        colorChoice: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { submission } = await requireOwnerOfSubmission(ctx, args.submissionId);
        if (!isOwnerApp(submission)) reject('This website was made by a field agent.');
        const patch: Partial<Doc<'submissions'>> = { styleUpdatedAt: Date.now() };
        if (args.fontChoice !== undefined) patch.fontChoice = cleanChoice(args.fontChoice, 'Font');
        if (args.colorChoice !== undefined) patch.colorChoice = cleanChoice(args.colorChoice, 'Colour');
        await ctx.db.patch(args.submissionId, patch);
        return { ok: true };
    },
});

function cleanChoice(value: string, field: string): string {
    const clean = value.trim();
    if (!clean || clean.length > MAX_CHOICE || !/^[A-Za-z0-9 _:#.,()-]+$/.test(clean)) reject(`${field} is not valid.`);
    return clean;
}

// ==================== SUBMIT ====================

async function consumeSubmitThrottle(ctx: MutationCtx, ownerId: Id<'businessOwners'>) {
    const raw = Number(process.env.OWNER_APP_DAILY_LIMIT);
    const globalLimit = process.env.OWNER_APP_DAILY_LIMIT !== undefined && Number.isFinite(raw) && raw >= 0
        ? Math.floor(raw) : GLOBAL_DAILY_SUBMITS;
    const scopes = [
        { key: 'owner_app:global', limit: globalLimit },
        { key: `owner_app:${ownerId}`, limit: PER_OWNER_DAILY_SUBMITS },
    ];
    const now = Date.now();
    const rows: { row: Doc<'ownerIntakeThrottle'> | null; expired: boolean; key: string }[] = [];
    for (const scope of scopes) {
        const row = await ctx.db.query('ownerIntakeThrottle').withIndex('by_key', (q) => q.eq('key', scope.key)).first();
        const expired = !row || now - row.windowStart >= THROTTLE_WINDOW_MS;
        const count = row && !expired ? row.count : 0;
        if (count + 1 > scope.limit) reject("We're getting a lot of requests right now. Please try again later.");
        rows.push({ row, expired, key: scope.key });
    }
    for (const { row, expired, key } of rows) {
        if (!row) await ctx.db.insert('ownerIntakeThrottle', { key, count: 1, windowStart: now });
        else if (expired) await ctx.db.patch(row._id, { count: 1, windowStart: now });
        else await ctx.db.patch(row._id, { count: row.count + 1 });
    }
}

/**
 * Send the interview and photos: draft → 'submitted' (like /start), the four
 * build steps start 'pending', and the AI pipeline is kicked off
 * (internal.buildProgress.startPipeline). Idempotent for a double tap.
 */
export const submit = mutation({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        const { owner, submission } = await requireOwnerOfSubmission(ctx, args.submissionId);
        if (!isOwnerApp(submission)) reject('This website was made by a field agent.');
        if (submission.status !== 'draft') return { submissionId: args.submissionId, status: submission.status };

        if (!submission.businessName.trim()) reject('What is your shop called?');
        if (!submission.address.trim() && !submission.coordinates) reject('Where is your shop?');
        const interview = submission.ownerInterview ?? [];
        if (!interview.some((a) => a.answerText || a.mediaUrl)) reject('Please answer the questions first.');
        const shots = submission.ownerShots ?? [];
        const guided = shots.filter((s) => !s.extra).sort((a, b) => a.index - b.index);
        const extras = shots.filter((s) => s.extra).sort((a, b) => a.index - b.index);
        if (shots.length < MIN_REAL_PHOTOS) reject(`Please take at least ${MIN_REAL_PHOTOS} photos.`);

        await consumeSubmitThrottle(ctx, owner._id);

        const now = Date.now();
        const pending = { status: 'pending', updatedAt: now };
        const qa = interview
            .filter((a) => a.answerText)
            .map((a) => ({ q: a.questionEn, a: a.answerText! }));
        await ctx.db.patch(args.submissionId, {
            status: 'submitted',
            ownerName: submission.ownerName || owner.name || '',
            ownerPhone: submission.ownerPhone || owner.phone || '',
            ownerEmail: owner.email,
            // Existing readers (admin, Studio, generate route) read these two.
            photos: [...guided, ...extras].map((s) => s.url),
            interviewQa: qa.length > 0 ? qa : undefined,
            transcript: qa.length > 0 ? qa.map((p) => `Q: ${p.q}\nA: ${p.a}`).join('\n\n') : undefined,
            buildSteps: {
                reading_interview: pending,
                writing_pages: pending,
                polishing_photos: pending,
                building_site: pending,
            },
        });

        // Mirrors /start: a lead row and the submissions analytics.
        await ctx.db.insert('leads', {
            submissionId: args.submissionId,
            creatorId: submission.creatorId,
            source: 'direct',
            name: submission.ownerName || owner.name || owner.email,
            phone: submission.ownerPhone || owner.phone || '',
            email: owner.email,
            status: 'new',
            createdAt: now,
        });
        const today = new Date().toISOString().split('T')[0];
        for (const [period, periodType] of [[today, 'daily'], [today.substring(0, 7), 'monthly']] as const) {
            await ctx.scheduler.runAfter(0, internal.analytics.incrementStat, {
                creatorId: submission.creatorId, period, periodType, field: 'submissionsCount', delta: 1,
            });
        }

        await ctx.scheduler.runAfter(0, internal.buildProgress.startPipeline, { submissionId: args.submissionId });
        await ctx.scheduler.runAfter(0, internal.ownerEmails.send, { submissionId: args.submissionId, kind: 'building' });
        return { submissionId: args.submissionId, status: 'submitted' };
    },
});

// ==================== REVIEW ====================

/** "Looks good" on the private preview. Next step: pay (ownerPayments.createPayToken). */
export const approvePreview = mutation({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        const { submission } = await requireOwnerOfSubmission(ctx, args.submissionId);
        if (!isOwnerApp(submission)) reject('This website was made by a field agent.');
        if (!submission.previewReadyAt) reject('Your site is still being built.');
        if (await openChangeCount(ctx, args.submissionId)) reject('We are still working on your changes.');
        if (!submission.ownerApprovedAt) await ctx.db.patch(args.submissionId, { ownerApprovedAt: Date.now() });
        // Paid already (e.g. approve after a change): publish now.
        if (isPaidInFull(submission)) {
            await ctx.scheduler.runAfter(0, internal.ownerApp.publishIfReady, { submissionId: args.submissionId });
        }
        const next: 'publish' | 'pay' = isPaidInFull(submission) ? 'publish' : 'pay';
        return { next };
    },
});

/** "Ask for a change". Shows on the admin submission page. */
export const requestChange = mutation({
    args: { submissionId: v.id('submissions'), text: v.string() },
    handler: async (ctx, args) => {
        const { owner, submission } = await requireOwnerOfSubmission(ctx, args.submissionId);
        if (submission.status === 'draft') reject('Send your interview and photos first.');
        const text = args.text.trim();
        if (!text) reject('What should we change?');
        if (text.length > MAX_CHANGE_TEXT) reject('Please keep it shorter.');
        if ((await openChangeCount(ctx, args.submissionId)) >= MAX_OPEN_CHANGES) reject('We are still working on your last changes.');
        const id = await ctx.db.insert('changeRequests', {
            submissionId: args.submissionId,
            text,
            status: 'open',
            requestedBy: `owner:${owner._id}`,
            createdAt: Date.now(),
        });
        // A change means the owner checks again before publication.
        if (isOwnerApp(submission)) await resetOwnerApproval(ctx, args.submissionId);
        return id;
    },
});

// ==================== QUERIES ====================

/** The questions the app shows (EN + TL). index 10 is "Anything else?". */
export const interviewQuestions = query({
    args: {},
    handler: async () => OWNER_APP_QUESTIONS.map((q, index) => ({ index, en: q.en, tl: q.tl, extra: index === EXTRA_QUESTION_INDEX })),
});

/** Everything the app needs to resume a draft or show a site. */
export const getSubmission = query({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        const { submission: s } = await requireOwnerOfSubmission(ctx, args.submissionId);
        const summary = await siteSummary(ctx, args.submissionId);
        return {
            ...summary!,
            address: s.address,
            city: s.city,
            province: s.province ?? null,
            barangay: s.barangay ?? null,
            coordinates: s.coordinates ?? null,
            shotListKey: s.shotListKey ?? null,
            // lang / mediaType are stored as strings; saveAnswer only accepts these values.
            interview: (s.ownerInterview ?? []).map((a) => ({
                ...a,
                lang: (a.lang === 'tl' ? 'tl' : 'en') as 'en' | 'tl',
                mediaType: (a.mediaType === 'audio' || a.mediaType === 'video' ? a.mediaType : undefined) as 'audio' | 'video' | undefined,
            })),
            shots: s.ownerShots ?? [],
            templateId: s.templateId ?? null,
            templateIds: s.templateIds ?? [],
            fontChoice: s.fontChoice ?? null,
            colorChoice: s.colorChoice ?? null,
            ownerApprovedAt: s.ownerApprovedAt ?? null,
            previewReadyAt: s.previewReadyAt ?? null,
        };
    },
});

/** The build screen: four steps, phase, ~20 minutes. Subscribe with useQuery. */
export const getBuild = query({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        const { submission: s } = await requireOwnerOfSubmission(ctx, args.submissionId);
        const website = await ctx.db.query('generatedWebsites')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId)).first();
        const openChanges = await openChangeCount(ctx, args.submissionId);
        const steps = BUILD_STEPS.map((key) => {
            const st = s.buildSteps?.[key];
            return {
                key,
                label: BUILD_STEP_LABELS[key],
                status: (st?.status ?? 'pending') as 'pending' | 'running' | 'done' | 'failed',
                startedAt: st?.startedAt ?? null,
                finishedAt: st?.finishedAt ?? null,
                error: st?.error ?? null,
            };
        });
        return {
            phase: computeOwnerPhase(s, website, openChanges),
            steps,
            doneCount: steps.filter((x) => x.status === 'done').length,
            estimateMinutes: BUILD_ESTIMATE_MINUTES,
            buildStartedAt: s.buildStartedAt ?? null,
            previewReadyAt: s.previewReadyAt ?? null,
            openChangeRequests: openChanges,
        };
    },
});

/**
 * The private preview: a short-lived URL to the built HTML (not public, not
 * indexed). Before payment only the linked owner can get it.
 */
export const getPreview = query({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        const { submission: s } = await requireOwnerOfSubmission(ctx, args.submissionId);
        const website = await ctx.db.query('generatedWebsites')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId)).first();
        const live = website?.status === 'published' && !website.offlineAt;
        const htmlUrl = website?.htmlStorageId ? await ctx.storage.getUrl(website.htmlStorageId) : null;
        return {
            ready: !!s.previewReadyAt && !!website && (!!htmlUrl || !!website.htmlContent),
            htmlUrl,
            // Legacy rows keep inline HTML; the app can render it directly.
            inlineHtml: !htmlUrl && website?.htmlContent ? website.htmlContent : null,
            isLive: live,
            publishedUrl: live ? website?.publishedUrl ?? null : null,
        };
    },
});

// ==================== PUBLISH (pay-then-publish) ====================

async function uniqueSlug(ctx: MutationCtx, businessName: string, fallback: string): Promise<string> {
    const taken: string[] = [];
    for (let i = 0; i < 50; i++) {
        const candidate = resolveSiteSlug(businessName, taken, fallback);
        const clash = await ctx.db.query('generatedWebsites').withIndex('by_slug', (q) => q.eq('slug', candidate)).first();
        if (!clash) return candidate;
        taken.push(candidate);
    }
    return resolveSiteSlug(`${businessName}-${fallback}`, taken, fallback);
}

/**
 * Publish a paid owner-app site at <slug>.sites.tendso.com, the same writes
 * /api/publish-website makes for a standard site (slug once, generatedWebsites
 * published, submission.websiteUrl). Runs after a payment and after the build
 * finishes; whichever comes last publishes. No-op for field-agent sales (the
 * admin publishes those first), unpaid sites, unbuilt sites and live sites.
 * A site that needs a Cloudflare Worker (custom domain) is left for the admin.
 *
 * Does NOT set status 'deployed': the payment status (deposit_paid /
 * completed) is kept.
 */
export const publishIfReady = internalMutation({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args): Promise<{ published: boolean; reason: string; url?: string }> => {
        const s = await ctx.db.get(args.submissionId);
        if (!s) return { published: false, reason: 'not found' };
        if (publishPolicyFor(s) !== 'pay_then_publish') return { published: false, reason: 'publish_first source' };
        const blocked = await ownerAppPublishBlockReason(ctx, s);
        if (blocked) return { published: false, reason: blocked };
        const website = await ctx.db.query('generatedWebsites')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId)).first();
        if (!website || (!website.htmlStorageId && !website.htmlContent)) return { published: false, reason: 'not built' };
        if (website.status === 'published' && !website.offlineAt) return { published: false, reason: 'already live' };
        if (needsCloudflareWorker(website, s)) {
            await ctx.db.insert('auditLogs', {
                adminId: 'system:owner-app',
                action: 'manual_override',
                targetType: 'submission',
                targetId: args.submissionId,
                metadata: { reason: 'Paid owner-app site needs a Cloudflare Worker (custom domain). Publish it from admin.' },
                timestamp: Date.now(),
            });
            return { published: false, reason: 'needs admin publish' };
        }
        const slug = website.slug ?? await uniqueSlug(ctx, s.businessName, String(s._id));
        const url = publishAddressFor(website, slug);
        const now = Date.now();
        await ctx.db.patch(website._id, {
            status: 'published',
            publishedUrl: url,
            publishedAt: now,
            ...(website.slug ? {} : { slug }),
            offlineAt: undefined,
        });
        await ctx.db.patch(args.submissionId, { websiteUrl: url });
        await ctx.db.insert('auditLogs', {
            adminId: 'system:owner-app',
            action: 'website_deployed',
            targetType: 'website',
            targetId: String(website._id),
            metadata: { submissionId: args.submissionId, url, slug, policy: 'pay_then_publish' },
            timestamp: now,
        });
        if (!s.ownerLiveEmailSentAt) {
            await ctx.scheduler.runAfter(0, internal.ownerEmails.send, { submissionId: args.submissionId, kind: 'live' });
        }
        return { published: true, reason: 'published', url };
    },
});
