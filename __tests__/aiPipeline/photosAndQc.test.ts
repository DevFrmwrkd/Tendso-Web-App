import { buildPhotoPrompt, classifyShot, placementKeys, planPolish, PHOTO_RULES } from '@/lib/aiPipeline/photos';
import { basicImageChecks, decideQc, imageInfo, parseVisionVerdict } from '@/lib/aiPipeline/qc';
import { fakeJpeg, makeInput } from './fixtures';

describe('classifyShot', () => {
    it.each([
        [{ role: 'headshot' }, 'portrait'],
        [{ role: 'interior_2' }, 'interior'],
        [{ role: 'exterior' }, 'exterior'],
        [{ role: 'product_1' }, 'detail'],
        [{ label: 'Owner headshot' }, 'portrait'],
        [{ label: 'Haircut in progress' }, 'action'],
        [{ label: 'Chairs and equipment' }, 'interior'],
        [{ label: 'Outside' }, 'exterior'],
        [{ label: 'Price list' }, 'sign'],
        [{ label: 'Sign' }, 'sign'],
        [{ label: 'Tools' }, 'detail'],
    ])('%j → %s', (shot, type) => {
        expect(classifyShot(shot)).toBe(type);
    });
});

describe('planPolish + prompts', () => {
    const shots = [
        { index: 0, url: 'u/head', label: 'Owner headshot' },
        { index: 1, url: 'u/work', label: 'Haircut in progress' },
        { index: 2, url: 'u/inside', label: 'Inside' },
        { index: 3, url: 'u/front', label: 'Outside' },
        { index: 4, url: 'u/sign', label: 'Price list' },
        { index: 5, url: 'u/tools', label: 'Tools' },
    ];

    it('sends the owner and location references with people shots, never signs, and respects the cap', () => {
        const plan = planPolish(shots, { maxPolished: 4, keepOriginals: false, businessType: 'Barbershop' });
        expect(plan.ownerRefUrl).toBe('u/head');
        expect(plan.locationRefUrl).toBe('u/inside');
        expect(plan.items.map((i) => i.shot.index)).toEqual([0, 1, 2, 3]);
        expect(plan.items.find((i) => i.shot.index === 1)!.referenceUrls).toEqual(['u/work', 'u/head', 'u/inside']);
        expect(plan.items.find((i) => i.shot.index === 0)!.referenceUrls).toEqual(['u/head', 'u/inside']);
        expect(plan.items.find((i) => i.shot.index === 2)!.referenceUrls).toEqual(['u/inside']);
        expect(plan.skipped.map((s) => [s.shot.index, s.reason])).toEqual([
            [4, 'signs and price lists are never re-shot'],
            [5, 'over the per-site polishing cap'],
        ]);
    });

    it('keeps every original when the owner asks or the feature is off', () => {
        expect(planPolish(shots, { maxPolished: 6, keepOriginals: true }).items).toEqual([]);
        const off = planPolish(shots, { maxPolished: 6, keepOriginals: false, offReason: 'HIGGSFIELD_API_KEY is not set' });
        expect(off.items).toEqual([]);
        expect(off.skipped.every((s) => s.reason === 'HIGGSFIELD_API_KEY is not set')).toBe(true);
    });

    it('every prompt carries the bar: same person, same room, new camera, bright, never dark or a filter', () => {
        for (const type of ['portrait', 'action', 'interior', 'exterior', 'detail'] as const) {
            const p = buildPhotoPrompt(type, { hasOwnerRef: true, hasLocationRef: true }, 'Barbershop');
            expect(p).toContain(PHOTO_RULES);
            expect(p).toMatch(/new camera position/i);
            expect(p).toMatch(/never dark/i);
            expect(p).toMatch(/never a filter on the same frame/i);
            expect(p).toContain('Reference 2 is the owner reference');
            expect(p).toContain('Reference 3 is the location reference');
            expect(p).toContain('barbershop in the Philippines');
        }
        expect(buildPhotoPrompt('interior', { hasOwnerRef: false, hasLocationRef: true })).toContain('Reference 2 is the location reference');
    });

    it('placementKeys puts the shop front first, the owner as portrait, the rest in the gallery', () => {
        const keys = placementKeys([
            { index: 0, shotType: 'portrait' },
            { index: 1, shotType: 'interior' },
            { index: 3, shotType: 'exterior' },
            { index: 5, shotType: 'detail' },
        ]);
        expect(Object.fromEntries(keys)).toEqual({
            3: 'enhanced_hero', 0: 'enhanced_portrait', 1: 'enhanced_gallery_1', 5: 'enhanced_gallery_2',
        });
    });

    it('uses the input fixture shots too', () => {
        const plan = planPolish(makeInput().shots, { maxPolished: 6, keepOriginals: false });
        expect(plan.items).toHaveLength(4);
    });
});

describe('quality check', () => {
    it('reads JPEG and PNG sizes from headers', () => {
        expect(imageInfo(fakeJpeg(1024, 768))).toEqual({ mime: 'image/jpeg', width: 1024, height: 768 });
        const png = new Uint8Array(40);
        png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 4, 0, 0, 0, 3, 0], 0);
        expect(imageInfo(png)).toEqual({ mime: 'image/png', width: 1024, height: 768 });
        expect(imageInfo(new Uint8Array([1, 2, 3]))).toEqual({ mime: 'unknown' });
    });

    it('basic checks catch tiny, low-res, odd and identical results', () => {
        const original = fakeJpeg(1200, 900, 80_000, 1);
        expect(basicImageChecks(fakeJpeg(1200, 900, 80_000, 2), original).ok).toBe(true);
        expect(basicImageChecks(fakeJpeg(1200, 900, 1000, 2)).reasons[0]).toMatch(/too small/);
        expect(basicImageChecks(fakeJpeg(600, 400, 80_000, 2)).reasons.join()).toMatch(/low resolution/);
        expect(basicImageChecks(fakeJpeg(3000, 900, 80_000, 2)).reasons.join()).toMatch(/aspect ratio/);
        expect(basicImageChecks(original, original).reasons).toContain('identical to the original');
    });

    const good = {
        has_person: true, same_person: true, same_place: true, new_camera_position: true,
        bright_and_natural: true, realistic: true, no_artifacts: true, score: 8, reason: 'ok',
    };
    const ok = basicImageChecks(fakeJpeg(1200, 900, 80_000, 2));

    it('passes only when every rule holds', () => {
        expect(decideQc(ok, parseVisionVerdict(good))).toEqual({ pass: true, reason: 'passed (score 8)' });
        expect(decideQc(ok, parseVisionVerdict({ ...good, new_camera_position: false })).reason).toMatch(/filter/);
        expect(decideQc(ok, parseVisionVerdict({ ...good, bright_and_natural: false })).reason).toMatch(/bright/);
        expect(decideQc(ok, parseVisionVerdict({ ...good, same_person: false })).reason).toMatch(/same person/);
        expect(decideQc(ok, parseVisionVerdict({ ...good, score: 6 })).pass).toBe(false);
        // No person in the shot: same_person null is fine.
        expect(decideQc(ok, parseVisionVerdict({ ...good, has_person: false, same_person: null })).pass).toBe(true);
    });

    it('is fail-closed: no verdict or an unreadable one keeps the original', () => {
        expect(decideQc(ok, null).pass).toBe(false);
        expect(parseVisionVerdict({ score: 9 })).toBeNull();
        expect(parseVisionVerdict({ ...good, score: 'great' })).toBeNull();
        expect(decideQc({ ok: false, reasons: ['too small'], info: { mime: 'unknown' } }, parseVisionVerdict(good)).pass).toBe(false);
    });
});
