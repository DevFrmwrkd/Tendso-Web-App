/**
 * ════════════════════════════════════════════════════════════════════════════
 *  NOTIFICATION PREVIEW — what fits on a phone
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `notifications.body` is a short list-row preview. Mobile notification details
 * resolve a recipient's announcementId to the original announcement body, while
 * email remains available for older clients and offline readers.
 *
 * Kept deliberately short. The announcement title already says what the message
 * is about, so the snippet is secondary — what matters is that the pointer to
 * the email survives the clamp rather than being cut off with everything else.
 *
 * Keep previews compact; the full announcement is stored separately.
 */

export const NOTIFICATION_PREVIEW_LIMIT = 120;
export const FULL_MESSAGE_HINT = 'Full message sent to your email.';

/**
 * A one-line preview of a long message.
 *
 * Whitespace is flattened first: paragraph breaks mean nothing in a clipped
 * list row, and a body starting with a blank line would otherwise render as an
 * empty notification.
 *
 * A short message is returned untouched and WITHOUT the hint — telling someone
 * to check their email for text they can already read in full is noise.
 */
export function notificationPreview(body: string, limit: number = NOTIFICATION_PREVIEW_LIMIT): string {
    const flat = (body || '').replace(/\s+/g, ' ').trim();

    if (!flat) return FULL_MESSAGE_HINT;
    if (flat.length <= limit) return flat;

    const cut = flat.slice(0, limit);
    const lastSpace = cut.lastIndexOf(' ');
    // Break on a word boundary, unless that would throw away most of the
    // snippet — one very long word should still be cut rather than dropped.
    const snippet = (lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut)
        .replace(/[\s.,;:!?—–-]+$/, '');

    return `${snippet}… ${FULL_MESSAGE_HINT}`;
}
