"use node";

/**
 * Interview transcription: the recording on R2, through Groq Whisper, onto the
 * submission. Scheduled by submissions.update when an interview is attached,
 * from the web and from the mobile app alike.
 *
 * NODE RUNTIME ON PURPOSE. This ran in Convex's default runtime, where a
 * function may use 64 MB. An interview video is bigger than that, so the action
 * ran out of memory ("JavaScript execution ran out of memory") and was killed
 * before it could record the failure: the transcript stayed "processing" for
 * good. A Node action may use 512 MB.
 *
 * Memory, roughly: the file once (read into a buffer of its own size) and its
 * chunks, which copy it once more. A file over MAX_MEDIA_BYTES fails with that
 * reason instead of running out; /api/transcribe, which the success screen
 * calls and which has far more memory, still takes it.
 *
 * Calls Groq directly. DO NOT replace with a round-trip to the Next.js app: see
 * docs/changes/MOBILE-PARTY-FIX-TRANSCRIBE.md for the incident (2026-04-23)
 * where that pattern 404'd in production, because Clerk middleware blocked the
 * server-to-server call and Convex in the cloud cannot reach localhost in dev.
 * Chunking is lib/services/media-chunker.ts.
 *
 * Env vars required on the Convex deployment: GROQ_API_KEY, R2_PUBLIC_URL.
 */

import { v } from 'convex/values';
import { internalAction } from './_generated/server';
import { internal } from './_generated/api';
import { chunkMediaFile, getFileExtension } from './lib/mediaChunker';

/** The file and its chunks, twice this, have to fit in a Node action's 512 MB. */
const MAX_MEDIA_BYTES = 200 * 1024 * 1024;

/** Longer than an action may run (10 minutes): a transcription still "processing" by then was killed. */
const STALL_AFTER_MS = 15 * 60 * 1000;

const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

/**
 * POST one media chunk to Groq Whisper and return the transcript text.
 * Retries once on transient connection errors. Throws on unrecoverable failures.
 */
async function callGroqWhisper(chunk: ArrayBuffer, filename: string, groqKey: string): Promise<string> {
    const form = new FormData();
    form.append('file', new Blob([chunk]), filename);
    form.append('model', 'whisper-large-v3');
    form.append('response_format', 'json');

    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                method: 'POST',
                headers: { Authorization: `Bearer ${groqKey}` },
                body: form,
            });
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(`Groq API ${res.status}: ${text.slice(0, 300)}`);
            }
            const json = (await res.json()) as { text?: unknown };
            return typeof json?.text === 'string' ? json.text : '';
        } catch (err) {
            const e = err as { code?: string; cause?: { code?: string }; message?: string };
            const isTransient =
                e?.code === 'ECONNRESET' ||
                e?.cause?.code === 'ECONNRESET' ||
                /Connection error|fetch failed|network/i.test(e?.message || '');
            if (isTransient && attempt < 2) {
                await new Promise((r) => setTimeout(r, 3000));
                continue;
            }
            throw err;
        }
    }
    throw new Error('Groq transcription failed after retries');
}

/**
 * The response body in one buffer of its own size. `arrayBuffer()` keeps every
 * piece as it arrives and then copies them all into one buffer: twice the file
 * at the peak.
 */
async function readBody(res: Response): Promise<ArrayBuffer> {
    const length = Number(res.headers.get('content-length'));
    // A compressed body arrives longer than the length it declares.
    if (!res.body || res.headers.get('content-encoding') || !Number.isSafeInteger(length) || length <= 0) {
        return await res.arrayBuffer();
    }
    const out = new Uint8Array(length);
    let at = 0;
    for await (const piece of res.body as unknown as AsyncIterable<Uint8Array>) {
        if (at + piece.length > length) throw new Error(`The download ran past its ${length} bytes`);
        out.set(piece, at);
        at += piece.length;
    }
    if (at !== length) throw new Error(`The download stopped at ${at} of ${length} bytes`);
    return out.buffer;
}

