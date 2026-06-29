/**
 * ADD THIS ROUTE to convex/http.ts (before `export default http;`).
 *
 * It receives the agent's result, verifies the shared secret, and schedules the
 * ingest action. Mirrors the existing /airtable-webhook handler. `internal` is
 * already imported in http.ts.
 */

// POST /hyperagent-callback
// Tendso Studio (Hyperagent) posts the rendered images + copy here.
http.route({
    path: '/hyperagent-callback',
    method: 'POST',
    handler: httpAction(async (ctx, request) => {
        const secret = request.headers.get('X-Tendso-Secret');
        if (!secret || secret !== process.env.TENDSO_CALLBACK_SECRET) {
            return new Response('unauthorized', { status: 401 });
        }

        let body: any;
        try {
            body = await request.json();
        } catch {
            return new Response('bad json', { status: 400 });
        }

        const { submissionId, content, images } = body || {};
        if (!submissionId) {
            return new Response('missing submissionId', { status: 400 });
        }

        await ctx.scheduler.runAfter(0, internal.hyperagent.ingestStudioResult, {
            submissionId,
            content: content || {},
            images: images || {},
        });

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }),
});
