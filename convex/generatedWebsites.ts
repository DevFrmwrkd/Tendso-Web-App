import { v } from 'convex/values';
import { mutation, query, internalQuery, action, internalAction } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { requireAdmin } from './lib/auth';

// Get generated website by submission ID.
// `htmlUrl` resolves the file-storage HTML (when the row uses htmlStorageId
// instead of inline htmlContent — the built HTML can exceed Convex's 1 MiB
// document limit). Readers use htmlContent when present, else fetch htmlUrl.
export const getBySubmissionId = query({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        const doc = await ctx.db
            .query('generatedWebsites')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId))
            .first();
        if (!doc) return null;
        const htmlUrl = doc.htmlStorageId ? await ctx.storage.getUrl(doc.htmlStorageId) : null;
        return { ...doc, htmlUrl };
    },
});

// Internal version callable from actions
export const getBySubmissionInternal = internalQuery({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        const doc = await ctx.db
            .query('generatedWebsites')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId))
            .first();
        if (!doc) return null;
        const htmlUrl = doc.htmlStorageId ? await ctx.storage.getUrl(doc.htmlStorageId) : null;
        return { ...doc, htmlUrl };
    },
});

// Store built HTML in Convex file storage (the built HTML can exceed the 1 MiB
// per-document limit, so it can't be inlined on the row). Returns the storageId
// to save as `htmlStorageId`. STORE-ONLY — it never deletes: the previous blob
// is GC'd by `upsert` (via the internal `deleteBlob`) AFTER the new reference is
// committed, so a failed upsert can never strand a row on a deleted blob.
// Administrative builds authenticate before storing anything; internal blob
// cleanup remains separate so scheduled cleanup does not need a Clerk session.
export const storeHtml = action({
    args: { html: v.string() },
    handler: async (ctx, args): Promise<Id<'_storage'>> => {
        await requireAdmin(ctx);
        return await ctx.storage.store(new Blob([args.html], { type: 'text/html' }));
    },
});

// Best-effort delete of a superseded HTML blob. Internal (not a public delete
// vector) and scheduled by `upsert` only once the row points at the new blob.
export const deleteBlob = internalAction({
    args: { storageId: v.id('_storage') },
    handler: async (ctx, args) => {
        try { await ctx.storage.delete(args.storageId); } catch { /* already gone — ignore */ }
    },
});

// Create or update generated website
export const upsert = mutation({
    args: {
        submissionId: v.id('submissions'),
        templateName: v.string(),
        extractedContent: v.any(),
        customizations: v.optional(v.any()),
        htmlContent: v.optional(v.string()),
        cssContent: v.optional(v.string()),
        htmlStorageId: v.optional(v.id('_storage')),
        status: v.optional(v.union(v.literal('draft'), v.literal('published'))),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        // Check if website already exists for this submission
        const existing = await ctx.db
            .query('generatedWebsites')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId))
            .first();

        if (existing) {
            const oldBlob = existing.htmlStorageId;
            // Update existing
            await ctx.db.patch(existing._id, {
                templateName: args.templateName,
                extractedContent: args.extractedContent,
                customizations: args.customizations,
                htmlContent: args.htmlContent,
                cssContent: args.cssContent,
                htmlStorageId: args.htmlStorageId,
                status: args.status || existing.status,
            });
            // GC the superseded HTML blob AFTER the new reference is committed
            // (covers both replace → new id and remove → undefined).
            if (oldBlob && oldBlob !== args.htmlStorageId) {
                await ctx.scheduler.runAfter(0, internal.generatedWebsites.deleteBlob, { storageId: oldBlob });
            }
            return existing._id;
        } else {
            // Create new
            return await ctx.db.insert('generatedWebsites', {
                submissionId: args.submissionId,
                templateName: args.templateName,
                extractedContent: args.extractedContent,
                customizations: args.customizations,
                htmlContent: args.htmlContent,
                cssContent: args.cssContent,
                htmlStorageId: args.htmlStorageId,
                status: args.status || 'draft',
            });
        }
    },
});

// Update website status and publishing info
export const updatePublishingInfo = mutation({
    args: {
        submissionId: v.id('submissions'),
        publishedUrl: v.optional(v.string()),
        netlifySiteId: v.optional(v.string()),
        cfPagesProjectName: v.optional(v.string()),
        status: v.optional(v.union(v.literal('draft'), v.literal('published'))),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const website = await ctx.db
            .query('generatedWebsites')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId))
            .first();

        if (!website) {
            throw new Error('Generated website not found');
        }

        const updates: any = {};
        if (args.publishedUrl !== undefined) updates.publishedUrl = args.publishedUrl;
        if (args.netlifySiteId !== undefined) updates.netlifySiteId = args.netlifySiteId;
        if (args.cfPagesProjectName !== undefined) updates.cfPagesProjectName = args.cfPagesProjectName;
        if (args.status !== undefined) {
            updates.status = args.status;
            if (args.status === 'published') {
                updates.publishedAt = Date.now();
            }
        }

        await ctx.db.patch(website._id, updates);
        return website._id;
    },
});

