import { runPipelineLocally, type PipelineDeps } from '@/lib/aiPipeline/runner';
import { backoffMs, MAX_ATTEMPTS, nextStep, PipelineError, planAfterFailure, planWait, STEPS } from '@/lib/aiPipeline/stateMachine';
import { aiPipelineEnabled, higgsfieldConfig, llmOrder, pipelineTimeoutMs, polishingOffReason, studioFallbackEnabled } from '@/lib/aiPipeline/config';
import { costRates, estimateCost } from '@/lib/aiPipeline/costs';
import type { PhotoResult, PipelineInput } from '@/lib/aiPipeline/types';
import { fakeJpeg, makeInput } from './fixtures';

const MIN = 60_000;
const ENV_ON = { HIGGSFIELD_API_KEY: 'id:secret', HIGGSFIELD_IMAGE_ENDPOINT: 'some/edit/endpoint' };

const FACTS_JSON = {
    businessName: 'Ariel Barber', ownerName: 'Ariel', businessType: 'Barbershop', city: 'Lipa',
    services: [{ name: 'Haircut', price: '₱150' }, { name: 'Shave', price: '₱100', note: 'with hot towel' }, { name: 'Perm', price: '₱999' }],
    hours: [{ days: 'Mon-Sat', time: '8am-7pm' }],
    yearStarted: '2014', story: 'Started in the market in 2014.', customersLove: ['clean fades'],
    paymentMethods: ['cash'], language: 'taglish',
};
const COPY_JSON = {
    tagline: 'Barbershop in Lipa', heroHeadline: 'Clean fades since 2014', heroSub: 'Walk in, sit down, look sharp.',
    aboutHeadline: 'From a market stall to our own shop', aboutLead: 'I started in the market in 2014.',
    servicesHeadline: 'Cuts and shaves', serviceDescriptions: [{ name: 'Shave', desc: 'Hot towel shave' }],
    ctaHeading: 'Drop by', footerBlurb: 'Barbershop in Lipa.',
};
const GOOD_VERDICT = {
    has_person: true, same_person: true, same_place: true, new_camera_position: true,
    bright_and_natural: true, realistic: true, no_artifacts: true, score: 8, reason: 'ok',
};

/** Mocked providers with a fake clock. Override any provider per test. */
function harness(over: Partial<PipelineDeps> = {}, env: Record<string, string> = ENV_ON) {
    let clock = Date.UTC(2026, 9, 21, 2);
    const calls = { llm: [] as string[], images: [] as string[][], vision: 0, saved: [] as PhotoResult[], builds: [] as Array<Parameters<PipelineDeps['buildSite']>[0]>, clips: [] as string[] };
    let stored = 0;
    const deps: PipelineDeps = {
        env,
        now: () => clock,
        log: () => undefined,
        llmJson: async (req) => {
            calls.llm.push(req.purpose);
            clock += 20_000;
            return { json: req.purpose === 'facts' ? FACTS_JSON : COPY_JSON, usage: { provider: 'gemini', model: 'm', inputTokens: 2000, outputTokens: 500 } };
        },
        transcribeClip: async (url) => { calls.clips.push(url); return 'Gupit po 150.'; },
        ensureMainTranscript: async (input: PipelineInput) => ({ kind: 'ready', transcript: input.transcript }),
        templateInfo: () => ({ code: 'barbershop:BP', paths: ['hero.headline', 'services.items.N.title', 'about.quote'] }),
        generateImage: async (req) => { calls.images.push(req.imageUrls); clock += 60_000; return { url: `${req.imageUrls[0]}#polished`, requestId: 'r1' }; },
        fetchBytes: async (url) => ({ bytes: fakeJpeg(1400, 1000, 90_000, url.includes('#polished') ? 2 : 1), contentType: 'image/jpeg' }),
        visionCheck: async () => { calls.vision++; return { json: GOOD_VERDICT }; },
        storeImage: async () => ({ storageId: `st_${++stored}`, url: `https://convex/st_${stored}` }),
        savePhotoResult: async (r) => { calls.saved.push(r); },
        buildSite: async (req) => { calls.builds.push(req); clock += 90_000; return { templateName: 'astro', htmlStorageId: 'html_1' }; },
        ...over,
    };
    const sleep = async (ms: number) => { clock += ms; };
    return { deps, calls, sleep, advance: (ms: number) => { clock += ms; } };
}

