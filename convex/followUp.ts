import { v } from 'convex/values'
import { internalQuery, internalAction } from './_generated/server'
import { internal } from './_generated/api'

/**
 * Final-day payment follow-up pipeline.
 *
 * The submissions table tracks two timestamps:
 *   - sentEmailAt       — when the original payment email went out
 *   - followUpEmailSentAt — when this follow-up has already fired (auto or manual)
 *
 * The hourly cron at :15 finds pending_payment submissions whose `sentEmailAt`
 * is between (now - 72h) and (now - 48h), and have no `followUpEmailSentAt`.
 * That window is the "final day" before the unpublish cron (which runs at :00
 * and tears down sites where `sentEmailAt < now - 72h`) catches them.
 *
 * The actual email send is delegated to the Next.js endpoint
 * /api/send-payment-followup-email so that the email template, transport, and
 * Wise account details all live in one place (lib/email/).
 *
 * IMPORTANT: This module touches NOTHING in the unpublish pipeline. It only
 * dispatches follow-up emails and stamps followUpEmailSentAt — no balance
 * mutations, no Cloudflare API calls, no status changes.
 */

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000

/**
 * Internal query: submissions due for the final-day follow-up email.
 * Selection criteria:
 *   - status === 'pending_payment'
 *   - sentEmailAt set and falls inside the [now-72h, now-48h] window
 *   - followUpEmailSentAt is NOT set (we only send once)
 *   - ownerEmail is set (no point dispatching otherwise)
 */
export const getDueForFollowUp = internalQuery({
    handler: async (ctx) => {
        const now = Date.now()
        const finalDayStart = now - THREE_DAYS_MS // anything older than this is being unpublished by the other cron
        const finalDayEnd = now - TWO_DAYS_MS // anything newer than this is too early for the last-day nudge

        const candidates = await ctx.db
            .query('submissions')
            .withIndex('by_status', (q) => q.eq('status', 'pending_payment'))
            .collect()

        return candidates.filter((s) => {
            if (!s.sentEmailAt) return false
            if (s.followUpEmailSentAt) return false
            if (!s.ownerEmail) return false
            return s.sentEmailAt >= finalDayStart && s.sentEmailAt <= finalDayEnd
        })
    },
})

/**
 * Internal action: actually call /api/send-payment-followup-email for one submission.
 * The Next.js endpoint marks `followUpEmailSentAt` itself once the email is sent.
 */
export const sendOneFollowUp = internalAction({
    args: { submissionId: v.id('submissions') },
    handler: async (_ctx, args) => {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || 'https://tendso.vercel.app'
        const internalSecret = process.env.INTERNAL_API_SECRET || ''

        if (!internalSecret) {
            console.error('[followup] INTERNAL_API_SECRET not set — skipping follow-up send.')
            return
        }

        try {
            const response = await fetch(`${baseUrl}/api/send-payment-followup-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Internal-Secret': internalSecret,
                },
                body: JSON.stringify({
                    submissionId: args.submissionId,
                    isManual: false,
                }),
            })

            if (!response.ok) {
                const text = await response.text()
                console.error(`[followup] Send failed for ${args.submissionId}: ${response.status} ${text}`)
                return
            }

            const data = (await response.json()) as { sentTo?: string }
            console.log(`[followup] Sent to ${data.sentTo || 'unknown'} for submission ${args.submissionId}`)
        } catch (error) {
            console.error(`[followup] Error sending to ${args.submissionId}:`, error)
        }
    },
})

/**
 * Cron entry point. Runs hourly (registered in crons.ts at :15 — offset from
 * the unpublish cron at :00 so they never race).
 */
export const checkAndSendFollowUps = internalAction({
    handler: async (ctx) => {
        const due = await ctx.runQuery(internal.followUp.getDueForFollowUp, {})

        if (due.length === 0) {
            console.log('[followup] No submissions due for follow-up.')
            return
        }

        console.log(`[followup] ${due.length} submission(s) entering final day. Dispatching...`)

        for (const submission of due) {
            await ctx.runAction(internal.followUp.sendOneFollowUp, {
                submissionId: submission._id,
            })
        }
    },
})
