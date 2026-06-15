import { v } from 'convex/values'
import { internalAction, internalMutation } from './_generated/server'
import { internal } from './_generated/api'
import { extractReferenceFromText } from '../lib/payments/referenceCode'
import { determinePaymentStatus } from '../lib/payments/webhookParser'
import { REFERRAL_BONUS } from '../lib/pricing'

// ==================== SHARED CREDIT LOGIC ====================
// Used by both admin.markPaid (manual) and auto-payment (webhook)

/**
 * Credit a creator for a paid submission.
 * Shared logic: updates submission, credits balance, creates earnings,
 * sends notification, logs audit, checks referral qualification.
 */
export const creditCreatorForPayment = internalMutation({
    args: {
        submissionId: v.id('submissions'),
        triggeredBy: v.string(), // 'admin:<clerkId>' or 'system:auto-payment'
        paymentRefCode: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const submission = await ctx.db.get(args.submissionId)
        if (!submission) throw new Error('Submission not found')

        // Don't double-pay
        if (submission.status === 'completed' || submission.creatorPaidAt) {
            console.log(`[PAYMENTS] Submission ${args.submissionId} already paid, skipping`)
            return
        }

        const payoutAmount = submission.creatorPayout ?? 0

        // 1. Update submission status
        await ctx.db.patch(args.submissionId, {
            creatorPaidAt: Date.now(),
            status: 'completed' as any,
        })

        // 2. Credit creator balance
        const creator = await ctx.db.get(submission.creatorId)
        if (creator) {
            await ctx.db.patch(submission.creatorId, {
                balance: (creator.balance || 0) + payoutAmount,
                totalEarnings: ((creator as any).totalEarnings || 0) + payoutAmount,
            })
        }

        // 3. Create earning record
        await ctx.scheduler.runAfter(0, internal.earnings.create, {
            creatorId: submission.creatorId,
            submissionId: args.submissionId,
            amount: payoutAmount,
            type: 'submission_approved',
        })

        // 4. Audit log
        const isAuto = args.triggeredBy.startsWith('system:')
        await ctx.scheduler.runAfter(0, internal.auditLogs.log, {
            adminId: args.triggeredBy,
            action: isAuto ? 'payment_auto_matched' as any : 'payment_sent',
            targetType: isAuto ? 'payment' as any : 'submission',
            targetId: args.submissionId,
            metadata: {
                businessName: submission.businessName,
                amount: payoutAmount,
                creatorId: submission.creatorId,
                paymentRefCode: args.paymentRefCode,
                automated: isAuto,
            },
        })

        // 5. Notification to creator
        await ctx.scheduler.runAfter(0, internal.notifications.createAndSend, {
            creatorId: submission.creatorId,
            type: 'payout_sent',
            title: 'Payment Received!',
            body: `You received ₱${payoutAmount} for "${submission.businessName}".`,
            data: { submissionId: args.submissionId, amount: payoutAmount },
        })

        // 6. Analytics
        const today = new Date().toISOString().split('T')[0]
        const month = today.substring(0, 7)
        await ctx.scheduler.runAfter(0, internal.analytics.incrementStat, {
            creatorId: submission.creatorId,
            period: today,
            periodType: 'daily',
            field: 'earningsTotal',
            delta: payoutAmount,
        })
        await ctx.scheduler.runAfter(0, internal.analytics.incrementStat, {
            creatorId: submission.creatorId,
            period: month,
            periodType: 'monthly',
            field: 'earningsTotal',
            delta: payoutAmount,
        })

        // 7. Referral qualification check
        const referral = await ctx.db
            .query('referrals')
            .withIndex('by_referred', (q) => q.eq('referredId', submission.creatorId))
            .filter((q) => q.eq(q.field('status'), 'pending'))
            .first()

        if (referral) {
            const paidSubmissions = await ctx.db
                .query('submissions')
                .withIndex('by_creator_id', (q) => q.eq('creatorId', submission.creatorId))
                .filter((q) => q.eq(q.field('status'), 'completed'))
                .collect()

            if (paidSubmissions.length <= 1) {
                await ctx.scheduler.runAfter(0, internal.referrals.qualifyByCreator, {
                    referredId: submission.creatorId,
                    bonusAmount: REFERRAL_BONUS,
                })
            }
        }

        console.log(`[PAYMENTS] Credited ₱${payoutAmount} to creator ${submission.creatorId} for submission ${args.submissionId} (triggered by ${args.triggeredBy})`)

        // 8. Custom domain auto-setup
        // If this submission has a requested custom domain, kick off the registration pipeline
        const subm = submission as any
        if (subm.requestedDomain && subm.submissionType === 'with_custom_domain') {
            console.log(`[PAYMENTS] Scheduling domain setup for ${subm.requestedDomain}`)
            await ctx.scheduler.runAfter(0, internal.domains.setupForSubmission, {
                submissionId: args.submissionId,
            })
        }
    },
})

// ==================== AUTO-PAYMENT PROCESSING ====================

/**
 * Process an incoming Wise deposit.
 * Called by the /wise-deposit-webhook handler.
 *
 * Uses the existing paymentTokens system:
 * - paymentTokens.referenceCode matches the code in the Wise payment note
 * - paymentTokens has the expected amount and submissionId
 * - paymentTokens.markUsed marks it as paid
 */
