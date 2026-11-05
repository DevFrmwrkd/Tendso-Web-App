import { ownerPhaseStatus, ownerSiteAction, ownerSiteStatus, type OwnerSite } from '@/app/my-business/_components/ownerSite';

const site = (fields: Partial<OwnerSite> = {}): OwnerSite => ({
    submissionId: 'site-1' as OwnerSite['submissionId'], businessName: 'Test business', businessType: 'Other',
    contentSource: 'owner_app', publishPolicy: 'pay_then_publish', status: 'website_generated', phase: 'ready_to_check',
    publishedUrl: null, total: 4999, amountPaid: 0, balanceDue: 4999, paidInFull: false, openChangeRequests: 0, createdAt: 1,
    ...fields,
});

describe('canonical owner website labels', () => {
    it('distinguishes preview approval from payment despite the same raw generated status', () => {
        const ready = site();
        const approved = site({ phase: 'awaiting_payment' });
        expect(ownerPhaseStatus(ready)).toEqual({ tone: 'attn', word: 'Check preview' });
        expect(ownerSiteAction(ready)).toBe('Check preview');
        expect(ownerPhaseStatus(approved)).toEqual({ tone: 'attn', word: 'Payment due' });
        expect(ownerSiteAction(approved)).toBe('View payment');
    });

    it('uses the canonical rebuilding or change-request phase instead of an old generated URL', () => {
        const oldUrl = 'https://old.sites.tendso.com';
        expect(ownerPhaseStatus(site({ phase: 'building', publishedUrl: oldUrl })).word).toBe('Building');
        expect(ownerSiteAction(site({ phase: 'building', publishedUrl: oldUrl }))).toBe('View progress');
        expect(ownerPhaseStatus(site({ phase: 'changes_requested', publishedUrl: oldUrl, openChangeRequests: 1 })).word).toBe('Updating site');
        expect(ownerSiteAction(site({ phase: 'changes_requested', publishedUrl: oldUrl }))).toBe('View request');
    });

    it('calls out the remaining balance after a deposit without calling the whole order paid', () => {
        const deposit = site({ phase: 'awaiting_payment', status: 'deposit_paid', amountPaid: 500, balanceDue: 4499 });
        expect(ownerPhaseStatus(deposit)).toEqual({ tone: 'attn', word: 'Balance due' });
        expect(ownerSiteAction(deposit)).toBe('Pay balance');
        const legacyLive = { ...deposit, phase: 'live' as const, publishPolicy: 'publish_first' as const, publishedUrl: 'https://shop.sites.tendso.com' };
        expect(ownerPhaseStatus(legacyLive)).toEqual({ tone: 'done', word: 'Live' });
        expect(ownerSiteAction(legacyLive)).toBe('Pay balance');
    });

    it('does not equate a raw completed status, publishing or a free grant with money received', () => {
        expect(ownerPhaseStatus(site({ status: 'completed', phase: 'publishing', paidInFull: true, balanceDue: 0 })).word).toBe('Publishing');
        const free = site({ status: 'completed', phase: 'live', paidInFull: true, amountPaid: 0, balanceDue: 0, publishedUrl: 'https://free.sites.tendso.com' });
        expect(ownerPhaseStatus(free).word).toBe('Live');
        expect(ownerSiteAction(free)).toBe('Open website');
    });

    it.each([null, 'javascript:alert(1)', 'https://user:password@example.test', 'not a URL'])('does not promise to open a website without a usable active address (%s)', publishedUrl => {
        expect(ownerSiteAction(site({ phase: 'live', paidInFull: true, balanceDue: 0, publishedUrl }))).toBe('View business');
    });

    it.each(['offline', 'rejected', 'in_review', 'draft'] as const)('does not infer public access from a retained URL for %s', phase => {
        expect(ownerSiteAction(site({ phase, publishedUrl: 'https://old.sites.tendso.com' }))).not.toBe('Open website');
    });

    it('keeps legacy raw-status mapping compatible while canonical statuses avoid it', () => {
        expect(ownerSiteStatus('pending_payment')).toEqual({ tone: 'attn', word: 'Payment due' });
        expect(ownerSiteStatus('completed')).toEqual({ tone: 'done', word: 'Paid' });
        expect(ownerPhaseStatus(site({ status: 'completed', phase: 'building' })).word).toBe('Building');
    });
});
