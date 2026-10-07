/**
 * How often a creator may have Tendso email a business owner a payment
 * reminder for one site: once a day, three times in all (decided 2026-10-07).
 * Three days is how long an unpaid site stays live, so a creator can remind
 * once on each of them.
 *
 * Pure, so the Convex mutation that enforces the limit
 * (convex/creatorReminders.ts) and the drawer that explains it count the same
 * way. Sharing the pay link from the creator's own phone has no limit: that
 * message is theirs, not Tendso's.
 */

export const REMINDER_LIMIT = 3;
export const REMINDER_GAP_MS = 24 * 60 * 60 * 1000;

export type ReminderState =
    | { canSend: true; left: number }
    | { canSend: false; left: 0; reason: 'used-up' }
    | { canSend: false; left: number; reason: 'too-soon'; nextAt: number };

/** Whether another reminder may go now, given when the earlier ones went. */
export function reminderState(sentAt: readonly number[] | null | undefined, now: number): ReminderState {
    const sent = sentAt ?? [];
    const left = Math.max(0, REMINDER_LIMIT - sent.length);
    if (left === 0) return { canSend: false, left: 0, reason: 'used-up' };
    if (sent.length > 0) {
        const nextAt = Math.max(...sent) + REMINDER_GAP_MS;
        if (now < nextAt) return { canSend: false, left, reason: 'too-soon', nextAt };
    }
    return { canSend: true, left };
}
