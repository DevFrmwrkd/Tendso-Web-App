/**
 * templateCatalog — shared template inventory for the submission editors.
 *
 * Copy-extracted from SandboxEditor.tsx so the redesigned SandboxEditorV2 can
 * reuse the exact same `family:code` template ids + `/template-previews/*.html`
 * thumbnails WITHOUT touching v1. v1 will be converged onto this file in a
 * follow-up PR; until then a parity test (templateCatalog.test) guards against
 * drift (catalog length must equal the number of files in public/template-previews).
 *
 * Each `code` maps to `customizations.heroStyle` (e.g. "generic:A"), which the
 * astro router (astro-site-template/src/pages/index.astro) resolves at build time.
 */

export type TemplateFamily =
    | "generic" | "barbershop" | "salonspa" | "autoshop" | "restaurant"
    | "shirtstore" | "retail" | "medical" | "fitness" | "education"
    | "trades" | "foodcraft" | "services" | "filipino" | "hospitality"
    | "layouts";

import { TEMPLATE_SECTION_ORDER } from "./templateSectionOrder.generated";
import { TEMPLATE_SECTION_LABELS, DEFAULT_SECTION_LABELS } from "./templateSectionLabels";

export interface TemplateDef {
    letter: string;
    code: string;
    label: string;
    tagline: string;
    preview: string;
}

const GENERIC_TEMPLATES: TemplateDef[] = [
    { letter: "A", code: "generic:A", label: "Ironwood",      tagline: "Paper + gold · café",           preview: "/template-previews/a.html" },
    { letter: "B", code: "generic:B", label: "Stillwater",    tagline: "Teal + peach · yoga / studio",  preview: "/template-previews/b.html" },
    { letter: "C", code: "generic:C", label: "Cedar & Stone", tagline: "Amber + forest · build trades", preview: "/template-previews/c.html" },
    { letter: "D", code: "generic:D", label: "Northpoint",    tagline: "Lime on dark · tech / IT",      preview: "/template-previews/d.html" },
    { letter: "E", code: "generic:E", label: "Wash House",    tagline: "Blue + yellow · laundry",       preview: "/template-previews/e.html" },
];

const BARBERSHOP_TEMPLATES: TemplateDef[] = [
    { letter: "F", code: "barbershop:F", label: "Forge",     tagline: "Paper + brass · classic",      preview: "/template-previews/f.html" },
    { letter: "G", code: "barbershop:G", label: "Cinematic", tagline: "Oversized type · editorial",   preview: "/template-previews/g.html" },
    { letter: "H", code: "barbershop:H", label: "Kinetic",   tagline: "Black + green · energetic",     preview: "/template-previews/h.html" },
    { letter: "I", code: "barbershop:I", label: "Minimal",   tagline: "Neutral grayscale · refined",   preview: "/template-previews/i.html" },
    { letter: "J", code: "barbershop:J", label: "Stacked",   tagline: "Stone + dark red · bold serif", preview: "/template-previews/j.html" },
    { letter: "BP", code: "barbershop:BP", label: "Glacier", tagline: "Ice blue + didone · full-bleed photo", preview: "/template-previews/bp.html" },
];

const SALONSPA_TEMPLATES: TemplateDef[] = [
    { letter: "K",  code: "salonspa:K",  label: "Atelier",  tagline: "Pearl + brass · refined salon",    preview: "/template-previews/k.html" },
    { letter: "L",  code: "salonspa:L",  label: "Botanica", tagline: "Sage + cream · botanical spa",     preview: "/template-previews/l.html" },
    { letter: "M",  code: "salonspa:M",  label: "Clinic",   tagline: "Mist + teal · clinical aesthetic", preview: "/template-previews/m.html" },
    { letter: "N",  code: "salonspa:N",  label: "Vogue",    tagline: "Mauve pink · editorial beauty",    preview: "/template-previews/n.html" },
    { letter: "O",  code: "salonspa:O",  label: "Bloom",    tagline: "Mauve + cream · romantic",         preview: "/template-previews/o.html" },
    { letter: "AN", code: "salonspa:AN", label: "Héla · Poblacion Atelier", tagline: "Atelier nights · salon & spa", preview: "/template-previews/an.html" },
];

