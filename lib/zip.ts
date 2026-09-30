/**
 * A minimal ZIP writer: "stored" entries (no compression), UTF-8 names.
 *
 * Built for the admin's "download all photos" zip. The files are JPEG / PNG /
 * WebP, which are already compressed, so deflating them again saves nothing
 * and costs CPU — storing them is the right format, and it keeps this small
 * enough to own instead of adding a dependency. Runs in the browser and in
 * Node (tests) alike: plain Uint8Arrays, no streams, no Node APIs.
 *
 * Limits, on purpose: no ZIP64, so under 65,535 entries and 4 GiB total — a
 * submission's photos are two orders of magnitude below either.
 */

export interface ZipEntry {
    /** Path inside the archive, forward slashes, e.g. "originals/photo-01.jpg". */
    path: string;
    data: Uint8Array;
    /** Modification time recorded in the archive. Defaults to now. */
    date?: Date;
}

let crcTable: Uint32Array | null = null;
function table(): Uint32Array {
    if (crcTable) return crcTable;
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        crcTable[n] = c >>> 0;
    }
    return crcTable;
}

/** CRC-32 (IEEE 802.3), the checksum ZIP requires for every entry. */
export function crc32(data: Uint8Array): number {
    const t = table();
    let c = 0xffffffff;
    for (let i = 0; i < data.length; i++) c = t[(c ^ data[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

/** MS-DOS date/time, the only timestamp classic ZIP headers carry (2-second precision). */
function dosDateTime(d: Date): { time: number; date: number } {
    const year = Math.min(Math.max(d.getFullYear(), 1980), 2107);
    return {
        time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
        date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    };
}

const UTF8_FLAG = 0x0800; // general purpose bit 11: names are UTF-8

/** Build a complete .zip archive from the given entries. */
export function createZip(entries: ZipEntry[]): Uint8Array {
    if (entries.length > 0xffff) throw new Error('Too many files for a ZIP without ZIP64');
    const encoder = new TextEncoder();
    const locals: Uint8Array[] = [];
    const centrals: Uint8Array[] = [];
    let offset = 0;

    for (const entry of entries) {
        const name = encoder.encode(entry.path.replace(/\\/g, '/').replace(/^\/+/, ''));
        const data = entry.data;
        const crc = crc32(data);
        const { time, date } = dosDateTime(entry.date ?? new Date());

        const local = new Uint8Array(30 + name.length);
        const lv = new DataView(local.buffer);
        lv.setUint32(0, 0x04034b50, true); // local file header signature
        lv.setUint16(4, 20, true); // version needed (2.0)
        lv.setUint16(6, UTF8_FLAG, true);
        lv.setUint16(8, 0, true); // method: stored
        lv.setUint16(10, time, true);
        lv.setUint16(12, date, true);
        lv.setUint32(14, crc, true);
        lv.setUint32(18, data.length, true); // compressed size
        lv.setUint32(22, data.length, true); // uncompressed size
        lv.setUint16(26, name.length, true);
        lv.setUint16(28, 0, true); // extra field length
        local.set(name, 30);

        const central = new Uint8Array(46 + name.length);
        const cv = new DataView(central.buffer);
        cv.setUint32(0, 0x02014b50, true); // central directory signature
        cv.setUint16(4, 20, true); // version made by
        cv.setUint16(6, 20, true); // version needed
        cv.setUint16(8, UTF8_FLAG, true);
        cv.setUint16(10, 0, true); // stored
        cv.setUint16(12, time, true);
        cv.setUint16(14, date, true);
        cv.setUint32(16, crc, true);
        cv.setUint32(20, data.length, true);
        cv.setUint32(24, data.length, true);
        cv.setUint16(28, name.length, true);
        // extra length, comment length, disk number, internal attrs: all 0
        cv.setUint32(38, 0, true); // external attributes
        cv.setUint32(42, offset, true); // offset of the local header
        central.set(name, 46);

        locals.push(local, data);
        centrals.push(central);
        offset += local.length + data.length;
        if (offset > 0xffffffff) throw new Error('ZIP exceeds 4 GiB');
    }

    const centralSize = centrals.reduce((n, c) => n + c.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true); // end of central directory signature
    ev.setUint16(8, entries.length, true); // entries on this disk
    ev.setUint16(10, entries.length, true); // total entries
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true); // central directory offset

    const out = new Uint8Array(offset + centralSize + end.length);
    let p = 0;
    for (const part of [...locals, ...centrals, end]) {
        out.set(part, p);
        p += part.length;
    }
    return out;
}
