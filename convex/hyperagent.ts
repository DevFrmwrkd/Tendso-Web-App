/**
 * Hyperagent "Tendso Studio" glue.
 *
 * Replaces the Airtable AI step. Flow:
 *   submissions.submit()  →  triggerStudioRender (POST to the agent webhook)
 *   agent renders + writes copy  →  POST /hyperagent-callback (see http.additions.ts)
 *     →  ingestStudioResult (download images → Convex storage)
 *     →  saveStudioContent (write generatedWebsites)
 *
 * Self-contained: does not depend on convex/airtable.ts, so Airtable can be removed.
 *
 * Required Convex env vars:
 *   HYPERAGENT_WEBHOOK_URL    the agent's Webhook trigger URL
 *   HYPERAGENT_WEBHOOK_TOKEN  the agent's Webhook auth token
 *   TENDSO_CALLBACK_SECRET    shared secret; must match the skill credential
 *   R2_PUBLIC_URL             (already set) used to resolve photo paths
 */
import { v } from 'convex/values';
import { internalAction, internalMutation, internalQuery, mutation } from './_generated/server';
import { internal } from './_generated/api';

// Tendso's fixed photo order → roles. Products only when hasProducts.
const PHOTO_ROLES = ['headshot', 'interior_1', 'interior_2', 'exterior', 'product_1', 'product_2'];

// Content keys we allow into generatedWebsites (whitelist; everything else ignored).
const COPY_KEYS = [
    'heroHeadline', 'heroSubHeadline', 'aboutDescription', 'servicesDescription', 'contactCta',
    'heroBadgeText', 'heroCtaLabel', 'aboutHeadline', 'aboutTagline', 'aboutTags',
    'servicesHeadline', 'servicesSubheadline', 'featuredHeadline', 'tagline', 'tone', 'services',
    // SEO layer
    'seoTitle', 'metaDescription', 'seoKeywords', 'structuredData', 'gbpDescription', 'imageAlt',
];

export const getSubmissionForStudio = internalQuery({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => ctx.db.get(args.submissionId),
});

export const setSyncStatus = internalMutation({
    args: { submissionId: v.id('submissions'), status: v.string() },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.submissionId, { airtableSyncStatus: args.status });
    },
});

/**
 * Public trigger for the admin "Enhance Images" button. Schedules the Studio
 * render (Hyperagent) — the replacement for the old airtable.triggerAirtablePush.
 * Mirrors that mutation's contract so the admin UI can swap to it directly.
 */
export const triggerStudioRenderPublic = mutation({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        const submission = await ctx.db.get(args.submissionId);
        if (!submission) throw new Error('Submission not found');
        await ctx.db.patch(args.submissionId, { airtableSyncStatus: 'pending_push' });
        await ctx.scheduler.runAfter(0, internal.hyperagent.triggerStudioRender, {
            submissionId: args.submissionId,
        });
        return { success: true };
    },
});

/**
 * Trigger the Hyperagent agent. Resolves photo URLs, builds a self-contained
 * payload, and POSTs it to the agent's webhook so a fresh thread runs the skill.
 */
