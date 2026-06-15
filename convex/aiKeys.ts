import { v } from 'convex/values';
import { query, mutation, action, internalQuery, internalMutation, type QueryCtx, type MutationCtx } from './_generated/server';
import { internal } from './_generated/api';
import { requireAuth } from './lib/auth';
import { encryptSecret, isEncrypted } from './lib/encryption';
import type { Doc } from './_generated/dataModel';

/**
 * BYOK Gemini key pool.
 *
 * Field agents contribute their OWN free Google Gemini API keys (~500 requests
 * per key per day). The RAG action (convex/knowledgeAI.ts) rotates across the
 * active pool — least-recently-used first — so the platform pays nothing for AI
 * and capacity grows with the creator base. A key that hits its daily quota is
 * put on a cooldown and skipped; an invalid key is retired (active=false).
 *
 * Keys are SERVER-ONLY: they are never returned to the client. `listMyGeminiKeys`
 * returns only a masked tail + status.
 *
 * NOTE: keys are stored as-is in Convex (access-controlled, never shipped to the
 * browser). Hardening follow-up: encrypt at rest (reuse owner-engine's
 * AES-256-GCM keystore) — tracked for Steven.
 */

const COOLDOWN_MS = 12 * 60 * 60 * 1000; // ~half a day — past the daily free-quota reset
const ERROR_COOLDOWN_MS = 60 * 60 * 1000; // 1h after repeated transient errors

function mask(key: string): string {
    const tail = key.slice(-4);
    return `…${tail}`;
}

async function getCreator(ctx: QueryCtx | MutationCtx): Promise<Doc<'creators'> | null> {
    const identity = await requireAuth(ctx);
    return await ctx.db
        .query('creators')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
        .first();
}

// ==================== CREATOR-FACING ====================

/**
 * Add (or replace) the caller's own Gemini key in the pool.
 *
 * An ACTION (not a mutation) because AES-GCM encryption uses a random IV, which
 * Convex's deterministic mutations disallow. The action encrypts here, then
 * hands the ciphertext + the (plaintext-derived) masked label to an internal
 * mutation that does the auth'd upsert. The raw key never lands in the DB.
 */
export const addMyGeminiKey = action({
    args: { key: v.string() },
    handler: async (ctx, args): Promise<{ ok: boolean; label: string; replaced: boolean }> => {
        // Auth is enforced again in the internal mutation (by clerk identity);
        // we just need a non-empty, plausible key before spending crypto on it.
        await requireAuth(ctx);
        const key = args.key.trim();
        if (key.length < 20) throw new Error('That does not look like a valid Gemini API key.');

        const secret = process.env.KEY_ENCRYPTION_SECRET;
        if (!secret) throw new Error('Server is missing KEY_ENCRYPTION_SECRET — cannot store keys securely.');

        const encrypted = await encryptSecret(key, secret);
        const label = mask(key); // masked tail from the PLAINTEXT (storage stays encrypted)

        return await ctx.runMutation(internal.aiKeys.upsertMyGeminiKey, {
            encryptedKey: encrypted,
            label,
        });
    },
});

/**
 * Internal upsert for the encrypted key — does the auth'd creator lookup and
 * writes the ciphertext. Only callable from addMyGeminiKey (server-side).
 */
export const upsertMyGeminiKey = internalMutation({
    args: { encryptedKey: v.string(), label: v.string() },
    handler: async (ctx, args) => {
        const me = await getCreator(ctx);
        if (!me) throw new Error('Creator profile not found.');

        const existing = await ctx.db
            .query('aiKeys')
            .withIndex('by_creator', (q) => q.eq('creatorId', me._id))
            .collect();
        const mineForGemini = existing.find((k) => k.provider === 'gemini');

        const fields = {
            provider: 'gemini',
            key: args.encryptedKey, // ciphertext at rest
            creatorId: me._id,
            label: args.label,
            active: true,
            failureCount: 0,
            cooldownUntil: undefined,
        };
        if (mineForGemini) {
            await ctx.db.patch(mineForGemini._id, fields);
            return { ok: true, label: args.label, replaced: true };
        }
        await ctx.db.insert('aiKeys', { ...fields, createdAt: Date.now() });
        return { ok: true, label: args.label, replaced: false };
    },
});

