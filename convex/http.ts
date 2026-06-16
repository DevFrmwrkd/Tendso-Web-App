import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';
import nacl from 'tweetnacl';

const http = httpRouter();

// ---- Discord Ed25519 request-signature verification ----
function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

function verifyDiscordSignature(rawBody: string, signature: string, timestamp: string, publicKey: string): boolean {
    try {
        const message = new TextEncoder().encode(timestamp + rawBody);
        return nacl.sign.detached.verify(message, hexToBytes(signature), hexToBytes(publicKey));
    } catch {
        return false;
    }
}

const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// POST /discord/interactions
// Discord slash-command webhook. Verifies the signature, answers PING, and for
// the /ask command defers (type 5) and hands off to internal.discord.answerInteraction.
http.route({
    path: '/discord/interactions',
    method: 'POST',
    handler: httpAction(async (ctx, request) => {
        const signature = request.headers.get('X-Signature-Ed25519');
        const timestamp = request.headers.get('X-Signature-Timestamp');
        const publicKey = process.env.DISCORD_PUBLIC_KEY;

        // Must read the RAW body — signature is computed over (timestamp + raw bytes).
        const raw = await request.text();

        if (!signature || !timestamp || !publicKey || !verifyDiscordSignature(raw, signature, timestamp, publicKey)) {
            return new Response('invalid request signature', { status: 401 });
        }

        const body = JSON.parse(raw);

        // PING → PONG (endpoint verification + Discord health checks)
        if (body.type === 1) {
            return jsonResponse({ type: 1 });
        }

        // APPLICATION_COMMAND
        if (body.type === 2 && body.data?.name === 'ask') {
            const options: { name: string; value?: unknown }[] = body.data.options ?? [];
            const question = options.find((o) => o.name === 'question')?.value ?? '';
            const discordUserId = body.member?.user?.id ?? body.user?.id;
            await ctx.scheduler.runAfter(0, internal.discord.answerInteraction, {
                interactionToken: body.token,
                query: String(question),
                discordUserId,
            });
            // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE — we edit this reply once RAG completes.
            return jsonResponse({ type: 5 });
        }

        return jsonResponse({ type: 4, data: { content: 'Unsupported interaction.' } });
    }),
});

// POST /airtable-webhook
// Supplements the polling mechanism — Airtable calls this when AI generation completes
http.route({
    path: '/airtable-webhook',
    method: 'POST',
    handler: httpAction(async (ctx, request) => {
        const body = await request.json();
        const { convexRecordId, status, enhanced_image_url } = body;

        if (!convexRecordId) {
            return new Response('Missing convexRecordId', { status: 400 });
        }

        // Handle enhanced image URL (string or Airtable attachment array)
        let imageUrl = enhanced_image_url;
        if (Array.isArray(enhanced_image_url) && enhanced_image_url.length > 0) {
            imageUrl = enhanced_image_url[0].url;
        }

        if (status === 'done' || status === 'complete') {
            if (imageUrl) {
                await ctx.scheduler.runAfter(0, internal.airtable.downloadAndStoreEnhancedImage, {
                    submissionId: convexRecordId,
                    sourceImageUrl: imageUrl,
                });
            }
        }

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }),
});

// POST /wise-webhook
// Receives transfer state changes from Wise API
http.route({
    path: '/wise-webhook',
    method: 'POST',
    handler: httpAction(async (ctx, request) => {
        const body = await request.json();
        const { data } = body;

        if (!data?.resource?.id) {
            return new Response('Invalid payload', { status: 400 });
        }

        const transferId = data.resource.id.toString();
        const currentState = data.current_state;

        // Map Wise states to withdrawal statuses
        let newStatus: 'processing' | 'completed' | 'failed';
        if (currentState === 'outgoing_payment_sent') {
            newStatus = 'completed';
        } else if (currentState === 'processing') {
            newStatus = 'processing';
        } else if (['cancelled', 'refunded', 'bounced_back'].includes(currentState)) {
            newStatus = 'failed';
        } else {
            return new Response(JSON.stringify({ ignored: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        await ctx.runMutation(internal.withdrawals.updateByWiseTransferId, {
            wiseTransferId: transferId,
            status: newStatus,
        });

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }),
});

// GET /health
http.route({
    path: '/health',
    method: 'GET',
    handler: httpAction(async () => {
        return new Response(JSON.stringify({ status: 'ok', timestamp: Date.now() }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }),
});

// POST /wise-deposit-webhook
// Wise fires this when money is deposited into the platform's Wise account.
// Extracts reference code from payment note, matches to submission, auto-credits creator.
http.route({
    path: '/wise-deposit-webhook',
    method: 'POST',
    handler: httpAction(async (ctx, request) => {
        try {
            const body = await request.json();

            // Log the RAW payload so we can debug the exact Wise event shape
            console.log(`[WISE-DEPOSIT] Raw payload: ${JSON.stringify(body).substring(0, 1000)}`);

            // Parse the Wise deposit event
            const { parseDepositWebhook } = await import('../lib/payments/webhookParser');
            const result = parseDepositWebhook(body);

            if (!result.success || !result.event) {
                console.log(`[WISE-DEPOSIT] Ignored: ${result.error}`);
                return new Response(JSON.stringify({ status: 'ignored', reason: result.error }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            const { transactionId, amount, currency, reference, senderName } = result.event;

            console.log(`[WISE-DEPOSIT] Received: ₱${amount} ${currency}, ref="${reference}", sender="${senderName}", txn=${transactionId}`);

            // Schedule async processing (return 200 immediately — Wise requires fast response)
            await ctx.scheduler.runAfter(0, internal.payments.processDeposit, {
                referenceText: reference,
                amount,
                currency,
                transactionId,
                senderName: senderName || undefined,
            });

            return new Response(JSON.stringify({ status: 'ok', transactionId }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (error) {
            console.error('[WISE-DEPOSIT] Error:', error);
            return new Response(JSON.stringify({ error: 'Internal error' }), {
                status: 200, // Return 200 to prevent Wise from retrying
                headers: { 'Content-Type': 'application/json' },
            });
        }
    }),
});

export default http;
