import { describe as suite, expect, it, vi } from 'vitest';
vi.mock('@/components/r1', async () => ({
    ...await vi.importActual<typeof import('../../components/r1/money')>('@/components/r1/money'),
    ...await vi.importActual<typeof import('../../components/r1/statusWords')>('@/components/r1/statusWords'),
}));
import { describe as describeEvent, type AuditLog } from '../../app/admin/audit/_components/model';

const event = (metadata: Record<string, unknown>) => describeEvent({
    _id: 'audit-1', _creationTime: 1, timestamp: 1, adminId: 'system:auto-payment',
    action: 'payment_unmatched', targetType: 'payment', targetId: 'wise-transfer-1', metadata,
} as AuditLog, () => null);

suite('Wise team-verification audit presentation', () => {
    it('labels a single amount suggestion as verification and links only to the possible submission', () => {
        const view = event({ amount: 4999, currency: 'PHP', senderName: 'Sam', requiresReview: true,
            reason: 'No matching reference.', candidateSubmissionIds: ['submission-1'] });
        expect(view.label).toBe('Payment verification');
        expect(view.target).toBe('a ₱4,999 payment');
        expect(view.tail).toBe(' from Sam for team verification');
        expect(view.note).toContain('No order was marked paid automatically.');
        expect(view.note).toContain('hints only');
        expect(view.link).toEqual({ href: '/admin/submissions/submission-1', label: 'Open submission' });
        expect(view.chip).toBe('payments');
    });

    it.each([[], ['submission-1', 'submission-2'], ['../unsafe']].map(ids => [ids]))('offers no presumed-order link for candidate set %j', ids => {
        expect(event({ amount: 4999, requiresReview: true, candidateSubmissionIds: ids }).link).toBeNull();
    });

    it('shows foreign receipts in their actual currency instead of as pesos', () => {
        const view = event({ amount: 4999, currency: 'USD', requiresReview: true, reason: 'Check the currency.' });
        expect(view.target).toBe('a USD 4,999 payment');
        expect(view.note).toContain('Check the currency.');
    });

    it('keeps existing unmatched/duplicate events unchanged when they are not a verification queue item', () => {
        const view = event({ amount: 4999, reason: 'Duplicate — already paid' });
        expect(view.label).toBe('Payment not matched');
        expect(view.note).toBe('Duplicate — already paid');
        expect(view.link).toBeNull();
    });
});