describe('runPipelineLocally (orchestrator with mocked providers)', () => {
    it('runs the four steps in order and hands the builder honest content and polished photos', async () => {
        const h = harness();
        const steps: string[] = [];
        const res = await runPipelineLocally(makeInput(), h.deps, { timeoutMs: 30 * MIN, sleep: h.sleep, onStep: (s, st) => steps.push(`${s}:${st}`) });

        expect(res.status).toBe('done');
        expect(steps).toEqual(STEPS.flatMap((s) => [`${s}:running`, `${s}:done`]));
        expect(h.calls.llm).toEqual(['facts', 'copy']);

        // Facts grounded: ₱999 was never said, so the perm keeps no price.
        expect(res.state.facts!.services.map((s) => s.price)).toEqual(['₱150', '₱100', '']);
        // Typed name wins over the heard one.
        expect(res.state.facts!.businessName).toBe("Mang Ariel's Barbershop");

        const build = h.calls.builds[0];
        expect(build.templateCode).toBe('barbershop:BP');
        expect(build.content.hero.headline).toBe('Clean fades since 2014');
        expect(build.content.why).toEqual([]);
        expect(Object.keys(build.enhancedImages!).sort()).toEqual(['enhanced_gallery_1', 'enhanced_gallery_2', 'enhanced_hero', 'enhanced_portrait']);
        // The shop front (index 3) is the hero, polished and stored.
        const front = res.state.photos!['3'];
        expect(front.outcome).toBe('polished');
        expect(build.enhancedImages!.enhanced_hero).toEqual({ url: front.url, storageId: front.storageId });

        // The owner shot carries the location ref; interiors only themselves + the other room ref.
        expect(h.calls.images).toContainEqual(['https://r2.example/headshot.jpg', 'https://r2.example/inside.jpg']);
        expect(h.calls.saved).toHaveLength(4);
        expect(res.usage).toMatchObject({ llmCalls: 6, imageJobs: 4, visionChecks: 4 });

        // About 20 minutes or less on this (slow-ish) fake clock.
        const took = res.events[res.events.length - 1].at - res.events[0].at;
        expect(took).toBeLessThan(20 * MIN);
    });

    it('keeps the original when a result fails the quality check, and when polishing throws', async () => {
        let n = 0;
        const h = harness({
            visionCheck: async () => ({ json: { ...GOOD_VERDICT, bright_and_natural: false } }),
            generateImage: async (req) => {
                if (++n === 2) throw new Error('Higgsfield job nsfw');
                return { url: `${req.imageUrls[0]}#polished` };
            },
        });
        const res = await runPipelineLocally(makeInput(), h.deps, { timeoutMs: 30 * MIN, sleep: h.sleep });
        expect(res.status).toBe('done');
        const photos = Object.values(res.state.photos!);
        expect(photos.every((p) => p.outcome === 'kept')).toBe(true);
        expect(photos.some((p) => /not bright and natural/.test(p.reason))).toBe(true);
        expect(photos.some((p) => /nsfw/.test(p.reason))).toBe(true);
        // Nothing polished → every active placement explicitly uses the current original.
        expect(Object.values(h.calls.builds[0].enhancedImages!).map((image) => image.url).sort()).toEqual(makeInput().shots.map((shot) => shot.url).sort());
    });

    it('is cleanly off without a Higgsfield key: no image jobs, originals used', async () => {
        const h = harness({}, {});
        const res = await runPipelineLocally(makeInput(), h.deps, { timeoutMs: 30 * MIN, sleep: h.sleep });
        expect(res.status).toBe('done');
        expect(h.calls.images).toEqual([]);
        expect(h.calls.vision).toBe(0);
        expect(Object.values(res.state.photos ?? {})).toEqual([]);
        expect(Object.values(h.calls.builds[0].enhancedImages!).every((image) => !image.storageId)).toBe(true);
    });

    it('honours "keep originals"', async () => {
        const h = harness();
        await runPipelineLocally(makeInput({ keepOriginals: true }), h.deps, { timeoutMs: 30 * MIN, sleep: h.sleep });
        expect(h.calls.images).toEqual([]);
    });

    it('retries a transient failure with backoff, then succeeds', async () => {
        let failures = 1;
        const base = harness();
        const h = harness({
            llmJson: async (req) => {
                if (req.purpose === 'copy' && failures-- > 0) throw new Error('Gemini 503');
                return base.deps.llmJson(req);
            },
        });
        const res = await runPipelineLocally(makeInput(), h.deps, { timeoutMs: 30 * MIN, sleep: h.sleep });
        expect(res.status).toBe('done');
        expect(res.events.filter((e) => e.status === 'retry').map((e) => e.step)).toEqual(['writing_pages']);
    });

    it('gives up after the attempt limit and asks for the Studio fallback', async () => {
        const h = harness({ buildSite: async () => { throw new Error('builder 502'); } });
        const res = await runPipelineLocally(makeInput(), h.deps, { timeoutMs: 30 * MIN, sleep: h.sleep });
        expect(res.status).toBe('failed');
        expect(res.fallback).toBe(true);
        expect(res.error).toMatch(/building_site failed 3 times/);
        expect(res.events.filter((e) => e.step === 'building_site' && e.status === 'retry')).toHaveLength(2);
    });

    it('stops without fallback on a permanent "already built" refusal', async () => {
        const h = harness({ buildSite: async () => { throw new PipelineError('A site was already built', 'already_built', false); } });
        const res = await runPipelineLocally(makeInput(), h.deps, { timeoutMs: 30 * MIN, sleep: h.sleep });
        expect(res).toMatchObject({ status: 'failed', fallback: false });
        expect(res.events.filter((e) => e.status === 'retry')).toHaveLength(0);
    });

    it('fails permanently (with fallback) when there is no interview at all', async () => {
        const h = harness();
        const res = await runPipelineLocally(makeInput({ answers: [], transcript: '' }), h.deps, { timeoutMs: 30 * MIN, sleep: h.sleep });
        expect(res).toMatchObject({ status: 'failed', fallback: true });
        expect(res.error).toMatch(/no interview/);
        expect(h.calls.llm).toEqual([]);
    });

    it('waits for a recording that is still being transcribed, then reads it', async () => {
        let waits = 2;
        const h = harness({
            ensureMainTranscript: async () => (waits-- > 0
                ? { kind: 'wait', delayMs: 30_000, note: 'still transcribing' }
                : { kind: 'ready', transcript: 'Gupit 150, shave 100, since 2014, alas otso hanggang alas siyete' }),
        });
        const res = await runPipelineLocally(makeInput({ answers: [], contentSource: undefined, mainMediaUrl: 'https://r2/v.mp4' }), h.deps, { timeoutMs: 30 * MIN, sleep: h.sleep });
        expect(res.status).toBe('done');
        expect(res.events.filter((e) => e.status === 'wait')).toHaveLength(2);
        expect(res.state.input.transcript).toMatch(/Gupit/);
        expect(res.usage.transcribedMainRecording).toBe(1);
    });

    it('transcribes recorded answers (owner app) before reading them', async () => {
        const h = harness();
        const input = makeInput({ answers: [{ q: 'Services?', a: '', mediaUrl: 'https://r2/a0.m4a' }] });
        const res = await runPipelineLocally(input, h.deps, { timeoutMs: 30 * MIN, sleep: h.sleep });
        expect(res.status).toBe('done');
        expect(h.calls.clips).toEqual(['https://r2/a0.m4a']);
        expect(res.state.clipTranscripts).toEqual({ 0: 'Gupit po 150.' });
    });

    it('fails on the overall deadline', async () => {
        const h = harness({ generateImage: async (req) => { h.advance(20 * MIN); return { url: `${req.imageUrls[0]}#p` }; } });
        const res = await runPipelineLocally(makeInput(), h.deps, { timeoutMs: 30 * MIN, sleep: h.sleep });
        expect(res.status).toBe('failed');
        expect(res.error).toBe('timed out');
        expect(h.calls.builds).toHaveLength(0);
    });

    it('a retried photo step skips photos already finished (idempotent)', async () => {
        const h = harness();
        const first = await runPipelineLocally(makeInput(), h.deps, { timeoutMs: 30 * MIN, sleep: h.sleep });
        const again = harness();
        const { executeStep } = await import('@/lib/aiPipeline/runner');
        const out = await executeStep('polishing_photos', { input: makeInput(), photos: first.state.photos }, again.deps);
        expect(out.kind).toBe('done');
        expect(again.calls.images).toEqual([]);
    });
});

