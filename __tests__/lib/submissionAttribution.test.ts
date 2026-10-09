jest.mock('@/convex/_generated/api', () => ({ api: {} }));

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { affiliateAttribution } from '@/lib/submissionAttribution';
import { matchesSearch, type QueueRow } from '@/app/admin/submissions/_queue/model';
import { QueueRowButton } from '@/app/admin/submissions/_queue/Rows';
import { creatorFact, cameFrom } from '@/app/admin/submissions/[id]/_components/DetailsPanel';

const row: QueueRow = {
    _id: 'order' as QueueRow['_id'], _creationTime: 1, creatorId: 'affiliate' as QueueRow['creatorId'],
    businessName: 'Corner Shop', businessType: 'Salon', ownerName: 'Owner', ownerPhone: '09171234567',
    address: 'Main Street', city: 'Manila', status: 'submitted', contentSource: 'owner_intake',
    creatorPayout: 1000, affiliateHandle: 'alex-shops', reviewedByName: null,
    creator: { firstName: 'Alex', lastName: 'Santos', email: 'alex@example.com', phone: undefined,
        role: 'affiliate', affiliateHandle: 'alex-shops', affiliateDisplayName: 'Alex Websites' },
};

describe('affiliate order labels', () => {
    it('shows the affiliate name, role and handle on phone and desktop submission rows', () => {
        const html = renderToStaticMarkup(createElement(QueueRowButton, { row, now: 1, selected: false, onOpen: () => {} }));
        expect(html).toContain('Alex Websites');
        expect(html).toContain('Affiliate');
        expect(html).toContain('@alex-shops');
        expect(html).not.toContain('Tendso self-serve');
        expect(creatorFact(row, true)).toEqual({ text: 'Alex Websites', meta: 'Affiliate · @alex-shops · Owner-submitted via /start · payout ₱1,000' });
        expect(cameFrom(row)).toContain('Affiliate · @alex-shops');
    });

    it('makes the affiliate name and handle searchable', () => {
        expect(matchesSearch(row, 'alex websites')).toBe(true);
        expect(matchesSearch(row, 'alex-shops')).toBe(true);
        expect(matchesSearch(row, 'unrelated')).toBe(false);
    });

    it('labels existing affiliate orders without a snapshot using their attributed account', () => {
        expect(affiliateAttribution({ ...row, affiliateHandle: undefined })).toEqual({ name: 'Alex Websites', handle: 'alex-shops', label: 'Affiliate · @alex-shops' });
    });

    it('keeps the saved handle when the account changes, including a missing account', () => {
        expect(affiliateAttribution({ ...row, creator: { ...row.creator!, affiliateHandle: 'changed-handle' } })?.handle).toBe('alex-shops');
        expect(affiliateAttribution({ affiliateHandle: 'alex-shops', creator: null })).toEqual({ name: '@alex-shops', handle: 'alex-shops', label: 'Affiliate · @alex-shops' });
    });

    it('keeps genuine self-serve and ordinary creator orders distinct from affiliate sales', () => {
        const house = { ...row, affiliateHandle: undefined, creator: { firstName: 'Tendso', lastName: 'Self-Serve', email: 'self-serve@tendso.com', phone: undefined } };
        expect(affiliateAttribution(house)).toBeNull();
        expect(creatorFact(house, true).text).toBe('Tendso self-serve');
        expect(affiliateAttribution({ creator: { role: 'creator', firstName: 'Creator' } })).toBeNull();
    });
});
