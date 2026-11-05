/**
 * Pipeline switches, read from an env object so tests can pass their own.
 * Every value has a safe default: with nothing set the pipeline is OFF and
 * production behaves exactly as before (Tendso Studio on submit).
 */

type Env = Record<string, string | undefined>;

const truthy = (v: string | undefined) => /^(1|true|yes|on)$/i.test((v ?? '').trim());

/** Master switch. Off unless AI_PIPELINE_ENABLED is true/1/yes/on. */
export function aiPipelineEnabled(env: Env): boolean {
    return truthy(env.AI_PIPELINE_ENABLED);
}

/** Fall back to Tendso Studio (Hyperagent) when the pipeline fails. Default on. */
export function studioFallbackEnabled(env: Env): boolean {
    const raw = env.AI_PIPELINE_STUDIO_FALLBACK;
    if (raw === undefined || raw.trim() === '') return true;
    return truthy(raw);
}

/** Overall deadline from "Send" to "Ready to check". Default 30 minutes. */
export function pipelineTimeoutMs(env: Env): number {
    const minutes = Number(env.AI_PIPELINE_TIMEOUT_MINUTES);
    return (Number.isFinite(minutes) && minutes > 0 ? minutes : 30) * 60_000;
}

/** At most this many photos are sent for polishing per site (cost cap). Default 6. */
export function maxPolishedPhotos(env: Env): number {
    const n = Number(env.AI_PIPELINE_MAX_POLISHED_PHOTOS);
    return Number.isInteger(n) && n >= 0 ? n : 6;
}

/** Text LLM order. Default Gemini (pool) first, Groq second. */
export function llmOrder(env: Env): Array<'gemini' | 'groq'> {
    const raw = (env.AI_PIPELINE_LLM_ORDER ?? 'gemini,groq').split(',').map((s) => s.trim().toLowerCase());
    const out = raw.filter((s): s is 'gemini' | 'groq' => s === 'gemini' || s === 'groq');
    return out.length > 0 ? Array.from(new Set(out)) : ['gemini', 'groq'];
}

export interface HiggsfieldConfig {
    authorization: string;
    endpoint: string;
    baseUrl: string;
    extraParams: Record<string, unknown>;
}

/**
 * Higgsfield platform API settings, or null when photo polishing is off.
 *
 * HIGGSFIELD_API_KEY is `KEY_ID:KEY_SECRET` (the platform's
 * `Authorization: Key id:secret` scheme). HIGGSFIELD_API_KEY_ID +
 * HIGGSFIELD_API_KEY_SECRET work too.
 *
 * HIGGSFIELD_IMAGE_ENDPOINT is REQUIRED and has no default on purpose: the
 * public docs (docs.higgsfield.ai, checked 2026-10-21) list no Nano Banana
 * endpoint id, so we do not guess one. Copy the id from console.higgsfield.ai.
 */
export function higgsfieldConfig(env: Env): HiggsfieldConfig | null {
    const key = (env.HIGGSFIELD_API_KEY ?? '').trim();
    const id = (env.HIGGSFIELD_API_KEY_ID ?? '').trim();
    const secret = (env.HIGGSFIELD_API_KEY_SECRET ?? '').trim();
    const credentials = key || (id && secret ? `${id}:${secret}` : '');
    const endpoint = (env.HIGGSFIELD_IMAGE_ENDPOINT ?? '').trim().replace(/^\/+/, '');
    if (!credentials || !endpoint) return null;
    let extraParams: Record<string, unknown> = {};
    const rawParams = (env.HIGGSFIELD_IMAGE_PARAMS ?? '').trim();
    if (rawParams) {
        try {
            const parsed = JSON.parse(rawParams);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) extraParams = parsed;
        } catch {
            extraParams = {};
        }
    }
    return {
        authorization: credentials.startsWith('Key ') ? credentials : `Key ${credentials}`,
        endpoint,
        baseUrl: (env.HIGGSFIELD_API_BASE ?? 'https://api.higgsfield.ai').replace(/\/+$/, ''),
        extraParams,
    };
}

/** Why polishing is off, for logs and the run record. Null when it is on. */
export function polishingOffReason(env: Env): string | null {
    const hasKey = !!((env.HIGGSFIELD_API_KEY ?? '').trim() || ((env.HIGGSFIELD_API_KEY_ID ?? '').trim() && (env.HIGGSFIELD_API_KEY_SECRET ?? '').trim()));
    if (!hasKey) return 'HIGGSFIELD_API_KEY is not set';
    if (!(env.HIGGSFIELD_IMAGE_ENDPOINT ?? '').trim()) return 'HIGGSFIELD_IMAGE_ENDPOINT is not set';
    return null;
}
