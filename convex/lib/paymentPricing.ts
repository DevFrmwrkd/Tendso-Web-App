import type { Doc } from '../_generated/dataModel';
import { BASE_PRICE, PRICE_CEILING, commissionFor, domainAddOnFor } from '../../lib/pricing';

type StoredPricing = Pick<Doc<'submissions'>,
    'amount' | 'creatorPayout' | 'submissionType' | 'domainCostPHP' | 'domainChargedPHP'>;

/** Validate stored ordinary-sale money without changing the invoice or legacy commission. */
export function validatePaymentPricing(submission: StoredPricing) {
    const amount = submission.amount ?? 0;
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('A positive order amount is required.');
    const domainCharge = domainAddOnFor(
        submission.submissionType ?? 'standard', submission.domainCostPHP, submission.domainChargedPHP,
    );
    const websitePrice = amount - domainCharge;
    if (!Number.isFinite(websitePrice) || websitePrice < BASE_PRICE || websitePrice > PRICE_CEILING) {
        throw new Error(`Website price must be between ${BASE_PRICE} and ${PRICE_CEILING}.`);
    }
    const creatorPayout = submission.creatorPayout ?? 0;
    if (!Number.isFinite(creatorPayout) || creatorPayout < 0 || creatorPayout > commissionFor(websitePrice)) {
        throw new Error('Creator payout exceeds the allowed website commission or is invalid.');
    }
    return { amount, websitePrice, creatorPayout };
}
