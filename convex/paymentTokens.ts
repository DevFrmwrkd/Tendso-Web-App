import { action, mutation, query, internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { PaymentTokenStatus } from '../types/payment-tokens'
import { isComped } from '../lib/pricing'
import { requireAccountOwner, requireAdmin } from './lib/auth'
import { validatePaymentPricing } from './lib/paymentPricing'
import type { Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'

async function orderPricing(ctx: Pick<QueryCtx, 'db'>, submissionId: Id<'submissions'>) {
    const submission = await ctx.db.get(submissionId)
    if (!submission) throw new Error('Submission not found')
    if (submission.giveawayApplication) {
        throw new Error('Giveaway applications cannot be billed. Give the website through the comped flow instead.')
    }
    if (isComped(submission)) throw new Error('Comped websites cannot be billed.')
    return validatePaymentPricing(submission)
}

/**
 * Generate a cryptographic payment token using Web Crypto API
 * Works in both Node.js and browser environments
 */
async function generateToken(): Promise<string> {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
}

/**
 * Store a payment token in the database
 * Internal mutation - called by createPaymentToken action
 */
export const storePaymentToken = internalMutation({
    args: {
        submissionId: v.id('submissions'),
        token: v.string(),
        referenceCode: v.string(),
        amount: v.number(),
        createdAt: v.number(),
        expiresAt: v.number(),
    },
    handler: async (ctx, args) => {
        // The public action retains its mobile amount argument, but the order
        // owns the charge. A browser-created cheap token cannot settle it.
        const { amount } = await orderPricing(ctx, args.submissionId)
        return await ctx.db.insert('paymentTokens', {
            submissionId: args.submissionId,
            token: args.token,
            referenceCode: args.referenceCode,
            amount,
            status: 'pending' as PaymentTokenStatus,
            createdAt: args.createdAt,
            expiresAt: args.expiresAt,
        })
    },
})

/**
 * Create and store a new payment token
 * Returns the token details for payment link generation
 */
export const createPaymentToken = action({
    args: {
        submissionId: v.id('submissions'),
        referenceCode: v.string(),
        amount: v.number(),
    },
    handler: (async (ctx: any, args: any) => {
        const token = await generateToken()
        const now = Date.now()
        const expiresAt = now + 30 * 24 * 60 * 60 * 1000 // 30 days

        const tokenId = await ctx.runMutation(
            internal.paymentTokens.storePaymentToken,
            {
                submissionId: args.submissionId,
                token,
                referenceCode: args.referenceCode,
                amount: args.amount,
                createdAt: now,
                expiresAt,
            }
        )

        const stored = await ctx.runQuery(internal.paymentTokens.getByTokenInternal, { token })
        if (!stored || stored._id !== tokenId) throw new Error('Payment token was not stored')
        return stored
    }) as any,
})

// Get payment token by token string
export const getByToken = query({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        const token = await ctx.db
            .query('paymentTokens')
            .withIndex('by_token', (q) => q.eq('token', args.token))
            .first()

        if (!token) return null

        // Check if expired
        if (token.expiresAt < Date.now() && token.status === 'pending') {
            // Optionally auto-expire, but don't update status for now (let user know what happened)
        }

        return token
    },
})

// Internal query to get payment token by token string (used by actions)
export const getByTokenInternal = internalQuery({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        const token = await ctx.db
            .query('paymentTokens')
            .withIndex('by_token', (q) => q.eq('token', args.token))
            .first()

        return token
    },
})

// Get payment token by reference code
export const getByReference = query({
    args: { referenceCode: v.string() },
    handler: async (ctx, args) => {
        await requireAdmin(ctx)
        const token = await ctx.db
            .query('paymentTokens')
            .withIndex('by_reference', (q) => q.eq('referenceCode', args.referenceCode))
            .first()

        return token || null
    },
})

// Internal version of getByReference (used by actions)
export const getByReferenceInternal = internalQuery({
    args: { referenceCode: v.string() },
    handler: async (ctx, args) => {
        const token = await ctx.db
            .query('paymentTokens')
            .withIndex('by_reference', (q) => q.eq('referenceCode', args.referenceCode))
            .first()

        return token || null
    },
})

