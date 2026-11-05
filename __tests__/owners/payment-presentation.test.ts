import { describe, expect, it } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { pendingPaymentSummary, receiptSummary, safePaymentUrl,
    type PaymentToken, type PaymentSubmission } from '../../app/pay/[token]/_components/paymentPresentation';
import { payView } from '../../app/pay/[token]/_components/payState';

const NOW = Date.UTC(2026, 10, 3, 18);
const token = (fields: Partial<PaymentToken> = {}): PaymentToken => ({
    _id: 'token-1' as PaymentToken['_id'], _creationTime: NOW - 1000, submissionId: 'site-1' as PaymentToken['submissionId'],
    token: 'a'.repeat(64), referenceCode: 'ND-AAAA-BBBB', kind: 'full', amount: 4999, status: 'pending',
    createdAt: NOW - 1000, expiresAt: NOW + 1000, ...fields,
});
type Submission = NonNullable<PaymentSubmission>;
const order = (fields: Partial<Submission> = {}): Submission => ({
    _id: 'site-1' as Submission['_id'], businessName: 'Test Shop', status: 'website_generated', amount: 4999, ...fields,
});

describe('truthful public payment presentation', () => {
    it('does not treat a new pay-before-publication order status label as a receipt', () => {
        const unreceived = order({ status: 'completed', publishPolicy: 'pay_then_publish' });
        expect(payView(token(), unreceived, NOW)).toBe('pending');
        expect(receiptSummary(token(), unreceived)).toMatchObject({ paid: 0, balance: 4999, confirmed: false });
        expect(pendingPaymentSummary(token(), unreceived)).toMatchObject({ paid: 0, balance: 4999 });
        const received = { ...unreceived, paidInFullAt: NOW };
        expect(payView(token(), received, NOW)).toBe('paid');
        expect(receiptSummary(token(), received)).toMatchObject({ paid: 4999, balance: 0, confirmed: false, receivedAmount: null });
    });

    it('preserves legacy completed orders while a new-policy deposit remains only partly paid', () => {
        expect(payView(token(), order({ status: 'completed' }), NOW)).toBe('paid');
        expect(receiptSummary(token(), order({ status: 'completed' }))).toMatchObject({ paid: 4999, balance: 0 });
        const deposit = order({ status: 'completed', publishPolicy: 'pay_then_publish', depositPaidAt: NOW, amountPaid: 500 });
        expect(payView(token({ status: 'paid', kind: 'deposit', amount: 500 }), deposit, NOW)).toBe('paid');
        expect(receiptSummary(token({ status: 'paid', kind: 'deposit', amount: 500 }), deposit)).toMatchObject({ paid: 500, balance: 4499, receivedAmount: 500 });
        expect(payView(token({ status: 'cancelled' }), deposit, NOW)).toBe('notfound');
    });

    it('separates a paid deposit receipt from the order balance and full settlement', () => {
        expect(receiptSummary(token({ status: 'paid', kind: 'deposit', amount: 500, paidAmount: 500,
            paymentReceivedAt: NOW, provider: 'wise' }), order({ status: 'deposit_paid', amountPaid: 500, depositPaidAt: NOW }))).toEqual({
            kind: 'deposit', total: 4999, paid: 500, balance: 4499, confirmed: true, receivedAmount: 500, receivedAt: NOW, method: 'Wise transfer',
        });
    });

    it('shows only this balance receipt as received while retaining the fully settled order total', () => {
        expect(receiptSummary(token({ status: 'paid', kind: 'balance', amount: 4499, paidAmount: 4499, usedAt: NOW,
            provider: 'xendit' }), order({ status: 'completed', amountPaid: 4999, paidInFullAt: NOW, depositPaidAt: NOW - 1000 }))).toMatchObject({
            total: 4999, paid: 4999, balance: 0, receivedAmount: 4499, receivedAt: NOW, method: 'Card or e-wallet',
        });
    });

    it('does not invent a token receipt, payment date or method when another payment/manual confirmation settled the order', () => {
        expect(receiptSummary(token({ kind: 'deposit', amount: 500, wiseTransactionId: 'stale-transfer', usedAt: NOW - 1000 }),
            order({ status: 'completed', paidInFullAt: NOW, paidAt: NOW, amountPaid: 4999 }))).toMatchObject({
            total: 4999, paid: 4999, balance: 0, confirmed: false, receivedAmount: null, receivedAt: null, method: null,
        });
    });

    it('uses actual provider money including an overpayment and preserves older paid-token records without inventing a date', () => {
        expect(receiptSummary(token({ status: 'paid', paidAmount: 5000 }), order({ status: 'completed' }))).toMatchObject({ receivedAmount: 5000, total: 4999, paid: 4999, balance: 0 });
        expect(receiptSummary(token({ status: 'paid', provider: 'manual' }), order({ status: 'completed', paidAt: NOW }))).toMatchObject({
            receivedAmount: 4999, receivedAt: null, method: 'Confirmed by team',
        });
        expect(receiptSummary(token({ status: 'paid', paidAmount: Number.NaN }), order())).toMatchObject({ receivedAmount: null });
    });

    it('does not claim a comped completion was paid in cash or accept its old invoice as current', () => {
        const free = order({ status: 'completed', pricingMode: 'comped' });
        expect(receiptSummary(token(), free)).toMatchObject({ paid: 0, balance: 0, confirmed: false, receivedAmount: null });
        expect(pendingPaymentSummary(token(), free).stale).toBe(true);
    });

    it('keeps custom-domain and discount math on the full order, never on the deposit or balance amount', () => {
        const domainOrder = order({ amount: 2499, requestedDomain: 'shop.com', domainChargedPHP: 500, domainCostPHP: 720, websiteListPrice: 4999 });
        const deposit = pendingPaymentSummary(token({ kind: 'deposit', amount: 500 }), domainOrder);
        expect(deposit).toMatchObject({ total: 2499, amountDue: 500, addOn: 500, websiteLine: 1999, stale: false,
            discount: { listPrice: 4999, price: 1999, percentOff: 60 } });
        const balance = pendingPaymentSummary(token({ kind: 'balance', amount: 1999 }), { ...domainOrder, amountPaid: 500, depositPaidAt: NOW });
        expect(balance).toMatchObject({ total: 2499, amountDue: 1999, paid: 500, balance: 1999, websiteLine: 1999, addOn: 500, stale: false });
    });

    it('preserves an explicit free domain add-on rather than subtracting its later registrar cost', () => {
        expect(pendingPaymentSummary(token({ amount: 1999 }), order({ amount: 1999, requestedDomain: 'shop.com',
            domainChargedPHP: 0, domainCostPHP: 720, websiteListPrice: 4999 }))).toMatchObject({ total: 1999, addOn: 0, websiteLine: 1999, stale: false });
    });

    it.each(['full-after-deposit', 'stale-balance', 'price-change', 'deposit-too-small', 'unknown-kind'])('flags %s requests rather than inviting a stale charge', scenario => {
        const request = scenario === 'stale-balance' ? token({ kind: 'balance', amount: 4499 })
            : scenario === 'deposit-too-small' ? token({ kind: 'deposit', amount: 100 })
                : scenario === 'unknown-kind' ? token({ kind: 'unexpected' }) : token();
        const submission = scenario === 'price-change' ? order({ amount: 3999 })
            : scenario === 'full-after-deposit' || scenario === 'stale-balance' ? order({ amountPaid: 1000, depositPaidAt: NOW }) : order();
        expect(pendingPaymentSummary(request, submission).stale).toBe(true);
    });

    it('preserves unknown amounts rather than deriving an order total from a request or guessing a missing deposit amount', () => {
        expect(pendingPaymentSummary(token(), null)).toMatchObject({ total: null, paid: null, balance: null, stale: true });
        expect(receiptSummary(token({ status: 'paid' }), null)).toMatchObject({ total: null, paid: null, balance: null, receivedAmount: 4999 });
        expect(pendingPaymentSummary(token({ kind: 'balance', amount: 4499 }), order({ depositPaidAt: NOW }))).toMatchObject({ paid: null, balance: null, stale: true });
        expect(pendingPaymentSummary(token(), order({ depositPaidAt: NOW, amountPaid: 0 })).stale).toBe(true);
    });

    it('never combines a token with a different business summary', () => {
        const foreign = order({ _id: 'other-site' as Submission['_id'], amount: 1999, amountPaid: 1000 });
        expect(pendingPaymentSummary(token(), foreign)).toMatchObject({ total: null, paid: null, balance: null, stale: true });
        expect(receiptSummary(token({ status: 'paid' }), foreign)).toMatchObject({ total: null, paid: null, balance: null, receivedAmount: 4999 });
    });

    it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 100])('suppresses untrustworthy order pricing %s', amount => {
        expect(pendingPaymentSummary(token(), order({ amount }))).toMatchObject({ total: null, websiteLine: null, discount: null, stale: true });
    });

    it('does not display a negative website line when the domain exceeds the recorded order total', () => {
        expect(pendingPaymentSummary(token({ kind: 'deposit', amount: 500 }), order({ amount: 1000,
            requestedDomain: 'shop.com', domainChargedPHP: 1500 }))).toMatchObject({ total: null, websiteLine: null, addOn: null, discount: null, stale: true });
    });
});

