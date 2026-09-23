import { v } from 'convex/values';
import { action } from './_generated/server';

/**
 * Turning a spoken answer into text, for the owner intake at /start.
 *
 * WHY THIS EXISTS SEPARATELY. The app already transcribes, through
 * /api/transcribe, but that route needs a Clerk session or the internal secret
 * and the owner filling in /start has neither — there is no account on that path
 * and never will be. So this is the same job with the one identity the intake
 * actually has: none.
 *
 * WHY SPEAKING MATTERS HERE. The eight questions are the whole product. They ask
 * a sari-sari store owner to describe their business in a few sentences each,
 * on a phone, and a typed answer from that keyboard is short in a way that has
 * nothing to do with how much they have to say. Talking gets the real answer.
 *
 * UNAUTHENTICATED AND IT COSTS MONEY, so the input is fenced rather than
 * trusted:
 *
 *   - the URL must sit under our own R2 public prefix, so the audio is something
 *     that came through our signed upload and not an arbitrary address this
 *     action would happily fetch on a stranger's behalf,
 *   - it must be under the audio folder,
 *   - and the file has a hard size ceiling, which is also the only duration
 *     limit that can be enforced before paying for the transcription.
 *
 * None of that makes it free to abuse. It makes abuse cost an upload first, and
 * keeps this from being a general-purpose fetcher pointed at anything.
 */

/** Two minutes of speech at the bitrate a browser records, with room to spare. */
const MAX_AUDIO_BYTES = 6 * 1024 * 1024;

const GROQ_TRANSCRIBE_MODEL = process.env.GROQ_TRANSCRIBE_MODEL || 'whisper-large-v3';

export const transcribeAnswer = action({
    args: { audioUrl: v.string() },
    handler: async (_ctx, { audioUrl }): Promise<{ ok: boolean; text?: string; error?: string }> => {
        const prefix = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
        if (!prefix) return { ok: false, error: 'Recording is not configured.' };

        // Both checks are on the URL as given, before anything is fetched.
        if (!audioUrl.startsWith(`${prefix}/`)) {
            return { ok: false, error: 'That recording is not one of ours.' };
        }
        const path = audioUrl.slice(prefix.length + 1);
        if (!path.startsWith('audio/') || path.includes('..')) {
            return { ok: false, error: 'That recording is not one of ours.' };
        }

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) return { ok: false, error: 'Recording is not configured.' };

        let audio: Blob;
        try {
            const res = await fetch(audioUrl);
            if (!res.ok) return { ok: false, error: 'We could not read that recording.' };
            // Length first where the CDN gives one, so an oversized file is
            // refused before it is pulled into memory.
            const declared = Number(res.headers.get('content-length') ?? '0');
            if (declared > MAX_AUDIO_BYTES) {
                return { ok: false, error: 'That recording is too long. Try a shorter answer.' };
            }
            audio = await res.blob();
            if (audio.size > MAX_AUDIO_BYTES) {
                return { ok: false, error: 'That recording is too long. Try a shorter answer.' };
            }
        } catch {
            return { ok: false, error: 'We could not read that recording.' };
        }

        try {
            const form = new FormData();
            form.append('file', audio, path.split('/').pop() || 'answer.webm');
            form.append('model', GROQ_TRANSCRIBE_MODEL);
            form.append('response_format', 'json');
            // No language is set on purpose. These answers come out as Taglish,
            // and pinning either language makes the model translate rather than
            // transcribe — the owner's own words are the point.

            const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                method: 'POST',
                headers: { Authorization: `Bearer ${apiKey}` },
                body: form,
            });

            if (!res.ok) {
                const detail = await res.text().catch(() => '');
                console.error(`[INTAKE-VOICE] groq ${res.status}: ${detail.slice(0, 300)}`);
                return { ok: false, error: 'We could not turn that into text. Please try again.' };
            }

            const data = (await res.json()) as { text?: string };
            const text = (data.text ?? '').trim();
            if (!text) return { ok: false, error: 'We did not catch anything. Try recording again.' };
            return { ok: true, text };
        } catch (err) {
            console.error('[INTAKE-VOICE] failed:', err instanceof Error ? err.message : String(err));
            return { ok: false, error: 'We could not turn that into text. Please try again.' };
        }
    },
});
