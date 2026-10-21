/**
 * AI site pipeline — the outside services, reusing what the repo already has:
 *  - Text + vision: Gemini through the BYOK key pool (aiKeys, same rotation
 *    rules as knowledgeAI) with Groq (GROQ_API_KEY, GROQ_TEXT_MODEL) as the
 *    second choice for text. No new LLM vendor.
 *  - Photos: Higgsfield platform API (HIGGSFIELD_API_KEY). Contract from
 *    docs.higgsfield.ai, checked 2026-10-21: POST {base}/{endpoint id} with a
 *    flat JSON body, `Authorization: Key id:secret`, then poll
 *    GET {base}/requests/{id}/status until completed | failed | nsfw | canceled;
 *    the image is at images[0].url and is kept ≥7 days, so we copy it into
 *    Convex storage.
 * Used only from convex/aiPipeline/steps.ts (Node runtime).
 */

import type { ActionCtx } from '../_generated/server';
import { internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import { decryptSecret } from '../lib/encryption';
import { llmOrder, type HiggsfieldConfig } from '../../lib/aiPipeline/config';
import { parseJsonLoose } from '../../lib/aiPipeline/json';
import type { LlmUsage } from '../../lib/aiPipeline/types';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
// Same chain as convex/knowledgeAI.ts (strongest first; Pro has no free quota).
const DEFAULT_GEMINI_CHAIN = ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];

function geminiChain(): string[] {
    const list = process.env.AI_PIPELINE_GEMINI_MODELS || process.env.GEMINI_GENERATION_MODELS;
    if (list) return list.split(',').map((s) => s.trim()).filter(Boolean);
    const single = process.env.GEMINI_GENERATION_MODEL;
    return single ? [single.trim()] : DEFAULT_GEMINI_CHAIN;
}

class HttpError extends Error {
    constructor(readonly status: number, message: string) {
        super(message);
    }
}

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

async function geminiCall(model: string, key: string, system: string, parts: Part[]): Promise<{ text: string; usage: LlmUsage }> {
    const res = await fetch(`${GEMINI_BASE}/models/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts }],
            // Thinking models bill reasoning against this ceiling before any text.
            generationConfig: { temperature: 0.2, responseMimeType: 'application/json', maxOutputTokens: 8192 },
        }),
    });
    if (!res.ok) throw new HttpError(res.status, `Gemini ${model} ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
    const json = await res.json();
    const text: string = (json?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p?.text ?? '').join('').trim();
    if (!text) throw new Error(`Gemini ${model} returned no text`);
    return {
        text,
        usage: {
            provider: 'gemini',
            model,
            inputTokens: Number(json?.usageMetadata?.promptTokenCount) || 0,
            outputTokens: Number(json?.usageMetadata?.candidatesTokenCount) || 0,
        },
    };
}

async function pickGeminiKey(ctx: ActionCtx): Promise<{ id?: Id<'aiKeys'>; key: string } | null> {
    const pooled = await ctx.runQuery(internal.aiKeys.pickActiveKey, { provider: 'gemini' });
    if (pooled) {
        const secret = process.env.KEY_ENCRYPTION_SECRET;
        if (!secret) throw new Error('KEY_ENCRYPTION_SECRET is missing — cannot decrypt pooled Gemini keys');
        return { id: pooled.id, key: await decryptSecret(pooled.key, secret) };
    }
    const env = process.env.GEMINI_API_KEY;
    return env ? { key: env } : null;
}

/** Gemini through the key pool: rotate keys on 429/401/403, walk the model chain on 404/400. */
export async function geminiJson(ctx: ActionCtx, system: string, parts: Part[]): Promise<{ text: string; usage: LlmUsage } | null> {
    let lastErr: unknown = null;
    let anyKey = false;
    for (const model of geminiChain()) {
        for (let attempt = 0; attempt < 4; attempt++) {
            const picked = await pickGeminiKey(ctx);
            if (!picked) {
                // No usable key left. None at all → let the caller fall back.
                if (anyKey) throw lastErr instanceof Error ? lastErr : new Error('Gemini keys exhausted');
                return null;
            }
            anyKey = true;
            try {
                const out = await geminiCall(model, picked.key, system, parts);
                if (picked.id) await ctx.runMutation(internal.aiKeys.reportKeyResult, { id: picked.id, status: 'ok' });
                return out;
            } catch (e) {
                lastErr = e;
                const status = e instanceof HttpError ? e.status : undefined;
                if (picked.id && (status === 429 || status === 401 || status === 403)) {
                    await ctx.runMutation(internal.aiKeys.reportKeyResult, { id: picked.id, status: status === 429 ? 'quota' : 'invalid' });
                    continue; // next key, same model
                }
                if (picked.id && status !== undefined && status >= 500) {
                    await ctx.runMutation(internal.aiKeys.reportKeyResult, { id: picked.id, status: 'error' });
                }
                break; // model unavailable / bad request / env key exhausted → next model
            }
        }
    }
    throw lastErr instanceof Error ? lastErr : new Error('Gemini failed on every model');
}

async function groqJson(system: string, prompt: string): Promise<{ text: string; usage: LlmUsage }> {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('GROQ_API_KEY is not set');
    const model = process.env.GROQ_TEXT_MODEL || 'openai/gpt-oss-120b';
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            temperature: 0.2,
            max_tokens: 4000,
            response_format: { type: 'json_object' },
            messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
        }),
    });
    if (!res.ok) throw new HttpError(res.status, `Groq ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
    const json = await res.json();
    const text = String(json?.choices?.[0]?.message?.content ?? '').trim();
    if (!text) throw new Error('Groq returned no text');
    return {
        text,
        usage: { provider: 'groq', model, inputTokens: Number(json?.usage?.prompt_tokens) || 0, outputTokens: Number(json?.usage?.completion_tokens) || 0 },
    };
}

/** JSON from the text LLM chain (AI_PIPELINE_LLM_ORDER, default gemini,groq). */
export async function llmJson(ctx: ActionCtx, system: string, prompt: string): Promise<{ json: unknown; usage?: LlmUsage }> {
    let lastErr: unknown = new Error('No text LLM is configured (Gemini key pool / GEMINI_API_KEY / GROQ_API_KEY)');
    for (const provider of llmOrder(process.env)) {
        try {
            const out = provider === 'gemini' ? await geminiJson(ctx, system, [{ text: prompt }]) : await groqJson(system, prompt);
            if (!out) continue;
            return { json: parseJsonLoose(out.text), usage: out.usage };
        } catch (e) {
            lastErr = e;
            console.warn(`[ai-pipeline] ${provider} failed: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
    throw lastErr;
}