const AUTOSHOP_TEMPLATES: TemplateDef[] = [
    { letter: "P",  code: "autoshop:P",  label: "Foundry",      tagline: "Concrete + hazard orange · industrial", preview: "/template-previews/p.html" },
    { letter: "Q",  code: "autoshop:Q",  label: "Meridian",     tagline: "Clean steel · precision service",       preview: "/template-previews/q.html" },
    { letter: "R",  code: "autoshop:R",  label: "Volt",         tagline: "Electric accent · EV / modern",         preview: "/template-previews/r.html" },
    { letter: "S",  code: "autoshop:S",  label: "Redline",      tagline: "Bold red · performance shop",           preview: "/template-previews/s.html" },
    { letter: "T",  code: "autoshop:T",  label: "Maple Street", tagline: "Warm neighbourhood · trusted garage",   preview: "/template-previews/t.html" },
    { letter: "AF", code: "autoshop:AF", label: "Job-Sheet Industrial", tagline: "Hazard yellow · repair shops", preview: "/template-previews/af.html" },
    { letter: "AP", code: "autoshop:AP", label: "Vulca Garage & Detailing", tagline: "Volcanic grit · garage & detailing", preview: "/template-previews/ap.html" },
];

const RESTAURANT_TEMPLATES: TemplateDef[] = [
    { letter: "U",  code: "restaurant:U",  label: "Harvest", tagline: "Rustic + olive · farm-to-table", preview: "/template-previews/u.html" },
    { letter: "V",  code: "restaurant:V",  label: "Atelier", tagline: "Minimal · refined dining",       preview: "/template-previews/v.html" },
    { letter: "W",  code: "restaurant:W",  label: "Press",   tagline: "Bold type · casual eatery",      preview: "/template-previews/w.html" },
    { letter: "X",  code: "restaurant:X",  label: "Ember",   tagline: "Cinematic · fine dining",        preview: "/template-previews/x.html" },
    { letter: "Y",  code: "restaurant:Y",  label: "Garden",  tagline: "Playful · cafe / brunch",        preview: "/template-previews/y.html" },
    { letter: "AE", code: "restaurant:AE", label: "Smoke & Banana Leaf", tagline: "Charcoal + ember · grills & BBQ", preview: "/template-previews/ae.html" },
    { letter: "AM", code: "restaurant:AM", label: "Kalan · Mercado Nocturne", tagline: "Ember + night market · restaurants", preview: "/template-previews/am.html" },
];

const SHIRTSTORE_TEMPLATES: TemplateDef[] = [
    { letter: "Z",  code: "shirtstore:Z",  label: "Editorial",  tagline: "Warm editorial · apparel brand", preview: "/template-previews/z.html" },
    { letter: "AA", code: "shirtstore:AA", label: "Streetwear", tagline: "Bold urban · drops / merch",     preview: "/template-previews/aa.html" },
    { letter: "AB", code: "shirtstore:AB", label: "Artisan",    tagline: "Handmade · small-batch",         preview: "/template-previews/ab.html" },
    { letter: "AC", code: "shirtstore:AC", label: "Modern",     tagline: "Clean minimal · DTC store",      preview: "/template-previews/ac.html" },
    { letter: "AD", code: "shirtstore:AD", label: "Kinetic",    tagline: "Energetic · statement tees",     preview: "/template-previews/ad.html" },
];

const RETAIL_TEMPLATES: TemplateDef[] = [
    { letter: "AG", code: "retail:AG", label: "Broadsheet Catalog", tagline: "Newsprint + red ink · hardware", preview: "/template-previews/ag.html" },
    { letter: "AO", code: "retail:AO", label: "Domingo · Catálogo", tagline: "Sunday catalog · retail & shops", preview: "/template-previews/ao.html" },
];

const MEDICAL_TEMPLATES: TemplateDef[] = [
    { letter: "AH", code: "medical:AH", label: "Clinical Editorial",  tagline: "Porcelain + seafoam · dental / derma", preview: "/template-previews/ah.html" },
    { letter: "AQ", code: "medical:AQ", label: "Batis Dental Studio", tagline: "Fresh spring · dental & clinics",      preview: "/template-previews/aq.html" },
];

const FITNESS_TEMPLATES: TemplateDef[] = [
    { letter: "AI", code: "fitness:AI", label: "Brutalist Fight Poster", tagline: "Red/black halftone · boxing gyms", preview: "/template-previews/ai.html" },
    { letter: "AR", code: "fitness:AR", label: "Kalasag Strength Co.",   tagline: "Shield-strong · gyms & strength",  preview: "/template-previews/ar.html" },
];

