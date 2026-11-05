import { NextRequest, NextResponse } from 'next/server'
import { POST as generateWebsite } from '@/app/api/generate-website/route'
import { AI_PIPELINE_HEADER, secretMatches } from '@/lib/aiPipeline/internalAuth'

/**
 * POST /api/internal/ai-pipeline-build
 *
 * The AI pipeline's build step (convex/aiPipeline/steps.ts). Runs the EXISTING
 * generate-website handler — same content assembly, testimonial guard, template
 * resolution, image placement and Astro build — without an admin session, and
 * returns the build instead of saving it (the admin-gated mutations cannot run
 * without one). The pipeline saves the result with internal mutations.
 *
 * Public in proxy.ts through the existing `/api/internal(.*)` entry; the
 * shared secret is the gate. Body: { submissionId, customizations? }.
 *
 * Auth: X-Internal-Secret header = INTERNAL_API_SECRET.
 */
export const maxDuration = 300

export async function POST(request: NextRequest) {
    const secret = process.env.INTERNAL_API_SECRET
    if (!secretMatches(request.headers.get('x-internal-secret'), secret)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { submissionId?: unknown; customizations?: unknown }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    if (typeof body.submissionId !== 'string' || !body.submissionId) {
        return NextResponse.json({ error: 'submissionId required' }, { status: 400 })
    }

    const inner = new NextRequest(new URL('/api/generate-website', request.url), {
        method: 'POST',
        headers: { 'content-type': 'application/json', [AI_PIPELINE_HEADER]: secret! },
        body: JSON.stringify({
            submissionId: body.submissionId,
            ...(body.customizations && typeof body.customizations === 'object' ? { customizations: body.customizations } : {}),
        }),
    })
    return generateWebsite(inner)
}
