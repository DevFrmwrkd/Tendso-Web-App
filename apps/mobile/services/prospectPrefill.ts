/**
 * Prefill helpers for interviewing a business found through Discover.
 *
 * Port of the web app's `lib/prospectPrefill.ts` (commit b7eb98e). Keep the two
 * mappers in step with that file — they encode the same two mismatches between
 * scraped Outscraper data and what the step-1 form will accept, and mobile's
 * inputs happen to have the identical constraints (same 8 business types, same
 * static "+63" chip).
 *
 * The web repo owns the Convex side of this feature: `submissions.create` and
 * `submissions.update` accept `prospectLeadId`, and `submissions.submit`
 * consumes it to patch the scraped lead instead of inserting a duplicate.
 */

/**
 * The canonical business-type list, mirroring BUSINESS_TYPES in
 * app/(app)/submit/info.tsx. Anything mapped in must land on one of these.
 */
export const BUSINESS_TYPES = [
  'Barber/Salon',
  'Auto Shop',
  'Spa/Massage',
  'Restaurant',
  'Clinic',
  'Law Office',
  'Craft/Producer',
  'Other',
] as const;

/** First match wins, so the more specific patterns come first. */
const CATEGORY_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/law|attorney|legal|notar/, 'Law Office'],
  [/barber|salon|hair|nail|beauty/, 'Barber/Salon'],
  [/spa|massage|wellness/, 'Spa/Massage'],
  [/restaurant|cafe|coffee|food|bakery|eatery|carinderia/, 'Restaurant'],
  [/clinic|dental|dentist|medical|doctor|veterinar|pharmac/, 'Clinic'],
  [/auto|car repair|tire|vulcaniz|mechanic|motor/, 'Auto Shop'],
  [/craft|artisan|furniture|weav|pottery|producer/, 'Craft/Producer'],
];

/**
 * Map Outscraper's free-text category ("Personal injury attorney") onto one of
 * BUSINESS_TYPES.
 *
 * Returns '' — deliberately NOT 'Other' — when nothing matches. An unmatched
 * category is a guess, and 'Other' is a confidently wrong answer that quietly
 * poisons categorisation. '' leaves the field on its placeholder so the
 * existing required-field check makes the creator pick. One tap, no bad data.
 */
export function mapCategoryToBusinessType(category?: string | null): string {
  if (!category) return '';
  const c = category.toLowerCase();
  for (const [pattern, type] of CATEGORY_PATTERNS) {
    if (pattern.test(c)) return type;
  }
  return '';
}

/**
 * Normalise a scraped phone to the 10 local digits the step-1 input expects.
 *
 * That input renders a static "+63" chip beside it, so pasting
 * "+63 917 123 4567" raw would yield "639171234567" — displayed as
 * "+63 639171234567", a silently wrong number. Drop the country code (or the
 * trunk "0") and keep the last 10 digits.
 *
 * Returns '' rather than a partial number when there aren't 10 digits: a
 * half-entered phone is worse than an empty required field, because the phone
 * is what links this interview back to the scraped lead.
 */
export function toLocalPhDigits(raw?: string | null): string {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('63')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.length >= 10 ? digits.slice(-10) : '';
}

/**
 * Convex ids are lowercase base32. A Google place_id ("ChIJ…") or a synthetic
 * "direct-3" id is not, and would fail the v.id('leads') validator server-side
 * — crashing step 1 rather than degrading to an unlinked submission.
 *
 * NOTE: this is a shape check only. It CANNOT tell a `leads` id from a
 * `prospects` id — both are the same shape. Discover therefore tracks which
 * table a row came from explicitly (PinnedBiz.source) rather than sniffing the
 * id, because sending a prospects id where v.id('leads') is expected is a
 * server-side error.
 */
export function looksLikeConvexId(s: string | null | undefined): boolean {
  return !!s && /^[0-9a-z]{20,40}$/.test(s);
}