/** List the caller's keys — masked, never the raw key. */
export const listMyGeminiKeys = query({
    args: {},
    handler: async (ctx) => {
        const me = await getCreator(ctx);
        if (!me) return [];
        const keys = await ctx.db
            .query('aiKeys')
            .withIndex('by_creator', (q) => q.eq('creatorId', me._id))
            .collect();
        return keys.map((k) => ({
            _id: k._id,
            provider: k.provider,
            // Prefer the stored masked label. Only fall back to masking k.key for
            // legacy PLAINTEXT rows — never mask ciphertext (it's meaningless).
            label: k.label ?? (isEncrypted(k.key) ? '…••••' : mask(k.key)),
            active: k.active,
            onCooldown: !!(k.cooldownUntil && k.cooldownUntil > Date.now()),
            lastUsedAt: k.lastUsedAt,
        }));
    },
});

/** Remove one of the caller's keys. */
export const removeMyGeminiKey = mutation({
    args: { id: v.id('aiKeys') },
    handler: async (ctx, args) => {
        const me = await getCreator(ctx);
        if (!me) throw new Error('Creator profile not found.');
        const row = await ctx.db.get(args.id);
        if (row && row.creatorId === me._id) await ctx.db.delete(args.id);
        return { ok: true };
    },
});

// ==================== INTERNAL (used by the RAG action) ====================

/**
 * Pick the least-recently-used active key for a provider that isn't on cooldown.
 * Returns the key AS STORED (ciphertext for new rows, plaintext for legacy ones);
 * the calling action decrypts via decryptSecret() before use.
 */
export const pickActiveKey = internalQuery({
    args: { provider: v.string() },
    handler: async (ctx, args) => {
        const now = Date.now();
        const candidates = await ctx.db
            .query('aiKeys')
            .withIndex('by_provider_active', (q) => q.eq('provider', args.provider).eq('active', true))
            .collect();
        const usable = candidates
            .filter((k) => !k.cooldownUntil || k.cooldownUntil <= now)
            .sort((a, b) => (a.lastUsedAt ?? 0) - (b.lastUsedAt ?? 0));
        const pick = usable[0];
        return pick ? { id: pick._id, key: pick.key } : null;
    },
});

/** How many keys are usable right now (for the action to decide on env fallback). */
export const poolSize = internalQuery({
    args: { provider: v.string() },
    handler: async (ctx, args) => {
        const now = Date.now();
        const candidates = await ctx.db
            .query('aiKeys')
            .withIndex('by_provider_active', (q) => q.eq('provider', args.provider).eq('active', true))
            .collect();
        return candidates.filter((k) => !k.cooldownUntil || k.cooldownUntil <= now).length;
    },
});

/** Record the outcome of a Gemini call so rotation can skip exhausted/invalid keys. */
export const reportKeyResult = internalMutation({
    args: {
        id: v.id('aiKeys'),
        status: v.union(v.literal('ok'), v.literal('quota'), v.literal('invalid'), v.literal('error')),
    },
    handler: async (ctx, args) => {
        const row = await ctx.db.get(args.id);
        if (!row) return;
        const now = Date.now();
        if (args.status === 'ok') {
            await ctx.db.patch(args.id, { lastUsedAt: now, failureCount: 0, cooldownUntil: undefined });
        } else if (args.status === 'quota') {
            await ctx.db.patch(args.id, { lastUsedAt: now, cooldownUntil: now + COOLDOWN_MS });
        } else if (args.status === 'invalid') {
            await ctx.db.patch(args.id, { lastUsedAt: now, active: false });
        } else {
            const failureCount = (row.failureCount ?? 0) + 1;
            await ctx.db.patch(args.id, {
                lastUsedAt: now,
                failureCount,
                cooldownUntil: failureCount >= 5 ? now + ERROR_COOLDOWN_MS : row.cooldownUntil,
            });
        }
    },
});

// ==================== ADMIN ====================

/** Admin/ops: pool health (counts only, no raw keys). */
export const poolStats = query({
    args: {},
    handler: async (ctx) => {
        const all = await ctx.db.query('aiKeys').collect();
        const now = Date.now();
        const gemini = all.filter((k) => k.provider === 'gemini');
        return {
            total: gemini.length,
            active: gemini.filter((k) => k.active).length,
            usableNow: gemini.filter((k) => k.active && (!k.cooldownUntil || k.cooldownUntil <= now)).length,
            onCooldown: gemini.filter((k) => k.active && k.cooldownUntil && k.cooldownUntil > now).length,
            retired: gemini.filter((k) => !k.active).length,
        };
    },
});