const EDUCATION_TEMPLATES: TemplateDef[] = [
    { letter: "AJ", code: "education:AJ", label: "Notebook Modern",         tagline: "Ruled paper · tutoring centers",       preview: "/template-previews/aj.html" },
    { letter: "AT", code: "education:AT", label: "Talíno Learning Studio",  tagline: "Bright + smart · tutoring & learning", preview: "/template-previews/at.html" },
];

const TRADES_TEMPLATES: TemplateDef[] = [
    { letter: "AK", code: "trades:AK", label: "Blueprint Cyanotype",     tagline: "Cyan blueprint · aircon / electrical", preview: "/template-previews/ak.html" },
    { letter: "AU", code: "trades:AU", label: "Volt & Line Electrical",  tagline: "Live wire · electrical & trades",      preview: "/template-previews/au.html" },
    { letter: "BQ", code: "trades:BQ", label: "Bakal Fabrication Works", tagline: "Hazard orange · steel, welding & metal shops", preview: "/template-previews/bq.html" },
];

const FOODCRAFT_TEMPLATES: TemplateDef[] = [
    { letter: "AL", code: "foodcraft:AL", label: "Pastel Deco Panaderia", tagline: "Cream + terracotta · bakeries", preview: "/template-previews/al.html" },
    { letter: "BL", code: "foodcraft:BL", label: "Kalinaw Coffee", tagline: "Cream + rust · cafés, roasters & brunch", preview: "/template-previews/bl.html" },
    { letter: "BM", code: "foodcraft:BM", label: "Tahanan Cafe", tagline: "White + walnut · ruled, editorial cafés", preview: "/template-previews/bm.html" },
    { letter: "BN", code: "foodcraft:BN", label: "Panday Coffee Works", tagline: "Bone + rust · roasteries & coffee bars", preview: "/template-previews/bn.html" },
    { letter: "BO", code: "foodcraft:BO", label: "Sipsip Tea Bar", tagline: "Blush + ultraviolet · milk tea & brew bars", preview: "/template-previews/bo.html" },
];

const SERVICES_TEMPLATES: TemplateDef[] = [
    { letter: "AS", code: "services:AS", label: "Labaná Laundry & Press", tagline: "Crisp + clean · laundry & services", preview: "/template-previews/as.html" },
];

const FILIPINO_TEMPLATES: TemplateDef[] = [
    { letter: "BB", code: "filipino:BB", label: "Tindahan · Suki Storefront",  tagline: "Barangay warmth · sari-sari & corner stores", preview: "/template-previews/bb.html" },
    { letter: "BC", code: "filipino:BC", label: "Lutong Bahay · Carinderia",   tagline: "Turo-turo warmth · carinderias & eateries",  preview: "/template-previews/bc.html" },
    { letter: "BD", code: "filipino:BD", label: "Tahanan Panaderia",           tagline: "Dark-crust bakeshop · panaderia & bakeries", preview: "/template-previews/bd.html" },
    { letter: "BE", code: "filipino:BE", label: "Barako Kapehan",              tagline: "Slab-roast warmth · coffee & kapehan",      preview: "/template-previews/be.html" },
    { letter: "BF", code: "filipino:BF", label: "Lechon Manok · Spit",         tagline: "Charcoal grill · roast chicken & BBQ",      preview: "/template-previews/bf.html" },
    { letter: "BG", code: "filipino:BG", label: "Vulca Bay",                   tagline: "Hazard-yellow grit · vulcanizing & repair", preview: "/template-previews/bg.html" },
    { letter: "BH", code: "filipino:BH", label: "Halo Haus",                   tagline: "Ube pastel · halo-halo & desserts",         preview: "/template-previews/bh.html" },
];

const HOSPITALITY_TEMPLATES: TemplateDef[] = [
    { letter: "BI", code: "hospitality:BI", label: "Palm Hour",  tagline: "Terracotta & lagoon shade · hotels, villas & short stays", preview: "/template-previews/bi.html" },
    { letter: "BJ", code: "hospitality:BJ", label: "Kubo Stays", tagline: "Cream & deep green · rooms, homestays & guest houses",     preview: "/template-previews/bj.html" },
    { letter: "BK", code: "hospitality:BK", label: "Villa Marindu", tagline: "Night & brass · private villas and whole-property stays", preview: "/template-previews/bk.html" },
];

