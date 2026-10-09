import { v } from 'convex/values'
import { internalAction, internalMutation } from './_generated/server'
import { internal } from './_generated/api'
import { extractReferenceFromText } from '../lib/payments/referenceCode'
import { determinePaymentStatus } from '../lib/payments/webhookParser'
import { REFERRAL_BONUS, PRICING_MODE_COMPED, isComped, ownerChargeFor } from '../lib/pricing'
import { isCreatorAccount } from '../lib/accounts'
import { validatePaymentPricing } from './lib/paymentPricing'

// ==================== SHARED CREDIT LOGIC ====================
// Used by both admin.markPaid (manual) and auto-payment (webhook)

/**
 * Credit a creator for a paid submission.
 * Shared logic: updates submission, credits balance, creates earnings,
 * sends notification, logs audit, checks referral qualification.
 *
 * `comped: true` is the promo path (admin.markComped): the owner paid nothing,
 * the creator is still owed their commission. Everything about the CREDIT is
 * identical — same balance, same earnings row, same analytics — because the
 * creator's money is real either way. What changes is everything that assumes
 * cash arrived: no registrar purchase, no referral bonus, and an audit trail
 * that says which it was. See the numbered notes below.
 */
export const creditCreatorForPayment = internalMutation({
    args: {
        submissionId: v.id('submissions'),
        triggeredBy: v.string(), // 'admin:<clerkId>' or 'system:auto-payment'
        paymentRefCode: v.optional(v.string()),
        comped: v.optional(v.boolean()),
        expectedOwnerCharge: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const submission = await ctx.db.get(args.submissionId)
        if (!submission) throw new Error('Submission not found')

        // Don't double-pay
        if (submission.status === 'completed' || submission.creatorPaidAt) {
            console.log(`[PAYMENTS] Submission ${args.submissionId} already paid, skipping`)
            return
        }

        // Trust the row over the caller. admin.markComped patches pricingMode
        // BEFORE scheduling this, so a comped submission stays comped even if
        // some future call site forgets the flag — and the Wise webhook can
        // never accidentally re-classify one as a real sale.
        const comped = args.comped === true || isComped(submission as any)

        if (submission.giveawayApplication) {
            // Only admin.markComped can turn a held application into a given
            // site. A paid webhook or legacy caller cannot settle it first.
            if (!isComped(submission)) throw new Error('Giveaway websites must be comped, not marked paid.')
            // An admin can reject while this scheduled credit is pending. Do
            // not revive the row and silently reacquire its released slot.
            if (submission.status === 'rejected') return
        }

        if (!comped && !submission.giveawayApplication) {
            const { amount } = validatePaymentPricing(submission)
            if (args.expectedOwnerCharge !== undefined && amount !== args.expectedOwnerCharge) {
                throw new Error('Payment token amount no longer matches the order.')
            }
        }

        const payoutAmount = submission.giveawayApplication ? 0 : submission.creatorPayout ?? 0

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
        // A comped site must never look like a collected payment in the log —
        // that log is the only place the two can be told apart after the fact.
        const isAuto = args.triggeredBy.startsWith('system:')
        await ctx.scheduler.runAfter(0, internal.auditLogs.log, {
            adminId: args.triggeredBy,
            action: comped
                ? 'submission_comped' as any
                : (isAuto ? 'payment_auto_matched' as any : 'payment_sent'),
            targetType: comped ? 'submission' : (isAuto ? 'payment' as any : 'submission'),
            targetId: args.submissionId,
            metadata: {
                businessName: submission.businessName,
                amount: payoutAmount,
                creatorId: submission.creatorId,
                paymentRefCode: args.paymentRefCode,
                automated: isAuto,
                comped,
                // What the owner was actually charged (₱0 on the promo) against
                // what the site was listed at, so the giveaway's cost is
                // auditable without re-deriving it from pricing constants.
                ownerCharged: comped ? 0 : ownerChargeFor(submission as any),
                listPrice: submission.amount ?? 0,
                compedReason: comped ? (submission as any).compedReason : undefined,
            },
        })

        // 5. Notification to creator
        await ctx.scheduler.runAfter(0, internal.notifications.createAndSend, {
            creatorId: submission.creatorId,
            type: 'payout_sent',
            title: comped ? 'Promo Website Credited!' : 'Payment Received!',
            body: comped
                ? `You earned ₱${payoutAmount} for "${submission.businessName}" — given free under the promo.`
                : `You received ₱${payoutAmount} for "${submission.businessName}".`,
            data: { submissionId: args.submissionId, amount: payoutAmount, comped },
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
        //
        // REFERRAL_BONUS is ₱1,000 and its rule is "on a referred creator's
        // first PAID submission" (lib/pricing.ts:41). A comped site is not a
        // paid one, so it cannot be the trigger — otherwise refer-a-friend plus
        // one promo site mints ₱1,500 against ₱0 of revenue, with nobody having
        // sold anything. Comped rows are excluded on BOTH sides: they never fire
        // the bonus, and they never count toward "is this the first", so the
        // referred creator's first REAL sale still qualifies later.
        // Affiliate sales still use the shared commission ledger, but nobody
        // can earn a referral bonus for recruiting an affiliate account.
        if (!comped && isCreatorAccount(creator)) {
            const referral = await ctx.db
                .query('referrals')
                .withIndex('by_referred', (q) => q.eq('referredId', submission.creatorId))
                .filter((q) => q.eq(q.field('status'), 'pending'))
                .first()

            if (referral) {
                const completed = await ctx.db
                    .query('submissions')
                    .withIndex('by_creator_id', (q) => q.eq('creatorId', submission.creatorId))
                    .filter((q) => q.eq(q.field('status'), 'completed'))
                    .collect()

                const paidSubmissions = completed.filter((s) => !isComped(s as any))

                if (paidSubmissions.length <= 1) {
                    await ctx.scheduler.runAfter(0, internal.referrals.qualifyByCreator, {
                        referredId: submission.creatorId,
                        bonusAmount: REFERRAL_BONUS,
                    })
                }
            }
        }

        console.log(
            `[PAYMENTS] Credited ₱${payoutAmount} to creator ${submission.creatorId} for submission ${args.submissionId} ` +
            `(triggered by ${args.triggeredBy}${comped ? ', COMPED — owner paid ₱0' : ''})`
        )

        // 8. Custom domain auto-setup
        // If this submission has a requested custom domain, kick off the registration pipeline.
        //
        // NEVER on the comped path. setupForSubmission buys a real domain on a
        // saved card, so a comped custom-domain site would cost the platform the
        // registrar fee AND the ₱500 payout while collecting nothing.
        // admin.markComped already refuses the custom-domain tier up front; this
        // is the second lock, because this mutation is also reachable from the
        // Wise webhook and from any future caller.
        const subm = submission as any
        if (!comped && subm.requestedDomain && subm.submissionType === 'with_custom_domain') {
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

        const orderPricing = await ctx.runQuery(internal.paymentTokens.getOrderPricingInternal, {
            submissionId: paymentToken.submissionId,
        })
        if (orderPricing.amount !== paymentToken.amount) {
            throw new Error('Payment token amount no longer matches the order.')
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

        // Validate and credit in one mutation before consuming the token.
        // A changed price or payout must leave the invoice available for review.
        console.log(`[PAYMENTS] ✓ Auto-crediting submission ${paymentToken.submissionId} (matched_by=${matchMethod})`)
        await ctx.runMutation(internal.payments.creditCreatorForPayment, {
            submissionId: paymentToken.submissionId,
            triggeredBy: 'system:auto-payment',
            paymentRefCode: paymentToken.referenceCode,
            expectedOwnerCharge: paymentToken.amount,
        })

        await ctx.runMutation(internal.paymentTokens.markUsed, {
            token: paymentToken.token,
            wiseTransactionId: args.transactionId,
        })
    },
})