/** Vision verdict from Gemini, or null when no vision model can answer (→ keep original). */
export async function visionJson(
    ctx: ActionCtx,
    prompt: string,
    images: Array<{ bytes: Uint8Array; contentType: string }>,
): Promise<{ json: unknown; usage?: LlmUsage } | null> {
    try {
        const parts: Part[] = [
            ...images.map((img) => ({ inline_data: { mime_type: img.contentType.split(';')[0] || 'image/jpeg', data: Buffer.from(img.bytes).toString('base64') } })),
            { text: prompt },
        ];
        const out = await geminiJson(ctx, 'You grade photos strictly and answer in JSON only.', parts);
        return out ? { json: parseJsonLoose(out.text), usage: out.usage } : null;
    } catch (e) {
        console.warn(`[ai-pipeline] vision check unavailable: ${e instanceof Error ? e.message : String(e)}`);
        return null;
    }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One Higgsfield image job, submitted and polled to completion. */
export async function higgsfieldGenerate(
    cfg: HiggsfieldConfig,
    req: { prompt: string; imageUrls: string[] },
    opts: { timeoutMs?: number; pollMs?: number } = {},
): Promise<{ url: string; requestId?: string }> {
    const headers = { Authorization: cfg.authorization, 'Content-Type': 'application/json', Accept: 'application/json' };
    const body = JSON.stringify({ ...cfg.extraParams, prompt: req.prompt, image_urls: req.imageUrls });

    let submitted: { request_id?: string; status_url?: string } | null = null;
    for (let attempt = 0; attempt < 4 && !submitted; attempt++) {
        const res = await fetch(`${cfg.baseUrl}/${cfg.endpoint}`, { method: 'POST', headers, body });
        const text = await res.text();
        if (res.ok) {
            submitted = JSON.parse(text);
            break;
        }
        // Past the per-account concurrency cap Higgsfield answers 400 (not 429).
        if ((res.status === 400 && /concurrent/i.test(text)) || res.status === 429 || res.status >= 500) {
            await sleep(8_000 * (attempt + 1));
            continue;
        }
        throw new HttpError(res.status, `Higgsfield submit ${res.status}: ${text.slice(0, 300)}`);
    }
    if (!submitted?.request_id) throw new Error('Higgsfield did not accept the job');

    const statusUrl = submitted.status_url || `${cfg.baseUrl}/requests/${submitted.request_id}/status`;
    const deadline = Date.now() + (opts.timeoutMs ?? 150_000);
    while (Date.now() < deadline) {
        await sleep(opts.pollMs ?? 4_000);
        const res = await fetch(statusUrl, { headers });
        if (!res.ok) continue;
        const json = await res.json();
        const status = String(json?.status ?? '');
        if (status === 'completed') {
            const url = json?.images?.[0]?.url;
            if (typeof url !== 'string' || !url) throw new Error('Higgsfield completed without an image');
            return { url, requestId: submitted.request_id };
        }
        if (status === 'failed' || status === 'nsfw' || status === 'canceled') {
            throw new Error(`Higgsfield job ${status}${json?.error ? `: ${String(json.error).slice(0, 200)}` : ''}`);
        }
    }
    // Free a queued slot; an in-progress job cannot be canceled and is simply abandoned.
    fetch(`${cfg.baseUrl}/requests/${submitted.request_id}/cancel`, { method: 'POST', headers }).catch(() => undefined);
    throw new Error('Higgsfield job timed out');
}

export async function fetchBytes(url: string): Promise<{ bytes: Uint8Array; contentType: string }> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`download ${res.status}`);
    return { bytes: new Uint8Array(await res.arrayBuffer()), contentType: res.headers.get('content-type') || 'image/jpeg' };
}