/** Families in rail-display order, each with a human label. */
export const TEMPLATE_FAMILIES: Array<{ family: TemplateFamily; label: string; templates: TemplateDef[] }> = [
    { family: "generic",     label: "Generic",        templates: GENERIC_TEMPLATES },
    { family: "restaurant",  label: "Restaurant",     templates: RESTAURANT_TEMPLATES },
    { family: "barbershop",  label: "Barbershop",     templates: BARBERSHOP_TEMPLATES },
    { family: "salonspa",    label: "Salon & Spa",    templates: SALONSPA_TEMPLATES },
    { family: "autoshop",    label: "Auto",           templates: AUTOSHOP_TEMPLATES },
    { family: "shirtstore",  label: "Apparel",        templates: SHIRTSTORE_TEMPLATES },
    { family: "retail",      label: "Retail",         templates: RETAIL_TEMPLATES },
    { family: "medical",     label: "Medical",        templates: MEDICAL_TEMPLATES },
    { family: "fitness",     label: "Fitness",        templates: FITNESS_TEMPLATES },
    { family: "education",   label: "Education",      templates: EDUCATION_TEMPLATES },
    { family: "trades",      label: "Trades",         templates: TRADES_TEMPLATES },
    { family: "foodcraft",   label: "Foodcraft",      templates: FOODCRAFT_TEMPLATES },
    { family: "services",    label: "Services",       templates: SERVICES_TEMPLATES },
    { family: "filipino",    label: "Filipino",       templates: FILIPINO_TEMPLATES },
    { family: "hospitality", label: "Hotels & Stays", templates: HOSPITALITY_TEMPLATES },
];

export const ALL_TEMPLATES: TemplateDef[] = TEMPLATE_FAMILIES.flatMap((f) => f.templates);

/* ────────────────────────────────────────────────────────────────────────────
 * WHICH SECTIONS A TEMPLATE ACTUALLY RENDERS, AND WHAT IT CALLS THEM
 *
 * Membership and ORDER come from templateSectionOrder.generated.ts, which
 * scripts/gen-template-sections.mjs reads straight out of every
 * Page<CODE>.astro. It replaced a hand-written "base list plus two exception
 * sets" that was only ever an approximation: it claimed all 62 wrappers render
 * the same fourteen blocks in the same order, so the Sections panel showed the
 * same generic schema whichever template was selected.
 *
 * They do not render in the same order. Kubo Stays leads with the rooms and
 * puts the promises straight after the host; the generic family opens with a
 * marquee and never renders credentials at all. Page order is what an admin is
 * actually looking at, so it is what the panel lists.
 *
 * The NAMES come from templateSectionLabels.ts — what each template calls the
 * section on the page ("The rooms", "Your host", "Getting here"), because
 * "SERVICES" and "WHY-US" are our vocabulary, not the owner's.
 *
 * NOTE: HEADER, CLICK-TO-MESSAGE and SCROLL-TO-TOP are deliberately absent. No
 * wrapper gates on any of them — the message pill is gated on the owner having
 * supplied a real WhatsApp/Messenger handle, and nothing renders a scroll-top
 * button — so offering them as toggles would be offering switches that do
 * nothing.
 * ──────────────────────────────────────────────────────────────────────────── */

/** One section as a given template renders it. */
export interface TemplateSection {
    /** The ALL_BLOCKS name, which is what the visibility key hangs off. */
    block: string;
    /** What THIS template calls it on the page. */
    label: string;
    /** What is actually inside it, so an admin knows what a toggle removes. */
    blurb: string;
}

/**
 * The blocks a given template renders. Unordered by contract — callers that
 * care about order use sectionsForTemplate().
 *
 * An unknown code falls back to the union of every block, so a newly added
 * template that has not been regenerated yet over-offers rather than hiding a
 * section the admin can see on the page.
 */
export function blocksForTemplate(code: string | undefined | null): Set<string> {
    const order = code ? TEMPLATE_SECTION_ORDER[code] : undefined;
    if (order) return new Set(order);
    return new Set(ALL_SECTION_BLOCKS);
}

/** Every block any template renders — the fallback for an unknown code. */
const ALL_SECTION_BLOCKS: string[] = (() => {
    const seen = new Set<string>();
    for (const list of Object.values(TEMPLATE_SECTION_ORDER)) for (const b of list) seen.add(b);
    return [...seen];
})();

/**
 * The sections a template renders, IN PAGE ORDER, each carrying the template's
 * own name for it. This is what the editor's Sections panel lists.
 */
