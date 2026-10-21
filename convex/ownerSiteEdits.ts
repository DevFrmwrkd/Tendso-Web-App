import { v, ConvexError } from 'convex/values';
import {
    action,
    internalMutation,
    internalQuery,
    mutation,
    query,
} from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { isArchiveKey, orderedEnhancedEntries } from './lib/enhancedImages';
import { cleanOwnerDraft, OwnerDraftError } from '../lib/ownerSiteEdits';
import { verifyOwnerBuild } from '../lib/ownerBuildProof';
import { needsCloudflareWorker } from '../lib/publish-target';

/**
 * Owner editing (v2): a signed-in shop owner changes the design, font, colours,
 * texts, photos and sections of THEIR OWN site, and publishes the result.
 *
 * Nothing here is a second editor. The draft is the admin editor's draft
 * (`extractedContent` + `customizations`); the site is rebuilt by the same
 * route the admin's Save uses (app/api/generate-website, owner mode) and the
 * result is committed to the same `generatedWebsites` row. What is different is
 * WHO may do it and WHAT they may change:
 *
 *   · Every function re-checks, server-side, that the caller's Clerk identity is
 *     a `businessOwners` row linked to THIS submission through
 *     `websiteOwnerships`. A guessed id is never enough; a stranger gets the
 *     same "we could not find that website" as a missing site.
 *   · The owner's draft lives in its own table (`ownerSiteDrafts`) and never
 *     touches the live site until Publish. lib/ownerSiteEdits.ts decides what
 *     survives the round trip (plain text, a closed design vocabulary, the
 *     shop's facts and the essential sections untouchable).
 *   · The HTML itself can only come from our build route: `commitBuild` needs a
 *     signature (lib/ownerBuildProof.ts) that only a server holding
 *     INTERNAL_API_SECRET can make.
 *
 * A site that is not live yet (an owner who made it in the app and has not paid)
 * keeps being a private preview: the edit is built and stored, never published.
 * A live site is republished at once, exactly like the admin Save.
 */

const NOT_FOUND = 'We could not find that website.';
const SIGN_IN = 'Please sign in again.';
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);

type DbCtx = QueryCtx | MutationCtx;

// ── Ownership ─────────────────────────────────────────────────────────────

async function ownerForClerkId(ctx: DbCtx, clerkId: string): Promise<Doc<'businessOwners'> | null> {
    return await ctx.db
        .query('businessOwners')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
        .first();
}

/**
 * The owner who is signed in AND linked to this submission, or a ConvexError.
 * (Same link `businessOwners.requireOwnership` checks; kept local so this file
 * does not depend on that one's exports.)
 */
async function requireOwnedSite(ctx: DbCtx, submissionId: Id<'submissions'>, clerkId?: string) {
    let subject = clerkId;
    if (!subject) {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new ConvexError(SIGN_IN);
        subject = identity.subject;
    }
    const owner = await ownerForClerkId(ctx, subject);
    if (!owner) throw new ConvexError(NOT_FOUND);
    const link = await ctx.db
        .query('websiteOwnerships')
        .withIndex('by_submission', (q) => q.eq('submissionId', submissionId))
        .filter((q) => q.eq(q.field('businessOwnerId'), owner._id))
        .first();
    const submission = await ctx.db.get(submissionId);
    if (!link || !submission || submission.status === 'rejected') throw new ConvexError(NOT_FOUND);
    const website = await ctx.db
        .query('generatedWebsites')
        .withIndex('by_submissionId', (q) => q.eq('submissionId', submissionId))
        .first();
    if (!website) throw new ConvexError('Your website is not built yet.');
    return { owner, submission, website };
}

async function draftFor(ctx: DbCtx, submissionId: Id<'submissions'>) {
    return await ctx.db
        .query('ownerSiteDrafts')
        .withIndex('by_submission', (q) => q.eq('submissionId', submissionId))
        .first();
}

const isLive = (website: Doc<'generatedWebsites'>) => !!website.publishedUrl && !website.offlineAt;

