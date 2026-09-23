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
 * NOTHING IS STORED. The recording is posted straight through to the
 * transcription service and never lands in a bucket: the text is the only thing
 * this app wants, and keeping a voice recording of a shop owner because it was
 * convenient to upload it is not a good enough reason to keep one. It rides in
 * the request as base64 — two minutes of speech is well under a megabyte, and
 * the round-trip through storage bought nothing but a file to delete later.
 *
 * UNAUTHENTICATED AND IT COSTS MONEY, so the one thing that can be checked
 * before paying for a transcription is checked: the size. That is also the only
 * duration limit enforceable up front, and the recorder stops itself at two
 * minutes to stay inside it. Without a stored object to point at there is no
 * ownership to verify, so this is a deliberate trade: no recordings kept, in
 * exchange for an endpoint whose only gate is how much it will listen to.
 */

/** Roughly two and a half minutes of browser-recorded speech, base64 encoded. */
const MAX_BASE64_CHARS = 1_400_000;

const GROQ_TRANSCRIBE_MODEL = process.env.GROQ_TRANSCRIBE_MODEL || 'whisper-large-v3';

export const transcribeAnswer = action({
    args: { audioBase64: v.string(), mimeType: v.optional(v.string()) },
    handler: async (
        _ctx,
        { audioBase64, mimeType },
    ): Promise<{ ok: boolean; text?: string; error?: string }> => {
        if (!audioBase64) return { ok: false, error: 'We did not catch anything. Try again.' };
        if (audioBase64.length > MAX_BASE64_CHARS) {
            return { ok: false, error: 'That recording is too long. Try a shorter answer.' };
        }

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) return { ok: false, error: 'Recording is not configured.' };

        let audio: Blob;
        try {
            const binary = atob(audioBase64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            audio = new Blob([bytes], { type: mimeType || 'audio/webm' });
        } catch {
            return { ok: false, error: 'We could not read that recording.' };
        }

        try {
            const form = new FormData();
            // The extension matters to the service: it reads the container from
            // the filename, and a mislabelled one is rejected before decoding.
            const extension = (mimeType || '').includes('mp4')
                ? 'mp4'
                : (mimeType || '').includes('ogg')
                  ? 'ogg'
                  : (mimeType || '').includes('wav')
                    ? 'wav'
                    : 'webm';
            form.append('file', audio, `answer.${extension}`);
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
