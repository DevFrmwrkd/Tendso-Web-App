/**
 * Normalize a phone number into a canonical digit-string used for lead-business identity matching.
 *
 * Philippine number formats handled:
 * - "0917 234 1234"   → "639172341234"
 * - "+63 917 234 1234"→ "639172341234"
 * - "+639172341234"   → "639172341234"
 * - "9172341234"      → "639172341234"
 *
 * Anything else: returns the digits-only fallback. `null` only if input is empty/undefined.
 */
export function normalizePhone(raw: string | undefined | null): string | null {
    if (!raw) return null;
    const digits = raw.replace(/\D/g, '');
    if (!digits) return null;

    if (digits.startsWith('0') && digits.length === 11) return '63' + digits.slice(1);
    if (digits.startsWith('63') && digits.length === 12) return digits;
    if (digits.startsWith('9') && digits.length === 10) return '63' + digits;

    return digits;
}
