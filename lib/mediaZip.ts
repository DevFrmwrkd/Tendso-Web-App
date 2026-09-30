/**
 * "Download all" for a submission's media: the owner's original photos and
 * every AI-enhanced image, as one .zip built in the admin's browser.
 *
 * WHY THE BROWSER. Both hosts already allow it — the R2 photo bucket answers
 * `Access-Control-Allow-Origin: *` and Convex storage echoes the site origin —
 * so no server route is needed, and none of Vercel's function payload limits
 * apply to a zip of full-size phone photos (3 MB each is common).
 *
 * A file that fails to download never fails the whole zip: it is listed in
 * missing-files.txt inside the archive, and in the returned summary.
 */
import { createZip, type ZipEntry } from '@/lib/zip';

export interface MediaFile {
    /** Folder inside the zip. */
    folder: 'originals' | 'ai-enhanced';
    /** File name without extension; the extension comes from the downloaded type. */
    name: string;
    /** Where to fetch it from. Empty when the URL could not be resolved. */
    url: string;
}

export interface MediaZipResult {
    added: number;
    failed: Array<{ path: string; reason: string }>;
}

/** A file or folder name that is safe on Windows, macOS and Linux. */
export function safeName(value: string, fallback = 'file'): string {
    const cleaned = String(value ?? '')
        .normalize('NFC')
        .replace(/[\u0000-\u001f\u007f]/g, '')
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^[.\s]+|[.\s]+$/g, '')
        .slice(0, 80)
        .trim();
    return cleaned || fallback;
}

const TYPE_EXT: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/pjpeg': 'jpg', 'image/png': 'png',
    'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'image/heic': 'heic',
    'image/heif': 'heif', 'image/svg+xml': 'svg',
};

/** The extension to save a file under: from its content type, else its URL, else jpg. */
export function extensionFor(contentType: string | null | undefined, url: string): string {
    const type = String(contentType ?? '').split(';')[0].trim().toLowerCase();
    if (TYPE_EXT[type]) return TYPE_EXT[type];
    const m = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(url);
    if (m && Object.values(TYPE_EXT).includes(m[1].toLowerCase().replace('jpeg', 'jpg'))) return m[1].toLowerCase().replace('jpeg', 'jpg');
    return 'jpg';
}

/**
 * The file list for a submission: originals as photo-01, photo-02, … in upload
 * order, and AI-enhanced images named by their slot (hero, gallery_1,
 * archive_2 for an earlier render), in the order the caller gives them.
 */
export function buildMediaFileList(input: {
    originals: Array<string | null | undefined>;
    enhanced: Array<{ key: string; url: string | null | undefined }>;
}): MediaFile[] {
    const pad = (n: number) => String(n).padStart(2, '0');
    const originals: MediaFile[] = input.originals.map((url, i) => ({
        folder: 'originals', name: `photo-${pad(i + 1)}`, url: url && /^https?:/i.test(url) ? url : '',
    }));
    const enhanced: MediaFile[] = input.enhanced.map((e) => ({
        folder: 'ai-enhanced',
        name: safeName(e.key.replace(/^enhanced_/, ''), 'image'),
        url: e.url && /^https?:/i.test(e.url) ? e.url : '',
    }));
    return [...originals, ...enhanced];
}

/** Fetch every file (a few at a time), zip them, and hand the zip to the browser as a download. */
export async function downloadMediaZip(opts: {
    zipName: string;
    files: MediaFile[];
    onProgress?: (done: number, total: number) => void;
    fetchImpl?: typeof fetch;
    /** Test seam: receives the finished archive instead of triggering a browser download. */
    deliver?: (zip: Uint8Array, fileName: string) => void;
}): Promise<MediaZipResult> {
    const doFetch = opts.fetchImpl ?? fetch;
    const total = opts.files.length;
    const results: Array<ZipEntry | { failed: string }> = new Array(total);
    let done = 0;
    let next = 0;

    const worker = async () => {
        while (next < total) {
            const i = next++;
            const f = opts.files[i];
            try {
                if (!f.url) throw new Error('no downloadable URL');
                const res = await doFetch(f.url, { mode: 'cors', credentials: 'omit' });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = new Uint8Array(await res.arrayBuffer());
                if (data.length === 0) throw new Error('empty file');
                const ext = extensionFor(res.headers.get('content-type'), f.url);
                results[i] = { path: `${f.folder}/${f.name}.${ext}`, data };
            } catch (e: unknown) {
                results[i] = { failed: (e instanceof Error && e.message) || 'download failed' };
            }
            opts.onProgress?.(++done, total);
        }
    };
    await Promise.all(Array.from({ length: Math.min(3, total) }, worker));

    const entries: ZipEntry[] = [];
    const failed: MediaZipResult['failed'] = [];
    const used = new Set<string>();
    results.forEach((r, i) => {
        const f = opts.files[i];
        if ('failed' in r) {
            failed.push({ path: `${f.folder}/${f.name}`, reason: r.failed });
            return;
        }
        // Two slots cannot share a name in one folder today, but never let a
        // later file silently replace an earlier one if they ever do.
        let path = r.path;
        for (let n = 2; used.has(path); n++) path = r.path.replace(/(\.[^.]+)$/, `-${n}$1`);
        used.add(path);
        entries.push({ ...r, path });
    });

    if (failed.length) {
        const lines = [
            'These files could not be downloaded when the zip was made:',
            '',
            ...failed.map((f) => `${f.path}  —  ${f.reason}`),
        ];
        entries.push({ path: 'missing-files.txt', data: new TextEncoder().encode(lines.join('\r\n') + '\r\n') });
    }

    const fileName = `${safeName(opts.zipName, 'photos')}.zip`;
    const zip = createZip(entries);
    if (opts.deliver) opts.deliver(zip, fileName);
    else {
        const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: 'application/zip' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
    }
    return { added: entries.length - (failed.length ? 1 : 0), failed };
}