export const triggerStudioRender = internalAction({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        const submission = await ctx.runQuery(internal.hyperagent.getSubmissionForStudio, {
            submissionId: args.submissionId,
        });
        if (!submission) throw new Error('Submission not found');

        const webhookUrl = process.env.HYPERAGENT_WEBHOOK_URL;
        const token = process.env.HYPERAGENT_WEBHOOK_TOKEN;
        if (!webhookUrl || !token) throw new Error('Missing HYPERAGENT_WEBHOOK_URL / HYPERAGENT_WEBHOOK_TOKEN');

        // Resolve photos (R2 URL, R2 path, or Convex storage id) → public URLs, tagged by role.
        const r2PublicUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
        const hasProducts = !!submission.hasProducts;
        const photosRaw = submission.photos || [];
        const photos: { role: string; url: string }[] = [];
        for (let i = 0; i < photosRaw.length && i < PHOTO_ROLES.length; i++) {
            const role = PHOTO_ROLES[i];
            if ((role === 'product_1' || role === 'product_2') && !hasProducts) continue;
            const photo = photosRaw[i];
            let url: string | null = null;
            if (photo.startsWith('http://') || photo.startsWith('https://')) {
                url = photo;
            } else if (/^(images|videos|audio)\//.test(photo) && r2PublicUrl) {
                url = `${r2PublicUrl}/${photo}`;
            } else {
                try {
                    const storageId = photo.startsWith('convex:') ? photo.replace('convex:', '') : photo;
                    url = await ctx.storage.getUrl(storageId as any);
                } catch {
                    url = null;
                }
            }
            if (url) photos.push({ role, url });
        }

        const payload = {
            submissionId: args.submissionId,
            business: {
                name: submission.businessName,
                type: submission.businessType,
                owner: submission.ownerName,
                city: submission.city,
                address: submission.address,
                phone: submission.ownerPhone,
                email: submission.ownerEmail,
                hasProducts,
            },
            photos,
            transcript: submission.transcript || '',
            qa: (submission as any).interviewQa || [],
        };

        // The Hyperagent webhook receives the ENTIRE JSON body as the agent's user
        // message ("POST any JSON payload to the URL — the agent receives it as the
        // user message"). The standing instruction ("use the tendso-studio skill…")
        // lives in the endpoint's own Prompt field, so we POST the raw submission
        // payload object directly — no { message: ... } wrapper.
        try {
            const res = await fetch(webhookUrl, {
                method: 'POST',
                // Hyperagent's webhook expects the trigger token in this header
                // (not Authorization: Bearer).
                headers: { 'Content-Type': 'application/json', 'X-Hyperagent-Webhook-Secret': token },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(`webhook ${res.status}: ${await res.text()}`);
            await ctx.runMutation(internal.hyperagent.setSyncStatus, {
                submissionId: args.submissionId,
                status: 'pushed',
            });
        } catch (e) {
            console.error('[STUDIO] trigger failed:', e);
            await ctx.runMutation(internal.hyperagent.setSyncStatus, {
                submissionId: args.submissionId,
                status: 'error',
            });
            throw e;
        }
    },
});

/**
 * Ingest the agent's result: download each generated image into Convex storage,
 * then persist copy + images. Called from the /hyperagent-callback route.
 */
// Base keys the website builder (app/api/generate-website) maps to page sections.
// Two families: legacy role keys, and Tendso Studio v0.2 placement keys
// (hero / portrait / gallery_<N>). An image whose base key is NOT here saves to
// storage but never renders on the site, so we normalize + warn on anything off-contract.
const BUILDER_IMAGE_BASES = [
    // legacy role keys
    'headshot', 'interior_1', 'interior_2', 'exterior', 'product_1', 'product_2',
    // v0.2 placement keys
    'hero', 'portrait',
];

// Normalize an agent-supplied image key to the builder's expected shape:
// enforce the `enhanced_` prefix and tolerate `_vN` variants (the builder strips
// `enhanced_` and `_vN`). Returns null for keys the builder can't map.
function normalizeImageKey(rawKey: string): string | null {
    let k = rawKey.trim();
    if (!k.startsWith('enhanced_')) k = `enhanced_${k}`;
    const base = k.replace(/^enhanced_/, '').replace(/_v\d+$/, '');
    // gallery_<N> is an open-ended set the builder maps by prefix.
    if (/^gallery_\d+$/.test(base)) return k;
    return BUILDER_IMAGE_BASES.includes(base) ? k : null;
}

export const ingestStudioResult = internalAction({
    args: { submissionId: v.id('submissions'), content: v.any(), images: v.any() },
    handler: async (ctx, args) => {
        const enhancedImages: Record<string, { url: string | null; storageId: string }> = {};
        const images = (args.images || {}) as Record<string, string>;

        for (const [rawKey, sourceUrl] of Object.entries(images)) {
            if (typeof sourceUrl !== 'string' || !sourceUrl.startsWith('http')) continue;

            // Map the key to the builder's contract. Keep an unmapped image (don't
            // lose work) but log loudly — it won't show on the site until renamed.
            const key = normalizeImageKey(rawKey);
            if (!key) {
                console.warn(
                    `[STUDIO] image key '${rawKey}' is not a builder slot ` +
                    `(${BUILDER_IMAGE_BASES.join(', ')}); storing as-is but it won't render on the website.`,
                );
            }
            const storeKey = key ?? rawKey;

            try {
                const resp = await fetch(sourceUrl);
                if (!resp.ok) throw new Error(`fetch ${resp.status}`);
                const blob = await resp.blob();
                const storageId = await ctx.storage.store(blob);
                const url = await ctx.storage.getUrl(storageId);
                enhancedImages[storeKey] = { url, storageId };
            } catch (e) {
                console.warn(`[STUDIO] could not store image ${storeKey}: ${e}`);
            }
        }

        const mapped = Object.keys(enhancedImages).filter((k) => normalizeImageKey(k));
        console.log(`[STUDIO] stored ${Object.keys(enhancedImages).length} images, ${mapped.length} builder-mappable`);

        await ctx.runMutation(internal.hyperagent.saveStudioContent, {
            submissionId: args.submissionId,
            enhancedImages,
            content: args.content || {},
        });
    },
});

/**
 * Write copy + enhanced images into generatedWebsites (patch or insert).
 * Whitelists copy keys so only schema fields are written.
 */
// Map alternate copy key spellings the agent sometimes emits (Airtable-style
// snake_case, or a single nested blob) → the flat camelCase keys the schema +
// templates expect. Without this, e.g. heroHeadline arrives as a JSON object
// {hero_headline, about_content, ...} and the template can't read it.
const COPY_ALIASES: Record<string, string> = {
    hero_headline: 'heroHeadline',
    hero_subheadline: 'heroSubHeadline',
    about_content: 'aboutDescription',
    about_description: 'aboutDescription',
    services_description: 'servicesDescription',
    contact_cta: 'contactCta',
};

function normalizeCopy(raw: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = { ...raw };
    // If heroHeadline came in as a nested object (the snake_case blob), lift its
    // fields up to the top level via the alias map.
    const hh = raw['heroHeadline'];
    if (hh && typeof hh === 'object' && !Array.isArray(hh)) {
        for (const [k, dest] of Object.entries(COPY_ALIASES)) {
            const val = (hh as Record<string, unknown>)[k];
            if (val !== undefined && out[dest] === undefined) out[dest] = val;
        }
        delete out['heroHeadline'];
        // re-apply the lifted heroHeadline if present
        if ((hh as Record<string, unknown>)['hero_headline']) {
            out['heroHeadline'] = (hh as Record<string, unknown>)['hero_headline'];
        }
    }
    // Also lift any top-level snake_case aliases.
    for (const [k, dest] of Object.entries(COPY_ALIASES)) {
        if (raw[k] !== undefined && out[dest] === undefined) out[dest] = raw[k];
    }
    return out;
}

export const saveStudioContent = internalMutation({
    args: { submissionId: v.id('submissions'), enhancedImages: v.any(), content: v.any() },
    handler: async (ctx, args) => {
        const content = normalizeCopy((args.content || {}) as Record<string, unknown>);
        const copy: Record<string, unknown> = {};
        for (const key of COPY_KEYS) {
            const val = content[key];
            // Only accept string/array/object scalars the schema expects; never a
            // nested copy blob (which would have been lifted by normalizeCopy).
            if (val !== undefined && val !== null && val !== '') {
                copy[key] = val;
            }
        }

        const existing = await ctx.db
            .query('generatedWebsites')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId))
            .first();

        // GUARD: never clobber a previously-saved image set with an empty one. A push
        // that arrives with no images (agent skipped the image step, or a copy-only
        // re-push) must NOT wipe images a prior render already stored.
        const incoming = (args.enhancedImages || {}) as Record<string, unknown>;
        const hasIncomingImages = Object.keys(incoming).length > 0;
        const enhancedImages = hasIncomingImages
            ? incoming
            : ((existing as { enhancedImages?: unknown })?.enhancedImages ?? {});

        const fields = {
            ...copy,
            enhancedImages,
            airtableSyncedAt: Date.now(),
            updatedAt: Date.now(),
        };

        if (existing) {
            await ctx.db.patch(existing._id, fields);
        } else {
            await ctx.db.insert('generatedWebsites', { submissionId: args.submissionId, ...fields });
        }

        // Mark the submission synced (status field is on submissions, where the
        // existing status UI / by_airtable_sync index read it).
        await ctx.db.patch(args.submissionId, { airtableSyncStatus: 'synced' });
    },
});
