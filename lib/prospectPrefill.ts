/**
 * Helpers for prefilling the interview flow from a scraped Outscraper prospect.
 *
 * Plain TS with no Convex imports so both the client form and (if ever needed)
 * server code can use it. See app/submit/info/page.tsx, which reads the
 * ?prospectLeadId=&businessName=&phone=&address=&city=&category= params that
 * app/leads/[leadId]/page.tsx and app/leads/page.tsx build.
 */

/**
 * The canonical business-type list. The step-1 <select> only accepts these
 * exact literals, so anything mapped in must land on one of them.
 */
export const BUSINESS_TYPES = [
    "Barber/Salon",
    "Auto Shop",
    "Spa/Massage",
    "Restaurant",
    "Clinic",
    "Law Office",
    "Craft/Producer",
    "Other",
] as const;

/** First match wins, so put the more specific patterns first. */
const CATEGORY_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
    [/law|attorney|legal|notar/, "Law Office"],
    [/barber|salon|hair|nail|beauty/, "Barber/Salon"],
    [/spa|massage|wellness/, "Spa/Massage"],
    [/restaurant|cafe|coffee|food|bakery|eatery|carinderia/, "Restaurant"],
    [/clinic|dental|dentist|medical|doctor|veterinar|pharmac/, "Clinic"],
    [/auto|car repair|tire|vulcaniz|mechanic|motor/, "Auto Shop"],
    [/craft|artisan|furniture|weav|pottery|producer/, "Craft/Producer"],
];

/**
 * Map Outscraper's free-text category ("Personal injury attorney") onto one of
 * BUSINESS_TYPES.
 *
 * Returns "" — not "Other" — when nothing matches. An unmatched category is a
 * guess, and "Other" is a confidently wrong answer that quietly poisons
 * categorisation; "" leaves the field on its placeholder and the existing
 * `required` attribute makes the creator pick. One tap, no bad data.
 */
export function mapCategoryToBusinessType(category?: string | null): string {
    if (!category) return "";
    const c = category.toLowerCase();
    for (const [pattern, type] of CATEGORY_PATTERNS) {
        if (pattern.test(c)) return type;
    }
    return "";
}

/**
 * Normalise a scraped phone to the 10 local digits the step-1 input expects.
 *
 * That input renders a static "+63" chip beside it, strips non-digits, and caps
 * at 10 — so pasting "+63 917 123 4567" raw yields "6391712345", a silently
 * wrong number. Drop the country code (or the trunk "0") and keep the last 10.
 */
export function toLocalPhDigits(raw?: string | null): string {
    if (!raw) return "";
    let digits = raw.replace(/\D/g, "");
    if (digits.startsWith("63")) digits = digits.slice(2);
    else if (digits.startsWith("0")) digits = digits.slice(1);
    return digits.length >= 10 ? digits.slice(-10) : "";
}

/**
 * Convex ids are 32-char base32. A Google place_id ("ChIJ…") or a hand-edited
 * string is not, and would blow up the v.id('leads') validator server-side —
 * crashing step 1 instead of degrading. Shape-check before sending.
 * Mirrors looksLikeConvexId in app/leads/[leadId]/page.tsx.
 */
export function looksLikeConvexId(s: string | null | undefined): boolean {
    return !!s && /^[0-9a-z]{20,40}$/.test(s);
}
