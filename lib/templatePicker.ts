/**
 * Which template a site gets when nobody picked one.
 *
 * THE BUG THIS FIXES. `defaultCustomizations.heroStyle` was the bare letter
 * `'A'`. Every wrapper in astro-site-template/src/pages/index.astro is gated on
 * a FULL code — `/^generic:([A-E])$/`, `/^florist:(BR)$/` and so on — so `'A'`
 * matched nothing, `anyLetter` stayed false, and the page fell through to the
 * "Coming soon" stub: a headline, one paragraph, and no sections at all.
 * Verified with real astro builds of the same fixture:
 *
 *     heroStyle 'A'            ->  0 sections   (stub)
 *     heroStyle 'generic:A'    -> 10 sections
 *     heroStyle 'florist:BR'   -> 12 sections
 *
 * So any site generated without an admin explicitly choosing a template came
 * out empty. Production carries rows with `heroStyle: 'A'` and rows with no
 * customizations at all, which resolve the same way.
 *
 * WHY IT ALSO VARIES. Once the default has to name a real code, picking the
 * same one every time would put every barbershop in town on an identical page —
 * the failure an owner actually notices, because they can see their competitor's
 * site. So the code is chosen from the family that suits the trade, and varied
 * WITHIN that family by a hash of the submission id: appropriate, stable, and
 * not identical to the shop next door.
 *
 * DETERMINISTIC ON PURPOSE. The same submission must resolve to the same
 * template every time, or a regenerate would silently reshuffle a site an admin
 * has already reviewed. The hash is over the submission id alone.
 *
 * THE CODES ARE NOT LISTED HERE. They come from TEMPLATE_FAMILIES in
 * components/editor/templateCatalog.ts — the same list the editor's rail reads.
 * A new template added there is pickable here with no second edit, which is the
 * whole point: one source of truth, not two that drift.
 */

import { TEMPLATE_FAMILIES } from "@/components/editor/templateCatalog";

/**
 * Trade -> family. Ordered, first match wins, so put the specific patterns
 * first ("flower" before "shop", or a florist lands in retail).
 *
 * This deliberately does NOT reuse normalizeBusinessType from
 * derive-content-defaults: that function feeds autoSchemeFor, and widening it
 * to recognise florists and hotels would quietly change the colour scheme of
 * existing sites. Matching here keeps the blast radius to template choice.
 */
const FAMILY_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
    [/florist|flower|bloom|bouquet/, "florist"],
    [/hotel|resort|villa|inn|lodge|homestay|bnb|airbnb|stay/, "hospitality"],
    // Ahead of trades (carpentry used to land there), foodcraft ("woodcraft"
    // contains "craft"), restaurant ("kitchen cabinets" contains "kitchen") and
    // retail ("furniture store" contains "store"). Deliberately no bare "wood":
    // "Hollywood Salon" and "Driftwood Cafe" are not furniture makers.
    [/wood ?work|wood ?craft|wood ?carv|furniture|joiner|cabinet|carpent/, "woodworks"],
    [/barber/, "barbershop"],
    [/salon|spa|massage|nail|hair|beauty|aesthet|lash|brow|wellness/, "salonspa"],
    [/auto|mechanic|vulcaniz|tire|garage|motor|carwash/, "autoshop"],
    [/weld|fabricat|steel|metal|electric|aircon|hvac|plumb|construct|hardware/, "trades"],
    [/cafe|coffee|roaster|tea|bakery|bake|pastry|dessert|brew/, "foodcraft"],
    [/restaurant|eatery|diner|bistro|carinderia|grill|food|kitchen|catering/, "restaurant"],
    [/shirt|apparel|clothing|boutique|thrift|ukay|garment/, "shirtstore"],
    [/clinic|dental|dentist|medical|doctor|veterinar|vet|pharmac|optical/, "medical"],
    [/gym|fitness|yoga|pilates|crossfit|martial|dojo/, "fitness"],
    [/school|tutor|academy|review|learning|training|daycare/, "education"],
    [/craft|artisan|candle|producer|handmade|weav|potter/, "foodcraft"],
    [/sari|grocery|store|retail|shop|mart|supply/, "retail"],
    [/law|attorney|legal|notar|account|consult|agency|service|repair|laundry|printing|photo/, "services"],
];

