import type { FunctionReturnType } from 'convex/server';
import { api, type Doc, type Id } from '@tendso/convex-client';
import { clampSellPrice, commissionFor, WEBSITE_PRICE } from '../../../../packages/shared/pricing';
import type { ChipTone } from '../v2';
import { AFFILIATE_MESSAGE_MAX_LENGTH, affiliatePhotoError, affiliateSocialLinkError } from '../../../../lib/affiliates';

/** The default creator code takes 30% off the list price: ₱3,499, of which the creator keeps ₱1,750. */
export const DEFAULT_CODE_DISCOUNT = 0.3;
export const DEFAULT_CODE_PRICE = Math.round(WEBSITE_PRICE * (1 - DEFAULT_CODE_DISCOUNT));
export const DEFAULT_CODE_KEEP = commissionFor(DEFAULT_CODE_PRICE);
/** Share of each sale by a field agent who joined with the creator's code (12 months, one level). */
export const RECRUIT_SHARE_PERCENT = 5;

export type AffiliatePortal = FunctionReturnType<typeof api.affiliates.portal>;
export type AffiliateSale = FunctionReturnType<typeof api.affiliates.sales>['page'][number];
export type AffiliateDraft = { photo: string; displayName: string; message: string; socialLink: string; price: string };

export function affiliateDraft(account: Doc<'creators'>): AffiliateDraft {
  return {
    photo: account.affiliatePhoto ?? '', displayName: account.affiliateDisplayName ?? '',
    message: account.affiliateMessage ?? '', socialLink: account.affiliateSocialLink ?? '',
    price: String(clampSellPrice(account.affiliatePrice ?? WEBSITE_PRICE)),
  };
}

export function affiliateUrl(handle: string): string {
  return `https://tendso.com/v2/a/${encodeURIComponent(handle)}`;
}

export function affiliateName(account: Doc<'creators'>): string {
  return account.affiliateDisplayName?.trim() || [account.firstName, account.lastName].filter(Boolean).join(' ') || 'Your Tendso creator';
}

export function affiliatePagePayload(draft: AffiliateDraft) {
  const page = { photo: draft.photo.trim(), displayName: draft.displayName.trim(), message: draft.message.trim(), socialLink: draft.socialLink.trim() };
  if (page.displayName.length > 100) throw new Error('Use a display name of 100 characters or fewer.');
  if (page.message.length > AFFILIATE_MESSAGE_MAX_LENGTH) throw new Error(`Use a message of ${AFFILIATE_MESSAGE_MAX_LENGTH} characters or fewer.`);
  const photoError = affiliatePhotoError(page.photo);
  const socialError = affiliateSocialLinkError(page.socialLink);
  if (photoError || socialError) throw new Error(photoError || socialError!);
  if (!draft.price.trim() || !Number.isFinite(Number(draft.price))) throw new Error('Enter your website price in whole pesos.');
  return { ...page, price: clampSellPrice(Number(draft.price)) };
}

export function saleStatus(status: string): string {
  return ({ draft: 'Order received', pending: 'In review', approved: 'Approved', processing: 'Building website', website_generated: 'Website ready', deployed: 'Awaiting payment', pending_payment: 'Awaiting payment', paid: 'Paid', completed: 'Completed', rejected: 'Not approved', failed: 'Needs attention' } as Record<string, string>)[status] ?? status.replace(/_/g, ' ');
}

export function saleTone(status: string): ChipTone {
  if (status === 'paid' || status === 'completed') return 'ok';
  if (status === 'rejected' || status === 'failed') return 'danger';
  if (status === 'deployed' || status === 'pending_payment') return 'info';
  return 'warn';
}

const sampleTime = Date.UTC(2026, 9, 10, 2);
export const sampleAffiliate: Doc<'creators'> = {
  _id: 'mobile-preview-affiliate' as Id<'creators'>, _creationTime: sampleTime,
  clerkId: 'preview', email: 'creator@example.com', firstName: 'Sam', lastName: 'Santos',
  role: 'affiliate', status: 'active', affiliateHandle: 'sample-affiliate', affiliateDisplayName: 'Sam Santos',
  affiliateMessage: 'Let’s help your business get online.', affiliatePrice: 3999,
  referralCode: 'AFFSAMPLE', balance: 2500, totalEarnings: 5000, totalWithdrawn: 1000,
};

export const samplePortal: AffiliatePortal = {
  summary: { balance: 2500, totalEarned: 5000, totalWithdrawn: 1000, pendingCommission: 2000, inFlight: 500 },
  earnings: [], withdrawals: [],
  referrals: [{ _id: 'sample-referral' as Id<'referrals'>, referredName: 'Alex Reyes', status: 'pending', bonusAmount: 0, createdAt: sampleTime }],
  referralStats: { total: 1, pending: 1, qualified: 0, paid: 0, totalEarned: 0 },
  recruits: [],
  recruitStats: { total: 0, earning: 0, totalEarned: 0 },
};

export const sampleSales: AffiliateSale[] = [
  { _id: 'sample-sale-paid' as Id<'submissions'>, businessName: 'Sample barbershop', price: 3999, commission: 2000, status: 'paid', createdAt: sampleTime },
  { _id: 'sample-sale-pending' as Id<'submissions'>, businessName: 'Sample tailor shop', price: 3999, commission: 2000, status: 'pending_payment', createdAt: sampleTime - 86400000 },
];
