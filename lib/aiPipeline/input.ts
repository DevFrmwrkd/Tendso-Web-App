/**
 * Submission row → PipelineInput, and the interview text the facts step reads.
 * Pure: URL resolution is passed in. Reads the owner-app fields
 * (ownerInterview, ownerShots, templateId, …) loosely, because they are added on
 * another branch (feat/v2-backend-owners) and may not exist yet.
 */

import type { InterviewAnswer, PipelineInput, PipelineShot } from './types';
import { isRecord, str } from './json';

/** Positional roles of `submissions.photos` (convex/hyperagent.ts, app/start/photoSlots.ts). */
export const PHOTO_ROLES = ['headshot', 'interior_1', 'interior_2', 'exterior', 'product_1', 'product_2'];

/** Content sources whose `transcript` was synthesized from the typed answers. */
const SYNTHESIZED_TRANSCRIPT_SOURCES = new Set(['owner_intake', 'owner_app']);

type Row = Record<string, unknown>;

export function buildPipelineInput(
    submission: Row,
    website: Row | null,
    resolveUrl: (raw: string) => string | null,
): PipelineInput {
    const s = submission;
    const answers: InterviewAnswer[] = [];

    // Owner app: ownerInterview[] { index, q?/questionEn?, answerText?, mediaUrl? }.
    if (Array.isArray(s.ownerInterview)) {
        for (const raw of s.ownerInterview) {
            if (!isRecord(raw)) continue;
            const q = str(raw.q ?? raw.questionEn ?? raw.question ?? '', 300);
            const a = str(raw.answerText ?? raw.a ?? '', 4000);
            const mediaRaw = typeof raw.mediaUrl === 'string' ? raw.mediaUrl : '';
            const mediaUrl = mediaRaw ? resolveUrl(mediaRaw) ?? undefined : undefined;
            if (a || mediaUrl) answers.push({ q, a, ...(mediaUrl && !a ? { mediaUrl } : {}) });
        }
    }
    // Owner intake (/start) and owner app mirror: interviewQa[] { q, a }.
    if (answers.length === 0 && Array.isArray(s.interviewQa)) {
        for (const raw of s.interviewQa) {
            if (!isRecord(raw)) continue;
            const a = str(raw.a, 4000);
            if (a) answers.push({ q: str(raw.q, 300), a });
        }
    }

    const contentSource = typeof s.contentSource === 'string' ? s.contentSource : undefined;
    const transcript = typeof s.transcript === 'string' ? s.transcript.trim() : '';
    const mediaRaw = [s.videoUrl, s.audioUrl, s.videoStorageId, s.audioStorageId].find((m) => typeof m === 'string' && m) as string | undefined;
    const mainMediaUrl = mediaRaw ? resolveUrl(mediaRaw) ?? undefined : undefined;
    const mainMediaType = s.videoUrl || s.videoStorageId ? 'video' : mediaRaw ? 'audio' : undefined;

    // Shots: owner app ownerShots[] first (labelled), else positional photos[].
    const shots: PipelineShot[] = [];
    if (Array.isArray(s.ownerShots) && s.ownerShots.length > 0) {
        const guided = s.ownerShots.filter((x) => isRecord(x) && !x.extra);
        const extras = s.ownerShots.filter((x) => isRecord(x) && x.extra);
        const ordered = [...guided, ...extras] as Row[];
        ordered.forEach((shot, i) => {
            const url = typeof shot.url === 'string' ? resolveUrl(shot.url) : null;
            if (url) shots.push({ index: i, url, label: str(shot.label, 80) || undefined });
        });
    } else if (Array.isArray(s.photos)) {
        (s.photos as unknown[]).forEach((p, i) => {
            if (typeof p !== 'string' || !p.trim()) return;
            const url = resolveUrl(p.trim());
            if (url) shots.push({ index: i, url, role: PHOTO_ROLES[i] });
        });
    }

    const coords = isRecord(s.coordinates) && typeof s.coordinates.lat === 'number' && typeof s.coordinates.lng === 'number'
        ? { lat: s.coordinates.lat, lng: s.coordinates.lng } : undefined;

    const chosen = [s.templateId, Array.isArray(s.templateIds) ? s.templateIds[0] : undefined,
        isRecord(website?.customizations) ? website?.customizations?.heroStyle : undefined]
        .find((t) => typeof t === 'string' && t.trim()) as string | undefined;

    return {
        submissionId: String(s._id ?? ''),
        businessName: str(s.businessName, 120),
        businessType: str(s.businessType, 80),
        ownerName: str(s.ownerName, 120),
        ownerPhone: str(s.ownerPhone, 40),
        ownerEmail: str(s.ownerEmail, 120),
        address: str(s.address, 240),
        city: str(s.city, 120),
        coordinates: coords,
        contentSource,
        answers,
        transcript,
        transcriptionStatus: typeof s.transcriptionStatus === 'string' ? s.transcriptionStatus : undefined,
        mainMediaUrl,
        mainMediaType,
        shots,
        chosenTemplate: chosen?.trim(),
        fontChoice: typeof s.fontChoice === 'string' ? s.fontChoice : undefined,
        colorChoice: typeof s.colorChoice === 'string' ? s.colorChoice : undefined,
        keepOriginals: s.keepOriginalPhotos === true,
        hasBuiltSite: !!(website && (website.htmlStorageId || website.htmlContent)),
        isPublished: website?.status === 'published',
    };
}

/**
 * The text the facts model reads: Q&A pairs (with transcribed recordings) and
 * the free transcript. A transcript that was synthesized from the same answers
 * (owner intake / owner app) is left out so nothing is read twice.
 */
export function assembleInterviewText(input: Pick<PipelineInput, 'answers' | 'transcript' | 'contentSource'>, clipTranscripts: Record<number, string> = {}): string {
    const blocks: string[] = [];
    input.answers.forEach((pair, i) => {
        const answer = (pair.a || clipTranscripts[i] || '').trim();
        if (!answer) return;
        blocks.push(pair.q ? `Q: ${pair.q}\nA: ${answer}` : `A: ${answer}`);
    });
    const synthesized = input.contentSource ? SYNTHESIZED_TRANSCRIPT_SOURCES.has(input.contentSource) : false;
    if (input.transcript && !(synthesized && blocks.length > 0)) {
        blocks.push(`RECORDED INTERVIEW TRANSCRIPT:\n${input.transcript}`);
    }
    return blocks.join('\n\n').slice(0, 60_000);
}

/** Recordings in the answers that still need a transcript, by answer position. */
export function clipsToTranscribe(input: Pick<PipelineInput, 'answers'>, done: Record<number, string> = {}): Array<{ position: number; url: string }> {
    const out: Array<{ position: number; url: string }> = [];
    input.answers.forEach((pair, i) => {
        if (!pair.a && pair.mediaUrl && !done[i]) out.push({ position: i, url: pair.mediaUrl });
    });
    return out;
}

/** The form values as text, for grounding checks. */
export function formText(input: PipelineInput): string {
    return [input.businessName, input.ownerName, input.ownerPhone, input.ownerEmail, input.address, input.city].join('\n');
}
