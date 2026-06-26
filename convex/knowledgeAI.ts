import { v } from 'convex/values';
import { action, internalAction, type ActionCtx } from './_generated/server';
import { internal } from './_generated/api';
import { decryptSecret } from './lib/encryption';
import type { Doc, Id } from './_generated/dataModel';

/**
 * Gemini-powered RAG for the Tendso knowledge base.
 *
 * Retrieval: Gemini embeddings (text-embedding-004, 768-dim) + Convex native
 * vector search, with a keyword fallback if embeddings are not yet generated.
 * Generation: Gemini generateContent, strictly grounded in the retrieved
 * sources, with multi-turn history for follow-ups. Answers walk a model chain
 * (strongest→weakest, see DEFAULT_GEN_CHAIN) so the best available model is
 * always tried first and gemini-2.0-flash is only the last resort. Degrades
 * gracefully to an extractive answer when no key is available or Gemini errors,
 * so the UI/Discord still work end-to-end.
 *
 * One core (`runRag`) is shared by:
 *   - ask()            — public web/landing entrypoint (auth-gated for wiki)
 *   - answerQuery()    — internal entrypoint used by the Discord /ask flow
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const EMBED_MODEL = () => process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004';
// Generation model fallback chain: STRONGEST first, weakest last. Each model has
// its own per-key quota bucket, so when a strong model is exhausted (429) or
// unavailable on a key's tier we drop to the next — gemini-2.0-flash is the
// last-resort floor. Pro models are omitted: they have no quota on the free
// tier (0/0) and would always fail. Override the whole list (comma-separated)
// with GEMINI_GENERATION_MODELS, or pin a single model with GEMINI_GENERATION_MODEL.
const DEFAULT_GEN_CHAIN = [
    'gemini-3.5-flash', // newest flagship flash — strongest
    'gemini-2.5-flash', // proven full flash
    'gemini-3.1-flash-lite', // newer-gen lite, large daily quota (~500/key)
    'gemini-2.5-flash-lite', // proven lite
    'gemini-2.0-flash', // last resort — weakest
];
function genModelChain(): string[] {
    const list = process.env.GEMINI_GENERATION_MODELS;
    if (list) return list.split(',').map((s) => s.trim()).filter(Boolean);
    const single = process.env.GEMINI_GENERATION_MODEL;
    if (single) return [single.trim()];
    return DEFAULT_GEN_CHAIN;
}
const EMBED_DIMS = 768;

const workspaceArg = v.union(v.literal('help'), v.literal('wiki'));
const sourceArg = v.union(v.literal('web'), v.literal('discord'), v.literal('chatbot'));
const historyArg = v.optional(
    v.array(v.object({ role: v.union(v.literal('user'), v.literal('assistant')), text: v.string() })),
);

type Workspace = 'help' | 'wiki';
type Article = Doc<'knowledgeArticles'>;

// ---- plain-text projection of an article (for embeddings + the grounding prompt) ----
export function articleToText(a: Article, maxLen = 1200): string {
    const parts: string[] = [a.title, a.summary];
    for (const b of a.body) {
        if (b.t === 'ul' || b.t === 'ol') parts.push(b.items.join('. '));
        else if ('text' in b) parts.push(b.text);
    }
    if (a.keywords?.length) parts.push(`Keywords: ${a.keywords.join(', ')}`);
    const text = parts.filter(Boolean).join('\n');
    return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
}

// ---- Gemini REST helpers (no SDK; matches the codebase's fetch convention) ----
// HTTP failures throw an Error carrying `.status` so the rotation layer can tell
// quota (429) and invalid-key (401/403) apart from transient errors.
function geminiError(kind: string, status: number, detail: string): Error {
    return Object.assign(new Error(`Gemini ${kind} failed (${status}): ${detail.slice(0, 300)}`), { status });
}

async function geminiEmbed(text: string, taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY', apiKey: string): Promise<number[]> {
    const model = EMBED_MODEL();
    const res = await fetch(`${GEMINI_BASE}/models/${model}:embedContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: `models/${model}`, content: { parts: [{ text }] }, taskType }),
    });
    if (!res.ok) throw geminiError('embed', res.status, await res.text().catch(() => ''));
    const json = await res.json();
    const values: number[] = json?.embedding?.values ?? [];
    if (values.length !== EMBED_DIMS) {
        throw new Error(`Gemini embed returned ${values.length} dims, expected ${EMBED_DIMS}`);
    }
    return values;
}

// A single conversational turn in Gemini's wire format ('model' = assistant).
type GeminiTurn = { role: 'user' | 'model'; parts: { text: string }[] };

async function geminiGenerate(
    systemInstruction: string,
    contents: GeminiTurn[],
    model: string,
    apiKey: string,
): Promise<string> {
    const res = await fetch(`${GEMINI_BASE}/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents,
            generationConfig: { temperature: 0.2, maxOutputTokens: 700, topP: 0.9 },
        }),
    });
    if (!res.ok) throw geminiError('generate', res.status, await res.text().catch(() => ''));
    const json = await res.json();
    const text: string | undefined = json?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p?.text || '')
        .join('')
        .trim();
    if (!text) throw new Error('Gemini returned an empty answer');
    return text;
}

// ---- BYOK key pool: rotate across creator-supplied Gemini keys ----
// Each creator contributes a free key (~500 req/day). We pull the
// least-recently-used active key, and on quota (429) / invalid (401/403) we
// retire-or-cooldown that key and try the next one. Falls back to a platform
// GEMINI_API_KEY if the pool is empty; if there is no key at all, callers
// degrade to keyword search + an extractive answer.
type PickedKey = { id?: Id<'aiKeys'>; key: string };

async function pickGeminiKey(ctx: ActionCtx): Promise<PickedKey | null> {
    const pooled = await ctx.runQuery(internal.aiKeys.pickActiveKey, { provider: 'gemini' });
    if (pooled) {
        // pooled.key is ciphertext for new rows (plaintext for legacy ones).
        // decryptSecret passes legacy plaintext through unchanged.
        const secret = process.env.KEY_ENCRYPTION_SECRET;
        if (!secret) throw new Error('Server is missing KEY_ENCRYPTION_SECRET — cannot decrypt pooled keys.');
        const key = await decryptSecret(pooled.key, secret);
        return { id: pooled.id, key };
    }
    const env = process.env.GEMINI_API_KEY;
    return env ? { key: env } : null;
}

async function withGeminiKey<T>(ctx: ActionCtx, doCall: (key: string) => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 4; attempt++) {
        const picked = await pickGeminiKey(ctx);
        if (!picked) {
            throw new Error('No Gemini API key available — a creator must add one in the app, or set GEMINI_API_KEY.');
        }
        try {
            const result = await doCall(picked.key);
            if (picked.id) await ctx.runMutation(internal.aiKeys.reportKeyResult, { id: picked.id, status: 'ok' });
            return result;
        } catch (err) {
            lastErr = err;
            const status = (err as { status?: number }).status;
            if (picked.id && (status === 429 || status === 401 || status === 403)) {
                await ctx.runMutation(internal.aiKeys.reportKeyResult, {
                    id: picked.id,
                    status: status === 429 ? 'quota' : 'invalid',
                });
                continue; // rotate to the next pooled key
            }
            if (picked.id) await ctx.runMutation(internal.aiKeys.reportKeyResult, { id: picked.id, status: 'error' });
            throw err; // transient/logic error, or the env key — not rotatable
        }
    }
    throw lastErr instanceof Error ? lastErr : new Error('Gemini call failed after rotating keys');
}

const embedText = (ctx: ActionCtx, text: string, taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY') =>
    withGeminiKey(ctx, (key) => geminiEmbed(text, taskType, key));

// Generate an answer, walking the model chain (strongest→weakest) and the key
// pool together. For each key we try every model: a 429 (that model's quota for
// this key is spent) or a 404/400 (model not on this key's tier) just drops us
// to the next, weaker model on the SAME key — because each model is a separate
// quota bucket, so we must not retire a key that's still good for weaker models.
// We only rotate keys on an auth error (invalid key) or when the WHOLE chain
// failed (even the floor model), and only then cool/retire the key.
async function generateWithFallback(ctx: ActionCtx, system: string, contents: GeminiTurn[]): Promise<string> {
    const chain = genModelChain();
    let lastErr: unknown;
    for (let keyAttempt = 0; keyAttempt < 4; keyAttempt++) {
        const picked = await pickGeminiKey(ctx);
        if (!picked) {
            if (lastErr) break; // ran out of keys after rotating
            throw new Error('No Gemini API key available — a creator must add one in the app, or set GEMINI_API_KEY.');
        }

        let keyInvalid = false;
        let lastStatus: number | undefined;
        for (const model of chain) {
            try {
                const text = await geminiGenerate(system, contents, model, picked.key);
                if (picked.id) await ctx.runMutation(internal.aiKeys.reportKeyResult, { id: picked.id, status: 'ok' });
                return text;
            } catch (err) {
                lastErr = err;
                lastStatus = (err as { status?: number }).status;
                if (lastStatus === 401 || lastStatus === 403) {
                    keyInvalid = true; // bad key — stop trying models, rotate keys
                    break;
                }
                // 429 (quota) / 404 / 400 (model unavailable) / 5xx → try the next model on this key.
                console.warn(`[KB-AI] ${model} failed (${lastStatus ?? '?'}), trying next model:`, (err as Error).message);
            }
        }

        if (!picked.id) break; // env key — nothing to rotate to

        if (keyInvalid) {
            await ctx.runMutation(internal.aiKeys.reportKeyResult, { id: picked.id, status: 'invalid' });
            continue;
        }
        // Whole chain failed on a real key. If even the floor model was rate-limited,
        // the key is genuinely spent → cool it (12h). Otherwise treat as transient.
        await ctx.runMutation(internal.aiKeys.reportKeyResult, {
            id: picked.id,
            status: lastStatus === 429 ? 'quota' : 'error',
        });
    }
    throw lastErr instanceof Error ? lastErr : new Error('Gemini generation failed across all models and keys');
}

// ---- keyword fallback (mirrors the design prototype's scorer) ----
const STOP = new Set(
    'the a an to my of for is in on at it as how do i can what where when why with your you our we and or but if'.split(' '),
);
function queryTerms(q: string): string[] {
    return (q || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 2 && !STOP.has(t));
}
function keywordScore(a: Article, terms: string[]): number {
    const title = a.title.toLowerCase();
    const summary = a.summary.toLowerCase();
    const kw = (a.keywords || []).join(' ').toLowerCase();
    const body = articleToText(a).toLowerCase();
    let s = 0;
    for (const t of terms) {
        if (title.includes(t)) s += 6;
        if (title.startsWith(t)) s += 3;
        if (kw.includes(t)) s += 4;
        if (summary.includes(t)) s += 2;
        if (body.includes(t)) s += 1;
    }
    if (a.popular) s += 0.4;
    return s;
}

// ---- retrieval: vector search first, keyword fallback ----
async function retrieve(ctx: ActionCtx, query: string, workspace: Workspace, topK = 5): Promise<Article[]> {
    // 1) Try semantic search.
    try {
        const vector = await embedText(ctx, query, 'RETRIEVAL_QUERY');
        const hits = await ctx.vectorSearch('knowledgeArticles', 'by_embedding', {
            vector,
            limit: 12,
            filter: (q) => q.eq('workspace', workspace),
        });
        if (hits.length) {
            const docs = await ctx.runQuery(internal.knowledge.getArticlesByIds, {
                ids: hits.map((h) => h._id as Id<'knowledgeArticles'>),
            });
            // Preserve vector-search order; keep only published.
            const byId = new Map(docs.map((d) => [d._id, d]));
            const ordered = hits
                .map((h) => byId.get(h._id as Id<'knowledgeArticles'>))
                .filter((d): d is Article => !!d && d.status === 'published');
            if (ordered.length) return ordered.slice(0, topK);
        }
    } catch (err) {
        console.warn('[KB-AI] vector search unavailable, falling back to keyword:', (err as Error).message);
    }

    // 2) Keyword fallback over the published corpus.
    const all: Article[] = await ctx.runQuery(internal.knowledge.listPublishedInternal, { workspace });
    const terms = queryTerms(query);
    if (!terms.length) return all.filter((a) => a.popular).slice(0, topK);
    return all
        .map((a) => ({ a, score: keywordScore(a, terms) }))
        .filter((r) => r.score > 0)
        .sort((x, y) => y.score - x.score)
        .slice(0, topK)
        .map((r) => r.a);
}

// ---- conversation memory (multi-turn follow-ups) ----
// Clients (e.g. the landing chatbot) pass the recent turns so follow-up
// questions keep context. The RAG stays grounded — history is only used to
// understand the question; answers still come from the retrieved SOURCES.
type ChatTurn = { role: 'user' | 'assistant'; text: string };

const MAX_HISTORY_TURNS = 6; // ~3 exchanges
const MAX_TURN_CHARS = 600;

// Normalize client-supplied history into a clean sequence that starts with a
// user turn and ends with an assistant turn — safe to prepend before the live
// (final) user turn we send to Gemini, which requires alternating roles.
function normalizeHistory(history?: ChatTurn[]): ChatTurn[] {
    if (!history?.length) return [];
    const cleaned: ChatTurn[] = [];
    for (const t of history) {
        const text = (t.text || '').trim().slice(0, MAX_TURN_CHARS);
        if (!text) continue;
        // Collapse consecutive same-role turns (e.g. the chatbot's two greetings).
        if (cleaned.length && cleaned[cleaned.length - 1].role === t.role) {
            cleaned[cleaned.length - 1] = { role: t.role, text };
        } else {
            cleaned.push({ role: t.role, text });
        }
    }
    while (cleaned.length && cleaned[0].role === 'assistant') cleaned.shift();
    while (cleaned.length && cleaned[cleaned.length - 1].role === 'user') cleaned.pop();
    return cleaned.slice(-MAX_HISTORY_TURNS);
}

const FOLLOWUP_RE =
    /^(and|but|so|also|what about|how about|why|why not|what if|then|ok|okay|that|those|this|these|it|they|he|she|more|tell me more)\b/i;

// Short or anaphoric follow-ups ("what about that?") don't retrieve well on
// their own — fold in the previous user question so vector/keyword search stays
// on-topic. Standalone questions are left untouched.
function buildRetrievalQuery(query: string, history: ChatTurn[]): string {
    const isFollowup = query.length < 60 || FOLLOWUP_RE.test(query.trim());
    if (!isFollowup) return query;
    const lastUser = [...history].reverse().find((t) => t.role === 'user');
    return lastUser ? `${lastUser.text} ${query}`.slice(0, 500) : query;
}

// ---- grounded answer ----
const SYSTEM_INSTRUCTION = `You are Tendso AI, the assistant for the Tendso knowledge base.
Tendso builds a complete website for a local business from one 30-minute creator visit.
Answer the user's question using ONLY the numbered SOURCES provided below.
- Be concise and direct: 2-4 sentences, or a short list. Lead with the answer.
- Cite the sources you used inline, like [1] or [2].
- Never invent prices, policies, timelines, or features. If the sources don't contain the answer, say you don't have that in the knowledge base yet and suggest contacting Tendso support (or asking in Discord for field agents).
- The conversation may include earlier turns — use them to resolve follow-up references like "it" or "that", but still answer only from the SOURCES.
- Write in a calm, clear, human voice. No hype, no emoji.`;

function buildPrompt(query: string, sources: Article[]): string {
    const blocks = sources
        .map((a, i) => `[${i + 1}] ${a.title}\n${articleToText(a, 900)}`)
        .join('\n\n---\n\n');
    return `SOURCES:\n\n${blocks}\n\n---\n\nQUESTION: ${query}\n\nAnswer using only the sources above, with inline citations.`;
}

// Extractive fallback when Gemini is unavailable (no key / API error).
function fallbackAnswer(query: string, sources: Article[], workspace: Workspace): string {
    if (!sources.length) {
        const where = workspace === 'help' ? 'Help Center' : 'wiki';
        return `I couldn't find anything about that in the ${where} yet. Try rephrasing, browse the categories, or reach out to Tendso support.`;
    }
    const top = sources[0];
    const firstOl = top.body.find((b) => b.t === 'ol');
    let tail = '';
    if (firstOl && firstOl.t === 'ol') tail = ' Steps: ' + firstOl.items.slice(0, 3).join('; ') + '.';
    return `${top.summary}${tail} [1]`;
}

// ---- shared RAG core ----
async function runRag(
    ctx: ActionCtx,
    args: {
        query: string;
        workspace: Workspace;
        source: 'web' | 'discord' | 'chatbot';
        userId?: string;
        discordUserId?: string;
        history?: ChatTurn[];
    },
): Promise<{ answer: string; sources: { slug: string; title: string }[]; grounded: boolean }> {
    const query = args.query.trim().slice(0, 500);
    const history = normalizeHistory(args.history);
    const sources = await retrieve(ctx, buildRetrievalQuery(query, history), args.workspace);

    let answer: string;
    let grounded = true;
    if (!sources.length) {
        answer = fallbackAnswer(query, sources, args.workspace);
        grounded = false;
    } else {
        try {
            // Prior turns + the live grounded question, in Gemini's wire format.
            const contents: GeminiTurn[] = [
                ...history.map(
                    (t): GeminiTurn => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.text }] }),
                ),
                { role: 'user', parts: [{ text: buildPrompt(query, sources) }] },
            ];
            answer = await generateWithFallback(ctx, SYSTEM_INSTRUCTION, contents);
        } catch (err) {
            console.warn('[KB-AI] generation failed, using extractive fallback:', (err as Error).message);
            answer = fallbackAnswer(query, sources, args.workspace);
            grounded = false;
        }
    }

    // Log for analytics / content-gap discovery (best effort).
    await ctx.runMutation(internal.knowledge.logQuery, {
        source: args.source,
        workspace: args.workspace,
        query,
        answer,
        sourceArticleIds: sources.map((s) => s._id),
        userId: args.userId,
        discordUserId: args.discordUserId,
        grounded,
    });

    return { answer, sources: sources.map((s) => ({ slug: s.slug, title: s.title })), grounded };
}

// ==================== PUBLIC: web search box + landing ChatBot ====================
export const ask = action({
    args: {
        query: v.string(),
        workspace: workspaceArg,
        source: v.optional(sourceArg),
        history: historyArg,
    },
    handler: async (ctx, args) => {
        const source = args.source ?? 'web';

        // Identify the caller (for gating + rate-limit key).
        const identity = await ctx.auth.getUserIdentity();
        const userId: string | undefined = identity?.subject;

        // Wiki is internal: require an admin or certified field-agent creator.
        if (args.workspace === 'wiki') {
            if (!identity) throw new Error('Sign in as a field agent to ask the internal wiki.');
            const me = await ctx.runQuery(internal.creators.getMeForAuthInternal, {
                clerkId: identity.subject,
            });
            if (!me || (me.role !== 'admin' && !me.certifiedAt)) {
                throw new Error('Field-agent access required to ask the internal wiki.');
            }
        }

        // Rate limit: 20 questions / minute per identity (anonymous web shares a bucket).
        const rlKey = `kb-ask:${userId ?? 'anon'}`;
        const { allowed } = await ctx.runMutation(internal.knowledge.consumeRateLimit, {
            key: rlKey,
            limit: 20,
            windowMs: 60_000,
        });
        if (!allowed) {
            return {
                answer: "You're asking a lot of questions very quickly — give it a moment and try again.",
                sources: [],
                grounded: false,
            };
        }

        return await runRag(ctx, {
            query: args.query,
            workspace: args.workspace,
            source,
            userId,
            history: args.history,
        });
    },
});

// ==================== INTERNAL: Discord /ask flow (no Clerk identity) ====================
export const answerQuery = internalAction({
    args: {
        query: v.string(),
        workspace: workspaceArg,
        source: sourceArg,
        discordUserId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        return await runRag(ctx, {
            query: args.query,
            workspace: args.workspace,
            source: args.source,
            discordUserId: args.discordUserId,
        });
    },
});

// ==================== EMBEDDINGS (ops: run from CLI/dashboard) ====================
export const generateEmbeddingForArticle = internalAction({
    args: { articleId: v.id('knowledgeArticles') },
    handler: async (ctx, args) => {
        const [article] = await ctx.runQuery(internal.knowledge.getArticlesByIds, { ids: [args.articleId] });
        if (!article) return { ok: false, reason: 'not found' };
        try {
            const embedding = await embedText(ctx, articleToText(article), 'RETRIEVAL_DOCUMENT');
            await ctx.runMutation(internal.knowledge.patchEmbedding, { articleId: article._id, embedding });
            return { ok: true };
        } catch (err) {
            console.error('[KB-AI] embedding failed for', article.slug, (err as Error).message);
            return { ok: false, reason: (err as Error).message };
        }
    },
});

/**
 * Backfill / refresh embeddings for all published articles whose embedding is
 * missing or older than their last edit. Run after seeding:
 *    npx convex run knowledgeAI:backfillEmbeddings
 */
export const backfillEmbeddings = internalAction({
    args: { force: v.optional(v.boolean()) },
    handler: async (ctx, args) => {
        const articles: Article[] = await ctx.runQuery(internal.knowledge.listPublishedInternal, {});
        let embedded = 0;
        let skipped = 0;
        let failed = 0;
        for (const a of articles) {
            const stale = !a.embedding || (a.embeddingUpdatedAt ?? 0) < a.updatedAt;
            if (!args.force && !stale) {
                skipped++;
                continue;
            }
            try {
                const embedding = await embedText(ctx, articleToText(a), 'RETRIEVAL_DOCUMENT');
                await ctx.runMutation(internal.knowledge.patchEmbedding, { articleId: a._id, embedding });
                embedded++;
            } catch (err) {
                console.error('[KB-AI] backfill failed for', a.slug, (err as Error).message);
                failed++;
            }
        }
        return { total: articles.length, embedded, skipped, failed };
    },
});
