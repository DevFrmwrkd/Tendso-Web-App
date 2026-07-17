import { v } from 'convex/values';
import { internalAction, internalMutation, internalQuery } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';

/**
 * Discord escalation loop for the Knowledge Hub.
 *
 * When a web/chat question can't be answered from the KB (retrieval found no
 * genuine match — see `retrieve()` / `matched` in convex/knowledgeAI.ts), the
 * question is escalated here:
 *   1. `createAndPost` — dedup, record an `escalations` row, post the question to
 *      a role-scoped Discord channel, and open a thread on it.
 *   2. A team member replies in that thread.
 *   3. A cron (convex/crons.ts) polls the thread for the human answer, turns it
 *      into a KB Q&A (knowledgeTraining.saveTrainedQA), and notifies the asker.
 *
 * Discord is ONLY the team's answer surface — the asker is a web/mobile user.
 *
 * Env: DISCORD_BOT_TOKEN (reused from /ask), DISCORD_ESCALATION_CHANNEL_ID (the
 * role-scoped channel — from Theo). Without the channel id, escalations are still
 * recorded (queue), but not posted to Discord.
 */

const DISCORD_API = 'https://discord.com/api/v10';
const workspaceArg = v.union(v.literal('help'), v.literal('wiki'));

function normalizeQuestion(q: string): string {
    return q.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 300);
}

// An escalation is "open" (don't re-post a duplicate) while it's still being
// handled — posted but not yet answered, learned, or delivered.
const OPEN_STATUSES = new Set(['pending', 'answered', 'learned']);

/** Dedup: is there already an open escalation for this question? */
export const findOpenByQuestion = internalQuery({
    args: { normalizedQuestion: v.string() },
    handler: async (ctx, args) => {
        const rows = await ctx.db
            .query('escalations')
            .withIndex('by_normalized', (q) => q.eq('normalizedQuestion', args.normalizedQuestion))
            .collect();
        return rows.find((r) => OPEN_STATUSES.has(r.status)) ?? null;
    },
});

export const insertEscalation = internalMutation({
    args: {
        question: v.string(),
        normalizedQuestion: v.string(),
        workspace: workspaceArg,
        askerUserId: v.optional(v.string()),
    },
    handler: async (ctx, args): Promise<Id<'escalations'>> => {
        const now = Date.now();
        return await ctx.db.insert('escalations', {
            question: args.question,
            normalizedQuestion: args.normalizedQuestion,
            workspace: args.workspace,
            askerUserId: args.askerUserId,
            status: 'pending',
            createdAt: now,
            updatedAt: now,
        });
    },
});

/** Patch any subset of an escalation's mutable fields (Discord ids, status, answer, …). */
export const patchEscalation = internalMutation({
    args: {
        id: v.id('escalations'),
        status: v.optional(
            v.union(
                v.literal('pending'),
                v.literal('answered'),
                v.literal('learned'),
                v.literal('delivered'),
                v.literal('error'),
            ),
        ),
        discordChannelId: v.optional(v.string()),
        discordMessageId: v.optional(v.string()),
        discordThreadId: v.optional(v.string()),
        answer: v.optional(v.string()),
        answeredBy: v.optional(v.string()),
        answeredAt: v.optional(v.number()),
        learnedArticleId: v.optional(v.id('knowledgeArticles')),
        error: v.optional(v.string()),
        lastPolledAt: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const { id, ...rest } = args;
        await ctx.db.patch(id, { ...rest, updatedAt: Date.now() });
    },
});

/**
 * Entry point (scheduled fire-and-forget from knowledgeAI.ask): record the
 * escalation, then post it to Discord and open a thread. Dedups on the question
 * so the same open question isn't posted twice.
 */
export const createAndPost = internalAction({
    args: {
        question: v.string(),
        workspace: workspaceArg,
        askerUserId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const normalizedQuestion = normalizeQuestion(args.question);

        // Dedup: skip if this question is already being handled.
        const existing = await ctx.runQuery(internal.escalations.findOpenByQuestion, { normalizedQuestion });
        if (existing) {
            console.log('[KB-ESCALATION] duplicate question already open, skipping:', normalizedQuestion.slice(0, 60));
            return;
        }

        const id = await ctx.runMutation(internal.escalations.insertEscalation, {
            question: args.question,
            normalizedQuestion,
            workspace: args.workspace,
            askerUserId: args.askerUserId,
        });

        const channelId = process.env.DISCORD_ESCALATION_CHANNEL_ID;
        const botToken = process.env.DISCORD_BOT_TOKEN;
        if (!channelId || !botToken) {
            // Queue is recorded; Discord posting activates once the channel is configured.
            console.warn('[KB-ESCALATION] DISCORD_ESCALATION_CHANNEL_ID/DISCORD_BOT_TOKEN not set — recorded escalation but did not post to Discord.');
            return;
        }

        try {
            // 1) Post the question to the role-scoped channel.
            const msgRes = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
                method: 'POST',
                headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content:
                        `❓ **Unanswered question from the Knowledge Hub**\n\n>>> ${args.question}\n\n` +
                        `_Reply in this thread with the answer — the bot will add it to the knowledge base._`,
                    allowed_mentions: { parse: [] },
                }),
            });
            if (!msgRes.ok) {
                throw new Error(`post message failed (${msgRes.status}): ${(await msgRes.text().catch(() => '')).slice(0, 200)}`);
            }
            const msg = (await msgRes.json()) as { id: string };

            // 2) Start a thread from that message so replies are scoped to it.
            const threadRes = await fetch(`${DISCORD_API}/channels/${channelId}/messages/${msg.id}/threads`, {
                method: 'POST',
                headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: args.question.slice(0, 90), auto_archive_duration: 1440 }),
            });
            if (!threadRes.ok) {
                throw new Error(`create thread failed (${threadRes.status}): ${(await threadRes.text().catch(() => '')).slice(0, 200)}`);
            }
            const thread = (await threadRes.json()) as { id: string };

            await ctx.runMutation(internal.escalations.patchEscalation, {
                id,
                discordChannelId: channelId,
                discordMessageId: msg.id,
                discordThreadId: thread.id,
            });
            console.log('[KB-ESCALATION] posted to Discord, thread', thread.id);
        } catch (err) {
            console.error('[KB-ESCALATION] Discord post failed:', (err as Error).message);
            await ctx.runMutation(internal.escalations.patchEscalation, {
                id,
                status: 'error',
                error: (err as Error).message,
            });
        }
    },
});
