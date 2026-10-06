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

// ---- Plain MP4 (a phone's video file) ----

const ascii = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
const handler = (kind: string) => fullBox('hdlr', 0, u32(0), ascii(kind), new Uint8Array(12), Uint8Array.of(0));
const mediaHeader = (timescale: number, duration: number) =>
    fullBox('mdhd', 0, u32(0), u32(0), u32(timescale), u32(duration), Uint8Array.of(0x55, 0xc4, 0, 0));

/** Where a box's payload starts in `data`, found by its type (unique in these files). */
const payloadOf = (data: Uint8Array, type: string) => {
    for (let i = 4; i + 4 <= data.length; i++) {
        if (String.fromCharCode(data[i], data[i + 1], data[i + 2], data[i + 3]) === type) return i + 4;
    }
    throw new Error(`no ${type}`);
};
const readU32 = (b: Uint8Array, o: number) => ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];

describe('chunkMediaFile: plain MP4', () => {
    // Three AAC frames between two runs of video bytes, as a phone interleaves them.
    const audioSamples = [filler(10, 1), filler(12, 2), filler(14, 3)];
    const ftyp = box('ftyp', ascii('qt  '), u32(0));
    const before = filler(1500, 5);
    const audioOffset = ftyp.length + 8 + before.length;
    const mdat = box('mdat', before, ...audioSamples, filler(500, 6));
    const videoTrak = box('trak', box('mdia', mediaHeader(600, 1800), handler('vide')));
    const audioTrak = box(
        'trak',
        box(
            'mdia',
            mediaHeader(44100, 3 * 1024),
            handler('soun'),
            box(
                'minf',
                box(
                    'stbl',
                    fullBox('stsd', 0, u32(1), box('mp4a', filler(28, 4))),
                    fullBox('stts', 0, u32(1), u32(3), u32(1024)),
                    fullBox('stsz', 0, u32(0), u32(3), u32(10), u32(12), u32(14)),
                    fullBox('stsc', 0, u32(1), u32(1), u32(3), u32(1)),
                    fullBox('stco', 0, u32(1), u32(audioOffset)),
                ),
            ),
        ),
    );
    const file = bytes(ftyp, mdat, box('moov', videoTrak, audioTrak));

    it('pulls out the audio track alone', () => {
        const chunks = chunkMediaFile(toBuffer(file), 'video/mp4', 1000).map(view);
        expect(chunks).toHaveLength(1);
        const out = chunks[0];
        expect(String.fromCharCode(...out.subarray(8, 12))).toBe('M4A ');
        expect(out.subarray(out.length - 36)).toEqual(bytes(...audioSamples));
    });

    it('writes the timescale and duration where a decoder reads them', () => {
        const out = view(chunkMediaFile(toBuffer(file), 'video/mp4', 1000)[0]);
        // mvhd and mdhd (version 0): version and flags, creation, modification, then timescale and duration.
        for (const type of ['mvhd', 'mdhd']) {
            const p = payloadOf(out, type);
            expect([type, readU32(out, p + 12), readU32(out, p + 16)]).toEqual([type, 44100, 3072]);
        }
    });
});
