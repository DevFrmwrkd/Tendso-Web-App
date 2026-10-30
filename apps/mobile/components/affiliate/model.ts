import type { FunctionReturnType } from 'convex/server';
import { api, type Doc, type Id } from '@tendso/convex-client';
import { CREATOR_CODE_DISCOUNT, CREATOR_CODE_PRICE, commissionFor } from '../../../../packages/shared/pricing';
import { saleStatusLabel } from '../../../../packages/shared/affiliateSales';
import type { ChipTone } from '../v2';
import { AFFILIATE_MESSAGE_MAX_LENGTH, AFFILIATE_SOCIAL_PLATFORMS, affiliatePhotoError, affiliateSocialPlatformLinkError, getAffiliateSocialLinks, type AffiliateSocialLinks } from '../../../../lib/affiliates';

/** Every creator code takes 30% off the list price: ₱3,499, of which the creator keeps ₱1,750. */
export const DEFAULT_CODE_DISCOUNT = CREATOR_CODE_DISCOUNT;
export const DEFAULT_CODE_PRICE = CREATOR_CODE_PRICE;
export const DEFAULT_CODE_KEEP = commissionFor(DEFAULT_CODE_PRICE);
/** Share of each sale by a field agent who joined with the creator's code (12 months, one level). */
export const RECRUIT_SHARE_PERCENT = 5;

export type AffiliatePortal = FunctionReturnType<typeof api.affiliates.portal>;
export type AffiliateSale = FunctionReturnType<typeof api.affiliates.sales>['page'][number];
export type AffiliateDraft = { photo: string; displayName: string; message: string; socialLinks: AffiliateSocialLinks; price: string };

export function affiliateDraft(account: Doc<'creators'>): AffiliateDraft {
  return {
    photo: account.affiliatePhoto ?? '', displayName: account.affiliateDisplayName ?? '',
    message: account.affiliateMessage ?? '', socialLinks: getAffiliateSocialLinks(account.affiliateSocialLinks, account.affiliateSocialLink),
    price: String(CREATOR_CODE_PRICE),
  };
}

export function affiliateUrl(handle: string): string {
  return `https://tendso.com/v2/a/${encodeURIComponent(handle)}`;
}

export function affiliateName(account: Doc<'creators'>): string {
  return account.affiliateDisplayName?.trim() || [account.firstName, account.lastName].filter(Boolean).join(' ') || 'Your Tendso creator';
}

export function affiliatePagePayload(draft: AffiliateDraft) {
  const page = { photo: draft.photo.trim(), displayName: draft.displayName.trim(), message: draft.message.trim(), socialLinks: {} as AffiliateSocialLinks };
  if (page.displayName.length > 100) throw new Error('Use a display name of 100 characters or fewer.');
  if (page.message.length > AFFILIATE_MESSAGE_MAX_LENGTH) throw new Error(`Use a message of ${AFFILIATE_MESSAGE_MAX_LENGTH} characters or fewer.`);
  const photoError = affiliatePhotoError(page.photo);
  if (photoError) throw new Error(photoError);
  for (const platform of AFFILIATE_SOCIAL_PLATFORMS) {
    const value = draft.socialLinks[platform]?.trim() ?? '';
    const error = affiliateSocialPlatformLinkError(platform, value);
    if (error) throw new Error(error);
    if (value) page.socialLinks[platform] = value;
  }
  return page;
}

export const saleStatus = saleStatusLabel;

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
  affiliateMessage: 'Let’s help your business get online.', affiliatePrice: CREATOR_CODE_PRICE,
  referralCode: 'AFFSAMPLE', balance: 2500, totalEarnings: 5000, totalWithdrawn: 1000,
};

export const samplePortal: AffiliatePortal = {
  month: { start: Date.UTC(2026, 8, 30, 16), end: Date.UTC(2026, 9, 31, 16), label: 'October 2026' },
  income: { directThisMonth: 2500, teamThisMonth: 250, totalThisMonth: 2750 },
  summary: { balance: 2500, totalEarned: 5000, totalWithdrawn: 1000, pendingCommission: 2000, inFlight: 500 },
  earnings: [], withdrawals: [],
  referrals: [{ _id: 'sample-referral' as Id<'referrals'>, referredName: 'Alex Reyes', status: 'pending', bonusAmount: 0, createdAt: sampleTime }],
  referralStats: { total: 1, pending: 1, qualified: 0, paid: 0, totalEarned: 0 },
  recruits: [{ _id: 'sample-team-agent' as Id<'creators'>, referredName: 'Bea Reyes', photo: null,
    createdAt: Date.UTC(2026, 9, 22), endsAt: Date.UTC(2027, 9, 22), earning: true,
    totalEarned: 250, creditedTotalEarned: 250, monthEarned: 250, monthsLeft: 12 }],
  recruitStats: { total: 1, earning: 1, totalEarned: 250 },
};

export const sampleSales: AffiliateSale[] = [
  { _id: 'sample-sale-paid' as Id<'submissions'>, businessName: 'Sample barbershop', price: 3999, commission: 2000, status: 'paid', createdAt: sampleTime },
  { _id: 'sample-sale-pending' as Id<'submissions'>, businessName: 'Sample tailor shop', price: 3999, commission: 2000, status: 'pending_payment', createdAt: sampleTime - 86400000 },
];