describe('token-scoped payment facts', () => {
    it('exposes the raw optional publication policy to a signed-in token holder without any capture data or private HTML', async () => {
        const t = convexTest(schema, {
            './_generated/server.js': () => import('../../convex/_generated/server'),
            './paymentTokens.ts': () => import('../../convex/paymentTokens'),
        });
        const submissionId = await t.run(async ctx => {
            const creatorId = await ctx.db.insert('creators', { clerkId: 'agent', email: 'agent@example.test', role: 'creator' });
            const id = await ctx.db.insert('submissions', { creatorId, businessName: 'Private Shop', businessType: 'Other', ownerName: 'Private Owner',
                ownerPhone: '09171234567', ownerEmail: 'private@example.test', address: 'Private Address', city: 'Private City',
                status: 'completed', amount: 4999, publishPolicy: 'pay_then_publish', videoUrl: 'https://private.example/interview.mp4',
                ownerShots: [{ index: 0, url: 'https://private.example/photo.jpg', extra: false, updatedAt: NOW }],
                interviewQa: [{ q: 'Private question', a: 'Private answer' }] });
            await ctx.db.insert('paymentTokens', { submissionId: id, token: 'public-receipt-capability', referenceCode: 'ND-AAAA-BBBB', amount: 4999,
                status: 'pending', createdAt: NOW, expiresAt: NOW + 1000 });
            await ctx.db.insert('generatedWebsites', { submissionId: id, templateName: 'private', status: 'draft',
                htmlContent: '<html>Private preview</html>', extractedContent: { confidential: 'Private copy' } });
            return id;
        });
        const holder = t.withIdentity({ subject: 'signed-in-token-holder', email: 'other@example.test', emailVerified: true });
        const summary = await holder.query(api.paymentTokens.getSubmissionByToken, { token: 'public-receipt-capability' });
        expect(summary).toMatchObject({ _id: submissionId, publishPolicy: 'pay_then_publish', status: 'completed', amount: 4999 });
        for (const key of ['ownerEmail', 'ownerPhone', 'ownerShots', 'interviewQa', 'videoUrl', 'htmlContent', 'extractedContent', 'address']) {
            expect(summary).not.toHaveProperty(key);
        }
        expect(summary?.websiteUrl).toBeUndefined();
        expect(await t.query(api.paymentTokens.getSubmissionByToken, { token: 'public-receipt-capability' })).toEqual(summary);
        expect(await holder.query(api.paymentTokens.getSubmissionByToken, { token: 'unknown' })).toBeNull();
        await t.run(ctx => ctx.db.patch(submissionId, { publishPolicy: undefined }));
        const legacy = await holder.query(api.paymentTokens.getSubmissionByToken, { token: 'public-receipt-capability' });
        expect(legacy?.publishPolicy).toBeUndefined();
    });
});

describe('public payment URL and expiry boundaries', () => {
    it.each([undefined, null, '', '/relative', 'http://shop.example', 'javascript:alert(1)', 'data:text/html,test',
        'https://user:secret@shop.example', 'not a URL'])('rejects an unsafe payment/publication URL %j', value => {
        expect(safePaymentUrl(value)).toBeNull();
    });
    it('accepts a canonical HTTPS website address', () => {
        expect(safePaymentUrl('https://shop.example/path?q=1')).toBe('https://shop.example/path?q=1');
    });
    it('expires at the exact deadline while preserving paid and cancellation precedence', () => {
        expect(payView(token({ expiresAt: NOW }), order(), NOW)).toBe('expired');
        expect(payView(token({ expiresAt: NOW + 1 }), order(), NOW)).toBe('pending');
        expect(payView(token({ expiresAt: NOW, status: 'paid' }), order(), NOW)).toBe('paid');
        expect(payView(token({ expiresAt: NOW, status: 'cancelled' }), order(), NOW)).toBe('notfound');
        expect(payView(token({ expiresAt: NOW }), order({ paidInFullAt: NOW }), NOW)).toBe('paid');
    });
});
