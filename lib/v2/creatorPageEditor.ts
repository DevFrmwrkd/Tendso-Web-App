import type { Doc } from '@/convex/_generated/dataModel';
import { AFFILIATE_SOCIAL_PLATFORMS, affiliatePhotoError, getAffiliateSocialLinks, type AffiliateSocialLinks } from '@/lib/affiliates';
import { WEBSITE_PRICE, clampSellPrice } from '@/lib/pricing';
import type { CreatorCard } from './creatorTypes';

type PageDraft = { photo: string; displayName: string; message: string; socialLinks: AffiliateSocialLinks };

/** Clearing a previously empty optional input restores the clean draft, without hiding invalid edits. */
export function creatorPageDraftsEqual(left: PageDraft, right: PageDraft): boolean {
    return left.photo === right.photo && left.displayName === right.displayName && left.message === right.message
        && AFFILIATE_SOCIAL_PLATFORMS.every(platform => (left.socialLinks[platform] ?? '') === (right.socialLinks[platform] ?? ''));
}

/** Match the public creator-card contract using only editable public fields and the saved code. */
export function createCreatorPageCard(account: Doc<'creators'>, draft: PageDraft, value: number): CreatorCard {
    const price = clampSellPrice(value);
    const saving = Math.max(0, WEBSITE_PRICE - price);
    const message = draft.message.trim();
    const socialLinks = getAffiliateSocialLinks(draft.socialLinks);
    const photo = draft.photo.trim();
    return {
        handle: account.affiliateHandle ?? '',
        name: draft.displayName.trim()
            || [account.firstName, account.lastName].filter(Boolean).join(' ').trim()
            || (account.affiliateHandle ? `@${account.affiliateHandle}` : 'Tendso creator'),
        photo: photo && !affiliatePhotoError(photo) ? photo : null,
        code: account.referralCode ?? null,
        listPrice: WEBSITE_PRICE,
        price,
        saving,
        percentOff: saving > 0 ? Math.round((saving / WEBSITE_PRICE) * 100) : 0,
        ...(message ? { message } : {}),
        ...(Object.keys(socialLinks).length ? { socialLinks } : {}),
    };
}