// Public: count of all published websites — landing page hero counter.
export const countPublished = query({
    args: {},
    handler: async (ctx) => {
        const sites = await ctx.db
            .query('generatedWebsites')
            .filter((q) => q.eq(q.field('status'), 'published'))
            .collect();
        return sites.filter((s) => !!s.publishedUrl).length;
    },
});

// Public: list all published websites for the landing-page map.
// Returns business name + category + city + coords + live URL.
// Intentionally minimal — no user PII, no payout fields, no draft sites.
export const listPublished = query({
    args: {},
    handler: async (ctx) => {
        const sites = await ctx.db
            .query('generatedWebsites')
            .filter((q) => q.eq(q.field('status'), 'published'))
            .collect();

        const results = [];
        for (const site of sites) {
            if (!site.publishedUrl) continue;
            const submission = await ctx.db.get(site.submissionId);
            if (!submission) continue;
            results.push({
                id: site._id,
                businessName: submission.businessName,
                businessType: submission.businessType,
                city: submission.city,
                address: submission.address,
                coordinates: submission.coordinates,
                publishedUrl: site.publishedUrl,
                publishedAt: site.publishedAt,
            });
        }
        return results;
    },
});

/**
 * The site served at <slug>.sites.tendso.com.
 *
 * PUBLIC AND UNCREDENTIALED, because the thing it serves is a public website —
 * anyone typing the hostname is entitled to the page. That is exactly why it
 * returns a NARROW shape instead of the row: the document carries the owner's
 * email, phone, the raw interview and admin bookkeeping, and a hosted site must
 * never become a way to read those by guessing hostnames.
 *
 * `offlineAt` is returned because ABSENT MEANS LIVE (see schema) — the caller
 * serves the holding page rather than the site when it is set, which is how
 * unpublish works without deleting anything.
 *
 * `seo` is the structured-data bundle for lib/site-seo.ts. Every field in it is
 * ALREADY PRINTED ON THE PUBLISHED PAGE — the phone in the header, the address
 * and map in the location block, the social links in the footer — so returning
 * them here discloses nothing a visitor cannot read off the site itself. The
 * owner's account email, their phone as distinct from the business one, and the
 * interview stay out, as does every field for a row that is not published.
 */
export const getPublishedBySlug = query({
    args: { slug: v.string() },
    handler: async (ctx, args) => {
        const doc = await ctx.db
            .query('generatedWebsites')
            .withIndex('by_slug', (q) => q.eq('slug', args.slug))
            .first();
        if (!doc) return null;
        // A row that was never published has no business being served, even
        // though its slug is assigned.
        if (doc.status !== 'published') return null;

        const submission = await ctx.db.get(doc.submissionId);
        const htmlUrl = doc.htmlStorageId ? await ctx.storage.getUrl(doc.htmlStorageId) : null;

        // The admin-edited draft the astro build reads. Preferred over the raw
        // submission for everything it holds, because it is what the visible
        // page was built from — structured data that contradicts the page is
        // the one kind Google is entitled to ignore.
        // Only the handful of keys this query reads. extractedContent is
        // v.any() — an editor draft whose shape varies by template family — so
        // every field is narrowed at the point of use rather than trusted.
        const content = (doc.extractedContent ?? {}) as {
            contact?: { phone?: string; address?: string };
            location?: { lat?: number; lng?: number };
            business_city?: string;
            googleMapsUrl?: string;
            footer?: { social_links?: unknown };
        };
        const contact = content.contact ?? {};
        const location = content.location ?? {};
        const coords =
            typeof location.lat === 'number' && typeof location.lng === 'number'
                ? { lat: location.lat, lng: location.lng }
                : submission?.coordinates ?? null;
        const socialUrls: string[] = (Array.isArray(content.footer?.social_links)
            ? content.footer.social_links
            : []
        )
            .map((link) => (link as { url?: unknown } | null)?.url)
            .filter((url): url is string => typeof url === 'string' && !!url);

        return {
            slug: args.slug,
            htmlContent: doc.htmlContent ?? null,
            htmlUrl,
            offlineAt: doc.offlineAt ?? null,
            publishedAt: doc.publishedAt ?? null,
            businessName: submission?.businessName ?? null,
            // Only for the holding page, which is themed from the same two
            // inputs the astro build uses so it matches the site it replaces.
            // Both are design/category config, not owner contact details.
            businessType: submission?.businessType ?? null,
            customizations: (doc.customizations ?? null) as Record<string, unknown> | null,
            // A real domain, once one is live, is the address this site should
            // canonicalise to — the .sites.tendso.com copy is then the
            // duplicate, not the original. See app/hosted/[slug]/route.ts.
            //
            // GATED ON domainStatus, because customDomain is written the moment
            // the domain is registered and stays written while DNS and SSL are
            // still being provisioned. Canonicalising to an https address that
            // does not answer yet would point Google at a dead page.
            customDomain:
                (submission as { domainStatus?: string } | null)?.domainStatus === 'live'
                    ? doc.customDomain ?? null
                    : null,
            seo: {
                // STRICTLY the two contact fields the page was built from, with
                // no fall back to submission.ownerPhone / submission.address.
                // Those are what the owner gave us to work from, not what they
                // chose to publish: if the draft has no phone the page prints
                // none, and structured data must not print one either.
                telephone: (contact.phone as string | undefined) ?? null,
                address: (contact.address as string | undefined) ?? null,
                city: (content.business_city as string | undefined) ?? submission?.city ?? null,
                // Qualifiers only — buildLocalBusinessJsonLd drops them unless
                // there is an address for them to qualify.
                region: submission?.province ?? null,
                postalCode: submission?.postalCode ?? null,
                // submission.coordinates is a legitimate source here even though
                // it is not a draft field: it is the same value the build feeds
                // the map block, so it describes the pin the visitor can see.
                latitude: coords?.lat ?? null,
                longitude: coords?.lng ?? null,
                mapUrl: (content.googleMapsUrl as string | undefined) ?? null,
                socialUrls,
            },
        };
    },
});

