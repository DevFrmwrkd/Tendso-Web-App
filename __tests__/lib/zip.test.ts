import { crc32, createZip } from '@/lib/zip';
import { readZip } from './readZip';

/**
 * lib/zip.ts writes the admin's "download all photos" archive by hand, so the
 * format is pinned here: CRCs against published check values, and every
 * header read back the way an unzip tool reads it.
 */

const enc = (s: string) => new TextEncoder().encode(s);

describe('crc32', () => {
    it('matches the published check values', () => {
        expect(crc32(new Uint8Array(0))).toBe(0);
        expect(crc32(enc('123456789'))).toBe(0xcbf43926);
        expect(crc32(enc('hello'))).toBe(0x3610a686);
    });
});

describe('createZip', () => {
    it('round-trips files, folders and bytes exactly', () => {
        const photo = new Uint8Array(5000).map((_, i) => (i * 31) & 0xff);
        const zip = createZip([
            { path: 'originals/photo-01.jpg', data: photo },
            { path: 'ai-enhanced/hero.png', data: enc('png bytes') },
        ]);
        const files = readZip(zip);
        expect(files.map((f) => f.name)).toEqual(['originals/photo-01.jpg', 'ai-enhanced/hero.png']);
        expect(Array.from(files[0].data)).toEqual(Array.from(photo));
        expect(new TextDecoder().decode(files[1].data)).toBe('png bytes');
    });

    it('marks names as UTF-8 so a business name with ñ or ’ survives', () => {
        const zip = createZip([{ path: 'Jennifer & Agie’s Flowershop — Parañaque.txt', data: enc('x') }]);
        const [f] = readZip(zip);
        expect(f.name).toBe('Jennifer & Agie’s Flowershop — Parañaque.txt');
        expect(f.flags & 0x0800).toBe(0x0800);
    });

    it('normalises Windows separators and leading slashes in paths', () => {
        const [f] = readZip(createZip([{ path: '/originals\\photo-02.jpg', data: enc('y') }]));
        expect(f.name).toBe('originals/photo-02.jpg');
    });

    it('produces a valid empty archive', () => {
        const zip = createZip([]);
        expect(zip.length).toBe(22);
        expect(readZip(zip)).toEqual([]);
    });
});
