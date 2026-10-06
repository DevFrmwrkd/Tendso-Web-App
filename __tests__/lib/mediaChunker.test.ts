import { chunkMediaFile } from '@/lib/services/media-chunker';

/**
 * The transcription chunker on hand-built files: WebM split between clusters,
 * and a fragmented MP4 (what a browser's MediaRecorder writes) split between
 * fragments, each chunk carrying the file's header so it plays on its own.
 */

const bytes = (...parts: Uint8Array[]): Uint8Array => {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) {
        out.set(p, at);
        at += p.length;
    }
    return out;
};
const filler = (length: number, seed: number) => Uint8Array.from({ length }, (_, i) => (i + seed) % 7);
const u32 = (n: number) => Uint8Array.of((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
const toBuffer = (data: Uint8Array) => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
const view = (chunk: ArrayBuffer) => new Uint8Array(chunk);

// ---- WebM ----

const EBML_HEADER = bytes(Uint8Array.of(0x1a, 0x45, 0xdf, 0xa3), filler(16, 1)); // 20 bytes
const cluster = (seed: number) => bytes(Uint8Array.of(0x1f, 0x43, 0xb6, 0x75, 0x80 | 25), filler(25, seed)); // 30 bytes

describe('chunkMediaFile: WebM', () => {
    const clusters = [0, 1, 2, 3, 4].map(cluster);
    const file = bytes(EBML_HEADER, ...clusters);

    it('splits between clusters, the header in front of every chunk', () => {
        // 85 bytes: the 20-byte header and two 30-byte clusters fit, three do not.
        const chunks = chunkMediaFile(toBuffer(file), 'video/webm', 85).map(view);
        expect(chunks.map((c) => c.length)).toEqual([80, 80, 50]);
        for (const c of chunks) expect(c.subarray(0, 20)).toEqual(EBML_HEADER);
        expect(chunks[0].subarray(20)).toEqual(bytes(clusters[0], clusters[1]));
        expect(chunks[2].subarray(20)).toEqual(clusters[4]);
    });

    it('returns a small file whole', () => {
        const chunks = chunkMediaFile(toBuffer(file), 'video/webm', 1000);
        expect(chunks).toHaveLength(1);
        expect(view(chunks[0])).toEqual(file);
    });
});

// ---- Fragmented MP4 ----

const box = (type: string, ...payload: Uint8Array[]) => {
    const body = bytes(...payload);
    return bytes(u32(8 + body.length), Uint8Array.from(type, (ch) => ch.charCodeAt(0)), body);
};
const fullBox = (type: string, flags: number, ...payload: Uint8Array[]) =>
    box(type, Uint8Array.of(0, (flags >>> 16) & 255, (flags >>> 8) & 255, flags & 255), ...payload);

const DEFAULT_BASE_IS_MOOF = 0x020000;
const BASE_DATA_OFFSET_PRESENT = 0x000001;

const INIT = bytes(box('ftyp', Uint8Array.from('isom', (c) => c.charCodeAt(0)), u32(0)), box('moov', box('mvex'))); // 32 bytes
const fragment = (sequence: number, tfhdFlags = DEFAULT_BASE_IS_MOOF) =>
    bytes(
        box('moof', fullBox('mfhd', 0, u32(sequence)), box('traf', fullBox('tfhd', tfhdFlags, u32(1)), fullBox('trun', 0, u32(0)))),
        box('mdat', filler(40, sequence)),
    ); // 112 bytes

describe('chunkMediaFile: fragmented MP4', () => {
    const fragments = [1, 2, 3, 4].map((n) => fragment(n));
    const file = bytes(INIT, ...fragments);

    it('splits between fragments, the init segment in front of every chunk', () => {
        // 260 bytes: the 32-byte init segment and two 112-byte fragments fit.
        const chunks = chunkMediaFile(toBuffer(file), 'video/mp4', 260).map(view);
        expect(chunks.map((c) => c.length)).toEqual([256, 256]);
        for (const c of chunks) expect(c.subarray(0, 32)).toEqual(INIT);
        expect(chunks[0].subarray(32)).toEqual(bytes(fragments[0], fragments[1]));
        expect(chunks[1].subarray(32)).toEqual(bytes(fragments[2], fragments[3]));
    });

    it('keeps a fragment whole even when it alone is over the limit', () => {
        const chunks = chunkMediaFile(toBuffer(file), 'video/mp4', 100).map(view);
        expect(chunks.map((c) => c.length)).toEqual([144, 144, 144, 144]);
    });

    it('sends the file whole when fragments name an absolute data offset', () => {
        const absolute = bytes(INIT, ...[1, 2, 3, 4].map((n) => fragment(n, BASE_DATA_OFFSET_PRESENT)));
        const chunks = chunkMediaFile(toBuffer(absolute), 'video/mp4', 260);
        expect(chunks).toHaveLength(1);
        expect(view(chunks[0])).toEqual(absolute);
    });

    it('recognises the file by its bytes when the type says nothing', () => {
        const chunks = chunkMediaFile(toBuffer(file), 'application/octet-stream', 260);
        expect(chunks).toHaveLength(2);
    });
});
