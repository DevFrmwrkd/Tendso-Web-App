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
// How often to re-ping the team role about an escalation nobody has answered.
// Tunable via KB_ESCALATION_REPING_HOURS (default 8; fractional values allowed).
const repingEveryMs = () => Number(process.env.KB_ESCALATION_REPING_HOURS || 8) * 60 * 60 * 1000;
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
                v.literal('expired'),
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
        lastPingedAt: v.optional(v.number()),
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
        // Where the question came from, for the team's context in Discord. 'coach'
        // = owner-engine's Field Coach forwarded it after its own KB miss; absent
        // = the web/chat Knowledge Hub. Purely cosmetic (labels the post).
        origin: v.optional(v.union(v.literal('web'), v.literal('coach'))),
    },
    handler: async (ctx, args) => {
        const normalizedQuestion = normalizeQuestion(args.question);

        // Dedup: skip if this question is already being handled.
        const existing = await ctx.runQuery(internal.escalations.findOpenByQuestion, { normalizedQuestion });
        if (existing) {
            console.log('[KB-ESCALATION] duplicate question already open, skipping:', normalizedQuestion.slice(0, 60));
            return;
        }

        // Relevance gate: don't forward off-topic / junk questions ("how do I bake
        // bread") to the team. Only genuine Tendso questions get escalated.
        const onTopic = await ctx.runAction(internal.knowledgeAI.classifyOnTopic, { question: args.question });
        if (!onTopic) {
            console.log('[KB-ESCALATION] off-topic, not escalating:', normalizedQuestion.slice(0, 60));
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
            const originLabel = args.origin === 'coach' ? ' (via the Field Coach)' : '';
            const msgRes = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
                method: 'POST',
                headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content:
                        `❓ **Unanswered question from the Knowledge Hub${originLabel}**\n\n>>> ${args.question}\n\n` +
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
                body: JSON.stringify({ name: args.question.slice(0, 90), auto_archive_duration: 4320 }),
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

// Feature flag mirror (KB_ESCALATION_ENABLED gates the whole loop; default off).
const escalationEnabled = () => {
    const f = process.env.KB_ESCALATION_ENABLED;
    return f === '1' || f === 'true';
};

/** Pending escalations that have been posted to Discord (have a thread to poll). */
export const listPendingWithThread = internalQuery({
    args: {},
    handler: async (ctx) => {
        const rows = await ctx.db
            .query('escalations')
            .withIndex('by_status', (q) => q.eq('status', 'pending'))
            .collect();
        return rows.filter((r) => !!r.discordThreadId);
    },
});

/**
 * Atomically claim a pending escalation for processing (pending → answered).
 * Convex mutations are serializable, so of two overlapping poll runs (the cron
 * plus any manual run) only ONE wins the claim — the other gets false and skips.
 * This is what prevents duplicate articles / duplicate thread confirmations.
 */
export const claimForProcessing = internalMutation({
    args: { id: v.id('escalations') },
    handler: async (ctx, args): Promise<boolean> => {
        const esc = await ctx.db.get(args.id);
        if (!esc || esc.status !== 'pending') return false;
        await ctx.db.patch(args.id, { status: 'answered', updatedAt: Date.now() });
        return true;
    },
});

/** Notify the original asker (a signed-in field agent) that their question was answered. */
export const notifyAsker = internalMutation({
    args: { askerUserId: v.string(), question: v.string(), answer: v.string() },
    handler: async (ctx, args): Promise<boolean> => {
        const creator = await ctx.db
            .query('creators')
            .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.askerUserId))
            .first();
        if (!creator) return false;
        await ctx.scheduler.runAfter(0, internal.notifications.createAndSend, {
            creatorId: creator._id,
            type: 'system',
            title: 'Your question was answered',
            body: `${args.question}\n\n${args.answer.slice(0, 300)}`,
            data: { kbEscalation: true },
        });
        return true;
    },
});

type DiscordMessage = {
    id: string;
    content: string;
    author: { id: string; username: string; bot?: boolean };
    timestamp: string;
};

/**
 * Cron: poll open escalation threads for the first human reply. When one is
 * found, capture it, turn it into a KB Q&A (saveTrainedQA → embedded article),
 * notify the asker if signed in, and confirm in the thread. Gated by
 * KB_ESCALATION_ENABLED.
 */
