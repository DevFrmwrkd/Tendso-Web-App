import type { Doc } from '@/convex/_generated/dataModel';
import type { PaymentSubmissionSummary } from '@/convex/paymentTokens';
import { isPaidInFull } from '@/convex/lib/ownerApp';
import { BASE_PRICE, MIN_DOWN_PAYMENT, PRICE_CEILING, isComped, type CreatorDiscount } from '@/lib/pricing';
import { priceSplit } from './payState';

export type PaymentToken = Doc<'paymentTokens'>;
export type PaymentSubmission = PaymentSubmissionSummary | null;
export type PaymentKind = 'full' | 'deposit' | 'balance';
type OrderAmounts = { total: number | null; paid: number | null; balance: number | null };
export type PendingPaymentSummary = OrderAmounts & {
    kind: PaymentKind; amountDue: number; stale: boolean;
    domain: string | null; addOn: number | null; websiteLine: number | null; discount: CreatorDiscount | null;
};
export type PaymentReceiptSummary = OrderAmounts & {
    kind: PaymentKind; confirmed: boolean; receivedAmount: number | null;
    receivedAt: number | null; method: string | null;
};

/** Public website/checkout links never accept credentials or executable schemes. */
export function safePaymentUrl(value: unknown): string | null {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
    } catch { return null; }
}

const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const kindOf = (token: PaymentToken): PaymentKind => token.kind === 'deposit' || token.kind === 'balance' ? token.kind : 'full';
const knownKind = (token: PaymentToken) => token.kind === undefined || token.kind === 'full' || token.kind === 'deposit' || token.kind === 'balance';

function orderSplit(submission: PaymentSubmission) {
    const domain = submission?.requestedDomain?.trim() || null;
    if (!submission || !positive(submission.amount)) return { total: null, domain, addOn: null, websiteLine: null, discount: null };
    const split = priceSplit(submission.amount, { ...submission, requestedDomain: domain,
        websiteListPrice: positive(submission.websiteListPrice) ? submission.websiteListPrice : null });
    if (!nonnegative(split.addOn) || !positive(split.websiteLine) || split.websiteLine < BASE_PRICE || split.websiteLine > PRICE_CEILING) {
        return { total: null, domain, addOn: null, websiteLine: null, discount: null };
    }
    return { total: submission.amount, domain, addOn: split.addOn, websiteLine: split.websiteLine, discount: split.discount };
}

function orderAmounts(submission: PaymentSubmission, total: number | null): OrderAmounts {
    if (!submission) return { total, paid: null, balance: null };
    // A free grant is not proof of a cash payment, even when its status is completed.
    if (isComped(submission)) return { total, paid: 0, balance: 0 };
    const fullySettled = isPaidInFull(submission);
    const paid = fullySettled && total !== null ? total : nonnegative(submission.amountPaid) ? submission.amountPaid
        : positive(submission.depositPaidAt) ? null : fullySettled ? null : 0;
    return { total, paid, balance: fullySettled ? 0 : total !== null && paid !== null ? Math.max(0, total - paid) : null };
}

/** The order split and this request's amount are distinct for installments. */
export function pendingPaymentSummary(token: PaymentToken, submission: PaymentSubmission): PendingPaymentSummary {
    if (submission?._id !== token.submissionId) submission = null;
    const split = orderSplit(submission);
    const amounts = orderAmounts(submission, split.total);
    const kind = kindOf(token);
    let stale = token.status !== 'pending' || !knownKind(token) || !positive(token.amount) || isComped(submission)
        || amounts.total === null || amounts.paid === null || amounts.balance === null || amounts.balance <= 0
        || positive(submission?.depositPaidAt) && !(amounts.paid !== null && amounts.paid > 0);
    if (!stale && amounts.total !== null && amounts.paid !== null && amounts.balance !== null) {
        if (kind === 'full') stale = amounts.paid > 0 || token.amount !== amounts.total;
        else if (kind === 'balance') stale = amounts.paid <= 0 || token.amount !== amounts.balance;
        else stale = amounts.paid > 0 || token.amount < MIN_DOWN_PAYMENT || token.amount >= amounts.total;
        if (token.amount > amounts.balance) stale = true;
    }
    return { ...amounts, kind, amountDue: token.amount, stale,
        domain: split.domain, addOn: split.addOn, websiteLine: split.websiteLine, discount: split.discount };
}

/** A paid order is not proof that money arrived against this particular token. */
export function receiptSummary(token: PaymentToken, submission: PaymentSubmission): PaymentReceiptSummary {
    if (submission?._id !== token.submissionId) submission = null;
    const { total } = orderSplit(submission);
    const confirmed = token.status === 'paid';
    // paidAmount records the actual provider receipt. Older paid tokens omit it;
    // their stored request amount is the only recorded amount for that receipt.
    const recordedAmount = token.paidAmount === undefined ? token.amount : token.paidAmount;
    const receivedAmount = confirmed && positive(recordedAmount) ? recordedAmount : null;
    const receivedAt = confirmed ? positive(token.paymentReceivedAt) ? token.paymentReceivedAt
        : positive(token.usedAt) ? token.usedAt : null : null;
    const method = !confirmed ? null : token.provider === 'wise' || !!token.wiseTransactionId ? 'Wise transfer'
        : token.provider === 'xendit' ? 'Card or e-wallet' : token.provider === 'manual' ? 'Confirmed by team' : null;
    return { ...orderAmounts(submission, total), kind: kindOf(token), confirmed, receivedAmount, receivedAt, method };
}