async function resolveUrls(ctx: QueryCtx, values: string[]): Promise<string[]> {
    const out: string[] = [];
    for (const raw of values) {
        if (!raw) continue;
        if (/^https?:\/\//i.test(raw)) { out.push(raw); continue; }
        try {
            const url = await ctx.storage.getUrl(raw.replace(/^convex:/, '') as Id<'_storage'>);
            if (url) out.push(url);
        } catch { /* not a storage id */ }
    }
    return out;
}

// ── Reads ─────────────────────────────────────────────────────────────────

/** Everything /v2/my-site needs to open the editor for one site. */
export const getEditorState = query({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        const { submission, website } = await requireOwnedSite(ctx, args.submissionId);
        const draft = await draftFor(ctx, args.submissionId);

        const htmlUrl = website.htmlStorageId ? await ctx.storage.getUrl(website.htmlStorageId) : null;

        const originals = await resolveUrls(ctx, (submission.photos ?? []).filter((p) => typeof p === 'string'));

        const polishedRaw = (website as { enhancedImages?: unknown }).enhancedImages
            ?? (website.extractedContent as { enhancedImages?: unknown } | undefined)?.enhancedImages;
        const polished: string[] = [];
        if (polishedRaw && typeof polishedRaw === 'object') {
            const entries = orderedEnhancedEntries(polishedRaw as Record<string, unknown>)
                .filter(([key]) => !isArchiveKey(key));
            for (const [, img] of entries) {
                const rec = img as { url?: string; storageId?: string } | string;
                const raw = typeof rec === 'string' ? rec : rec?.storageId || rec?.url || '';
                const [url] = await resolveUrls(ctx, [raw]);
                if (url) polished.push(url);
            }
        }

        return {
            submissionId: args.submissionId,
            businessName: submission.businessName,
            businessType: submission.businessType,
            status: submission.status,
            live: isLive(website),
            offline: !!website.offlineAt,
            publishedUrl: website.publishedUrl ?? null,
            htmlUrl,
            htmlInline: website.htmlContent ?? null,
            base: {
                content: website.extractedContent ?? {},
                customizations: website.customizations ?? {},
            },
            draft: draft
                ? {
                    content: draft.content,
                    customizations: draft.customizations,
                    updatedAt: draft.updatedAt,
                    lastPublishedAt: draft.lastPublishedAt ?? null,
                    pendingWorkerRepublish: !!draft.pendingWorkerRepublish,
                }
                : null,
            photos: originals,
            polished,
        };
    },
});

/** What the build route renders for an owner: the draft, else the site as it is. */
export const getDraftForBuild = query({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        const { submission, website } = await requireOwnedSite(ctx, args.submissionId);
        const draft = await draftFor(ctx, args.submissionId);
        return {
            content: draft?.content ?? website.extractedContent ?? {},
            customizations: draft?.customizations ?? website.customizations ?? {},
            hasDraft: !!draft,
            // Which version of the draft a build is made from. commitBuild refuses
            // a page whose draft has changed since (see applyBuild).
            updatedAt: draft?.updatedAt ?? 0,
            live: isLive(website),
            slug: website.slug ?? null,
            publishedUrl: website.publishedUrl ?? null,
            needsWorker: needsCloudflareWorker(website, submission),
        };
    },
});

// ── Writes ────────────────────────────────────────────────────────────────

/**
 * Save the owner's working copy. The browser sends its whole draft; what is
 * stored is `cleanOwnerDraft(draft, theLiveSite)`, never the raw input.
 */
export const saveDraft = mutation({
    args: {
        submissionId: v.id('submissions'),
        content: v.any(),
        customizations: v.any(),
    },
    handler: async (ctx, args) => {
        const { owner, website } = await requireOwnedSite(ctx, args.submissionId);
        let cleaned;
        try {
            cleaned = cleanOwnerDraft(
                { content: args.content, customizations: args.customizations },
                { content: website.extractedContent ?? {}, customizations: website.customizations ?? {} },
            );
        } catch (err) {
            if (err instanceof OwnerDraftError) throw new ConvexError(err.message);
            throw err;
        }
        const existing = await draftFor(ctx, args.submissionId);
        const now = Date.now();
        if (existing) {
            await ctx.db.patch(existing._id, {
                businessOwnerId: owner._id,
                content: cleaned.content,
                customizations: cleaned.customizations,
                websiteId: website._id,
                updatedAt: now,
            });
        } else {
            await ctx.db.insert('ownerSiteDrafts', {
                submissionId: args.submissionId,
                businessOwnerId: owner._id,
                content: cleaned.content,
                customizations: cleaned.customizations,
                websiteId: website._id,
                updatedAt: now,
            });
        }
        return { updatedAt: now };
    },
});

/** Throw the working copy away; the site is untouched. */
export const discardDraft = mutation({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        await requireOwnedSite(ctx, args.submissionId);
        const existing = await draftFor(ctx, args.submissionId);
        if (existing) await ctx.db.delete(existing._id);
        return { ok: true };
    },
});

/** A one-time URL for the owner's photo upload (Convex file storage). */
export const generateUploadUrl = mutation({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        await requireOwnedSite(ctx, args.submissionId);
        return await ctx.storage.generateUploadUrl();
    },
});

/**
 * After the browser has uploaded: check what actually arrived (type and size are
 * the client's claim until we look) and return the permanent https URL.
 */
export const registerUpload = mutation({
    args: { submissionId: v.id('submissions'), storageId: v.id('_storage') },
    handler: async (ctx, args): Promise<{ ok: true; url: string } | { ok: false; message: string }> => {
        await requireOwnedSite(ctx, args.submissionId);
        const meta = await ctx.db.system.get(args.storageId);
        // A refusal is a RETURN, not a throw: a thrown error would roll back the
        // delete and leave the unwanted file behind.
        if (!meta || !meta.contentType || !IMAGE_TYPES.has(meta.contentType)) {
            await ctx.storage.delete(args.storageId).catch(() => undefined);
            return { ok: false, message: 'Please choose a photo (JPG, PNG or WebP).' };
        }
        if (meta.size > MAX_PHOTO_BYTES) {
            await ctx.storage.delete(args.storageId).catch(() => undefined);
            return { ok: false, message: 'That photo is too big. Please use one under 10 MB.' };
        }
        const url = await ctx.storage.getUrl(args.storageId);
        if (!url) return { ok: false, message: 'That photo did not upload. Please try again.' };
        return { ok: true, url };
    },
});

