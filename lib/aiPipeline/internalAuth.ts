/**
 * Server-to-server auth for the AI pipeline's build call.
 *
 * Convex (convex/aiPipeline/steps.ts) POSTs to /api/internal/ai-pipeline-build
 * with `X-Internal-Secret: INTERNAL_API_SECRET` (the same shared secret every
 * other /api/internal route uses). That route forwards to the generate-website
 * handler with AI_PIPELINE_HEADER set; the handler accepts it in place of an
 * admin session. /api/generate-website itself stays behind the Clerk proxy, so
 * the header is only honoured on that internal hop and only with the secret.
 */

export const AI_PIPELINE_HEADER = 'x-ai-pipeline-secret';

/** Length-independent string compare (no early exit on the first difference). */
export function safeEqual(a: string, b: string): boolean {
    let diff = a.length ^ b.length;
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    return diff === 0;
}

export function secretMatches(provided: string | null | undefined, expected: string | undefined = process.env.INTERNAL_API_SECRET): boolean {
    return !!expected && !!provided && safeEqual(provided, expected);
}

export function isAiPipelineBuildRequest(request: { headers: { get(name: string): string | null } }): boolean {
    return secretMatches(request.headers.get(AI_PIPELINE_HEADER));
}
