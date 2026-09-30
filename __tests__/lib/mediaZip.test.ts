import { buildMediaFileList, downloadMediaZip, extensionFor, safeName } from '@/lib/mediaZip';
import { readZip } from './readZip';

/**
 * The admin's "Download all (.zip)" on a submission's Photos card: originals
 * plus every AI-enhanced image, zipped in the browser.
 */

type FakeFile = { status?: number; type?: string; body?: string };
const fakeFetch = (files: Record<string, FakeFile>) =>
    (async (url: string) => {
        const f = files[url];
        if (!f) throw new TypeError('Failed to fetch');
        const bytes = new TextEncoder().encode(f.body ?? `bytes of ${url}`);
        return {
            ok: (f.status ?? 200) < 400,
            status: f.status ?? 200,
            headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? f.type ?? 'image/jpeg' : null) },
            arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        };
    }) as unknown as typeof fetch;

describe('safeName', () => {
    it('keeps a readable business name and strips what file systems reject', () => {
        expect(safeName('Jennifer & Agie’s Flowershop photos')).toBe('Jennifer & Agie’s Flowershop photos');
        expect(safeName('A/B:C*D?E"F<G>H|I')).toBe('A-B-C-D-E-F-G-H-I');
        expect(safeName('  ..hidden.  ')).toBe('hidden');
        expect(safeName('', 'photos')).toBe('photos');
    });
});

describe('extensionFor', () => {
    it('prefers the served content type', () => {
        expect(extensionFor('image/jpeg', 'https://x/a')).toBe('jpg');
        expect(extensionFor('image/png; charset=binary', 'https://x/a.jpg')).toBe('png');
        expect(extensionFor('image/webp', 'https://x/a')).toBe('webp');
    });

    it('falls back to the URL, then to jpg', () => {
        expect(extensionFor('application/octet-stream', 'https://x/photo.PNG?v=2')).toBe('png');
        expect(extensionFor(null, 'https://x/photo.jpeg')).toBe('jpg');
        expect(extensionFor(null, 'https://r2.dev/images/17905647826')).toBe('jpg');
    });
});

describe('buildMediaFileList', () => {
    it('numbers originals in upload order and names AI images by slot', () => {
        const files = buildMediaFileList({
            originals: ['https://r2/a', 'https://r2/b'],
            enhanced: [{ key: 'enhanced_hero', url: 'https://cv/h' }, { key: 'enhanced_archive_2', url: 'https://cv/x' }],
        });
        expect(files.map((f) => `${f.folder}/${f.name}`)).toEqual([
            'originals/photo-01', 'originals/photo-02', 'ai-enhanced/hero', 'ai-enhanced/archive_2',
        ]);
    });

    it('keeps an unresolved file in the list (it is reported, not silently dropped)', () => {
        const files = buildMediaFileList({ originals: ['kg2storageid', null], enhanced: [{ key: 'enhanced_hero', url: null }] });
        expect(files.map((f) => f.url)).toEqual(['', '', '']);
    });
});

describe('downloadMediaZip', () => {
    it('zips every file with the extension its server reports, in order', async () => {
        let delivered: { zip: Uint8Array; name: string } | null = null;
        const progress: string[] = [];
        const result = await downloadMediaZip({
            zipName: 'Jennifer & Agie’s Flowershop photos',
            files: buildMediaFileList({
                originals: ['https://r2/a', 'https://r2/b'],
                enhanced: [{ key: 'enhanced_hero', url: 'https://cv/h' }, { key: 'enhanced_gallery_1', url: 'https://cv/g1' }],
            }),
            fetchImpl: fakeFetch({ 'https://r2/a': {}, 'https://r2/b': { type: 'image/png' }, 'https://cv/h': {}, 'https://cv/g1': { type: 'image/webp' } }),
            onProgress: (d, t) => progress.push(`${d}/${t}`),
            deliver: (zip, name) => { delivered = { zip, name }; },
        });
        expect(result).toEqual({ added: 4, failed: [] });
        expect(delivered!.name).toBe('Jennifer & Agie’s Flowershop photos.zip');
        expect(readZip(delivered!.zip).map((f) => f.name)).toEqual([
            'originals/photo-01.jpg', 'originals/photo-02.png', 'ai-enhanced/hero.jpg', 'ai-enhanced/gallery_1.webp',
        ]);
        expect(progress[progress.length - 1]).toBe('4/4');
    });

    it('still delivers the zip when some files fail, and lists them in missing-files.txt', async () => {
        let zip: Uint8Array | null = null;
        const result = await downloadMediaZip({
            zipName: 'x',
            files: buildMediaFileList({
                originals: ['https://r2/ok', 'https://r2/gone', 'kg2unresolved'],
                enhanced: [{ key: 'enhanced_hero', url: 'https://cv/403' }],
            }),
            fetchImpl: fakeFetch({ 'https://r2/ok': {}, 'https://cv/403': { status: 403 } }),
            deliver: (z) => { zip = z; },
        });
        expect(result.added).toBe(1);
        expect(result.failed.map((f) => f.path)).toEqual(['originals/photo-02', 'originals/photo-03', 'ai-enhanced/hero']);
        const files = readZip(zip!);
        expect(files.map((f) => f.name)).toEqual(['originals/photo-01.jpg', 'missing-files.txt']);
        const missing = new TextDecoder().decode(files[1].data);
        expect(missing).toContain('ai-enhanced/hero  —  HTTP 403');
        expect(missing).toContain('originals/photo-03  —  no downloadable URL');
    });

    it('rejects an empty download as a failure rather than zipping a 0-byte photo', async () => {
        const result = await downloadMediaZip({
            zipName: 'x',
            files: buildMediaFileList({ originals: ['https://r2/empty'], enhanced: [] }),
            fetchImpl: fakeFetch({ 'https://r2/empty': { body: '' } }),
            deliver: () => {},
        });
        expect(result.failed).toEqual([{ path: 'originals/photo-01', reason: 'empty file' }]);
    });
});
