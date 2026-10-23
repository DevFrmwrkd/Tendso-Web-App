import { ConvexError, v } from 'convex/values';
import { action, internalMutation } from './_generated/server';
import { internal } from './_generated/api';
import {
    XENDIT_INVOICES_URL,
    basicAuthHeader,
    buildInvoiceRequest,
    isAllowedRedirect,
    isPaidStatus,
    parseInvoiceResponse,
    parsePaymentMethods,
} from '../lib/payments/xendit';
import { applyTokenPaymentImpl, type ApplyResult } from './ownerPayments';

/**
 * Xendit (GCash, Maya, card) for owner payments. Contract: docs/v2-api-owners.md.
 *
 * Feature-off unless BOTH XENDIT_SECRET_KEY and XENDIT_CALLBACK_TOKEN are set
 * on the Convex deployment: createCheckout returns { enabled: false } and the
 * webhook answers 503. Keys are read from env only.
 *
 * The invoice's external_id is the pay token's reference code, so a Xendit
 * payment and a Wise transfer for the same request settle the same token —
 * whichever lands first wins, the other is a 'duplicate'.
 */

/** Open (or reuse) a Xendit checkout for a pay token. Returns the URL to open. */
export const createCheckout = action({
    args: {
        token: v.string(),
        // Where Xendit sends the payer afterwards: https:// or tendso:// only.
        successRedirectUrl: v.optional(v.string()),
        failureRedirectUrl: v.optional(v.string()),
    },
    handler: async (ctx, args): Promise<
        | { enabled: false }
        | { enabled: true; checkoutUrl: string; invoiceId: string; expiresAt: number | null; amount: number; referenceCode: string }
    > => {
        const secretKey = process.env.XENDIT_SECRET_KEY;
        if (!secretKey || !process.env.XENDIT_CALLBACK_TOKEN) return { enabled: false };

        // Runs as the caller: owner of the site, admin, or the selling agent.
        const pay = await ctx.runQuery(internal.ownerPayments.checkoutContextInternal, { token: args.token });

        const now = Date.now();
        if (pay.xenditInvoiceUrl && pay.xenditInvoiceId && (pay.xenditExpiresAt ?? 0) > now + 60_000) {
            return {
                enabled: true,
                checkoutUrl: pay.xenditInvoiceUrl,
                invoiceId: pay.xenditInvoiceId,
                expiresAt: pay.xenditExpiresAt,
                amount: pay.amount,
                referenceCode: pay.referenceCode,
            };
        }

        const fallbackSuccess = process.env.XENDIT_SUCCESS_REDIRECT_URL;
        const fallbackFailure = process.env.XENDIT_FAILURE_REDIRECT_URL;
        const success = isAllowedRedirect(args.successRedirectUrl) ? args.successRedirectUrl : fallbackSuccess;
        const failure = isAllowedRedirect(args.failureRedirectUrl) ? args.failureRedirectUrl : fallbackFailure;

        const body = buildInvoiceRequest({
            referenceCode: pay.referenceCode,
            amount: pay.amount,
            businessName: pay.businessName,
            kind: pay.kind,
            payerEmail: pay.payerEmail,
            successRedirectUrl: success,
            failureRedirectUrl: failure,
            paymentMethods: parsePaymentMethods(process.env.XENDIT_PAYMENT_METHODS),
            metadata: { submissionId: String(pay.submissionId), kind: pay.kind },
        });

        let response: Response;
        try {
            response = await fetch(XENDIT_INVOICES_URL, {
                method: 'POST',
                headers: { Authorization: basicAuthHeader(secretKey), 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
        } catch (error) {
            console.error('[XENDIT] Invoice request failed:', error);
            throw new ConvexError('Card and e-wallet payment is not working right now. Please try again.');
        }
        const json = await response.json().catch(() => null);
        const created = response.ok ? parseInvoiceResponse(json) : null;
        if (!created) {
            console.error(`[XENDIT] Invoice rejected: ${response.status} ${JSON.stringify(json).slice(0, 500)}`);
            throw new ConvexError('Card and e-wallet payment is not working right now. Please try again.');
        }
        await ctx.runMutation(internal.ownerPayments.recordXenditInvoice, {
            token: pay.token,
            invoiceId: created.invoiceId,
            invoiceUrl: created.invoiceUrl,
            expiresAt: created.expiresAt,
        });
        return {
            enabled: true,
            checkoutUrl: created.invoiceUrl,
            invoiceId: created.invoiceId,
            expiresAt: created.expiresAt ?? null,
            amount: pay.amount,
            referenceCode: pay.referenceCode,
        };
    },
});

/**
 * An authenticated invoice callback (http.ts verified x-callback-token).
 * PAID / SETTLED settle the token through the same path as Wise; a repeat
 * callback for a paid token is a 'duplicate' no-op. EXPIRED clears the stored
 * checkout so the next createCheckout opens a fresh one.
 */
export const handleInvoiceCallback = internalMutation({
    args: {
        invoiceId: v.string(),
        externalId: v.string(),
        status: v.string(),
        amount: v.optional(v.number()),
        paidAmount: v.optional(v.number()),
        paymentMethod: v.optional(v.string()),
        paymentChannel: v.optional(v.string()),
    },
    handler: async (ctx, args): Promise<ApplyResult | { result: 'ignored' | 'unknown'; reason?: string }> => {
        const tokenRow = await ctx.db.query('paymentTokens')
            .withIndex('by_reference', (q) => q.eq('referenceCode', args.externalId)).first();
        if (!tokenRow) {
            await ctx.db.insert('auditLogs', {
                adminId: 'system:xendit',
                action: 'payment_unmatched',
                targetType: 'payment',
                targetId: args.invoiceId,
                metadata: { externalId: args.externalId, status: args.status, amount: args.paidAmount ?? args.amount, reason: 'No pay token has this reference.' },
                timestamp: Date.now(),
            });
            return { result: 'unknown' };
        }

        if (!isPaidStatus(args.status)) {
            if (args.status === 'EXPIRED' && tokenRow.status === 'pending' && tokenRow.xenditInvoiceId === args.invoiceId) {
                await ctx.db.patch(tokenRow._id, { xenditInvoiceId: undefined, xenditInvoiceUrl: undefined, xenditExpiresAt: undefined });
            }
            return { result: 'ignored', reason: `status ${args.status}` };
        }

        try {
            const applied = await applyTokenPaymentImpl(ctx, {
                token: tokenRow.token,
                provider: 'xendit',
                triggeredBy: 'system:xendit',
                externalId: args.invoiceId,
                amountReceived: args.paidAmount ?? args.amount,
            });
            if (applied.result === 'rejected') {
                await ctx.db.insert('auditLogs', {
                    adminId: 'system:xendit',
                    action: 'payment_unmatched',
                    targetType: 'payment',
                    targetId: args.invoiceId,
                    metadata: { refCode: tokenRow.referenceCode, submissionId: tokenRow.submissionId, amount: args.paidAmount ?? args.amount, reason: applied.reason },
                    timestamp: Date.now(),
                });
            }
            return applied;
        } catch (error) {
            // Money arrived but the order no longer matches (price changed, a
            // stale balance). Nothing was written above; leave it to an admin.
            const reason = error instanceof Error ? error.message : String(error);
            await ctx.db.insert('auditLogs', {
                adminId: 'system:xendit',
                action: 'payment_unmatched',
                targetType: 'payment',
                targetId: args.invoiceId,
                metadata: { refCode: tokenRow.referenceCode, submissionId: tokenRow.submissionId, amount: args.paidAmount ?? args.amount, reason },
                timestamp: Date.now(),
            });
            return { result: 'rejected', submissionId: tokenRow.submissionId, reason };
        }
    },
});