describe('state machine', () => {
    const base = { step: 'writing_pages' as const, now: 0, deadlineAt: 30 * MIN };

    it('retries with growing backoff until the attempt limit', () => {
        expect(planAfterFailure({ ...base, attempt: 1, error: new Error('x') })).toEqual({ action: 'retry', delayMs: backoffMs(1), attempt: 2 });
        expect(backoffMs(2)).toBeGreaterThan(backoffMs(1));
        expect(planAfterFailure({ ...base, attempt: MAX_ATTEMPTS.writing_pages, error: new Error('x') }).action).toBe('fail');
    });

    it('does not retry past the deadline, or a permanent error', () => {
        expect(planAfterFailure({ ...base, attempt: 1, now: 30 * MIN - 1000, error: new Error('x') })).toMatchObject({ action: 'fail', fallback: true });
        expect(planAfterFailure({ ...base, attempt: 1, error: new PipelineError('no', 'published', false) })).toEqual({ action: 'fail', reason: 'no', fallback: false });
        expect(planWait({ now: 0, deadlineAt: 10_000, delayMs: 30_000, note: 'x' }).action).toBe('fail');
    });

    it('walks the four steps in order', () => {
        expect(STEPS.map(nextStep)).toEqual(['writing_pages', 'polishing_photos', 'building_site', null]);
    });
});

