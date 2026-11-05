import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ShopLinkContent, ShopLinkView } from '@/components/v2/creators/ShopLinkContent';
import { ShopLinkPage } from '@/components/v2/creators/ShopLinkPage';
import type { Doc } from '@/convex/_generated/dataModel';
import { creatorCard } from '@/convex/lib/creatorRecruits';
import { getAffiliateSocialLinks } from '@/lib/affiliates';
import { CREATOR_CODE_PRICE } from '@/lib/pricing';
import { createCreatorPageCard, creatorPageDraftsEqual } from '@/lib/v2/creatorPageEditor';

jest.mock('@/lib/campaign', () => ({ rememberAffiliate: jest.fn() }));
jest.mock('@/lib/v2/creatorData', () => ({
    useCreatorCard: jest.fn(),
    useRecordClick: jest.fn(),
    useStoreLinks: () => ({ appStore: 'https://apps.apple.com/app/tendso-preview', googlePlay: 'https://play.google.com/store/apps/details?id=tendso.preview' }),
}));
jest.mock('@/components/v2/creators/Photo', () => ({ Photo: () => null }));
jest.mock('@/components/v2/PhoneFrame', () => ({ PhoneFrame: () => null }));

const account: Doc<'creators'> = {
    _id: 'page-preview-affiliate' as Doc<'creators'>['_id'], _creationTime: Date.UTC(2026, 9, 1),
    firstName: 'Ana', lastName: 'Cruz', role: 'affiliate', status: 'active',
    affiliateHandle: 'ana-local', referralCode: 'LEGACY27', affiliatePrice: 3499,
    affiliatePhoto: 'https://photos.example.com/saved.jpg', affiliateDisplayName: 'Ana’s saved page',
    affiliateMessage: 'The saved introduction.', affiliateSocialLink: 'https://m.me/ana-saved',
    email: 'private-email@example.com', clerkId: 'private-clerk-id', wiseEmail: 'private-payout@example.com',
    balance: 7654321, rejectionReason: 'private-review-message',
    creatorSocials: [{ platform: 'instagram', handle: '@private-application-account' }],
};
const draft = {
    photo: ' https://photos.example.com/draft.jpg ', displayName: '  Ana’s neighbourhood offers  ',
    message: '  Let’s help your shop get online.\n<script>plain text</script>  ',
    socialLinks: {
        messenger: 'https://m.me/ana-public', instagram: 'https://www.instagram.com/ana-public',
        tiktok: 'https://www.tiktok.com/@ana-public', youtube: 'https://www.youtube.com/@ana-public',
    },
};

beforeEach(() => {
    jest.resetAllMocks();
});

