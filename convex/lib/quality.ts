/**
 * Quality scoring for prospects — a 0–100 number sorted desc in
 * searchNearby. Inputs are the basic Outscraper signals (has website,
 * has phone, review count, rating); weights are configurable per
 * country+category via `category_locales.scoringWeights`.
 *
 * Used by:
 *   - ingest path (P1+) — stamped on every new prospect insert
 *   - searchNearby (P1) — implicit via .sort() on results
 *
 * The default weights below give a 50/50 split between "is this a real
 * business with contact channels" (website + phone) and "is it loved by
 * its customers" (rating + reviews), capped to avoid one signal
 * dominating. Tune per locale based on real-world hit rates after P4.
 */
import { Doc } from '../_generated/dataModel';

type ScoringWeights = Doc<'category_locales'>['scoringWeights'];

export const DEFAULT_WEIGHTS: ScoringWeights = {
    hasWebsite: 25,             // +25 if Outscraper found a website
    hasPhone: 25,               // +25 if there's a callable number
    reviewCountMultiplier: 0.2, // (reviewCount × 0.2), capped at 30
    minRating: 3.0,             // Rating below this contributes 0 to the score
};

export function computeQualityScore(
    input: {
        hasWebsite: boolean;
        hasPhone: boolean;
        rating: number | null;
        reviewCount: number | null;
    },
    weights: ScoringWeights = DEFAULT_WEIGHTS,
): number {
    let score = 0;
    if (input.hasWebsite) score += weights.hasWebsite;
    if (input.hasPhone) score += weights.hasPhone;
    if (input.reviewCount != null) {
        score += Math.min(input.reviewCount * weights.reviewCountMultiplier, 30);
    }
    if (input.rating != null && input.rating > weights.minRating) {
        // Up to +20 from rating, scaling linearly above the floor
        score += Math.min((input.rating - weights.minRating) * 10, 20);
    }
    return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Lowercase + strip non-alphanumeric for dedupe layer 4. Catches
 * "Joey's Barbershop" vs "joeys barbershop" vs "JOEY'S BARBERSHOP".
 */
export function normalizeBusinessName(raw: string | null | undefined): string {
    if (!raw) return '';
    return raw.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Map Outscraper's raw `category` string to one of our normalized
 * buckets. The bucket is what `category_locales.categoryBucket` keys on,
 * and what `prospects.categoryBucket` stores. New buckets land here as
 * we expand the seeded categories — keep the list deliberately tight
 * so the inventory grid stays manageable.
 *
 * Returns `'other'` for anything unknown — the replenishment cron will
 * skip these (no category_locales row → no scrape queries).
 */
export function bucketCategory(rawCategory: string | null | undefined): string {
    if (!rawCategory) return 'other';
    const k = rawCategory.toLowerCase();

    if (k.includes('barber')) return 'barbershop';
    if (k.includes('hair') || k.includes('salon')) return 'hair_salon';
    if (k.includes('nail') || k.includes('manicure')) return 'nail_salon';
    if (k.includes('spa') || k.includes('massage')) return 'spa';
    if (k.includes('repair') || k.includes('mechanic') || k.includes('vulcanizing')) return 'auto_repair';
    if (k.includes('dental') || k.includes('dentist')) return 'dental';
    if (k.includes('restaurant') || k.includes('carinderia') || k.includes('fastfood') || k.includes('eatery')) return 'restaurant';
    if (k.includes('cafe') || k.includes('coffee')) return 'cafe';
    if (k.includes('sari') || k.includes('convenience')) return 'sari_sari';
    if (k.includes('pharmacy') || k.includes('drugstore')) return 'pharmacy';

    return 'other';
}
