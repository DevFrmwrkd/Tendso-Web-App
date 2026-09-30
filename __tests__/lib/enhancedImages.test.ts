import {
    imageKeyBase,
    isArchiveKey,
    mergeEnhancedImages,
    orderEnhancedImageKeys,
    orderedEnhancedEntries,
} from '../../convex/lib/enhancedImages';

/** Every ordering of a small list (n! of them), to prove a sort does not depend on input order. */
const permutations = <T,>(xs: T[]): T[][] =>
    xs.length <= 1 ? [xs] : xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));

/**
 * A Hyperagent render must ADD images. saveStudioContent used to replace the
 * whole enhancedImages map, and every render reuses the same keys, so rendering
 * a second set of six made the first six vanish from the editor's image picker —
 * reported by an admin who rendered 6 more and lost the original 6.
 */

const img = (id: string) => ({ url: `https://files/${id}`, storageId: `sid_${id}`, sourceUrl: `https://agent/${id}` });

const firstRender = {
    enhanced_hero: img('a-hero'),
    enhanced_portrait: img('a-portrait'),
    enhanced_gallery_1: img('a-g1'),
    enhanced_gallery_2: img('a-g2'),
    enhanced_gallery_3: img('a-g3'),
    enhanced_gallery_4: img('a-g4'),
};
const secondRender = {
    enhanced_hero: img('b-hero'),
    enhanced_portrait: img('b-portrait'),
    enhanced_gallery_1: img('b-g1'),
    enhanced_gallery_2: img('b-g2'),
    enhanced_gallery_3: img('b-g3'),
    enhanced_gallery_4: img('b-g4'),
};
const ids = (map: Record<string, unknown>) =>
    orderedEnhancedEntries(map).map(([, v]) => (v as { storageId: string }).storageId);

describe('mergeEnhancedImages', () => {
    it('keeps every image when a second render arrives (the reported bug)', () => {
        const merged = mergeEnhancedImages(firstRender, secondRender);
        expect(Object.keys(merged)).toHaveLength(12);
        for (const v of [...Object.values(firstRender), ...Object.values(secondRender)])
            expect(Object.values(merged)).toContainEqual(v);
    });

    it('gives the canonical keys to the NEW render and archives the old one', () => {
        const merged = mergeEnhancedImages(firstRender, secondRender);
        expect(merged.enhanced_hero).toEqual(secondRender.enhanced_hero);
        expect(merged.enhanced_gallery_1).toEqual(secondRender.enhanced_gallery_1);
        const archived = Object.keys(merged).filter((k) => k.startsWith('enhanced_archive_'));
        expect(archived).toHaveLength(6);
    });

    it('orders the page: new render first, then the previous render in its own order', () => {
        const merged = mergeEnhancedImages(firstRender, secondRender);
        expect(ids(merged)).toEqual([
            'sid_b-hero', 'sid_b-g1', 'sid_b-g2', 'sid_b-g3', 'sid_b-g4', 'sid_b-portrait',
            'sid_a-hero', 'sid_a-g1', 'sid_a-g2', 'sid_a-g3', 'sid_a-g4', 'sid_a-portrait',
        ]);
    });

    it('puts the most recent earlier render ahead of older ones after three renders', () => {
        const third = { enhanced_hero: img('c-hero'), enhanced_gallery_1: img('c-g1') };
        const merged = mergeEnhancedImages(mergeEnhancedImages(firstRender, secondRender), third);
        expect(Object.keys(merged)).toHaveLength(14);
        const order = ids(merged);
        expect(order.slice(0, 2)).toEqual(['sid_c-hero', 'sid_c-g1']);
        expect(order.indexOf('sid_b-hero')).toBeLessThan(order.indexOf('sid_a-hero'));
        expect(order[2]).toBe('sid_b-hero');
    });

    it('changes nothing on an empty push (copy-only re-push)', () => {
        expect(mergeEnhancedImages(firstRender, {})).toEqual(firstRender);
        expect(mergeEnhancedImages(firstRender, undefined)).toEqual(firstRender);
        expect(mergeEnhancedImages(firstRender, null)).toEqual(firstRender);
    });

    it('stores the first render as-is when nothing was stored before', () => {
        expect(mergeEnhancedImages(undefined, firstRender)).toEqual(firstRender);
        expect(mergeEnhancedImages({}, firstRender)).toEqual(firstRender);
    });

    it('does not duplicate a retried callback of the same render (same source URLs)', () => {
        // A retry downloads again, so the blobs are new — only the source URL matches.
        const retry = Object.fromEntries(
            Object.entries(firstRender).map(([k, v]) => [k, { ...v, storageId: `${v.storageId}_retry` }]),
        );
        const merged = mergeEnhancedImages(firstRender, retry);
        expect(Object.keys(merged)).toHaveLength(6);
        expect(merged).toEqual(retry);
    });

    it('keeps legacy role-keyed images from before Studio v0.2 as archives', () => {
        const legacy = { enhanced_headshot: { url: 'u1', storageId: 's1' }, enhanced_exterior: { url: 'u2', storageId: 's2' } };
        const merged = mergeEnhancedImages(legacy, secondRender);
        expect(Object.keys(merged)).toHaveLength(8);
        expect(Object.keys(merged).filter((k) => k.startsWith('enhanced_archive_'))).toHaveLength(2);
        expect(merged.enhanced_headshot).toBeUndefined();
    });

    it('keeps existing archive numbers and never overwrites one', () => {
        const stored = { enhanced_archive_3: img('old'), enhanced_hero: img('a-hero') };
        const merged = mergeEnhancedImages(stored, { enhanced_hero: img('b-hero') });
        expect(merged.enhanced_archive_3).toEqual(img('old'));
        expect(merged.enhanced_archive_4).toEqual(img('a-hero'));
        expect(merged.enhanced_hero).toEqual(img('b-hero'));
    });

    it('never overwrites an incoming key that already looks like an archive', () => {
        const stored = { enhanced_hero: img('a-hero') };
        const incoming = { enhanced_hero: img('b-hero'), enhanced_archive_1: img('b-odd') };
        const merged = mergeEnhancedImages(stored, incoming);
        expect(merged.enhanced_archive_1).toEqual(img('b-odd'));
        expect(Object.values(merged)).toContainEqual(img('a-hero'));
        expect(Object.keys(merged)).toHaveLength(3);
    });

    it('marks only earlier renders as archives, so the builder can leave them off the page', () => {
        const merged = mergeEnhancedImages(firstRender, { enhanced_hero: img('b-hero'), enhanced_gallery_1: img('b-g1') });
        const placed = Object.keys(merged).filter((k) => !isArchiveKey(k));
        expect(placed.sort()).toEqual(['enhanced_gallery_1', 'enhanced_hero']);
        expect(isArchiveKey('enhanced_archive_12')).toBe(true);
        expect(isArchiveKey('enhanced_archive_3_v2')).toBe(true);
        expect(isArchiveKey('enhanced_gallery_1')).toBe(false);
    });

    it('tolerates odd stored shapes without losing them', () => {
        const stored = { enhanced_hero: 'https://plain-string-url', weird: 42 };
        const merged = mergeEnhancedImages(stored, { enhanced_hero: img('b') });
        expect(Object.values(merged)).toContain('https://plain-string-url');
        expect(Object.values(merged)).toContain(42);
    });
});

