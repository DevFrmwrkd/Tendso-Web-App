import { ConvexError, v } from 'convex/values';
import { internalAction, mutation } from './_generated/server';
import type { MutationCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { internal } from './_generated/api';
import { campaignSellPrice, normalizeCampaign, ownerTotal, type SubmissionTier } from '../lib/pricing';
import { BUSINESS_TYPES } from '../lib/prospectPrefill';
import { BLOCKED_TLDS } from './lib/hostinger';
import { INTAKE_QUESTIONS, buildNarrativeFromQa, meetsAnswerMinimum } from '../lib/narrativeFromQa';
import type { IntakeQuestion, QaPair } from '../lib/narrativeFromQa';

/**
 * Owner-supplied intake — the /start funnel's single write.
 *
 * A business owner fills in their own details, types the 8-question interview
 * and uploads photos; the row lands in the existing /admin queue at
 * status:'submitted' and the admin does exactly what they do today. The human
 * removed from the pipeline is the field CREATOR, not the admin.
 *
 * WHY THIS MUTATION IS PUBLIC, AND MUST STAY PUBLIC. The obvious instinct is to
 * make it an internalMutation and front it with a Next route holding the secret.
 * That does not work: `fetchMutation` from 'convex/nextjs' types its first
 * argument as a PUBLIC function reference, so the wrapper cannot call an
 * internal one. And even if it could, the wrapper buys nothing real — /start is
 * an anonymous page, so the client already carries the deployment URL and can
 * call Convex directly. All a route adds is an IP-level speed bump the same
 * client can bypass. The defences that actually hold are below: server-side
 * revalidation of everything the client sent, a durable throttle read and
 * incremented in the same transaction as the insert, and an admin who reviews
 * 100% of these by hand before a peso changes direction.
 *
 * WHY IT INSERTS DIRECTLY instead of calling submissions.create + submit:
 * `submit` early-returns unless status is 'draft' (convex/submissions.ts:589),
 * so the pair would have to go through 'draft' — and a stray draft under the
 * house creator is exactly what getDraftByCreatorId hands back to the next
 * caller, with no business-name filter. `submit` also runs Outscraper prospect
 * reconciliation (:620-647), which is meaningless here: no owner-originated
 * submission has a scraped prospect behind it. Everything from `submit` that
 * DOES apply — the lead row, both analytics increments, the Studio render — is
 * mirrored below.
 */

/** Wall between "the owner can fix this" and "an operator must fix this".
 *  ConvexError messages reach the browser, so they carry the former only; the
 *  misconfiguration throws below use plain Error and live in the logs. */
function reject(message: string): never {
    throw new ConvexError(message);
}

// Length caps. Nothing here is a UX limit — the /start form is far tighter.
// These exist so a scripted caller cannot push a megabyte of text into a row
// that gets interpolated into Groq prompts and rendered into a live site.
const MAX_BUSINESS_NAME = 120;
const MAX_BUSINESS_TYPE = 80;
const MAX_OWNER_NAME = 120;
const MAX_OWNER_PHONE = 40;
const MAX_OWNER_EMAIL = 320; // RFC 5321 addr-spec maximum
const MAX_ADDRESS = 300;
const MAX_CITY = 120;
const MAX_PROVINCE = 120;
const MAX_BARANGAY = 120;
const MAX_POSTAL_CODE = 20;
/** Generous next to narrativeFromQa's own per-answer budget, which truncates
 *  long answers rather than rejecting them. This is the abuse ceiling. */
const MAX_ANSWER_CHARS = 2000;
/** RFC 1035's ceiling on a fully-qualified name, and the same cap
 *  /api/check-domain applies (app/api/check-domain/route.ts:33). */
const MAX_REQUESTED_DOMAIN = 253;
/** Per-label ceiling. No registry accepts more. */
const MAX_DOMAIN_LABEL = 63;

/** Mirrors the creator-side floor at convex/submissions.ts:592. */
const MIN_PHOTOS = 3;
/** Six roles exist (convex/hyperagent.ts:23); the tail is ignored, so anything
 *  past ten is a caller doing something other than filling in the form. */
const MAX_PHOTOS = 10;

/** Same shape as lib/security.ts's validateEmail. Restated rather than imported
 *  because that module runs a setInterval at import time for its rate limiter,
 *  which has no business executing inside the Convex runtime. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The business-type allowlist — the same table the /start <select> renders,
 * imported rather than restated. prospectPrefill.ts is safe here where
 * lib/security.ts is not: it has no imports and no module-level side effects.
 *
 * ALLOWLISTED, not merely length-capped, because this one string does two
 * things a free-text value must never do. It is interpolated verbatim into the
 * Groq copywriting prompt ("Business Type: ..." at
 * app/api/generate-website/route.ts:140), so anything the caller types is
 * instruction the copywriter reads. And it drives the compliance branches at
 * :123 and :161-167 — the beauty cluster and, more importantly, the YMYL gate
 * that tells the model "no medical claims" for clinics. A direct caller who can
 * pick their own string can steer the copy AND opt out of that guard. Rejecting
 * off-list values here mirrors how normalizeQa rejects questions outside
 * INTAKE_QUESTIONS: the <select> is UX, the mutation is the boundary.
 */
const BUSINESS_TYPE_ALLOWLIST: ReadonlySet<string> = new Set(BUSINESS_TYPES);

function requireText(value: string, field: string, max: number): string {
    const clean = (value ?? '').trim();
    if (clean.length === 0) reject(`${field} is required.`);
    if (clean.length > max) reject(`${field} must be ${max} characters or fewer.`);
    return clean;
}

/** Blank and absent collapse to undefined so an empty form field never lands in
 *  the row as '' — the address builders treat those as present. */
function optionalText(value: string | undefined, field: string, max: number): string | undefined {
    if (value === undefined) return undefined;
    const clean = value.trim();
    if (clean.length === 0) return undefined;
    if (clean.length > max) reject(`${field} must be ${max} characters or fewer.`);
    return clean;
}

/**
 * Resolve a submitted question back to its canonical entry, accepting either the
 * machine key or the display text — the same tolerance buildNarrativeFromQa
 * has, so the form may send whichever it holds.
 *
 * The pairs are then STORED with the canonical display text, never with what the
 * caller sent. That is what makes this local copy of the matching rule safe: the
 * narrative builder only ever sees text straight out of INTAKE_QUESTIONS, so the
 * two matchers cannot disagree about a stored row however either is reworded.
 */
function normalizeQuestion(q: string): string {
    return (q ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const QUESTION_LOOKUP: ReadonlyMap<string, IntakeQuestion> = new Map(
    INTAKE_QUESTIONS.flatMap((entry) => [
        [normalizeQuestion(entry.q), entry] as const,
        [normalizeQuestion(entry.key), entry] as const,
    ]),
);

/**
 * Revalidate the interview server-side and return it in canonical form.
 *
 * The /start form runs the same `meetsAnswerMinimum` check against the same
 * INTAKE_QUESTIONS table, so a normal owner never sees any of these. The point
 * is that the floor on the two load-bearing answers — the ONLY quality mechanism
 * on this funnel — is not enforced by the client alone.
 */
function normalizeQa(qa: Array<QaPair>): Array<QaPair> {
    const answers = new Map<string, string>();

    for (const pair of qa) {
        const question = QUESTION_LOOKUP.get(normalizeQuestion(pair.q));
        if (!question) reject(`"${pair.q}" is not one of the interview questions.`);
        const answer = pair.a.trim();
        if (answer.length > MAX_ANSWER_CHARS) {
            reject(`Your answer to "${question.q}" is too long — keep it under ${MAX_ANSWER_CHARS} characters.`);
        }
        // First non-blank wins, matching buildNarrativeFromQa. A duplicated
        // question is a form bug, not a second opinion.
        if (answer.length > 0 && !answers.has(question.key)) answers.set(question.key, answer);
    }

    // Walk the canonical list, not the submitted array: a missing question has
    // to fail the same way a blank one does.
    const normalized: Array<QaPair> = [];
    for (const question of INTAKE_QUESTIONS) {
        const answer = answers.get(question.key) ?? '';
        if (!meetsAnswerMinimum(question, answer)) {
            reject(
                question.minChars
                    ? `Please give a bit more detail on "${question.q}" — at least ${question.minChars} characters.`
                    : `Please answer "${question.q}".`,
            );
        }
        if (answer.length > 0) normalized.push({ q: question.q, a: answer });
    }
    return normalized;
}

/**
 * Photos, in ROLE ORDER. The mapping at convex/hyperagent.ts:85-88 is purely
 * positional against PHOTO_ROLES = ['headshot','interior_1','interior_2',
 * 'exterior','product_1','product_2'], so index IS meaning.
 *
 * Index 0 — the optional owner portrait — may therefore be an EMPTY STRING, and
 * a skipped portrait must never be compacted away: dropping it would slide
 * interior_1 into the headshot slot and every other role down with it. Verified
 * an empty string is inert on both consumers:
 *   • hyperagent (:90-101) — '' is not http and does not match the R2 path
 *     regex, so it falls to ctx.storage.getUrl(''), whose failure is caught at
 *     :98 and leaves url null; nothing is pushed, and `i` still advances, so
 *     interior_1 keeps index 1.
 *   • the generate route — isValidImageUrl('') is falsy at :489 and :513, and
 *     the storage-id split at :490 / :514 filters on `id &&`, so '' is dropped
 *     by both branches rather than being resolved.
 */
function normalizePhotos(photos: Array<string>, r2PublicPrefix: string): Array<string> {
    if (photos.length > MAX_PHOTOS) reject(`Please upload no more than ${MAX_PHOTOS} photos.`);

    const normalized = photos.map((photo) => photo.trim());

    // Count REAL photos, not array slots — otherwise a caller could clear the
    // floor with three empty placeholders.
    if (normalized.filter((photo) => photo.length > 0).length < MIN_PHOTOS) {
        reject(`At least ${MIN_PHOTOS} photos are required.`);
    }

    for (let i = 0; i < normalized.length; i++) {
        const photo = normalized[i];
        // Only the portrait slot may be blank; a hole anywhere else means the
        // client compacted or mis-ordered the array and the roles are already
        // wrong — better to reject than to publish a storefront as a headshot.
        if (photo.length === 0) {
            if (i === 0) continue;
            reject('Photos must be sent in slot order, with only the portrait left blank.');
        }
        // Everything must be an object WE minted a presigned PUT for. Without
        // this the owner picks the URLs that get fetched server-side, rendered
        // into a live site, and handed to the Studio agent.
        if (!photo.startsWith(`${r2PublicPrefix}/`)) {
            reject('Photos must be uploaded through this form.');
        }
    }

    return normalized;
}

/**
 * The registrable name pattern.
 *
 * Character-for-character the expression convex/domains.ts:89 re-checks before
 * anything is bought, except that the TLD is additionally capped at 24 (the
 * longest one that exists). Deliberately a SUBSET: a name that clears this
 * cannot then be rejected as malformed downstream, which is the whole point of
 * validating a string whose next reader is a registrar API.
 *
 * One leading label, then one or more letters-only suffixes — so `alingnena.com`
 * and `alingnena.com.ph` both pass, `alingnena.c` and `aling nena.com` do not.
 */
const DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z]{2,24})+$/;

/**
 * The domain the owner asked for, in the exact form a registrar would be handed.
 *
 * AVAILABILITY IS NOT CHECKED HERE, on purpose: /api/check-domain requires a
 * logged-in user (app/api/check-domain/route.ts:19) and an owner has no account.
 * The admin confirms the name is free during the review they already do, before
 * the payment email goes out. So what lands in the row is a REQUEST, not a
 * promise — and nothing registers it until an admin has acted (see the pipeline
 * note on submissionType in the insert below).
 *
 * What this DOES enforce is shape, because if the request is ever honoured this
 * exact string is what convex/domains.ts hands to Hostinger with a saved card.
 */
function normalizeRequestedDomain(raw: string): string {
    // Case carries no meaning in DNS and a phone keyboard capitalises the first
    // letter of a text field by default, so this one is silently corrected.
    // Everything below rejects instead: the rest of the string is the owner's
    // intent and is not ours to guess at.
    const domain = (raw ?? '').trim().toLowerCase();

    if (domain.length === 0) reject('Please type the web address you want.');
    if (domain.length > MAX_REQUESTED_DOMAIN) reject('That web address is too long.');
    // Checked before the pattern so the two most common paste-ins get a message
    // that says what to remove rather than the generic "that doesn't look like".
    if (domain.includes('/')) {
        reject('Just the address itself, please — no https:// and no slashes. For example: alingnena.com');
    }
    // www.alingnena.com is a host INSIDE alingnena.com, not something anyone can
    // register; sent as-is it fails at the registrar after the owner has paid.
    // Only this prefix is rejected — a three-part name is otherwise perfectly
    // ordinary here (alingnena.com.ph), and telling those apart needs a public
    // suffix list, which is exactly the judgement the admin's availability check
    // already makes.
    if (domain.startsWith('www.')) {
        reject('Leave the "www." off — we set that up for you. For example: alingnena.com');
    }
    if (!DOMAIN_PATTERN.test(domain)) {
        reject(
            'That does not look like a web address. Use letters, numbers and dashes, ' +
            'ending in .com or similar — for example alingnena.com',
        );
    }
    if (domain.split('.').some((label) => label.length > MAX_DOMAIN_LABEL)) {
        reject('That web address is too long — keep each part under 63 characters.');
    }
    // Reject here rather than at purchase time. BLOCKED_TLDS is checked inside
    // registrarCheckAvailability (convex/lib/hostinger.ts:158), which does not
    // run until AFTER the owner has been billed ₱1,499 — at which point the
    // domain simply can never be bought and someone has to unpick a paid sale.
    // .ph is on that list today (~$50/yr, well over the ₱500 the tier collects),
    // and .ph is the single most natural choice for a Filipino shop, so this is
    // the likeliest wrong turn on the whole funnel. Imported, not restated: the
    // list is env-overridable at runtime and a second copy would drift.
    const tld = domain.slice(domain.lastIndexOf('.') + 1);
    if (BLOCKED_TLDS.includes(tld)) {
        reject(
            `We can't register .${tld} addresses at this price — they cost far more than the ` +
            'add-on covers. Try .com, or pick the free address option and message us about .' +
            `${tld} separately.`,
        );
    }

    return domain;
}

/**
 * ---- THROTTLE ------------------------------------------------------------
 *
 * Every SUCCESSFUL call here spends: it schedules a paid Hyperagent render, and
 * it adds a permanent row that api.submissions.getAllWithCreator re-reads with
 * an unbounded `.collect()` (plus a db.get per row) on every /admin load. Left
 * open, a loop does not just burn the render budget — once the table is large
 * enough that query blows Convex's per-query document limit and /admin, the
 * admin's only queue, stops loading for CREATOR submissions too. That is the
 * failure worth preventing, so the ceiling is deliberately low.
 *
 * BUT BE HONEST ABOUT WHAT THIS DOES NOT COVER. This throttle caps THIS door,
 * not the room. `submissions.create` (convex\submissions.ts:307) is also a
 * public mutation with no ctx.auth check, and `creators.getAll`
 * (convex\creators.ts:151) is a public query that hands out valid creator ids —
 * so the row-flooding half of the failure above is still reachable by anyone
 * with the deployment URL, throttle or no throttle. What this table genuinely
 * protects is the PAID RENDER, which only this mutation schedules. Closing the
 * other door is plan item P1.4 (auth-gate the 11 ungated public mutations in
 * submissions.ts); it is pre-existing and predates owner intake.
 *
 * The counters live in the `ownerIntakeThrottle` table and are read, checked and
 * incremented inside this mutation's transaction — Convex serializes conflicting
 * transactions, so two concurrent calls cannot both read the same count and both
 * pass. This is the same shared-document write conflict the house-creator
 * counter is deliberately NOT taking (step 7 below); here the serialization IS
 * the point.
 *
 * Raise them here — these three constants are the only place the numbers live
 * (the global one also takes a no-deploy env override, see globalDailyLimit).
 * Launch expects single-digit real submissions a day; the global figure is
 * roughly 3x that, so a normal week never touches it.
 */
const THROTTLE_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Per submitter. Room for an owner who mistypes something, re-does the whole
 *  form, and still wants a third go. */
const PER_SUBMITTER_DAILY_LIMIT = 3;
/** Across ALL submitters. Also the kill switch — see globalDailyLimit(). */
const GLOBAL_DAILY_LIMIT = 25;
/** The owner is not the attacker and cannot act on a limit they didn't hit, so
 *  this says nothing about which limit stopped them. */
const THROTTLE_MESSAGE = "We're getting a lot of requests right now — please try again later.";

/**
 * The global ceiling, overridable per deployment.
 *
 * The constant is the default; OWNER_INTAKE_DAILY_LIMIT overrides it. Convex env
 * vars are editable from the dashboard, so setting it to 0 closes /start
 * platform-wide in seconds WITHOUT a deploy — the intended response to spam at
 * 2am. A garbled value must not silently become that kill switch, so it falls
 * back to the constant and shouts in the logs.
 */
function globalDailyLimit(): number {
    const raw = process.env.OWNER_INTAKE_DAILY_LIMIT;
    if (raw === undefined || raw.trim().length === 0) return GLOBAL_DAILY_LIMIT;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
        console.error(
            `[owner-intake] OWNER_INTAKE_DAILY_LIMIT="${raw}" is not a non-negative number — ` +
            `falling back to ${GLOBAL_DAILY_LIMIT}.`,
        );
        return GLOBAL_DAILY_LIMIT;
    }
    return Math.floor(parsed);
}

