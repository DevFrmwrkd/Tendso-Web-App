import { REMINDER_GAP_MS, REMINDER_LIMIT, reminderState } from '@/lib/creatorReminders';
import { getPaymentFollowUpEmailHtml } from '@/lib/email/templates';

/**
 * A creator's payment reminders to an owner: one a day, three in all, and the
 * email that goes out in their name.
 */

const NOW = Date.UTC(2026, 9, 7, 4, 0);
const HOUR = 60 * 60 * 1000;

describe('reminderState', () => {
    it('allows the first reminder', () => {
        expect(reminderState(undefined, NOW)).toEqual({ canSend: true, left: 3 });
        expect(reminderState([], NOW)).toEqual({ canSend: true, left: 3 });
    });

    it('waits a day after the last one', () => {
        const last = NOW - 5 * HOUR;
        expect(reminderState([last], NOW)).toEqual({ canSend: false, left: 2, reason: 'too-soon', nextAt: last + REMINDER_GAP_MS });
        expect(reminderState([last], last + REMINDER_GAP_MS)).toEqual({ canSend: true, left: 2 });
    });

    it('counts from the latest, whatever the order', () => {
        const state = reminderState([NOW - 30 * HOUR, NOW - 2 * HOUR], NOW);
        expect(state).toMatchObject({ canSend: false, reason: 'too-soon', nextAt: NOW - 2 * HOUR + REMINDER_GAP_MS });
    });

    it('stops at three', () => {
        const three = [NOW - 72 * HOUR, NOW - 48 * HOUR, NOW - 24 * HOUR];
        expect(three).toHaveLength(REMINDER_LIMIT);
        expect(reminderState(three, NOW)).toEqual({ canSend: false, left: 0, reason: 'used-up' });
    });
});

describe('the reminder email in the creator’s name', () => {
    const base = { businessName: 'Aling Nena Store', businessOwnerName: 'Nena', amount: 3999, referenceCode: 'ND-ABCD-EFGH' };

    it('says who asked for it, and drops the final-day deadline', () => {
        const html = getPaymentFollowUpEmailHtml({ ...base, fromCreator: 'Ana' });
        expect(html).toContain('A reminder from Ana');
        expect(html).toContain('Ana, who made <strong style="color:#C89548;">Aling Nena Store</strong>');
        expect(html).not.toContain('Final reminder');
        expect(html).not.toContain('taken offline in about');
    });

    it('treats the creator’s name as text, not markup', () => {
        const html = getPaymentFollowUpEmailHtml({ ...base, fromCreator: '<a href="x">Ana</a>' });
        expect(html).not.toContain('<a href="x">');
        expect(html).toContain('&lt;a href=&quot;x&quot;&gt;Ana&lt;/a&gt;');
    });

    it('leaves the automatic final-day reminder as it was', () => {
        const html = getPaymentFollowUpEmailHtml({ ...base, hoursLeft: 20 });
        expect(html).toContain('Final reminder');
        expect(html).not.toContain('A reminder from');
    });
});