export const processDeposit = internalAction({
    args: {
        referenceText: v.string(),
        amount: v.number(),
        currency: v.string(),
        transactionId: v.string(),
        senderName: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        console.log(`[PAYMENTS] Processing deposit: ₱${args.amount} ${args.currency}, ref="${args.referenceText}", txn=${args.transactionId}`)

        // ── STRATEGY 1: Match by reference code (most precise) ──
        const refCode = extractReferenceFromText(args.referenceText)
        let paymentToken: any = null
        let matchMethod = ''

        if (refCode) {
            paymentToken = await ctx.runQuery(internal.paymentTokens.getByReferenceInternal, { referenceCode: refCode })
            if (paymentToken) {
                matchMethod = 'reference_code'
                console.log(`[PAYMENTS] Matched by reference code: ${refCode}`)
            }
        }

        // ── STRATEGY 2: Match by amount (fallback when Wise doesn't include reference) ──
        // Wise's balances#credit event doesn't include the payment note/reference.
        // So we find ALL pending payment tokens with a matching amount.
        // If exactly 1 match → auto-credit. If 0 or 2+ → log for admin.
        if (!paymentToken) {
            console.log(`[PAYMENTS] No reference match, trying amount-based matching for ₱${args.amount}`)
            const candidates = await ctx.runQuery(internal.paymentTokens.findPendingByAmount, {
                amount: args.amount,
                tolerance: 1, // ₱1 tolerance for InstaPay rounding/fees
            })

            if (candidates.length === 1) {
                paymentToken = candidates[0]
                matchMethod = 'amount_single_match'
                console.log(`[PAYMENTS] ✓ Single pending token matched by amount: ₱${paymentToken.amount}, ref=${paymentToken.referenceCode}, submission=${paymentToken.submissionId}`)
            } else if (candidates.length === 0) {
                console.warn(`[PAYMENTS] No pending payment tokens found for ₱${args.amount}`)
                await ctx.runMutation(internal.auditLogs.log, {
                    adminId: 'system:auto-payment',
                    action: 'payment_unmatched' as any,
                    targetType: 'payment' as any,
                    targetId: args.transactionId,
                    metadata: {
                        amount: args.amount,
                        currency: args.currency,
                        referenceText: args.referenceText,
                        senderName: args.senderName,
                        reason: 'No pending payment token found matching this amount. Admin: click "Mark as Paid" on the submission manually.',
                        matchAttempt: refCode ? 'reference_failed_then_amount_zero' : 'amount_zero',
                    },
                })
                return
            } else {
                // Multiple pending tokens with the same amount — ambiguous, admin must resolve
                console.warn(`[PAYMENTS] ${candidates.length} pending tokens match ₱${args.amount} — ambiguous, skipping auto-match`)
                await ctx.runMutation(internal.auditLogs.log, {
                    adminId: 'system:auto-payment',
                    action: 'payment_unmatched' as any,
                    targetType: 'payment' as any,
                    targetId: args.transactionId,
                    metadata: {
                        amount: args.amount,
                        currency: args.currency,
                        senderName: args.senderName,
                        reason: `${candidates.length} pending submissions have the same amount (₱${args.amount}). Cannot auto-match — admin must click "Mark as Paid" on the correct submission.`,
                        candidateSubmissionIds: candidates.map((c: any) => c.submissionId),
                        candidateRefCodes: candidates.map((c: any) => c.referenceCode),
                    },
                })
                return
            }
        }

        // ── Token found (by reference or amount) — process the payment ──

        // Check if already paid (duplicate)
        if (paymentToken.status === 'paid') {
            console.warn(`[PAYMENTS] Token ${paymentToken.referenceCode} already paid (duplicate deposit)`)
            await ctx.runMutation(internal.auditLogs.log, {
                adminId: 'system:auto-payment',
                action: 'payment_unmatched' as any,
                targetType: 'payment' as any,
                targetId: args.transactionId,
                metadata: { refCode: paymentToken.referenceCode, amount: args.amount, reason: 'Duplicate — already paid' },
            })
            return
        }

        // Determine payment status
        const paymentStatus = determinePaymentStatus(args.amount, paymentToken.amount)
        console.log(`[PAYMENTS] Token ${paymentToken.referenceCode}: status=${paymentStatus}, expected=₱${paymentToken.amount}, received=₱${args.amount}, matched_by=${matchMethod}`)

        // If partial, log and stop
        if (paymentStatus === 'partial') {
            await ctx.runMutation(internal.auditLogs.log, {
                adminId: 'system:auto-payment',
                action: 'payment_partial' as any,
                targetType: 'payment' as any,
                targetId: args.transactionId,
                metadata: {
                    refCode: paymentToken.referenceCode,
                    expectedAmount: paymentToken.amount,
                    receivedAmount: args.amount,
                    submissionId: paymentToken.submissionId,
                },
            })
            return
        }

        // Mark token as paid
        await ctx.runMutation(internal.paymentTokens.markUsed, {
            token: paymentToken.token,
            wiseTransactionId: args.transactionId,
        })

        // Credit creator + trigger domain pipeline
        console.log(`[PAYMENTS] ✓ Auto-crediting submission ${paymentToken.submissionId} (matched_by=${matchMethod})`)
        await ctx.runMutation(internal.payments.creditCreatorForPayment, {
            submissionId: paymentToken.submissionId,
            triggeredBy: 'system:auto-payment',
            paymentRefCode: paymentToken.referenceCode,
        })
    },
})