/** Every slug already in use, so a new site can avoid colliding with one. */
export const listSlugs = query({
    args: {},
    handler: async (ctx) => {
        const rows = await ctx.db.query('generatedWebsites').collect();
        return rows.map((r) => r.slug).filter((s): s is string => !!s);
    },
});

// Publish website (shorthand for updatePublishingInfo with status=published)
export const publish = mutation({
    args: {
        submissionId: v.id('submissions'),
        publishedUrl: v.string(),
        // OPTIONAL as of the move to <slug>.sites.tendso.com. Publishing no
        // longer deploys a Cloudflare Worker for the ordinary case, so most sites
        // have no Worker and no script name to record. It is still passed for a
        // site that has or has requested a custom domain, because
        // convex/domains.ts attaches the purchased domain to a Worker by this
        // name and refuses outright when it is missing.
        //
        // Never CLEARED here even when absent: an existing site keeps the name of
        // the Worker it already has, so unpublish can still reach it and a live
        // custom domain keeps working.
        cfPagesProjectName: v.optional(v.string()),
        // Optional so an older caller (or a deploy still running the previous
        // frontend) keeps working; the row simply has no hosted address yet.
        slug: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const website = await ctx.db
            .query('generatedWebsites')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId))
            .first();

        if (!website) {
            throw new Error('Generated website not found');
        }

        await ctx.db.patch(website._id, {
            status: 'published',
            publishedUrl: args.publishedUrl,
            ...(args.cfPagesProjectName ? { cfPagesProjectName: args.cfPagesProjectName } : {}),
            publishedAt: Date.now(),
            // Written once and then left alone: an address an owner has been
            // given must not move underneath them on a republish.
            ...(args.slug && !website.slug ? { slug: args.slug } : {}),
            // A publish is also the restore path for an offline site: the hosted
            // route serves the stored HTML again the moment this clears, so the
            // site is live again by definition.
            offlineAt: undefined,
        });

        return website._id;
    },
});

/**
 * Mark a site as offline — the Worker is now serving the holding page.
 *
 * Only ever called AFTER that deploy succeeds. Everything needed to bring the
 * site back (publishedUrl, cfPagesProjectName) is deliberately left in place;
 * `unpublish` below is the older, destructive version that clears them.
 */
export const markOffline = mutation({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const website = await ctx.db
            .query('generatedWebsites')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId))
            .first();

        if (!website) {
            throw new Error('Generated website not found');
        }

        await ctx.db.patch(website._id, { offlineAt: Date.now() });

        return website._id;
    },
});

// Unpublish website (remove publishing info, keep the website)
export const unpublish = mutation({
    args: {
        submissionId: v.id('submissions'),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const website = await ctx.db
            .query('generatedWebsites')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId))
            .first();

        if (!website) {
            throw new Error('Generated website not found');
        }

        await ctx.db.patch(website._id, {
            status: 'draft',
            publishedUrl: undefined,
            netlifySiteId: undefined,
            cfPagesProjectName: undefined,
            publishedAt: undefined,
        });

        return website._id;
    },
});

// Delete generated website
export const remove = mutation({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const website = await ctx.db
            .query('generatedWebsites')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId))
            .first();

        if (website) {
            await ctx.db.delete(website._id);
        }
    },
});