export const pollPending = internalAction({
    args: {},
    handler: async (ctx) => {
        if (!escalationEnabled()) return;
        const botToken = process.env.DISCORD_BOT_TOKEN;
        if (!botToken) return;

        // Give up on escalations nobody answered within the window, so they stop
        // being polled (matches the 3-day thread auto-archive).
        const MAX_AGE_MS = 72 * 60 * 60 * 1000;
        const pending = await ctx.runQuery(internal.escalations.listPendingWithThread, {});
        for (const esc of pending) {
            const threadId = esc.discordThreadId!;
            if (Date.now() - esc.createdAt > MAX_AGE_MS) {
                await ctx.runMutation(internal.escalations.patchEscalation, { id: esc._id, status: 'expired' });
                console.log(`[KB-ESCALATION] escalation ${esc._id} expired (no answer in 72h), stopping poll`);
                continue;
            }
            try {
                const res = await fetch(`${DISCORD_API}/channels/${threadId}/messages?limit=50`, {
                    headers: { Authorization: `Bot ${botToken}` },
                });
                if (!res.ok) {
                    console.warn(`[KB-ESCALATION] poll thread ${threadId} failed (${res.status})`);
                    await ctx.runMutation(internal.escalations.patchEscalation, { id: esc._id, lastPolledAt: Date.now() });
                    continue;
                }
                const messages = (await res.json()) as DiscordMessage[];
                // Discord returns newest-first; the first human reply = the oldest
                // non-bot message that has text.
                const firstHuman = messages
                    .filter((m) => !m.author.bot && m.content.trim().length > 0)
                    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))[0];

                if (!firstHuman) {
                    // Still unanswered — nudge the team role every REPING_EVERY_MS
                    // (first nudge measured from when the escalation was created).
                    const roleId = process.env.DISCORD_ESCALATION_ROLE_ID;
                    const lastNudge = esc.lastPingedAt ?? esc.createdAt;
                    const due = !!roleId && Date.now() - lastNudge >= repingEveryMs();
                    if (due) {
                        const hoursOpen = Math.round((Date.now() - esc.createdAt) / 3_600_000);
                        await fetch(`${DISCORD_API}/channels/${threadId}/messages`, {
                            method: 'POST',
                            headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                content: `⏰ <@&${roleId}> still no answer on this one (${hoursOpen}h open). Reply in this thread and I'll add it to the knowledge base.`,
                                allowed_mentions: { roles: [roleId] },
                            }),
                        }).catch(() => {});
                        console.log(`[KB-ESCALATION] re-pinged role on thread ${threadId} (${hoursOpen}h open)`);
                    }
                    await ctx.runMutation(internal.escalations.patchEscalation, {
                        id: esc._id,
                        lastPolledAt: Date.now(),
                        lastPingedAt: due ? Date.now() : undefined,
                    });
                    continue;
                }

                // Atomically claim so overlapping poll runs (cron + manual) never
                // double-process this escalation and create duplicate articles.
                const claimed = await ctx.runMutation(internal.escalations.claimForProcessing, { id: esc._id });
                if (!claimed) continue;

                const rawAnswer = firstHuman.content.trim().slice(0, 2000);

                // Polish the raw chat reply into a clean, article-style KB answer
                // (keeps all facts; falls back to the raw text if AI is unavailable).
                const answer = await ctx.runAction(internal.knowledgeAI.rewriteAnswer, {
                    question: esc.question,
                    rawAnswer,
                });

                // Learn: turn the answer into an embedded KB Q&A article.
                const articleId = await ctx.runMutation(internal.knowledgeTraining.saveTrainedQA, {
                    question: esc.question,
                    answer,
                    workspace: esc.workspace,
                    grounded: true,
                });

                // Link to the new article for the thread confirmation (same deep-link
                // format the Discord /ask bot uses). Skipped if SITE_URL isn't set.
                const [savedArticle] = await ctx.runQuery(internal.knowledge.getArticlesByIds, { ids: [articleId] });
                const siteUrl = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
                const articleLink =
                    savedArticle && siteUrl
                        ? `${siteUrl}/knowledge?ws=${esc.workspace}&article=${encodeURIComponent(savedArticle.slug)}`
                        : null;

                // Deliver back to the original asker if they were signed in.
                let delivered = false;
                if (esc.askerUserId) {
                    delivered = await ctx.runMutation(internal.escalations.notifyAsker, {
                        askerUserId: esc.askerUserId,
                        question: esc.question,
                        answer,
                    });
                }

                await ctx.runMutation(internal.escalations.patchEscalation, {
                    id: esc._id,
                    status: delivered ? 'delivered' : 'learned',
                    answer,
                    answeredBy: firstHuman.author.username,
                    answeredAt: Date.now(),
                    learnedArticleId: articleId,
                    lastPolledAt: Date.now(),
                });

                // Confirm in the thread (best-effort — never fails the learn).
                await fetch(`${DISCORD_API}/channels/${threadId}/messages`, {
                    method: 'POST',
                    headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content:
                            `✅ Added to the knowledge base — the agent will use this next time:\n\n>>> ${answer.slice(0, 1500)}` +
                            (articleLink ? `\n\n🔗 ${articleLink}` : ''),
                        allowed_mentions: { parse: [] },
                    }),
                }).catch(() => {});

                // Resolved: lock + archive the thread so the captured answer stands
                // and no further replies pile up. Best-effort — needs MANAGE_THREADS.
                const lockRes = await fetch(`${DISCORD_API}/channels/${threadId}`, {
                    method: 'PATCH',
                    headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ locked: true, archived: true }),
                }).catch(() => null);
                if (!lockRes || !lockRes.ok) {
                    console.warn(`[KB-ESCALATION] could not lock thread ${threadId} (needs MANAGE_THREADS)`);
                }

                console.log(`[KB-ESCALATION] learned from thread ${threadId} → article ${articleId} (${delivered ? 'delivered' : 'learned'})`);
            } catch (err) {
                console.error(`[KB-ESCALATION] poll/learn failed for thread ${threadId}:`, (err as Error).message);
            }
        }
    },
});