/**
 * Per-submitter scope keys.
 *
 * Being honest about what these buy: a Convex mutation has no IP and this page
 * has no auth, so every field the key can be built from is one the caller typed.
 * A determined attacker rotates the email and the phone together and gets a
 * fresh bucket every time — only the global ceiling stops them, which is why
 * that one is set where the damage is affordable rather than where the traffic
 * is expected.
 *
 * What these DO buy is the far more likely case: a double-click, a stuck retry
 * loop, a naive script reusing one identity. Without them a single such caller
 * eats the global ceiling and locks every real owner out for the rest of the
 * day. Normalizing kills the laziest rotations — +tags and Gmail dots on one
 * mailbox, and the +63/0/bare spellings of one number.
 *
 * Business name was considered as a third key and rejected: varying it is as
 * cheap as varying the email, so it raises no attacker cost, while two shops
 * that genuinely share a name (every "Aling Nena Sari-Sari Store" in the
 * country) would collide for real.
 */
function emailThrottleKey(email: string): string {
    const lower = email.toLowerCase();
    const at = lower.lastIndexOf('@');
    const local = lower.slice(0, at).split('+')[0].replace(/\./g, '');
    return `email:${local}@${lower.slice(at + 1)}`;
}

/** Last 10 digits — the same shape prospectPrefill.toLocalPhDigits produces, so
 *  '+63 917…', '0917…' and '917…' are one submitter. */
