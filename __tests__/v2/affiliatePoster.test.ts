import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { BoldOfferPoster, prepareAffiliatePosterForPrint } from '@/components/affiliate/BoldOfferPoster';
import { createAffiliatePoster, POSTER_PAGE } from '@/lib/affiliatePoster';

jest.mock('@/components/v2/fonts', () => ({ v2Fonts: 'test-v2-fonts' }));

const model = createAffiliatePoster({ handle: 'ana-local', displayName: 'Ana’s saved page',
    photo: 'https://photos.example.com/saved.jpg', referralCode: 'LEGACY27', price: 2661 });
const brand = '/v2/brand/mark-ink-256.png';
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
const originalImage = Object.getOwnPropertyDescriptor(globalThis, 'Image');
const images: TestImage[] = [];
let fonts: { load: jest.Mock; ready: Promise<unknown> };

class TestImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    complete = false;
    naturalWidth = 0;
    naturalHeight = 0;
    private source = '';
    constructor() { images.push(this); }
    set src(value: string) { this.source = value; }
    get src() { return this.source; }
    decode = jest.fn(async () => undefined);
    succeed() { this.complete = true; this.naturalWidth = 128; this.naturalHeight = 128; this.onload?.(); }
    fail() { this.complete = true; this.onerror?.(); }
}

async function waitForImages() {
    // Fonts settle first; permit the subsequent image probes to be installed.
    for (let i = 0; i < 12; i++) await Promise.resolve();
}

beforeEach(() => {
    images.length = 0;
    fonts = { load: jest.fn(async () => []), ready: Promise.resolve() };
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { fonts } });
    Object.defineProperty(globalThis, 'Image', { configurable: true, value: TestImage });
});
afterEach(() => {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
    if (originalImage) Object.defineProperty(globalThis, 'Image', originalImage);
    else Reflect.deleteProperty(globalThis, 'Image');
    jest.useRealTimers();
});

describe('web Bold offer artwork', () => {
    it('renders the real saved offer, photo and code in a vector A4 document', () => {
        const html = renderToStaticMarkup(createElement(BoldOfferPoster, { model }));
        expect(html).toContain(`viewBox="0 0 ${POSTER_PAGE.width} ${POSTER_PAGE.height}"`);
        expect(html).toContain('test-v2-fonts');
        expect(html).toContain('Ana’s saved page');
        expect(html).toContain('₱2,661');
        expect(html).toContain('LEGACY27');
        expect(html).toContain('href="https://photos.example.com/saved.jpg"');
        expect(html).toContain('tendso.com/v2/a/ana-local');
        expect(html).toContain('website offer.');
        expect(html).not.toContain('MIKA30');
        expect(html).not.toContain('Mika Santos');
        expect(html).not.toContain('/earn');
        expect(html).not.toContain('Scan to order');
        expect(html).not.toContain('<canvas');
    });

    it('escapes names and codes as text instead of introducing SVG or script markup', () => {
        const hostile = createAffiliatePoster({ ...model, handle: 'ana-local', displayName: '<script>name</script>', referralCode: '<image onload="attack()">' });
        const html = renderToStaticMarkup(createElement(BoldOfferPoster, { model: hostile }));
        expect(html).toContain('&lt;script&gt;name&lt;/script&gt;');
        expect(html).not.toContain('<script>name');
        expect(html).not.toContain('onload="attack()"');
    });

    it('uses initials when the saved photo is unavailable, without inventing a creator code', () => {
        const fallback = createAffiliatePoster({ handle: 'ana-local', displayName: 'Ana Cruz', price: 4999 });
        const html = renderToStaticMarkup(createElement(BoldOfferPoster, { model: fallback }));
        expect(html).toContain('Shared by Ana Cruz');
        expect(html).not.toContain('CREATOR CODE');
        expect(html).not.toContain('Enter this code');
        expect(html).not.toContain('Save ₱');
        expect(html).not.toContain('photos.example.com');
    });

    it('keeps portrait clipping identifiers separate for the visible and print copies', () => {
        const html = renderToStaticMarkup(createElement('div', null,
            createElement(BoldOfferPoster, { model }), createElement(BoldOfferPoster, { model })));
        const clips = [...html.matchAll(/<clipPath\b[^>]*id="([^"]+)"/g)].map(match => match[1]);
        expect(clips).toHaveLength(2);
        expect(new Set(clips).size).toBe(2);
        for (const clip of clips) expect(html).toContain(`clip-path="url(#${clip})"`);
    });
});

describe('web poster print preflight', () => {
    it('waits for both font readiness and artwork images before returning a printable document', async () => {
        let fontsReady!: () => void;
        fonts.ready = new Promise<void>(resolve => { fontsReady = resolve; });
        let settled = false;
        const operation = prepareAffiliatePosterForPrint(model, 'Onest').then(value => { settled = true; return value; });
        await waitForImages();
        expect(settled).toBe(false);
        fontsReady();
        await waitForImages();
        expect(fonts.load).toHaveBeenCalled();
        expect(images.map(image => image.src).sort()).toEqual([brand, model.photo!].sort());
        images.find(image => image.src === brand)!.succeed();
        await waitForImages();
        expect(settled).toBe(false);
        images.find(image => image.src === model.photo)!.succeed();
        const ready = await operation;
        expect(ready).toEqual({ model, omitBrandImage: false });
        expect(settled).toBe(true);
    });

    it('falls back to initials after a broken photo without altering saved price, name, QR link or creator code', async () => {
        const operation = prepareAffiliatePosterForPrint(model, 'Onest');
        await waitForImages();
        images.find(image => image.src === brand)!.succeed();
        images.find(image => image.src === model.photo)!.fail();
        const ready = await operation;
        expect(ready.model).toEqual({ ...model, photo: null });
        expect(ready.omitBrandImage).toBe(false);
    });

    it('keeps the wordmark and complete offer printable if the small brand image cannot load', async () => {
        const operation = prepareAffiliatePosterForPrint(model, 'Onest');
        await waitForImages();
        images.find(image => image.src === brand)!.fail();
        images.find(image => image.src === model.photo)!.succeed();
        const ready = await operation;
        expect(ready).toEqual({ model, omitBrandImage: true });
        const html = renderToStaticMarkup(createElement(BoldOfferPoster, ready));
        expect(html).toContain('tendso');
        expect(html).toContain('LEGACY27');
        expect(html).not.toContain(`href="${brand}"`);
    });

    it('uses the initials fallback when the browser loads but cannot decode the saved photo', async () => {
        const operation = prepareAffiliatePosterForPrint(model, 'Onest');
        await waitForImages();
        const photo = images.find(image => image.src === model.photo)!;
        photo.decode.mockRejectedValue(new Error('Unsupported image'));
        images.find(image => image.src === brand)!.succeed();
        photo.succeed();
        expect((await operation).model).toEqual({ ...model, photo: null });
    });

    it('bounds stalled image loading and returns a text-only fallback instead of leaving Print pending', async () => {
        jest.useFakeTimers();
        const operation = prepareAffiliatePosterForPrint(model, 'Onest');
        await jest.advanceTimersByTimeAsync(8001);
        expect(await operation).toEqual({ model: { ...model, photo: null }, omitBrandImage: true });
    });

    it('rejects a stalled font load instead of printing before the poster font is ready', async () => {
        jest.useFakeTimers();
        fonts.ready = new Promise(() => {});
        const operation = prepareAffiliatePosterForPrint(model, 'Onest');
        const rejection = expect(operation).rejects.toThrow('fonts');
        await jest.advanceTimersByTimeAsync(10001);
        await rejection;
    });
});
