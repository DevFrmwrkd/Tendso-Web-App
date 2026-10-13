import { clientEmailsFor, type SubmissionDoc } from '@/app/admin/submissions/[id]/_components/review';

describe('admin giveaway email list', () => {
    const row = { status: 'submitted', giveawayApplication: true } as SubmissionDoc;
    it('offers receipt and rejection previews with actual delivery timestamps', () => {
        const emails = clientEmailsFor({ ...row, status: 'rejected', intakeReceivedEmailSentAt: 1000, giveawayRejectedEmailSentAt: 2000 });
        expect(emails.map((email) => email.type)).toEqual(['giveaway_received', 'giveaway_rejected']);
        expect(emails.map((email) => email.sentAt)).toEqual([1000, 2000]);
        expect(emails.every((email) => email.sendEndpoint === undefined)).toBe(true);
    });
    it('lists the OTR approval email only once its delivery is recorded', () => {
        expect(clientEmailsFor({ ...row, status: 'approved' }).map((email) => email.type)).toEqual(['giveaway_received']);
        const emails = clientEmailsFor({ ...row, status: 'approved', intakeReceivedEmailSentAt: 1000, giveawayApprovedEmailSentAt: 3000 });
        expect(emails.map((email) => email.type)).toEqual(['giveaway_received', 'giveaway_approved']);
        expect(emails.map((email) => email.sentAt)).toEqual([1000, 3000]);
        expect(emails.every((email) => email.sendEndpoint === undefined)).toBe(true);
        const rejected = clientEmailsFor({ ...row, status: 'rejected', giveawayApprovedEmailSentAt: 3000 });
        expect(rejected.map((email) => email.type)).toEqual(['giveaway_received', 'giveaway_rejected']);
    });
    it('shows the free live notice for a given site without payment email actions', () => {
        const emails = clientEmailsFor({ ...row, status: 'paid', pricingMode: 'comped' });
        expect(emails.map((email) => email.type)).toEqual(['giveaway_received', 'promo_free']);
        expect(emails.some((email) => email.type === 'approval' || email.type === 'payment_confirmation')).toBe(false);
    });
    it('preserves ordinary paid email actions', () => {
        const emails = clientEmailsFor({ ...row, status: 'paid', giveawayApplication: false });
        expect(emails.map((email) => email.type)).toEqual(['approval', 'payment_confirmation', 'completed_website']);
        expect(emails.every((email) => email.sendEndpoint)).toBe(true);
    });
});