/** Where a trade we do not recognise goes. Five designs, so it still varies. */
const FALLBACK_FAMILY = "generic";

/** The codes a family offers, straight from the catalogue the editor uses. */
function codesForFamily(family: string): string[] {
    const entry = TEMPLATE_FAMILIES.find((f) => f.family === family);
    return entry ? entry.templates.map((t) => t.code) : [];
}

function matchFamily(text: string | undefined | null): string | null {
    const k = (text || "").toLowerCase();
    if (!k.trim()) return null;
    for (const [pattern, family] of FAMILY_PATTERNS) {
        if (pattern.test(k)) return family;
    }
    return null;
}

/**
 * THE NAME IS THE BETTER SIGNAL, MOST OF THE TIME.
 *
 * /start offers eight business types and one of them is "Other" — and across
 * the 30 submissions in production, 19 of them (63%) are "Other". Their names
 * are not ambiguous at all: "Jennifer & Agie's Flowershop", "Deluxia Coffee",
 * "Aurora villa", "Rowald Metal Works", "Kel's Meatshop". Choosing on the type
 * alone would send every one of those to the generic family.
 *
 * So the type is consulted first, because a type the owner actually chose is a
 * deliberate statement, and "Other" simply matches no pattern and falls
 * through. The name is the fallback, which is where most of the real signal
 * turns out to live.
 */
export function familyForBusinessType(
    businessType: string | undefined | null,
    businessName?: string | undefined | null,
): string {
    return matchFamily(businessType) ?? matchFamily(businessName) ?? FALLBACK_FAMILY;
}

/**
 * FNV-1a over the seed. Any stable hash would do; this one is short, has no
 * dependencies, and spreads short ids (Convex ids) evenly enough that two
 * neighbouring shops do not collide.
 */
function hash(seed: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
}

/**
 * The template code a submission gets when nothing was chosen for it.
 * Always a full `family:LETTER` code that index.astro can actually dispatch on.
 *
 * `seed` should be the submission id. An empty seed still returns a valid code
 * (the family's first), because returning something un-renderable is the one
 * outcome this module exists to prevent.
 */
/** Every code the catalogue knows, and every bare letter mapped to its code. */
function codeIndex(): { codes: Set<string>; byLetter: Map<string, string> } {
    const codes = new Set<string>();
    const byLetter = new Map<string, string>();
    for (const family of TEMPLATE_FAMILIES) {
        for (const t of family.templates) {
            codes.add(t.code);
            // First family wins: letters are unique across the catalogue today,
            // and if that ever stops being true the earlier family is the older
            // one, which is what a legacy bare letter meant.
            if (!byLetter.has(t.letter)) byLetter.set(t.letter, t.code);
        }
    }
    return { codes, byLetter };
}

/**
 * What a site should actually render, given whatever is stored.
 *
 * Repairs as well as defaults, because the broken value is already in the
 * database: rows exist with `heroStyle: 'A'`. A bare letter is upgraded to the
 * full code it plainly meant (`'A'` -> `'generic:A'`) rather than re-picked, so
 * a site an admin already reviewed keeps its design. Anything unrecognisable
 * falls to the automatic choice — never back to a value index.astro cannot
 * dispatch on.
 */
export function resolveHeroStyle(
    raw: unknown,
    businessType: string | undefined | null,
    seed: string | undefined | null,
    businessName?: string | undefined | null,
): string {
    const value = typeof raw === "string" ? raw.trim() : "";
    if (value) {
        const { codes, byLetter } = codeIndex();
        if (codes.has(value)) return value;
        const upgraded = byLetter.get(value);
        if (upgraded) return upgraded;
    }
    return autoTemplateFor(businessType, seed, businessName);
}

export function autoTemplateFor(
    businessType: string | undefined | null,
    seed: string | undefined | null,
    businessName?: string | undefined | null,
): string {
    const family = familyForBusinessType(businessType, businessName);
    const codes = codesForFamily(family);
    if (codes.length === 0) {
        // A family in the pattern table with no templates in the catalogue.
        // Fall back rather than hand index.astro something it cannot render.
        const generic = codesForFamily(FALLBACK_FAMILY);
        return generic[0] ?? "generic:A";
    }
    if (!seed) return codes[0];
    return codes[hash(seed) % codes.length];
}