describe('orderEnhancedImageKeys', () => {
    it('puts the hero first and sorts gallery slots numerically, not as text', () => {
        const keys = ['enhanced_gallery_10', 'enhanced_gallery_2', 'enhanced_portrait', 'enhanced_gallery_1', 'enhanced_hero'];
        expect(orderEnhancedImageKeys(keys)).toEqual([
            'enhanced_hero', 'enhanced_gallery_1', 'enhanced_gallery_2', 'enhanced_gallery_10', 'enhanced_portrait',
        ]);
    });

    it('does not depend on the order the stored object lists its keys', () => {
        const keys = Object.keys(secondRender);
        const reversed = [...keys].reverse();
        expect(orderEnhancedImageKeys(keys)).toEqual(orderEnhancedImageKeys(reversed));
    });

    it('puts a primary image before its variants', () => {
        expect(orderEnhancedImageKeys(['enhanced_hero_v2', 'enhanced_hero'])).toEqual(['enhanced_hero', 'enhanced_hero_v2']);
    });

    it('orders legacy role keys with the exterior leading', () => {
        const legacy = ['enhanced_headshot', 'enhanced_interior_1', 'enhanced_interior_2', 'enhanced_exterior', 'enhanced_product_1', 'enhanced_product_2'];
        expect(orderEnhancedImageKeys(legacy)).toEqual([
            'enhanced_exterior', 'enhanced_interior_1', 'enhanced_interior_2', 'enhanced_product_1', 'enhanced_product_2', 'enhanced_headshot',
        ]);
    });

    it('places archives after every current image, most recent first', () => {
        const keys = ['enhanced_archive_1', 'enhanced_archive_7', 'enhanced_hero', 'enhanced_whatever'];
        expect(orderEnhancedImageKeys(keys)).toEqual(['enhanced_hero', 'enhanced_whatever', 'enhanced_archive_7', 'enhanced_archive_1']);
    });

    it('is a total order: every input order gives the same result, odd keys included', () => {
        // gallery_1a is off-contract but reachable: ingest stores an unmappable key
        // under its raw name. It used to form a cycle with gallery_2 and gallery_10.
        const keys = ['enhanced_gallery_2', 'enhanced_gallery_10', 'gallery_1a', 'enhanced_hero', 'enhanced_archive_2', 'archive_2a'];
        const results = new Set(permutations(keys).map((p) => orderEnhancedImageKeys(p).join(',')));
        expect(results.size).toBe(1);
        expect(orderEnhancedImageKeys(keys)).toEqual([
            'enhanced_hero', 'enhanced_gallery_2', 'enhanced_gallery_10', 'gallery_1a', 'enhanced_archive_2', 'archive_2a',
        ]);
    });

    it('reads a key base the same way the builder always has', () => {
        expect(imageKeyBase('enhanced_gallery_3_v2')).toBe('gallery_3');
        expect(imageKeyBase('hero')).toBe('hero');
    });
});