describe('config and costs', () => {
    it('is off by default and only on when asked', () => {
        expect(aiPipelineEnabled({})).toBe(false);
        expect(aiPipelineEnabled({ AI_PIPELINE_ENABLED: 'false' })).toBe(false);
        expect(aiPipelineEnabled({ AI_PIPELINE_ENABLED: 'true' })).toBe(true);
        expect(studioFallbackEnabled({})).toBe(true);
        expect(studioFallbackEnabled({ AI_PIPELINE_STUDIO_FALLBACK: 'off' })).toBe(false);
        expect(pipelineTimeoutMs({})).toBe(30 * MIN);
        expect(llmOrder({ AI_PIPELINE_LLM_ORDER: 'groq, nope' })).toEqual(['groq']);
    });

    it('Higgsfield needs a key AND an endpoint id (no guessed default)', () => {
        expect(higgsfieldConfig({ HIGGSFIELD_API_KEY: 'a:b' })).toBeNull();
        expect(polishingOffReason({ HIGGSFIELD_API_KEY: 'a:b' })).toBe('HIGGSFIELD_IMAGE_ENDPOINT is not set');
        expect(polishingOffReason({})).toBe('HIGGSFIELD_API_KEY is not set');
        expect(higgsfieldConfig({ HIGGSFIELD_API_KEY_ID: 'a', HIGGSFIELD_API_KEY_SECRET: 'b', HIGGSFIELD_IMAGE_ENDPOINT: '/x/y', HIGGSFIELD_IMAGE_PARAMS: '{"resolution":"1k"}' }))
            .toEqual({ authorization: 'Key a:b', endpoint: 'x/y', baseUrl: 'https://api.higgsfield.ai', extraParams: { resolution: '1k' } });
    });

    it('estimates a typical site at well under a dollar', () => {
        const est = estimateCost({ transcribedMainRecording: 1, llmInputTokens: 30_000, llmOutputTokens: 6_000, imageJobs: 6 }, costRates({}));
        expect(est.imagesUsd).toBeCloseTo(0.6);
        expect(est.totalUsd).toBeLessThan(1);
    });
});


describe('photo rebuild identity', () => {
    it.each(['replacement', 'reorder', 'type', 'references', 'legacy'])(
        'regenerates results after a %s change', async (change) => {
            const first = harness();
            const res = await runPipelineLocally(makeInput(), first.deps, { timeoutMs: 30 * MIN, sleep: first.sleep });
            const input = makeInput();
            if (change === 'replacement') input.shots[3].url = 'https://r2.example/new-front.jpg';
            if (change === 'reorder') [input.shots[1].url, input.shots[3].url] = [input.shots[3].url, input.shots[1].url];
            if (change === 'type') input.shots[3].role = 'interior_3';
            if (change === 'references') input.shots[1].url = 'https://r2.example/new-room.jpg';
            if (change === 'legacy') for (const photo of Object.values(res.state.photos!)) delete photo.referenceUrls;
            const again = harness();
            const { executeStep } = await import('@/lib/aiPipeline/runner');
            await executeStep('polishing_photos', { input, photos: res.state.photos }, again.deps);
            expect(again.calls.images.length).toBeGreaterThan(0);
            if (change === 'references') expect(again.calls.images).toContainEqual([input.shots[0].url, input.shots[1].url]);
            else expect(again.calls.images.some((refs) => refs[0] === input.shots[3].url)).toBe(true);
        },
    );

    it('replaces inherited polished results with originals when requested', async () => {
        const first = harness();
        const res = await runPipelineLocally(makeInput(), first.deps, { timeoutMs: 30 * MIN, sleep: first.sleep });
        const again = harness();
        const { executeStep } = await import('@/lib/aiPipeline/runner');
        const out = await executeStep('polishing_photos', { input: makeInput({ keepOriginals: true }), photos: res.state.photos }, again.deps);
        expect(out.kind).toBe('done');
        if (out.kind !== 'done') throw new Error('not done');
        expect(again.calls.images).toEqual([]);
        expect(Object.values(out.patch.enhancedImages!).map((image) => image.url).sort()).toEqual(makeInput().shots.map((shot) => shot.url).sort());
        expect(out.patch.photos).toEqual({});
    });
});
