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

/**
 * Normalize a phone number into E.164 format ("+63XXXXXXXXXX") used by
 * the Prospect Pool's dedupe layer 3 (`prospects.normalizedPhone`).
 *
 * Unlike `normalizePhone` above (which returns digits-only "63XXX..." for
 * the existing leads matching), this returns a leading-`+` form for
 * cross-platform compatibility with telephony tools and pretty-display.
 *
 * Returns null when input is empty OR cannot be normalized to E.164 for
 * the given country. Don't silently mangle international numbers we don't
 * know how to format yet — the prospect just gets `normalizedPhone: null`
 * and falls back to the place-id dedupe layer.
 *
 * Country handlers:
 *   PH (default) — `09XX…` and `9XX…` → `+63…`; `+63…` passes through
 *   ID, VN — TODO when we expand into those markets
 */
export function normalizePhoneE164(
    raw: string | null | undefined,
    defaultCountry: 'PH' | 'ID' | 'VN' = 'PH',
): string | null {
    if (!raw) return null;
    const stripped = raw.replace(/[^\d+]/g, '');
    if (!stripped) return null;
    if (stripped.startsWith('+')) return stripped;

    if (defaultCountry === 'PH') {
        if (stripped.startsWith('09') && stripped.length === 11) return '+63' + stripped.slice(1);
        if (stripped.startsWith('9') && stripped.length === 10) return '+63' + stripped;
        if (stripped.startsWith('63') && stripped.length === 12) return '+' + stripped;
    }
    // TODO: ID (+62), VN (+84) when we expand
    return null;
}
