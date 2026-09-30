import { crc32 } from '@/lib/zip';

/**
 * Test helper, shared by zip.test.ts and mediaZip.test.ts: reads an archive
 * back the way an unzip tool does and asserts every header agrees.
 */
/** A minimal ZIP reader: end record -> central directory -> local headers -> data. */
export function readZip(zip: Uint8Array): Array<{ name: string; data: Uint8Array; crc: number; flags: number }> {
    const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    const eocd = zip.length - 22;
    expect(v.getUint32(eocd, true)).toBe(0x06054b50);
    const count = v.getUint16(eocd + 10, true);
    const cdSize = v.getUint32(eocd + 12, true);
    let p = v.getUint32(eocd + 16, true);
    expect(p + cdSize).toBe(eocd);
    const out = [];
    for (let i = 0; i < count; i++) {
        expect(v.getUint32(p, true)).toBe(0x02014b50);
        const flags = v.getUint16(p + 8, true);
        const method = v.getUint16(p + 10, true);
        const crc = v.getUint32(p + 16, true);
        const size = v.getUint32(p + 20, true);
        const nameLen = v.getUint16(p + 28, true);
        const localOffset = v.getUint32(p + 42, true);
        const name = new TextDecoder().decode(zip.subarray(p + 46, p + 46 + nameLen));
        expect(method).toBe(0);
        // The local header must agree with the central directory.
        expect(v.getUint32(localOffset, true)).toBe(0x04034b50);
        expect(v.getUint32(localOffset + 14, true)).toBe(crc);
        expect(v.getUint32(localOffset + 22, true)).toBe(size);
        const localNameLen = v.getUint16(localOffset + 26, true);
        const extraLen = v.getUint16(localOffset + 28, true);
        const start = localOffset + 30 + localNameLen + extraLen;
        const data = zip.subarray(start, start + size);
        expect(crc32(data)).toBe(crc);
        out.push({ name, data, crc, flags });
        p += 46 + nameLen;
    }
    return out;
}