export function sectionsForTemplate(code: string | undefined | null): TemplateSection[] {
    const order = (code ? TEMPLATE_SECTION_ORDER[code] : undefined) ?? ALL_SECTION_BLOCKS;
    const named = (code ? TEMPLATE_SECTION_LABELS[code] : undefined) ?? {};
    return order.map((block) => {
        const own = named[block];
        const fallback = DEFAULT_SECTION_LABELS[block];
        return {
            block,
            label: own?.label ?? fallback?.label ?? block,
            blurb: own?.blurb ?? fallback?.blurb ?? "",
        };
    });
}

/**
 * Editor grouping. Tiers describe how much of a site a block carries, so an
 * admin can see at a glance what is core and what is enrichment.
 */
export type BlockTier = "essential" | "enhanced" | "extra";

export const BLOCK_TIER: Record<string, BlockTier> = {
    "HERO": "essential", "SERVICES": "essential", "LOCATION": "essential", "FOOTER": "essential",
    "ABOUT": "enhanced", "GALLERY": "enhanced", "TESTIMONIALS": "enhanced",
    "FAQ": "enhanced", "CTA-BAND": "enhanced",
    "TRUST": "extra", "WHY-US": "extra", "HOW-IT-WORKS": "extra",
    "SERVICE-AREA": "extra", "CREDENTIALS": "extra", "MARQUEE": "extra",
};

export const TIER_META: Array<{ id: BlockTier; label: string; blurb: string }> = [
    { id: "essential", label: "Essential", blurb: "The page does not work without these." },
    { id: "enhanced",  label: "Enhanced",  blurb: "What turns a page into a site worth reading." },
    { id: "extra",     label: "Extra",     blurb: "Enrichment — drop any the owner has no material for." },
];

/**
 * Content paths a block reads, so the editor can show whether the owner has
 * anything to put in it. First non-empty path wins; a block with no entry here
 * is always treated as having content (HERO, FOOTER — always populated).
 */
export const BLOCK_CONTENT_PATHS: Record<string, string[]> = {
    "TRUST": ["trust.cells", "trust"],
    "ABOUT": ["about.body", "about.lead", "about.paragraphs", "about"],
    "SERVICES": ["services.items", "services"],
    "WHY-US": ["why.items"],
    "HOW-IT-WORKS": ["how.steps", "how.items"],
    "TESTIMONIALS": ["testimonials.items", "testimonials"],
    "GALLERY": ["gallery.items", "gallery.images", "photos"],
    "FAQ": ["faq.items"],
    "SERVICE-AREA": ["area.places"],
    "CREDENTIALS": ["credentials.items", "credentials"],
    "LOCATION": ["location.address", "contact.address", "location"],
    "CTA-BAND": ["ctaBand.headline", "ctaBand"],
    "MARQUEE": ["marquee.items", "marquee"],
};

/** business_type bucket labels (carried forward on save). */
export const TEMPLATE_BUCKETS = [
    { id: "barber",     label: "Barber",     business: "Barber Shop",       desc: "Vintage masculine · heritage" },
    { id: "salon",      label: "Beauty",     business: "Salon / Spa",       desc: "Luxe ethereal · soft & feminine" },
    { id: "auto",       label: "Automotive", business: "Auto Shop",         desc: "Industrial · technical · rugged" },
    { id: "restaurant", label: "Food",       business: "Restaurant / Café", desc: "Warm · appetizing · hospitable" },
    { id: "clinic",     label: "Medical",    business: "Clinic / Dental",   desc: "Clean · trustworthy · professional" },
    { id: "retail",     label: "Retail",     business: "Retail Store",      desc: "Blueprint · clear · catalog" },
    { id: "fitness",    label: "Fitness",    business: "Gym / Studio",      desc: "Kinetic · bold · confident" },
    { id: "education",  label: "Education",  business: "School / Workshop", desc: "Warm · inviting · academic" },
    { id: "services",   label: "Services",   business: "Trades / Services", desc: "Service area · utility · clear" },
] as const;

/** Family of a heroStyle code, e.g. "restaurant:AM" → "restaurant". */
export function familyOf(code: string | undefined | null): TemplateFamily | null {
    if (!code) return null;
    const fam = code.split(":")[0] as TemplateFamily;
    return TEMPLATE_FAMILIES.some((f) => f.family === fam) ? fam : null;
}

export function templateByCode(code: string | undefined | null): TemplateDef | undefined {
    if (!code) return undefined;
    return ALL_TEMPLATES.find((t) => t.code === code);
}