function phoneThrottleKey(phone: string): string {
    return `phone:${phone.replace(/\D/g, '').slice(-10)}`;
}

interface ThrottleScope {
    key: string;
    limit: number;
}

/**
 * Read-check-increment every scope, in the caller's transaction.
 *
 * All scopes are checked before any is written, and a reject() anywhere rolls
 * the whole mutation back — so a caller who fails validation, or who is stopped
 * by a later scope, never consumes quota. Only a submission that is about to
 * become real counts.
 *
 * Row growth is bounded by the ceiling itself: a per-submitter row is only
 * written on a success, and successes are capped per window.
 */
async function consumeThrottle(ctx: MutationCtx, scopes: ReadonlyArray<ThrottleScope>): Promise<void> {
    const now = Date.now();
    const pending: Array<{ row: Doc<'ownerIntakeThrottle'> | null; expired: boolean }> = [];

    for (const scope of scopes) {
        const row = await ctx.db
            .query('ownerIntakeThrottle')
            .withIndex('by_key', (q) => q.eq('key', scope.key))
            .first();
        const expired = !row || now - row.windowStart >= THROTTLE_WINDOW_MS;
        const count = row && !expired ? row.count : 0;
        // `count + 1 > limit`, not `count >= limit`: a limit of 0 has to reject
        // the very first call, which is what makes the ceiling a kill switch.
        if (count + 1 > scope.limit) reject(THROTTLE_MESSAGE);
        pending.push({ row, expired });
    }

    for (let i = 0; i < scopes.length; i++) {
        const { row, expired } = pending[i];
        if (!row) {
            await ctx.db.insert('ownerIntakeThrottle', { key: scopes[i].key, count: 1, windowStart: now });
        } else if (expired) {
            // The window rolls from the first success in it, not from midnight —
            // the same fixed-window shape knowledge.consumeRateLimit uses.
            await ctx.db.patch(row._id, { count: 1, windowStart: now });
        } else {
            await ctx.db.patch(row._id, { count: row.count + 1 });
        }
    }
}