/** Trigger transcription for a submission's media file. */
export const transcribeMedia = internalAction({
    args: {
        submissionId: v.id('submissions'),
        storageId: v.optional(v.string()),
        mediaType: v.optional(v.union(v.literal('video'), v.literal('audio'))),
    },
    handler: async (ctx, args) => {
        // Mark as processing so UIs can show a spinner while Groq works.
        const startedAt = Date.now();
        await ctx.runMutation(internal.submissions.updateTranscriptionStatus, {
            submissionId: args.submissionId,
            status: 'processing',
        });
        // Nothing below runs if this action is killed (out of memory, or past
        // its time limit), so a later check fails it if it never finished.
        await ctx.scheduler.runAfter(STALL_AFTER_MS, internal.submissions.failStalledTranscription, {
            submissionId: args.submissionId,
            startedAt,
        });

        try {
            const groqKey = process.env.GROQ_API_KEY;
            if (!groqKey) {
                throw new Error('GROQ_API_KEY env var not set on this Convex deployment');
            }

            // Resolve the storageId/URL/path to a fetchable HTTPS URL.
            const r2Prefix = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');
            const raw = args.storageId || '';
            let mediaUrl: string | null = null;
            if (raw.startsWith('http://') || raw.startsWith('https://')) {
                mediaUrl = raw;
            } else if (/^(images|videos|audio)\//.test(raw) && r2Prefix) {
                mediaUrl = `${r2Prefix}/${raw}`;
            }
            // Fallback: re-read the submission fields directly.
            if (!mediaUrl) {
                const fresh = await ctx.runQuery(internal.submissions.getByIdInternal, {
                    id: args.submissionId,
                });
                const candidates = [fresh?.videoUrl, fresh?.audioUrl, fresh?.videoStorageId, fresh?.audioStorageId]
                    .filter(Boolean) as string[];
                for (const f of candidates) {
                    if (f.startsWith('http')) { mediaUrl = f; break; }
                    if (/^(images|videos|audio)\//.test(f) && r2Prefix) {
                        mediaUrl = `${r2Prefix}/${f}`;
                        break;
                    }
                }
            }
            if (!mediaUrl) {
                throw new Error(`Could not resolve a fetchable URL for storageId "${args.storageId}"`);
            }

            console.log(`[transcribeMedia] Fetching ${mediaUrl}`);
            const mediaRes = await fetch(mediaUrl);
            if (!mediaRes.ok) {
                throw new Error(`Failed to download media (HTTP ${mediaRes.status}): ${mediaUrl}`);
            }
            const declaredBytes = Number(mediaRes.headers.get('content-length'));
            if (declaredBytes > MAX_MEDIA_BYTES) {
                throw new Error(`The recording is ${mb(declaredBytes)}MB; this transcribes up to ${mb(MAX_MEDIA_BYTES)}MB`);
            }
            const contentType = mediaRes.headers.get('content-type') || '';
            const buffer = await readBody(mediaRes);
            if (buffer.byteLength > MAX_MEDIA_BYTES) {
                throw new Error(`The recording is ${mb(buffer.byteLength)}MB; this transcribes up to ${mb(MAX_MEDIA_BYTES)}MB`);
            }
            console.log(`[transcribeMedia] Downloaded ${mb(buffer.byteLength)}MB, content-type="${contentType}"`);

            // Chunk if necessary — handles webm/mp3/wav/mp4. Files under the limit
            // return as a single-element array.
            const chunks = chunkMediaFile(buffer, contentType, undefined, mediaUrl);
            const extension = getFileExtension(contentType, mediaUrl);
            console.log(`[transcribeMedia] Split into ${chunks.length} chunk(s)`);

            // Transcribe each chunk. Serial rather than parallel to respect Groq's
            // rate limits and avoid memory spikes for very large files.
            const transcripts: string[] = [];
            for (let i = 0; i < chunks.length; i++) {
                const filename = chunks.length > 1
                    ? `chunk-${i + 1}-of-${chunks.length}.${extension}`
                    : `audio.${extension}`;
                console.log(`[transcribeMedia] Groq request ${i + 1}/${chunks.length} (${mb(chunks[i].byteLength)}MB)`);
                transcripts.push(await callGroqWhisper(chunks[i], filename, groqKey));
            }

            const fullTranscript = transcripts.join(' ').trim();
            if (!fullTranscript) {
                throw new Error('Groq returned an empty transcript');
            }

            await ctx.runMutation(internal.submissions.updateTranscription, {
                submissionId: args.submissionId,
                transcription: fullTranscript,
            });
            console.log(`[transcribeMedia] Saved transcript for ${args.submissionId} (${fullTranscript.length} chars)`);
        } catch (error) {
            const reason = error instanceof Error ? error.message : 'Unknown transcription error';
            console.error(`[transcribeMedia] submissionId=${args.submissionId}:`, reason);
            await ctx.runMutation(internal.submissions.updateTranscriptionStatus, {
                submissionId: args.submissionId,
                status: 'failed',
                error: reason,
            });
        }
    },
});
