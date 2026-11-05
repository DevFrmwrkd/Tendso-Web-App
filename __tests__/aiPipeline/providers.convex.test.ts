import { afterEach, describe, expect, it, vi } from 'vitest';
import { convexTest } from 'convex-test';
import type { ActionCtx } from '../../convex/_generated/server';
import type { Doc } from '../../convex/_generated/dataModel';
import { internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { fetchBytes, higgsfieldGenerate, visionJson } from '../../convex/aiPipeline/providers';
import { makeDeps } from '../../convex/aiPipeline/steps';
import { isPermanent } from '../../lib/aiPipeline/stateMachine';
import { makeInput } from './fixtures';

const cfg = { baseUrl: 'https://images.example', endpoint: 'edit', authorization: 'Key test', extraParams: {} };
const pending = () => new Promise<never>(() => undefined);

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

describe('image request deadlines', () => {
    it.each(['submission', 'submission body', 'poll', 'poll body'])('aborts a stalled %s within the job budget', async (stage) => {
        vi.useFakeTimers();
        let signal: AbortSignal | undefined;
        vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
            signal = init.signal as AbortSignal;
            const submit = init.method === 'POST';
            if ((stage === 'submission' && submit) || (stage === 'poll' && !submit)) return pending();
            return {
                ok: true,
                text: () => stage === 'submission body' ? pending() : Promise.resolve('{"request_id":"job"}'),
                json: () => stage === 'poll body' ? pending() : Promise.resolve({ status: 'completed', images: [{ url: 'done' }] }),
            };
        }));
        const result = higgsfieldGenerate(cfg, { prompt: 'photo', imageUrls: ['original'] }, { timeoutMs: 100, pollMs: 10 });
        const assertion = expect(result).rejects.toThrow('timed out');
        await vi.advanceTimersByTimeAsync(100);
        await assertion;
        expect(signal?.aborted).toBe(true);
    });

    it('includes submission retries and backoff in the same budget', async () => {
        vi.useFakeTimers();
        const fetch = vi.fn(async () => ({ ok: false, status: 429, text: async () => 'busy' }));
        vi.stubGlobal('fetch', fetch);
        const assertion = expect(higgsfieldGenerate(cfg, { prompt: '', imageUrls: [] }, { timeoutMs: 100 })).rejects.toThrow('timed out');
        await vi.advanceTimersByTimeAsync(100);
        await assertion;
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it.each(['headers', 'body'])('bounds image download %s', async (stage) => {
        vi.useFakeTimers();
        let signal: AbortSignal | undefined;
        vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
            signal = init.signal as AbortSignal;
            if (stage === 'headers') return pending();
            return { ok: true, arrayBuffer: pending, headers: new Headers() };
        }));
        const assertion = expect(fetchBytes('https://images.example/photo', { timeoutMs: 100 })).rejects.toThrow('timed out');
        await vi.advanceTimersByTimeAsync(100);
        await assertion;
        expect(signal?.aborted).toBe(true);
    });

    it.each(['headers', 'body'])('bounds vision %s and falls back to originals', async (stage) => {
        vi.useFakeTimers();
        vi.stubEnv('GEMINI_API_KEY', 'test');
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        let signal: AbortSignal | undefined;
        vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
            signal = init.signal as AbortSignal;
            return stage === 'headers' ? pending() : { ok: true, json: pending };
        }));
        const ctx = { runQuery: vi.fn(async () => null) } as unknown as ActionCtx;
        const result = visionJson(ctx, 'check', [], { timeoutMs: 100 });
        await vi.advanceTimersByTimeAsync(100);
        expect(await result).toBeNull();
        expect(signal?.aborted).toBe(true);
    });

    it('still returns a completed job', async () => {
        vi.useFakeTimers();
        vi.stubGlobal('fetch', vi.fn()
            .mockResolvedValueOnce({ ok: true, text: async () => '{"request_id":"job"}' })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'completed', images: [{ url: 'done' }] }) }));
        const result = higgsfieldGenerate(cfg, { prompt: '', imageUrls: [] }, { timeoutMs: 100, pollMs: 10 });
        await vi.advanceTimersByTimeAsync(10);
        expect(await result).toEqual({ url: 'done', requestId: 'job' });
    });
});

describe('main recording transcription', () => {
    it.each([{ transcriptionStatus: 'failed', transcript: '' }, { transcriptionStatus: 'complete', transcript: '   ' }, { transcriptionStatus: 'failed', transcript: 'stale text' }])('retries unusable refreshed transcription: %j', async (fresh) => {
        const ctx = { runAction: vi.fn(), runQuery: vi.fn(async () => fresh) } as unknown as ActionCtx;
        const deps = makeDeps(ctx, { submissionId: 'submission' } as Doc<'aiPipelineRuns'>);
        const error = await deps.ensureMainTranscript(makeInput({ mainMediaUrl: 'recording' })).catch((e) => e);
        expect(error).toBeInstanceOf(Error);
        expect(isPermanent(error)).toBe(false);
    });

    it('accepts a usable refreshed transcript', async () => {
        const ctx = { runAction: vi.fn(), runQuery: vi.fn(async () => ({ transcriptionStatus: 'complete', transcript: ' Haircuts ' })) } as unknown as ActionCtx;
        const deps = makeDeps(ctx, { submissionId: 'submission' } as Doc<'aiPipelineRuns'>);
        expect(await deps.ensureMainTranscript(makeInput({ mainMediaUrl: 'recording' }))).toEqual({ kind: 'ready', transcript: 'Haircuts' });
    });
});

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './aiPipeline/persist.ts': () => import('../../convex/aiPipeline/persist'),
};

describe('current image placements', () => {
    it.each([undefined, {}, { enhanced_hero: { url: 'current-original' } }])('deactivates previous polish with incoming map %j', async (enhancedImages) => {
        const t = convexTest(schema, modules);
        const ids = await t.run(async (ctx) => {
            const creatorId = await ctx.db.insert('creators', { clerkId: 'creator', email: 'creator@example.com' });
            const submissionId = await ctx.db.insert('submissions', {
                creatorId, businessName: 'Shop', businessType: 'Barber', ownerName: 'Owner', ownerPhone: '', address: '', city: '', status: 'submitted',
            });
            const runId = await ctx.db.insert('aiPipelineRuns', {
                submissionId, status: 'running', step: 'building_site', attempt: 1, force: true, startedAt: 0, deadlineAt: 1000, updatedAt: 0,
            });
            const websiteId = await ctx.db.insert('generatedWebsites', {
                submissionId, templateName: 'astro', status: 'draft', updatedAt: 0,
                enhancedImages: { enhanced_hero: { url: 'old-polished' }, enhanced_gallery_1: { url: 'removed-photo' } },
            });
            return { runId, submissionId, websiteId };
        });
        await t.mutation(internal.aiPipeline.persist.prepareBuild, { runId: ids.runId, submissionId: ids.submissionId, content: {}, ...(enhancedImages ? { enhancedImages } : {}) });
        const website = await t.run((ctx) => ctx.db.get(ids.websiteId));
        const active = Object.fromEntries(Object.entries(website!.enhancedImages ?? {}).filter(([key]) => !key.startsWith('enhanced_archive_')));
        expect(active).toEqual(enhancedImages ?? {});
    });
});
