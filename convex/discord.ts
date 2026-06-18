import { v } from 'convex/values';
import { internalAction } from './_generated/server';
import { internal } from './_generated/api';

/**
 * Discord `/ask` slash command for field agents.
 *
 * Flow (fully serverless — no gateway bot):
 *   1. Discord POSTs an interaction to  POST /discord/interactions  (convex/http.ts),
 *      which verifies the Ed25519 signature, replies type 5 (deferred), and
 *      schedules `answerInteraction`.
 *   2. `answerInteraction` runs the Gemini RAG over the internal wiki and edits
 *      the deferred reply with the grounded answer + source links.
 *
 * One-time setup (after env vars are set on the Convex deployment):
 *   npx convex run discord:registerCommands
 * and set Discord → App → "Interactions Endpoint URL" to
 *   https://<your-convex-site>.convex.site/discord/interactions
 *
 * Env: DISCORD_PUBLIC_KEY, DISCORD_APP_ID, DISCORD_BOT_TOKEN, DISCORD_GUILD_ID(?)
 */

const DISCORD_API = 'https://discord.com/api/v10';

/** Register (or refresh) the /ask slash command. Guild-scoped if DISCORD_GUILD_ID is set (instant), else global. */
export const registerCommands = internalAction({
    args: {},
    handler: async () => {
        const appId = process.env.DISCORD_APP_ID;
        const botToken = process.env.DISCORD_BOT_TOKEN;
        const guildId = process.env.DISCORD_GUILD_ID;
        if (!appId || !botToken) {
            throw new Error('DISCORD_APP_ID and DISCORD_BOT_TOKEN must be set on the Convex deployment.');
        }

        const commands = [
            {
                name: 'ask',
                type: 1, // CHAT_INPUT
                description: 'Ask the Tendso field-agent knowledge base',
                options: [
                    {
                        name: 'question',
                        description: 'What do you want to know?',
                        type: 3, // STRING
                        required: true,
                    },
                ],
            },
        ];

        const url = guildId
            ? `${DISCORD_API}/applications/${appId}/guilds/${guildId}/commands`
            : `${DISCORD_API}/applications/${appId}/commands`;

        const res = await fetch(url, {
            method: 'PUT', // bulk-overwrite: idempotent
            headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(commands),
        });
        const text = await res.text();
        if (!res.ok) {
            throw new Error(`Discord registerCommands failed (${res.status}): ${text.slice(0, 400)}`);
        }
        return { ok: true, scope: guildId ? 'guild' : 'global (up to 1h to propagate)' };
    },
});

/** Format the grounded answer for a Discord message (≤ 2000 chars), linking sources back to the wiki. */
function formatAnswer(question: string, answer: string, sources: { slug: string; title: string }[]): string {
    const siteUrl = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
    let out = `**${question}**\n\n${answer}`;
    if (sources.length) {
        out +=
            '\n\n**Sources**\n' +
            sources
                .map((s, i) => {
                    if (siteUrl) {
                        const link = `${siteUrl}/knowledge?ws=wiki&article=${encodeURIComponent(s.slug)}`;
                        return `${i + 1}. [${s.title}](${link})`;
                    }
                    return `${i + 1}. ${s.title}`;
                })
                .join('\n');
    }
    return out.length > 1990 ? out.slice(0, 1987) + '…' : out;
}

/** Run RAG over the wiki and edit the deferred interaction reply. Scheduled from the HTTP webhook. */
export const answerInteraction = internalAction({
    args: {
        interactionToken: v.string(),
        query: v.string(),
        discordUserId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const appId = process.env.DISCORD_APP_ID;
        if (!appId) {
            console.error('[DISCORD] DISCORD_APP_ID not set — cannot edit interaction reply');
            return;
        }

        let content: string;
        try {
            const result = await ctx.runAction(internal.knowledgeAI.answerQuery, {
                query: args.query,
                workspace: 'wiki',
                source: 'discord',
                discordUserId: args.discordUserId,
            });
            content = formatAnswer(args.query, result.answer, result.sources);
        } catch (err) {
            content = `⚠️ I couldn't answer that right now. ${(err as Error).message}`;
        }

        // Edit the original (deferred) response. The interaction token authorizes this — no bot token needed.
        const res = await fetch(`${DISCORD_API}/webhooks/${appId}/${args.interactionToken}/messages/@original`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
        });
        if (!res.ok) {
            console.error('[DISCORD] failed to edit reply', res.status, (await res.text().catch(() => '')).slice(0, 300));
        }
    },
});
