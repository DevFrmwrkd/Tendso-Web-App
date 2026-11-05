/**
 * Quality check for a polished photo: cheap byte checks first, then a vision
 * model grades the result against Theo's rules. The decision is FAIL-CLOSED:
 * no verdict (no vision key, model error, unreadable answer) keeps the original.
 * Pure. See docs/v2-ai-pipeline.md.
 */

import { isRecord } from './json';

export interface ImageInfo {
    mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'unknown';
    width?: number;
    height?: number;
}

/** Read type and pixel size from the header bytes (JPEG, PNG, WebP). */
export function imageInfo(bytes: Uint8Array): ImageInfo {
    const b = bytes;
    if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
        const w = (b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19];
        const h = (b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23];
        return { mime: 'image/png', width: w >>> 0, height: h >>> 0 };
    }
    if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
        let i = 2;
        while (i + 9 < b.length) {
            if (b[i] !== 0xff) { i++; continue; }
            const marker = b[i + 1];
            if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
            const len = (b[i + 2] << 8) | b[i + 3];
            // SOF0..SOF15 except DHT(C4), JPG(C8), DAC(CC)
            if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
                return { mime: 'image/jpeg', height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
            }
            i += 2 + len;
        }
        return { mime: 'image/jpeg' };
    }
    if (b.length >= 30 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
        const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
        if (chunk === 'VP8X') return { mime: 'image/webp', width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
        if (chunk === 'VP8 ') return { mime: 'image/webp', width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff };
        if (chunk === 'VP8L') {
            const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
            return { mime: 'image/webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
        }
        return { mime: 'image/webp' };
    }
    return { mime: 'unknown' };
}

/** Same bytes? Compares length plus a sparse sample, enough to catch "returned the input". */
export function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    const step = Math.max(1, Math.floor(a.length / 4096));
    for (let i = 0; i < a.length; i += step) if (a[i] !== b[i]) return false;
    return true;
}

export const MIN_BYTES = 30 * 1024;
export const MAX_BYTES = 20 * 1024 * 1024;
export const MIN_SHORT_SIDE = 720;

export interface BasicCheck {
    ok: boolean;
    reasons: string[];
    info: ImageInfo;
}

export function basicImageChecks(result: Uint8Array, original?: Uint8Array): BasicCheck {
    const reasons: string[] = [];
    const info = imageInfo(result);
    if (info.mime === 'unknown') reasons.push('not a JPEG, PNG or WebP image');
    if (result.length < MIN_BYTES) reasons.push(`too small (${result.length} bytes)`);
    if (result.length > MAX_BYTES) reasons.push(`too large (${result.length} bytes)`);
    if (info.width && info.height && Math.min(info.width, info.height) < MIN_SHORT_SIDE) {
        reasons.push(`low resolution (${info.width}x${info.height})`);
    }
    if (info.width && info.height) {
        const ratio = Math.max(info.width, info.height) / Math.min(info.width, info.height);
        if (ratio > 2.4) reasons.push(`odd aspect ratio (${info.width}x${info.height})`);
    }
    if (original && sameBytes(result, original)) reasons.push('identical to the original');
    return { ok: reasons.length === 0, reasons, info };
}

/** What the vision model is asked. Image 1 = original, image 2 = result. */
export const VISION_QC_PROMPT = `You are checking an AI re-shoot of a photo for a small Filipino shop's website.
Image 1 is the ORIGINAL phone photo. Image 2 is the RESULT.
The goal: the result looks like a professional photographer re-shot the same person in the same place, from a new camera position with new light. Bright, friendly, commercial, realistic.
Answer each question about the RESULT honestly. Return JSON only:
{
  "has_person": true|false,              // is there a person in the original
  "same_person": true|false|null,        // same face, hair, skin tone, clothes as the original (null if no person)
  "same_place": true|false,              // same room / shop / object, nothing invented or removed
  "new_camera_position": true|false,     // a genuinely new angle or framing, NOT the same frame with a filter
  "bright_and_natural": true|false,      // bright daylight look, natural colours; false if dark, moody, cinematic, orange/teal
  "realistic": true|false,               // looks like a real photograph, not CGI or illustration
  "no_artifacts": true|false,            // no extra fingers, warped faces, melted objects, garbled text or logos
  "score": 0-10,                         // overall fitness for the shop's website
  "reason": "one short sentence"
}`;

export interface VisionVerdict {
    hasPerson: boolean;
    samePerson: boolean | null;
    samePlace: boolean;
    newCameraPosition: boolean;
    brightAndNatural: boolean;
    realistic: boolean;
    noArtifacts: boolean;
    score: number;
    reason: string;
}

/** Coerce the model's JSON. Returns null when it is not usable (→ fail-closed). */
export function parseVisionVerdict(raw: unknown): VisionVerdict | null {
    if (!isRecord(raw)) return null;
    const bool = (v: unknown) => (typeof v === 'boolean' ? v : v === 'true' ? true : v === 'false' ? false : undefined);
    const fields = ['same_place', 'new_camera_position', 'bright_and_natural', 'realistic', 'no_artifacts'] as const;
    const values = fields.map((f) => bool(raw[f]));
    if (values.some((v) => v === undefined)) return null;
    const score = Number(raw.score);
    if (!Number.isFinite(score)) return null;
    const samePersonRaw = raw.same_person === null ? null : bool(raw.same_person);
    return {
        hasPerson: bool(raw.has_person) ?? samePersonRaw !== null,
        samePerson: samePersonRaw === undefined ? null : samePersonRaw,
        samePlace: values[0]!,
        newCameraPosition: values[1]!,
        brightAndNatural: values[2]!,
        realistic: values[3]!,
        noArtifacts: values[4]!,
        score: Math.max(0, Math.min(10, score)),
        reason: typeof raw.reason === 'string' ? raw.reason.slice(0, 300) : '',
    };
}

export const MIN_QC_SCORE = 7;

export interface QcDecision {
    pass: boolean;
    reason: string;
}

/** Keep the polished photo only when every check passes. Anything unknown fails. */
export function decideQc(basic: BasicCheck, verdict: VisionVerdict | null, minScore = MIN_QC_SCORE): QcDecision {
    if (!basic.ok) return { pass: false, reason: `basic check: ${basic.reasons.join('; ')}` };
    if (!verdict) return { pass: false, reason: 'no quality verdict (vision check unavailable or unreadable)' };
    const failures: string[] = [];
    if (verdict.hasPerson && verdict.samePerson !== true) failures.push('not clearly the same person');
    if (!verdict.samePlace) failures.push('not the same place');
    if (!verdict.newCameraPosition) failures.push('same frame (looks like a filter)');
    if (!verdict.brightAndNatural) failures.push('not bright and natural');
    if (!verdict.realistic) failures.push('not realistic');
    if (!verdict.noArtifacts) failures.push('visible artifacts');
    if (verdict.score < minScore) failures.push(`score ${verdict.score} < ${minScore}`);
    return failures.length > 0
        ? { pass: false, reason: failures.join('; ') }
        : { pass: true, reason: `passed (score ${verdict.score})` };
}
