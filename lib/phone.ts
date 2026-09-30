/**
 * Phone formatting for Philippine numbers.
 *
 * EXTRACTED so there is exactly one definition. `formatPhoneDisplay` lived
 * inside lib/astro-builder.ts, which runs the astro build and therefore imports
 * `fs`, `path` and `child_process` — so the only way for anything else to use it
 * was to copy it, and a copy of a formatter is a copy that drifts.
 *
 * That mattered as soon as the hosted route started publishing the phone as
 * structured data: the builder formats it for the page at BUILD time and does
 * not write the formatted value back, so the stored draft keeps whatever the
 * owner typed. Reading the raw draft gave `9622858067` in the JSON-LD of a page
 * that visibly prints `+63 962 285 8067` — the same business stating two
 * different numbers, one of them not resolvable to a country.
 *
 * No imports here, on purpose: this module is used from the astro builder, from
 * lib/site-seo.ts, and is safe to reach from anywhere else.
 */

/**
 * Format a phone for display: forces a `+63` PH country prefix when the input
 * is a local PH mobile number (10 digits starting `9`, or 11 digits starting
 * `09`). Numbers already in international form are left alone. Empty input
 * returns empty string so callers can fall through.
 */
export function formatPhoneDisplay(phone: string | undefined | null): string {
    if (!phone) return ''
    const trimmed = String(phone).trim()
    if (!trimmed) return ''
    // Already international (+countrycode) — return as-is.
    if (trimmed.startsWith('+')) return trimmed
    const digits = trimmed.replace(/[^0-9]/g, '')
    if (!digits) return trimmed
    // PH local mobile patterns.
    if (digits.startsWith('09') && digits.length === 11) return '+63' + digits.slice(1)
    if (digits.startsWith('9') && digits.length === 10)  return '+63' + digits
    if (digits.startsWith('63') && digits.length >= 12)  return '+' + digits
    // Fallback — leave whatever the admin typed.
    return trimmed
}