export const submitOwnerIntake = mutation({
    args: {
        // Business basics. Same names as submissions.create so the row is
        // indistinguishable downstream.
        businessName: v.string(),
        businessType: v.string(),
        ownerName: v.string(),
        ownerPhone: v.string(),
        // REQUIRED here, unlike the creator funnel where it is optional and
        // labelled as such: /api/send-website-email 400s without it (:44-46) and
        // the 72h follow-up cron filters on it (convex/followUp.ts:52). With no
        // creator standing in the shop, it is the only channel back to the owner.
        ownerEmail: v.string(),
        address: v.string(),
        city: v.string(),
        province: v.optional(v.string()),
        barangay: v.optional(v.string()),
        postalCode: v.optional(v.string()),
        // Captured from the browser geolocation prompt when the owner allows it.
        // Saves lib/astro-builder.ts:309 a Nominatim round-trip inside the
        // 60-second build budget.
        coordinates: v.optional(v.object({ lat: v.number(), lng: v.number() })),
        qa: v.array(v.object({ q: v.string(), a: v.string() })),
        photos: v.array(v.string()),
        // Drives the product_1 / product_2 roles at hyperagent.ts:87. The creator
        // funnel never writes it, so convex/airtable.ts:214 guesses from
        // photos.length > 4; the owner is simply asked.
        hasProducts: v.boolean(),
        // Tier, chosen at the confirm step of /start. Same literals as
        // submissions.setDomainTier (:499) because the fields they end up in are
        // the same ones. OPTIONAL, and absent means 'standard': a draft saved by
        // a build that predates the choice is still sitting in someone's
        // localStorage, and it must submit as the ₱999 it was quoted rather than
        // fail at the last tap of a ten-minute form.
        submissionType: v.optional(v.union(v.literal('standard'), v.literal('with_custom_domain'))),
        requestedDomain: v.optional(v.string()),
        // The campaign that priced this sale, and the placement that sent them.
        // Both arrive from the browser, so NEITHER is trusted: the campaign is
        // resolved against the ones we actually run and the price is worked out
        // here, and the source is only ever stored and counted. A price posted
        // from the client would let anyone name their own.
        campaign: v.optional(v.string()),
        source: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // ---- 1. Revalidate everything. The client is a stranger. ----------
        const businessName = requireText(args.businessName, 'Business name', MAX_BUSINESS_NAME);
        const businessType = requireText(args.businessType, 'Business type', MAX_BUSINESS_TYPE);
        // The cap above is the backstop; THIS is the boundary. See
        // BUSINESS_TYPE_ALLOWLIST — the value reaches a model prompt verbatim
        // and switches the YMYL guard.
        if (!BUSINESS_TYPE_ALLOWLIST.has(businessType)) {
            reject('Please pick your business type from the list.');
        }
        const ownerName = requireText(args.ownerName, 'Your name', MAX_OWNER_NAME);
        const ownerPhone = requireText(args.ownerPhone, 'Phone number', MAX_OWNER_PHONE);
        const address = requireText(args.address, 'Address', MAX_ADDRESS);
        const city = requireText(args.city, 'City', MAX_CITY);

        const ownerEmail = requireText(args.ownerEmail, 'Email address', MAX_OWNER_EMAIL);
        if (!EMAIL_PATTERN.test(ownerEmail)) reject('That email address does not look right.');

        // Non-finite or out-of-range coordinates would survive v.number() and
        // then poison the map embed and the LocalBusiness structured data.
        const { coordinates } = args;
        if (coordinates) {
            const inRange =
                Number.isFinite(coordinates.lat) && Math.abs(coordinates.lat) <= 90 &&
                Number.isFinite(coordinates.lng) && Math.abs(coordinates.lng) <= 180;
            if (!inRange) reject('Those map coordinates are not valid.');
        }

        // The only money decision on this form. Everything else about the tier —
        // what it costs, what it buys — is settled by lib/pricing; all this line
        // does is read which of the two the owner picked.
        const submissionType: SubmissionTier = args.submissionType ?? 'standard';
        const wantsCustomDomain = submissionType === 'with_custom_domain';
        // Only read on the tier that uses it. A domain left over in the client's
        // draft from a tier the owner then switched away from is ignored, exactly
        // as setDomainTier ignores it (convex/submissions.ts:541).
        const requestedDomain = wantsCustomDomain
            ? normalizeRequestedDomain(args.requestedDomain ?? '')
            : undefined;

        // Same source of truth r2.ts signs uploads against (getPublicUrlPrefix),
        // read the same way, trailing slash and all.
        const r2PublicUrl = process.env.R2_PUBLIC_URL;
        if (!r2PublicUrl) throw new Error('R2_PUBLIC_URL not configured');
        const photos = normalizePhotos(args.photos, r2PublicUrl.replace(/\/$/, ''));

        const interviewQa = normalizeQa(args.qa);

        // Resolved against the campaigns we run, so an invented one prices at
        // full price rather than failing the submission. The source is a label
        // for counting, capped and stripped of anything that is not a plain tag.
        const campaign = normalizeCampaign(args.campaign);
        const source = (args.source ?? '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40) || null;

        // ---- 2. The house creator. Never fall back. -----------------------
        // Attribution for every owner-originated submission. Seeded once per
        // deployment by seed/houseCreator:seedHouseCreator; the id it returns
        // goes in this env var. There is deliberately no default: guessing a
        // creator here would silently book a real person as the author of a
        // stranger's business, and (via creatorPayout) a payable to go with it.
        const configuredCreatorId = process.env.SELF_SERVE_CREATOR_ID;
        if (!configuredCreatorId) {
            throw new Error(
                'SELF_SERVE_CREATOR_ID is not set on this Convex deployment. ' +
                'Run `npx convex run seed/houseCreator:seedHouseCreator` and store the returned _id.',
            );
        }
        // normalizeId rather than a bare cast: a stale or hand-typed value must
        // fail here with this message, not deep inside db.get.
        const creatorId = ctx.db.normalizeId('creators', configuredCreatorId);
        if (!creatorId || !(await ctx.db.get(creatorId))) {
            throw new Error(
                `SELF_SERVE_CREATOR_ID (${configuredCreatorId}) does not match a creators row on this deployment. ` +
                'Re-run seed/houseCreator:seedHouseCreator — the id differs between dev and prod.',
            );
        }

        // ---- 3. The transcript the copy generators actually need. ---------
        // Three of the four Groq branches in app/api/generate-website/route.ts
        // are hard-gated on this string being truthy (:135, :254, :296). Without
        // it the route writes tagline/about/services from name + type + city and
        // invents the rest.
        const transcript = buildNarrativeFromQa(interviewQa);

        // ---- 4. Throttle. Read-check-increment, in this transaction. ------
        // The last gate before anything is written. Everything above this line
        // only read or rejected, so a caller sending garbage — or one hitting a
        // scope further down this list — burns no quota; the counters move only
        // for a submission that is one line away from being real.
        await consumeThrottle(ctx, [
            // Global first: when the ceiling is 0 the funnel is closed, and
            // there is no reason to touch the per-submitter rows to find out.
            { key: 'global', limit: globalDailyLimit() },
            { key: emailThrottleKey(ownerEmail), limit: PER_SUBMITTER_DAILY_LIMIT },
            { key: phoneThrottleKey(ownerPhone), limit: PER_SUBMITTER_DAILY_LIMIT },
        ]);

        // ---- 5. The row. -------------------------------------------------
        const submissionId: Id<'submissions'> = await ctx.db.insert('submissions', {
            creatorId,
            businessName,
            businessType,
            ownerName,
            ownerPhone,
            ownerEmail,
            address,
            city,
            province: optionalText(args.province, 'Province', MAX_PROVINCE),
            barangay: optionalText(args.barangay, 'Barangay', MAX_BARANGAY),
            postalCode: optionalText(args.postalCode, 'Postal code', MAX_POSTAL_CODE),
            coordinates,
            hasProducts: args.hasProducts,
            photos,
            transcript,
            interviewQa,
            // Never 'draft'. Under the house creator a stray draft is inert in
            // the sense that nobody can log in as that row — but
            // getDraftByCreatorId returns a creator's newest draft with NO
            // business filter, and app/submit/info/page.tsx:87-91 documents that
            // it "patches whatever it hands back". One owner's shop overwriting
            // another's is a one-line mistake away.
            status: 'submitted',
            // ₱999, or ₱1,499 when the owner asked for their own domain. Same
            // function the creator path bills through — the flat
            // CUSTOM_DOMAIN_ADDON, because no real registrar quote exists at
            // intake (nobody is logged in to fetch one) and the admin re-prices
            // through the existing domain flow if the real one differs.
            //
            // A campaign takes its percentage off the WEBSITE half only, which is
            // what `campaignSellPrice` returns; the domain stays at cost because
            // we buy it from a registrar. With the OTR campaign that is ₱699, or
            // ₱1,199 with a domain.
            amount: ownerTotal(campaignSellPrice(campaign), submissionType),
            campaign: campaign ?? undefined,
            source: source ?? undefined,
            // EXPLICIT ₱0. There is no creator to pay: creditCreatorForPayment
            // books this straight onto the attributed creator's balance at
            // payment time, and on this path that is the house row.
            // Because this is a direct db.insert, the 0 is simply written — the
            // `args.creatorPayout ?? commissionFor(BASE_PRICE)` default at
            // convex/submissions.ts:369 is never consulted from here. That
            // default only becomes load-bearing if anyone ever refactors this
            // insert into a submissions.create call, at which point it must stay
            // `??` and not `||`, or every owner sale silently re-acquires a ₱500
            // liability.
            creatorPayout: 0,
            // ---- The custom-domain tier, written here rather than through
            // submissions.setDomainTier. Same fields and same values that
            // mutation would produce (convex/submissions.ts:530-543; see the
            // domainCostPHP note below for the one exception). It is NOT CALLED
            // because it is a public ungated mutation that re-reads the creator
            // to clamp a sell price and re-derives creatorPayout from it — on
            // this path that would book a ₱500 payable onto the house row and
            // undo the explicit 0 above.
            //
            // These two fields are the ONLY thing that makes convex/payments.ts
            // :127 schedule domains.setupForSubmission, which registers a real
            // domain on a saved card. Nothing here can reach that on its own: it
            // needs an admin to have approved, published (setupForSubmission
            // returns early without a Cloudflare Pages project, :651-657) and
            // sent the payment email that mints the token, and then the owner to
            // have actually paid. That pipeline DOES price-check before it buys:
            // setupForSubmission step 1c (domains.ts:685-786) refuses anything
            // over the automatic ceiling on this path. It still never consults
            // checkDomainAvailability's `withinBudget` (domains.ts:110-111).
            submissionType,
            requestedDomain,
            domainStatus: wantsCustomDomain ? 'pending_payment' : 'not_requested',
            // domainCostPHP is setDomainTier's fifth field and is DELIBERATELY
            // left unset here. It is a quote there, but the schema (:176) and
            // domains.getTotalHostingerDomainCostsPHP (:306) both treat it as
            // money the platform has ALREADY paid Hostinger, and that query sums
            // every row with a value regardless of domainStatus. Writing ₱500 at
            // intake would book a registrar bill for a domain nobody has bought
            // — on a self-serve funnel that, by design, produces requests that
            // are never paid for. Nothing needs it: every reader falls back to
            // the flat CUSTOM_DOMAIN_ADDON when it is absent (the payment email
            // at lib/email/templates.ts:239, the earnings table at
            // convex/submissions.ts:234), so the ₱1,499 breakdown the owner sees
            // is identical either way. domains.setRegistrarMetadata writes the
            // real figure at the moment the domain is genuinely charged.
            airtableSyncStatus: 'pending_push',
            contentSource: 'owner_intake',
        });

        // ---- 6. Lead row. -------------------------------------------------
        // Mirrors submissions.ts:648-659. The prospect-reconciliation branch
        // above it is skipped outright: an owner-originated submission has no
        // scraped Outscraper prospect to convert.
        await ctx.db.insert('leads', {
            submissionId,
            creatorId,
            source: 'direct',
            name: ownerName,
            phone: ownerPhone,
            email: ownerEmail,
            status: 'new',
            createdAt: Date.now(),
        });

        // ---- 7. Analytics, daily + monthly. -------------------------------
        // Unchanged from submissions.ts:661-677 and correct by construction:
        // creatorId is a real creators id. Owner volume aggregates under the
        // house row, isolated from every real creator's dashboard.
        const today = new Date().toISOString().split('T')[0];
        const month = today.substring(0, 7);
        await ctx.scheduler.runAfter(0, internal.analytics.incrementStat, {
            creatorId,
            period: today,
            periodType: 'daily',
            field: 'submissionsCount',
            delta: 1,
        });
        await ctx.scheduler.runAfter(0, internal.analytics.incrementStat, {
            creatorId,
            period: month,
            periodType: 'monthly',
            field: 'submissionsCount',
            delta: 1,
        });

        // Deliberately NOT patching the house creator's submissionCount /
        // lastActiveAt the way submissions.create does. Every owner submission
        // shares this one document, so the counter would serialize concurrent
        // intakes behind a write conflict on a number nobody reads.

        // ---- 8. Tendso Studio image render. -------------------------------
        // Same call submissions.ts:681-683 makes. THIS IS THE ONE PLACE ON THE
        // OWNER PATH THAT SPENDS MONEY WITHOUT A HUMAN IN FRONT OF IT — a
        // stranger's form submission triggers a paid render. It fires anyway
        // because the scope rule is "the admin does the same work as today", and
        // an admin who forgets the Enhance Images button ships raw phone photos,
        // which is the product's most visible quality axis.
        //
        // What makes that affordable is step 4: this line cannot run more often
        // than the throttle lets a submission through, so the worst case is a
        // bounded number of wasted renders a day and never a runaway bill. If
        // that bound ever needs to be zero for a while, set the
        // OWNER_INTAKE_DAILY_LIMIT env var to 0 — no deploy, and it closes the
        // whole funnel rather than just this call.
        //
        // The permanent reversal is deleting this single schedule call: the admin's
        // existing Enhance Images button covers it, and that button is enabled
        // for owner rows precisely because we synthesized a transcript above
        // (TopActionBar.tsx:108-109 gates canEnhance on hasTranscript). Flip it
        // the day spam appears.
        await ctx.scheduler.runAfter(0, internal.hyperagent.triggerStudioRender, {
            submissionId,
        });

        // ---- 9. "We've got it." -------------------------------------------
        // Closes the silence between this moment and the payment email, which
        // cannot fire until the admin has reviewed, generated, picked a
        // template, approved and published. Scheduled rather than awaited, so a
        // Resend outage can never fail the submission the owner just spent ten
        // minutes on — the action swallows its own errors on top of that.
        await ctx.scheduler.runAfter(0, internal.ownerIntake.sendIntakeReceivedEmailAction, {
            submissionId,
        });

        return submissionId;
    },
});

/**
 * Internal action: send the acknowledgement email via the Next.js endpoint.
 *
 * Same shape as followUp.sendOneFollowUp and withdrawals.sendStatusEmailAction —
 * Resend lives in the Next runtime, not in Convex, so mail goes out over an
 * X-Internal-Secret'd fetch. Every failure path logs and returns: this email is
 * a courtesy, and the submission it acknowledges is already committed.
 */
export const sendIntakeReceivedEmailAction = internalAction({
    args: { submissionId: v.id('submissions') },
    handler: async (_ctx, args) => {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || 'https://tendso.vercel.app';
        const internalSecret = process.env.INTERNAL_API_SECRET || '';

        if (!internalSecret) {
            console.error('[owner-intake] INTERNAL_API_SECRET not set — skipping acknowledgement email.');
            return;
        }

        try {
            const response = await fetch(`${baseUrl}/api/internal/send-intake-received-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Internal-Secret': internalSecret,
                },
                body: JSON.stringify({ submissionId: args.submissionId }),
            });

            if (!response.ok) {
                const text = await response.text();
                console.error(
                    `[owner-intake] Acknowledgement email failed for ${args.submissionId}: ${response.status} ${text}`,
                );
            }
        } catch (error) {
            console.error(`[owner-intake] Error sending acknowledgement email for ${args.submissionId}:`, error);
        }
    },
});
