/**
 * The generatedWebsites.enhancedImages map — how Hyperagent renders are kept,
 * and in what order they reach the website and the editor's image picker.
 *
 * Pure functions, no Convex imports: convex/hyperagent.ts merges with them, the
 * website builder (app/api/generate-website) and the admin editor order with
 * them, and __tests__/lib/enhancedImages.test.ts pins them.
 *
 * KEY GRAMMAR. `enhanced_<base>` with an optional `_v<N>` variant suffix:
 *   hero · portrait · gallery_<N>                     Tendso Studio v0.2 placements
 *   headshot · interior_1/2 · exterior · product_1/2  legacy role keys
 *   archive_<N>                                        an image from an EARLIER render
 */

export type EnhancedImages = Record<string, unknown>;

const isRecord = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === 'object' && !Array.isArray(v);

/** `enhanced_gallery_3_v2` -> `gallery_3`. */
export function imageKeyBase(key: string): string {
    return key.replace(/^enhanced_/, '').replace(/_v\d+$/, '');
}

const variantOf = (key: string): number => {
    const m = /_v(\d+)$/.exec(key);
    return m ? Number(m[1]) : 0;
};

const numberAfter = (base: string, prefix: string): number | null => {
    const m = new RegExp(`^${prefix}_(\\d+)$`).exec(base);
    return m ? Number(m[1]) : null;
};

/**
 * Where a key sits in the page order. Templates place images BY POSITION
 * (photos[0] is the hero and the About lead, the auto gallery is the first
 * six), so this rank is what decides where each image appears. The latest
 * render's lead image comes first, then its set, then images from earlier
 * renders — newest render first.
 */
function rank(key: string): number {
    const base = imageKeyBase(key);
    if (base === 'hero') return 0;
    if (base === 'exterior') return 1;
    if (base.startsWith('gallery_')) return 2;
    if (base.startsWith('interior')) return 3;
    if (base.startsWith('product')) return 4;
    if (base === 'portrait') return 5;
    if (base === 'headshot') return 6;
    if (base.startsWith('archive_')) return 8;
    return 7;
}

/**
 * The keys in page order. Deterministic whatever order the stored object
 * comes back in: gallery_<N> and archive_<N> sort by number (archives
 * highest first — a higher number was archived more recently), a primary
 * image precedes its `_vN` variants, and ties keep their incoming order.
 */
export function orderEnhancedImageKeys(keys: string[]): string[] {
    return keys
        .map((key, i) => ({ key, i }))
        .sort((a, b) => {
            const ra = rank(a.key), rb = rank(b.key);
            if (ra !== rb) return ra - rb;
            const ba = imageKeyBase(a.key), bb = imageKeyBase(b.key);
            const ga = numberAfter(ba, 'gallery'), gb = numberAfter(bb, 'gallery');
            if (ga !== null && gb !== null && ga !== gb) return ga - gb;
            const aa = numberAfter(ba, 'archive'), ab = numberAfter(bb, 'archive');
            if (aa !== null && ab !== null && aa !== ab) return ab - aa;
            if (ba !== bb) return ba < bb ? -1 : 1;
            const va = variantOf(a.key), vb = variantOf(b.key);
            if (va !== vb) return va - vb;
            return a.i - b.i;
        })
        .map((x) => x.key);
}

/** `[key, value]` pairs of a stored map, in page order. */
export function orderedEnhancedEntries<T = unknown>(images: Record<string, T>): Array<[string, T]> {
    return orderEnhancedImageKeys(Object.keys(images)).map((k) => [k, images[k]]);
}

/** What identifies one stored image across pushes: its blob, or the URL it came from. */
function identities(value: unknown): string[] {
    if (typeof value === 'string') return value ? [`url:${value}`] : [];
    if (!isRecord(value)) return [];
    const out: string[] = [];
    if (typeof value.storageId === 'string' && value.storageId) out.push(`sid:${value.storageId}`);
    if (typeof value.sourceUrl === 'string' && value.sourceUrl) out.push(`src:${value.sourceUrl}`);
    return out;
}

/**
 * Merge a new render into the stored set. A render ADDS images; it never
 * takes one away.
 *
 * THE BUG THIS FIXES. saveStudioContent replaced the whole map with each
 * push, and every render reuses the same keys (enhanced_hero,
 * enhanced_gallery_1, …). Rendering a second set of six therefore made the
 * first six vanish from the image picker, although their files were still in
 * Convex storage with nothing pointing at them.
 *
 *  - The new render owns the canonical keys, so the latest hero is the hero.
 *  - Every earlier non-archive image moves to `enhanced_archive_<N>`, numbered
 *    above any existing archive so the newest earlier render sorts first
 *    among the archives, in its own page order.
 *  - Existing archives keep their numbers.
 *  - An image already in the incoming set (same storage blob, or same source
 *    URL — a retried callback) is not kept twice.
 *  - An empty push changes nothing: a copy-only re-push must not touch images.
 */
export function mergeEnhancedImages(existing: unknown, incoming: unknown): EnhancedImages {
    const prev: EnhancedImages = isRecord(existing) ? existing : {};
    const next: EnhancedImages = isRecord(incoming) ? incoming : {};
    if (Object.keys(next).length === 0) return { ...prev };

    const out: EnhancedImages = { ...next };
    const seen = new Set(Object.values(next).flatMap(identities));
    const keep = (value: unknown): boolean => {
        const ids = identities(value);
        if (ids.some((id) => seen.has(id))) return false;
        ids.forEach((id) => seen.add(id));
        return true;
    };

    // Archives already in the store keep their number.
    const prevKeys = orderEnhancedImageKeys(Object.keys(prev));
    let maxArchive = 0;
    for (const key of prevKeys) {
        const n = numberAfter(imageKeyBase(key), 'archive');
        if (n !== null) maxArchive = Math.max(maxArchive, n);
    }
    const archiveKeyFor = (n: number) => `enhanced_archive_${n}`;
    const existingArchives = prevKeys.filter((k) => numberAfter(imageKeyBase(k), 'archive') !== null);
    for (const key of existingArchives) {
        if (!keep(prev[key])) continue;
        if (!(key in out)) out[key] = prev[key];
        else out[archiveKeyFor(++maxArchive)] = prev[key];
    }

    // The previous render's images, in their page order, become the newest
    // archives: numbered from the top down so "highest first" reproduces
    // their order (its hero first).
    const toArchive = prevKeys
        .filter((k) => numberAfter(imageKeyBase(k), 'archive') === null)
        .filter((k) => keep(prev[k]));
    toArchive.forEach((key, i) => {
        out[archiveKeyFor(maxArchive + toArchive.length - i)] = prev[key];
    });
    return out;
}