/**
 * Find pending payment tokens matching a specific amount.
 * Used as fallback when Wise webhook doesn't include a reference code.
 * Returns ALL pending tokens with that amount — caller decides if exactly 1 = auto-match.
 */
export const findPendingByAmount = internalQuery({
    args: { amount: v.number(), tolerance: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const tol = args.tolerance ?? 1 // ₱1 tolerance for rounding/fees
        const allPending = await ctx.db
            .query('paymentTokens')
            .withIndex('by_status', (q) => q.eq('status', 'pending'))
            .collect()

        // Filter by amount within tolerance
        return allPending.filter((t) => {
            const diff = Math.abs(t.amount - args.amount)
            return diff <= tol
        })
    },
})

// Get payment token by submission ID
export const getBySubmissionId = query({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        const submission = await ctx.db.get(args.submissionId)
        if (!submission) throw new Error('Submission not found')
        await requireAccountOwner(ctx, submission.creatorId)
        const token = await ctx.db
            .query('paymentTokens')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId))
            .first()

        return token || null
    },
})

/** Recheck stored money before a webhook can settle an existing invoice. */
export const getOrderPricingInternal = internalQuery({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => orderPricing(ctx, args.submissionId),
})

// Trusted server email/reminder pipelines do not have a browser Clerk session.
export const getBySubmissionIdInternal = internalQuery({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        return await ctx.db.query('paymentTokens')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId))
            .first()
    },
})

// Mark token as used (consumed by payment)
export const markUsed = internalMutation({
    args: {
        token: v.string(),
        wiseTransactionId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const paymentToken = await ctx.db
            .query('paymentTokens')
            .withIndex('by_token', (q) => q.eq('token', args.token))
            .first()

        if (!paymentToken) {
            throw new Error(`Payment token not found: ${args.token}`)
        }

        const now = Date.now()

        await ctx.db.patch(paymentToken._id, {
            status: 'paid',
            usedAt: now,
            paymentReceivedAt: now,
            wiseTransactionId: args.wiseTransactionId,
        })

        return paymentToken
    },
})

// Mark token as expired
export const markExpired = internalMutation({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        const paymentToken = await ctx.db
            .query('paymentTokens')
            .withIndex('by_token', (q) => q.eq('token', args.token))
            .first()

        if (!paymentToken) {
            throw new Error(`Payment token not found: ${args.token}`)
        }

        await ctx.db.patch(paymentToken._id, {
            status: 'expired',
        })

        return paymentToken
    },
})

// Mark token as cancelled
export const markCancelled = mutation({
    args: {
        token: v.string(),
        reason: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx)
        const paymentToken = await ctx.db
            .query('paymentTokens')
            .withIndex('by_token', (q) => q.eq('token', args.token))
            .first()

        if (!paymentToken) {
            throw new Error(`Payment token not found: ${args.token}`)
        }

        await ctx.db.patch(paymentToken._id, {
            status: 'cancelled',
            adminNotes: args.reason,
        })

        return paymentToken
    },
})

// Record email sent timestamp  
export const recordEmailSent = mutation({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        await requireAdmin(ctx)
        const paymentToken = await ctx.db
            .query('paymentTokens')
            .withIndex('by_token', (q) => q.eq('token', args.token))
            .first()

        if (!paymentToken) {
            throw new Error(`Payment token not found: ${args.token}`)
        }

        await ctx.db.patch(paymentToken._id, {
            emailSentAt: Date.now(),
        })

        return paymentToken
    },
})

// List all pending payment tokens (for admin dashboard)
export const listPending = query({
    args: {
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx)
        const tokens = await ctx.db
            .query('paymentTokens')
            .withIndex('by_status', (q) => q.eq('status', 'pending'))
            .order('desc')
            .take(args.limit || 100)

        return tokens
    },
})

// Get tokens expiring soon (admin notification)
export const getExpiringTokens = query({
    args: {
        withinDays: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx)
        const days = args.withinDays || 7
        const now = Date.now()
        const threshold = now + days * 24 * 60 * 60 * 1000

        const tokens = await ctx.db
            .query('paymentTokens')
            .withIndex('by_status', (q) => q.eq('status', 'pending'))
            .filter((q) => q.and(q.lt(q.field('expiresAt'), threshold), q.gt(q.field('expiresAt'), now)))
            .collect()

        return tokens
    },
})
