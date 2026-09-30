/**
 * The house creator: the seeded creators row every self-serve (/start)
 * submission is attributed to. convex/seed/houseCreator.ts seeds it with
 * exactly this email, as "Tendso Self-Serve".
 *
 * It is an attribution row, not a person. The "Give free" gift notice names the
 * creator who chose the business ("<name> chose <business> for a free
 * website…"), and for a self-serve site that read "Tendso Self-Serve chose
 * Liwayway Flowers…" — a stranger's-looking name nobody picked. So on a
 * self-serve site the admin types the name the owner should see instead
 * (a show, a sponsor, a person), and it is required there.
 */
export const HOUSE_CREATOR_EMAIL = 'self-serve@tendso.com';

export function isHouseCreator(creator: { email?: string | null } | null | undefined): boolean {
    return (creator?.email ?? '').trim().toLowerCase() === HOUSE_CREATOR_EMAIL;
}

/** Longest giver name accepted: it sits inside one sentence of the email. */
export const GIFTED_BY_MAX = 60;

/**
 * The typed giver name as one short line of plain text. The email template
 * escapes it again before it reaches any markup; this only normalises.
 */
export function cleanGiftedBy(value: unknown): string {
    if (typeof value !== 'string') return '';
    return value.replace(/\s+/g, ' ').trim().slice(0, GIFTED_BY_MAX).trim();
}
