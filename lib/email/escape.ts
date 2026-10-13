/**
 * Entity-encode a value before it is interpolated into email markup.
 *
 * WHY: since /start exists, `businessName` / `businessOwnerName` / the owner's
 * email reach the templates from `submitOwnerIntake` — a PUBLIC, unauthenticated
 * Convex mutation — and the intake-received email is scheduled to a caller-supplied
 * address with no admin in the loop. Raw interpolation would let anyone put their
 * own HTML (a phishing link, say) inside a DKIM-signed email from our verified
 * from-address. Every runtime string is therefore treated as untrusted text,
 * never as markup. Covers both text nodes and quoted attribute values (href, title).
 */
export function escapeHtml(value: string | undefined | null): string {
    if (!value) return ''
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}