describe('creator page preview public model', () => {
    it('returns to a clean draft after an optional link is entered then cleared, while invalid edits remain dirty', () => {
        const baseline = { photo: '', displayName: 'Ana', message: '', socialLinks: {} };
        expect(creatorPageDraftsEqual({ ...baseline, socialLinks: { instagram: '' } }, baseline)).toBe(true);
        expect(creatorPageDraftsEqual({ ...baseline, socialLinks: { instagram: 'http://www.instagram.com/ana' } }, baseline)).toBe(false);
        expect(creatorPageDraftsEqual({ ...baseline, message: 'A new introduction' }, baseline)).toBe(false);
    });

    it.each([undefined, 0, 999, 1999.6, 3499, 4999, 99999, NaN])('matches the fixed backend offer regardless of a legacy price %s', price => {
        const savedAccount = {
            ...account, affiliatePrice: price, affiliatePhoto: draft.photo.trim(), affiliateDisplayName: draft.displayName.trim(),
            affiliateMessage: draft.message.trim(), affiliateSocialLinks: getAffiliateSocialLinks(draft.socialLinks), affiliateSocialLink: undefined,
        };
        const card = createCreatorPageCard({ ...account, affiliatePrice: price }, draft, price);
        expect(card).toEqual(creatorCard(savedAccount, price));
        expect(card).toMatchObject({ price: CREATOR_CODE_PRICE, listPrice: 4999, saving: 1500, percentOff: 30 });
    });

    it('preserves the real referral code and clears optional draft fields without reviving saved ones', () => {
        const card = createCreatorPageCard(account, { photo: '', displayName: ' ', message: ' ', socialLinks: {} }, 4999);
        expect(card).toEqual(creatorCard({ ...account, affiliatePhoto: undefined, affiliateDisplayName: undefined,
            affiliateMessage: undefined, affiliateSocialLinks: {}, affiliateSocialLink: undefined }, 4999));
        expect(card.name).toBe('Ana Cruz');
        expect(card.code).toBe('LEGACY27');
        expect(card.photo).toBeNull();
        expect(card.message).toBeUndefined();
        expect(card.socialLinks).toBeUndefined();
        expect(card.price).toBe(CREATOR_CODE_PRICE);
        expect(card.saving).toBe(1500);
        expect(card.percentOff).toBe(30);
    });

    it('uses the public handle fallback and keeps a missing code missing', () => {
        const card = createCreatorPageCard({ ...account, firstName: '', lastName: undefined, referralCode: undefined },
            { photo: '', displayName: '', message: '', socialLinks: {} }, 3499);
        expect(card.name).toBe('@ana-local');
        expect(card.code).toBeNull();
    });

    it('exposes only explicit public fields and excludes private application and payout data', () => {
        const card = createCreatorPageCard(account, draft, 3499);
        const json = JSON.stringify(card);
        expect(Object.keys(card).sort()).toEqual(['code', 'handle', 'listPrice', 'message', 'name', 'percentOff', 'photo', 'price', 'saving', 'socialLinks']);
        for (const secret of ['private-email@example.com', 'private-clerk-id', 'private-payout@example.com',
            '7654321', 'private-review-message', '@private-application-account']) expect(json).not.toContain(secret);
        expect(card.socialLinks).not.toHaveProperty('facebook');
        expect(card.socialLinks?.messenger).toBe('https://m.me/ana-public');
    });
});

describe('creator page preview presentation', () => {
    it('renders exactly the same public page as the live wrapper for the same card', () => {
        const card = createCreatorPageCard(account, draft, 3499);
        const data = jest.requireMock('@/lib/v2/creatorData');
        data.useCreatorCard.mockReturnValue({ status: 'found', card });
        const publicPage = renderToStaticMarkup(createElement(ShopLinkPage, { handle: card.handle }));
        const preview = renderToStaticMarkup(createElement(ShopLinkView, { card }));
        expect(preview).toBe(publicPage);
        expect(preview).toContain('Your shop online.<br/>Pay once, own it.');
        expect(preview).toContain('src="https://photos.example.com/draft.jpg"');
        expect(preview).toContain('object-position:50% 24%');
        expect(preview).toContain('LEGACY27');
        expect(preview).toContain('Save ₱1,500');
        expect(preview).toContain('Enter this code before you pay to use this website price.');
        expect(preview).toContain('>Copy</button>');
        expect(preview).toContain('https://www.instagram.com/ana-public');
        expect(preview).toContain('https://www.youtube.com/@ana-public');
        expect(preview).toContain('https://apps.apple.com/app/tendso-preview');
        expect(preview).toContain('&lt;script&gt;plain text&lt;/script&gt;');
        expect(preview).not.toContain('<script>');
        expect(data.useCreatorCard).toHaveBeenCalledTimes(1);
        expect(data.useRecordClick).toHaveBeenCalledTimes(1);
    });

    it('renders preview content and chrome without resolving an account or recording attribution', () => {
        const data = jest.requireMock('@/lib/v2/creatorData');
        data.useCreatorCard.mockImplementation(() => { throw new Error('Preview tried to resolve a live public account'); });
        data.useRecordClick.mockImplementation(() => { throw new Error('Preview tried to record a public visit'); });
        const card = createCreatorPageCard(account, draft, 2200);
        for (const component of [ShopLinkContent, ShopLinkView]) {
            const html = renderToStaticMarkup(createElement(component, { card }));
            expect(html).toContain('Your shop online.');
            for (const secret of [account.email, account.clerkId, account.wiseEmail!, account.rejectionReason!]) expect(html).not.toContain(secret);
        }
        expect(data.useCreatorCard).not.toHaveBeenCalled();
        expect(data.useRecordClick).not.toHaveBeenCalled();
        expect(jest.requireMock('@/lib/campaign').rememberAffiliate).not.toHaveBeenCalled();
    });
});
