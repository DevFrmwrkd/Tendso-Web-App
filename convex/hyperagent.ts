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
import { internalAction, internalMutation, internalQuery } from './_generated/server';
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
export const ingestStudioResult = internalAction({
    args: { submissionId: v.id('submissions'), content: v.any(), images: v.any() },
    handler: async (ctx, args) => {
        const enhancedImages: Record<string, { url: string | null; storageId: string }> = {};
        const images = (args.images || {}) as Record<string, string>;

        for (const [key, sourceUrl] of Object.entries(images)) {
            if (typeof sourceUrl !== 'string' || !sourceUrl.startsWith('http')) continue;
            try {
                const resp = await fetch(sourceUrl);
                if (!resp.ok) throw new Error(`fetch ${resp.status}`);
                const blob = await resp.blob();
                const storageId = await ctx.storage.store(blob);
                const url = await ctx.storage.getUrl(storageId);
                enhancedImages[key] = { url, storageId };
            } catch (e) {
                console.warn(`[STUDIO] could not store image ${key}: ${e}`);
            }
        }

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
export const saveStudioContent = internalMutation({
    args: { submissionId: v.id('submissions'), enhancedImages: v.any(), content: v.any() },
    handler: async (ctx, args) => {
        const content = (args.content || {}) as Record<string, unknown>;
        const copy: Record<string, unknown> = {};
        for (const key of COPY_KEYS) {
            if (content[key] !== undefined && content[key] !== null && content[key] !== '') {
                copy[key] = content[key];
            }
        }

        // generatedWebsites holds copy + images. NOTE: airtableSyncStatus lives on
        // the *submissions* table (not generatedWebsites), matching the original
        // Airtable path (airtable.ts updateSyncStatus) — set it separately below.
        const fields = {
            ...copy,
            enhancedImages: args.enhancedImages,
            airtableSyncedAt: Date.now(),
            updatedAt: Date.now(),
        };

        const existing = await ctx.db
            .query('generatedWebsites')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId))
            .first();

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