// ── Publish (build commit) ────────────────────────────────────────────────

/** Ownership check for the action below (actions have no db). */
export const ownerCanEditInternal = internalQuery({
    args: { clerkId: v.string(), submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        try {
            await requireOwnedSite(ctx, args.submissionId, args.clerkId);
            return true;
        } catch {
            return false;
        }
    },
});

/**
 * Store the page our build route made from the owner's draft and put it on the
 * site. Called by app/api/generate-website (owner mode) with the owner's token.
 * The proof ties this exact HTML to this submission; without it nothing is
 * stored.
 */
export const commitBuild = action({
    args: {
        submissionId: v.id('submissions'),
        html: v.string(),
        proof: v.string(),
        // The draft version the page was built from (getDraftForBuild.updatedAt).
        draftUpdatedAt: v.number(),
    },
    handler: async (
        ctx,
        args,
    ): Promise<{ live: boolean; republished: boolean; pendingWorker: boolean; slug: string | null; publishedUrl: string | null }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new ConvexError(SIGN_IN);
        const allowed = await ctx.runQuery(internal.ownerSiteEdits.ownerCanEditInternal, {
            clerkId: identity.subject,
            submissionId: args.submissionId,
        });
        if (!allowed) throw new ConvexError(NOT_FOUND);
        if (!(await verifyOwnerBuild(process.env.INTERNAL_API_SECRET, args.submissionId, args.html, args.proof))) {
            throw new ConvexError('This page was not built by Tendso, so it was not saved.');
        }
        const storageId = await ctx.storage.store(new Blob([args.html], { type: 'text/html' }));
        try {
            return await ctx.runMutation(internal.ownerSiteEdits.applyBuild, {
                submissionId: args.submissionId,
                clerkId: identity.subject,
                storageId,
                draftUpdatedAt: args.draftUpdatedAt,
            });
        } catch (err) {
            // Nothing points at this page: do not leave it behind.
            await ctx.storage.delete(storageId).catch(() => undefined);
            throw err;
        }
    },
});

/** The commit itself: draft -> live row, html swapped, old html collected. */
export const applyBuild = internalMutation({
    args: {
        submissionId: v.id('submissions'),
        clerkId: v.string(),
        storageId: v.id('_storage'),
        draftUpdatedAt: v.number(),
    },
    handler: async (ctx, args) => {
        const { owner, submission, website } = await requireOwnedSite(ctx, args.submissionId, args.clerkId);
        const draft = await draftFor(ctx, args.submissionId);
        // The page was built from one version of the draft. If the owner kept
        // typing while it built, committing the newer draft over an older page
        // would say "published" about words that are not on the site.
        if ((draft?.updatedAt ?? 0) !== args.draftUpdatedAt) {
            throw new ConvexError('You changed something while we were building. Please publish again.');
        }
        const now = Date.now();
        const live = isLive(website);
        // A custom-domain site is also served by a Cloudflare Worker that only
        // the admin Republish can refresh (publish-website deploys it). The new
        // HTML is stored; the hosted address is current, the domain waits.
        const pendingWorker = live && needsCloudflareWorker(website, submission);

        const oldBlob = website.htmlStorageId;
        await ctx.db.patch(website._id, {
            ...(draft ? { extractedContent: draft.content, customizations: draft.customizations } : {}),
            htmlStorageId: args.storageId,
            htmlContent: undefined,
            // The site now serves exactly what was built. For a live site that
            // also clears the "draft + publishedUrl = stale" signal the admin UI
            // shows after any rebuild.
            ...(live ? { status: 'published' as const, publishedAt: now } : {}),
        });
        if (oldBlob && oldBlob !== args.storageId) {
            await ctx.scheduler.runAfter(0, internal.generatedWebsites.deleteBlob, { storageId: oldBlob });
        }
        if (draft) {
            await ctx.db.patch(draft._id, {
                lastPublishedAt: now,
                pendingWorkerRepublish: pendingWorker || undefined,
                websiteId: website._id,
            });
        }
        await ctx.db.insert('auditLogs', {
            adminId: `owner:${owner._id}`,
            action: 'owner_site_edit_published',
            targetType: 'submission',
            targetId: args.submissionId,
            metadata: { live, pendingWorker, websiteId: website._id },
            timestamp: now,
        });
        return {
            live,
            republished: live && !pendingWorker,
            pendingWorker,
            slug: website.slug ?? null,
            publishedUrl: website.publishedUrl ?? null,
        };
    },
});
