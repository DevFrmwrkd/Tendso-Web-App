import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { interviewRecordingFingerprint } from '../../convex/lib/interviewRecording';

vi.mock('../../convex/lib/mediaChunker', () => ({
    chunkMediaFile: (buffer: ArrayBuffer) => [buffer], getFileExtension: () => 'mp3',
}));
const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './submissions.ts': () => import('../../convex/submissions'),
    './transcription.ts': () => import('../../convex/transcription'),
};

async function setup(storageId = 'audio/current-take.mp3') {
    const t = convexTest(schema, modules);
    const id = await t.run(async ctx => {
        const creatorId = await ctx.db.insert('creators', { clerkId: 'agent', email: 'agent@example.com', role: 'creator', status: 'active' });
        return await ctx.db.insert('submissions', { creatorId, businessName: 'Nena Store', businessType: 'Shop',
            ownerName: 'Nena', ownerPhone: '09171234567', address: 'Main Street', city: 'Manila', status: 'rejected',
            photos: ['photo-1', 'photo-2', 'photo-3'], audioStorageId: storageId,
            transcript: 'Saved current transcript', transcriptionStatus: 'complete' });
    });
    return { t, id };
}

beforeEach(() => {
    vi.stubEnv('GROQ_API_KEY', 'fake-test-groq-key');
    vi.stubEnv('R2_PUBLIC_URL', 'https://recordings.example.test');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('transcription stays bound to the actual saved interview', () => {
    it('ignores an old scheduled take before external work or lifecycle writes', async () => {
        const { t, id } = await setup();
        const network = vi.fn();
        vi.stubGlobal('fetch', network);
        await t.action(internal.transcription.transcribeMedia, { submissionId: id, storageId: 'audio/replaced-take.mp3', mediaType: 'audio' });
        expect(network).not.toHaveBeenCalled();
        expect(await t.run(ctx => ctx.db.get(id))).toMatchObject({
            audioStorageId: 'audio/current-take.mp3', transcript: 'Saved current transcript', transcriptionStatus: 'complete',
        });
    });

    it.each(['success', 'failure'])('does not attach an old provider %s result after a replacement upload', async outcome => {
        const { t, id } = await setup();
        vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request) => {
            if (String(url).includes('groq.com')) {
                await t.run(ctx => ctx.db.patch(id, { audioStorageId: 'audio/new-take.mp3',
                    transcript: undefined, transcriptionStatus: 'processing' }));
                return outcome === 'success' ? Response.json({ text: 'Stale old words' }) : new Response('provider error', { status: 400 });
            }
            return new Response(new Uint8Array(32), { headers: { 'content-type': 'audio/mpeg', 'content-length': '32' } });
        }));
        await t.action(internal.transcription.transcribeMedia, { submissionId: id, storageId: 'audio/current-take.mp3', mediaType: 'audio' });
        const current = await t.run(ctx => ctx.db.get(id));
        expect(current?.audioStorageId).toBe('audio/new-take.mp3');
        expect(current?.transcript).toBeUndefined();
        expect(current?.transcriptionStatus).toBe('processing');
    });

    it('accepts the current resolved R2 URL used by the AI pipeline', async () => {
        const { t, id } = await setup();
        vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request) => String(url).includes('groq.com')
            ? Response.json({ text: 'The current interview words' })
            : new Response(new Uint8Array(32), { headers: { 'content-type': 'audio/mpeg', 'content-length': '32' } })));
        await t.action(internal.transcription.transcribeMedia, { submissionId: id,
            storageId: 'https://recordings.example.test/audio/current-take.mp3', mediaType: 'audio' });
        expect(await t.run(ctx => ctx.db.get(id))).toMatchObject({ transcript: 'The current interview words', transcriptionStatus: 'complete' });
    });

    it('does not let the old stall timer fail the replacement interview', async () => {
        const { t, id } = await setup();
        const old = await t.run(ctx => ctx.db.get(id));
        await t.run(ctx => ctx.db.patch(id, { audioStorageId: 'audio/new-take.mp3', transcriptionStatus: 'processing' }));
        await t.mutation(internal.submissions.failStalledTranscription, {
            submissionId: id, startedAt: Date.now(), expectedRecording: interviewRecordingFingerprint(old!),
        });
        expect((await t.run(ctx => ctx.db.get(id)))?.transcriptionStatus).toBe('processing');
    });
});
