/**
 * design-library — the skill-style design catalog the AI agent picks from.
 *
 * Every design the platform can render is described here as a "card":
 * a short human/LLM-readable description, mood tags, the business types
 * it suits, and the variables the agent may tune (colorScheme,
 * fontPairing, per-block variants). Think of each card the way a skill
 * is structured: name → description → when to use → knobs.
 *
 * Consumers:
 *   • groqService.selectDesign()   — renders the catalog into the prompt
 *     via renderDesignLibraryPrompt(), parses the model's pick via
 *     resolveDesignSelection().
 *   • app/api/generate-website     — merges the resolved pick into
 *     finalCustomizations when the admin/app didn't choose explicitly.
 *   • Mobile app                   — alternates are persisted on the
 *     website's customizations.designSelection so the owner can swap.
 *
 * Adding a design: build the PageX .astro component, register it in
 * astro-site-template/src/pages/index.astro, then append a card here.
 * Append-only — never repurpose an existing id.
 *
 * Scheme/pairing ids must exist in
 * astro-site-template/src/lib/genericThemeOverrides.ts (SCHEMES /
 * FONT_PAIRINGS) — that file is the single source of truth for tokens.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DesignCard {
    /** Routable id — matches index.astro's heroStyle contract, e.g. "generic:A". */
    id: string
    /** Short display name. */
    name: string
    family: 'generic' | 'barbershop' | 'salonspa'
    /** 1-2 sentence description of the look — written for an LLM art director. */
    description: string
    /** Mood/style tags the agent matches against the business's tone. */
    mood: string[]
    /** Business types this design flatters. Freeform lowercase keywords. */
    bestFor: string[]
    /** Business types to steer away from. */
    avoidFor?: string[]
    /**
     * When true (barbershop/salonspa families) the design's native palette
     * is part of its identity: leave colorScheme on 'auto' unless the
     * business strongly demands a recolor. (See resolveTheme lockVariant.)
     */
    lockVariant?: boolean
    /** Recommended scheme ids for this design ('' / 'auto' = native palette). */
    recommendedSchemes: string[]
    /** Recommended font pairing ids ('auto' = native fonts on locked variants). */
    recommendedPairings: string[]
    /** SEO/GEO notes — anything the copy/schema step should know. */
    seoNotes?: string
}

/** Orthogonal look modifiers — mirrors DesignAxes in genericThemeOverrides.ts */
export interface DesignAxes {
    shape?: 'sharp' | 'soft' | 'pill'
    density?: 'airy' | 'dense'
    texture?: 'grain' | 'lines' | 'dots'
    typecase?: 'uppercase' | 'normal'
}

export interface DesignPick {
    designId: string
    colorScheme: string   // scheme id or 'auto'
    fontPairing: string   // pairing id or 'auto'
    reason: string        // one sentence, shown to admin/owner
    /** When the pick came from a curated recipe. */
    recipeId?: string
    axes?: DesignAxes
}

/**
 * A recipe = archetype × scheme × pairing × axes, curated by hand so the
 * combination is guaranteed to look good. This is how 15 hand-built
 * archetypes become 50+ visually distinct designs without new components.
 */
export interface DesignRecipe {
    id: string
    name: string
    designId: string
    colorScheme: string
    fontPairing: string
    axes?: DesignAxes
    /** One line the agent uses to match business character. */
    vibe: string
    bestFor: string[]
}

export interface DesignSelection {
    primary: DesignPick
    alternates: DesignPick[]  // ranked, shown in the mobile app as swap options
    pickedBy: 'agent' | 'preset' | 'default'
}

// ─────────────────────────────────────────────────────────────────────────────
// The catalog
// ─────────────────────────────────────────────────────────────────────────────

export const DESIGN_LIBRARY: DesignCard[] = [
    // ── Generic family (A–E): recolorable, business-type-agnostic ──────────
    {
        id: 'generic:A',
        name: 'Ironwood',
        family: 'generic',
        description:
            'Warm artisan landing page — cream paper, gold accents, generous serif-feel headings. Feels handmade and hospitable; strong hero with badge + dual CTA.',
        mood: ['warm', 'artisanal', 'inviting', 'classic'],
        bestFor: ['cafe', 'coffee', 'bakery', 'restaurant', 'food', 'boutique', 'retail'],
        recommendedSchemes: ['auto', 'brown', 'orange', 'gold', 'green'],
        recommendedPairings: ['classic', 'gourmet', 'modern', 'friendly'],
        seoNotes: 'Great for dine-in / order-ahead CTAs; keep menu keywords in services copy.',
    },
    {
        id: 'generic:B',
        name: 'Stillwater',
        family: 'generic',
        description:
            'Calm, airy, lots of whitespace and soft cards. Quiet confidence — reads premium without shouting. Ideal when the business sells calm, care, or craft.',
        mood: ['calm', 'minimal', 'airy', 'premium'],
        bestFor: ['studio', 'wellness', 'spa', 'clinic', 'photography', 'yoga', 'therapy'],
        recommendedSchemes: ['auto', 'green', 'blue', 'purple', 'whitegold', 'sage'],
        recommendedPairings: ['minimal', 'elegant', 'modern', 'professional'],
    },
    {
        id: 'generic:C',
        name: 'Cedar & Stone',
        family: 'generic',
        description:
            'Rugged, grounded, textured — heavier type, earthy tones, built-to-last energy. Communicates physical competence and durability.',
        mood: ['rugged', 'earthy', 'trustworthy', 'bold'],
        bestFor: ['trades', 'construction', 'landscaping', 'plumbing', 'electric', 'hvac', 'carpentry', 'hardware'],
        avoidFor: ['spa', 'salon', 'beauty'],
        recommendedSchemes: ['auto', 'maroon', 'brown', 'slate', 'navy'],
        recommendedPairings: ['bold', 'industrial', 'professional'],
        seoNotes: 'Service-area businesses: make sure serviceArea places list is filled — no storefront to anchor GEO.',
    },
    {
        id: 'generic:D',
        name: 'Northpoint',
        family: 'generic',
        description:
            'Dark panel-based tech layout — sharp edges, mono details, dashboard energy. Signals precision and modernity.',
        mood: ['tech', 'dark', 'precise', 'modern'],
        bestFor: ['it', 'tech', 'repair', 'automotive', 'security', 'printing', 'agency'],
        avoidFor: ['bakery', 'spa', 'florist'],
        recommendedSchemes: ['auto', 'dark', 'blue', 'black', 'teal', 'navy'],
        recommendedPairings: ['tech', 'modern', 'minimal', 'industrial'],
    },
    {
        id: 'generic:E',
        name: 'Wash House',
        family: 'generic',
        description:
            'Fresh, friendly, utility-forward — bright accents, rounded shapes, step-by-step how-it-works emphasis. Everyday-service energy: quick, cheap, reliable.',
        mood: ['fresh', 'friendly', 'practical', 'bright'],
        bestFor: ['laundry', 'cleaning', 'carwash', 'courier', 'water refilling', 'printing', 'tailor', 'services'],
        recommendedSchemes: ['auto', 'blue', 'green', 'yellow', 'mint', 'teal'],
        recommendedPairings: ['friendly', 'modern', 'professional', 'creative'],
    },

    // ── Barbershop family (F–J): native palettes are part of the identity ──
    {
        id: 'barbershop:F',
        name: 'Forge',
        family: 'barbershop',
        lockVariant: true,
        description:
            'Dark + brass barbershop flagship — moody photography slots, heavy display type, masculine premium. The default pick for classic barbershops.',
        mood: ['masculine', 'premium', 'dark', 'classic'],
        bestFor: ['barbershop', 'barber', 'grooming', 'tattoo'],
        recommendedSchemes: ['auto'],
        recommendedPairings: ['auto', 'bold', 'luxury'],
    },
    {
        id: 'barbershop:G',
        name: 'Forge Cinematic',
        family: 'barbershop',
        lockVariant: true,
        description:
            'Full-bleed cinematic hero, film-still pacing, dramatic scale. For shops with strong photography that want to feel like a brand, not a shop.',
        mood: ['cinematic', 'dramatic', 'editorial', 'dark'],
        bestFor: ['barbershop', 'studio', 'tattoo', 'photography'],
        recommendedSchemes: ['auto'],
        recommendedPairings: ['auto'],
    },
    {
        id: 'barbershop:H',
        name: 'Forge Kinetic',
        family: 'barbershop',
        lockVariant: true,
        description:
            'Black + electric green, kinetic type, street energy. Younger, louder, sneaker-culture adjacent.',
        mood: ['energetic', 'street', 'loud', 'young'],
        bestFor: ['barbershop', 'streetwear', 'sneaker', 'gym'],
        avoidFor: ['clinic', 'medical'],
        recommendedSchemes: ['auto'],
        recommendedPairings: ['auto', 'bold'],
    },
    {
        id: 'barbershop:I',
        name: 'Forge Minimal',
        family: 'barbershop',
        lockVariant: true,
        description:
            'Neutral, pared-back, gallery-like. The quiet version of Forge — lets photos and whitespace carry it.',
        mood: ['minimal', 'neutral', 'clean', 'modern'],
        bestFor: ['barbershop', 'salon', 'studio', 'boutique'],
        recommendedSchemes: ['auto'],
        recommendedPairings: ['auto', 'minimal'],
    },
    {
        id: 'barbershop:J',
        name: 'Forge Stacked',
        family: 'barbershop',
        lockVariant: true,
        description:
            'Paper background + dark red accents, stacked editorial sections, zine-like. Distinct without being dark.',
        mood: ['editorial', 'warm', 'crafted', 'bold'],
        bestFor: ['barbershop', 'cafe', 'retail', 'butcher'],
        recommendedSchemes: ['auto'],
        recommendedPairings: ['auto'],
    },

    // ── SalonSpa family (K–O): native palettes are part of the identity ────
    {
        id: 'salonspa:K',
        name: 'Atelier',
        family: 'salonspa',
        lockVariant: true,
        description:
            'Pearl + brass, Cormorant Garamond headings — haute, editorial, quietly expensive. For salons that price premium.',
        mood: ['luxury', 'editorial', 'elegant', 'feminine'],
        bestFor: ['salon', 'spa', 'aesthetic', 'lash', 'brow', 'bridal'],
        recommendedSchemes: ['auto'],
        recommendedPairings: ['auto', 'luxury'],
    },
    {
        id: 'salonspa:L',
        name: 'Botanica',
        family: 'salonspa',
        lockVariant: true,
        description:
            'Sage + cream, botanical calm, Spectral serif. Natural / organic positioning — great for spa, massage, skincare with plant-forward branding.',
        mood: ['natural', 'organic', 'calm', 'soft'],
        bestFor: ['spa', 'massage', 'skincare', 'wellness', 'organic'],
        recommendedSchemes: ['auto'],
        recommendedPairings: ['auto'],
    },
    {
        id: 'salonspa:M',
        name: 'Clinic',
        family: 'salonspa',
        lockVariant: true,
        description:
            'Mist + teal, Tenor Sans — clinical cleanliness with warmth. The credibility pick for derm clinics, dental, medspa, anything YMYL-adjacent.',
        mood: ['clinical', 'clean', 'credible', 'calm'],
        bestFor: ['clinic', 'dental', 'derma', 'medspa', 'medical', 'veterinary', 'optometry'],
        recommendedSchemes: ['auto'],
        recommendedPairings: ['auto', 'professional'],
        seoNotes: 'YMYL: lean hard on credentials + testimonials blocks; keep claims conservative.',
    },
    {
        id: 'salonspa:N',
        name: 'Vogue',
        family: 'salonspa',
        lockVariant: true,
        description:
            'Mauve pink, DM Serif Display — fashion-magazine attitude, high contrast, playful glam. For trend-led salons and nail bars.',
        mood: ['glam', 'fashion', 'playful', 'bold'],
        bestFor: ['salon', 'nail', 'makeup', 'lash', 'boutique'],
        recommendedSchemes: ['auto'],
        recommendedPairings: ['auto'],
    },
    {
        id: 'salonspa:O',
        name: 'Bloom',
        family: 'salonspa',
        lockVariant: true,
        description:
            'Mauve + cream, Marcellus — soft, romantic, approachable. The friendly neighborhood-salon pick when Atelier feels too expensive and Vogue too loud.',
        mood: ['soft', 'romantic', 'friendly', 'warm'],
        bestFor: ['salon', 'spa', 'nail', 'home service beauty', 'bridal'],
        recommendedSchemes: ['auto'],
        recommendedPairings: ['auto', 'friendly'],
    },
]

// ─────────────────────────────────────────────────────────────────────────────
// Variable descriptions (agent-facing) — ids must exist in genericThemeOverrides
// ─────────────────────────────────────────────────────────────────────────────

export const SCHEME_INFO: Record<string, string> = {
    auto: 'Keep the design\'s native palette (or business-type curated default).',
    blue: 'Professional blue — trust, competence.',
    green: 'Fresh green — health, growth, eco.',
    purple: 'Creative purple — education, arts.',
    orange: 'Energetic orange — food, appetite, action.',
    dark: 'Dark slate — elegant, technical.',
    pink: 'Vibrant pink — beauty, playful.',
    brown: 'Natural brown — coffee, craft, heritage.',
    red: 'Intense red — fitness, urgency, passion.',
    yellow: 'Bright yellow — cheap-and-cheerful, high visibility.',
    maroon: 'Deep maroon — rich, serious, trades.',
    black: 'Monochrome black — stark, premium.',
    gold: 'Gold on cream — premium warmth.',
    whitegold: 'White + antique gold — editorial luxe.',
    teal: 'Teal — modern care, clinics and tech-adjacent services.',
    navy: 'Navy — established, institutional trust.',
    sage: 'Sage — organic calm, wellness.',
    terracotta: 'Terracotta — warm Mediterranean, food and craft.',
    slate: 'Slate — industrial neutral, workshops and trades.',
    cream: 'Warm cream neutrals — soft heritage, bakeries and boutiques.',
    wine: 'Wine — intimate, restaurants and evening venues.',
    mint: 'Mint — light, hygienic freshness; laundry, dental, juice.',
}

export const PAIRING_INFO: Record<string, string> = {
    auto: 'Keep the design\'s native fonts.',
    modern: 'Space Grotesk + Inter — contemporary default.',
    classic: 'Playfair Display + Source Sans — traditional serif authority.',
    elegant: 'Cormorant Garamond + Montserrat — refined display.',
    bold: 'Bebas Neue + Roboto — loud condensed headlines.',
    minimal: 'DM Sans — single-family quiet.',
    professional: 'Poppins + Open Sans — safe corporate.',
    creative: 'Righteous + Nunito — rounded playful.',
    tech: 'Orbitron + Exo 2 — sci-fi technical.',
    friendly: 'Quicksand — soft rounded approachable.',
    luxury: 'Cinzel + Lato — engraved luxury.',
    gourmet: 'Cormorant Garamond + Montserrat — menu-card refinement.',
    editorial: 'Libre Caslon Text + Inter — magazine body seriousness.',
    humanist: 'Fraunces + Work Sans — warm modern serif character.',
    industrial: 'Oswald + Source Sans 3 — workshop signage.',
    retro: 'Abril Fatface + Poppins — vintage poster flair.',
    warm: 'Lora + Nunito Sans — gentle literary warmth.',
}

// ─────────────────────────────────────────────────────────────────────────────
// The recipe book — 50 curated, named designs. Each is a hand-picked
// combination guaranteed to hold together. Append-only.
// ─────────────────────────────────────────────────────────────────────────────

export const DESIGN_RECIPES: DesignRecipe[] = [
    // ── Ironwood (generic:A) — warm artisan base ────────────────────────
    { id: 'r-ember',        name: 'Ember',         designId: 'generic:A', colorScheme: 'terracotta', fontPairing: 'gourmet',    axes: { texture: 'grain' },                          vibe: 'Wood-fired warmth, grainy and appetizing.',            bestFor: ['restaurant', 'grill', 'bbq'] },
    { id: 'r-panaderia',    name: 'Panaderia',     designId: 'generic:A', colorScheme: 'cream',      fontPairing: 'warm',       axes: { shape: 'soft' },                             vibe: 'Soft morning-bakery comfort.',                          bestFor: ['bakery', 'pastry', 'cafe'] },
    { id: 'r-kapeng',       name: 'Kapeng Barako', designId: 'generic:A', colorScheme: 'brown',      fontPairing: 'classic',    axes: { texture: 'lines', density: 'airy' },         vibe: 'Heritage coffeehouse, ruled-paper character.',          bestFor: ['cafe', 'coffee', 'roaster'] },
    { id: 'r-vineyard',     name: 'Vineyard',      designId: 'generic:A', colorScheme: 'wine',       fontPairing: 'editorial',  axes: { density: 'airy' },                           vibe: 'Intimate evening dining, unhurried.',                   bestFor: ['restaurant', 'bistro', 'wine bar'] },
    { id: 'r-mercado',      name: 'Mercado',       designId: 'generic:A', colorScheme: 'yellow',     fontPairing: 'retro',      axes: { shape: 'sharp', density: 'dense' },          vibe: 'Loud market-stall energy, poster type.',                bestFor: ['street food', 'carinderia', 'market'] },
    { id: 'r-goldleaf',     name: 'Gold Leaf',     designId: 'generic:A', colorScheme: 'gold',       fontPairing: 'luxury',     axes: { typecase: 'uppercase' },                     vibe: 'Engraved premium, special-occasion.',                   bestFor: ['fine dining', 'deli', 'gifts'] },
    { id: 'r-orchard',      name: 'Orchard',       designId: 'generic:A', colorScheme: 'green',      fontPairing: 'humanist',   axes: { shape: 'soft' },                             vibe: 'Farm-fresh, honest and organic.',                       bestFor: ['organic food', 'farm', 'juice'] },

    // ── Stillwater (generic:B) — calm airy base ─────────────────────────
    { id: 'r-sagebrush',    name: 'Sagebrush',     designId: 'generic:B', colorScheme: 'sage',       fontPairing: 'elegant',    axes: { density: 'airy' },                           vibe: 'Botanical calm, breathing room everywhere.',            bestFor: ['spa', 'massage', 'wellness'] },
    { id: 'r-porcelain',    name: 'Porcelain',     designId: 'generic:B', colorScheme: 'whitegold',  fontPairing: 'minimal',    axes: { shape: 'sharp' },                            vibe: 'Clinical luxe, precise and pristine.',                  bestFor: ['aesthetic clinic', 'derma', 'medspa'] },
    { id: 'r-lavender',     name: 'Lavender',      designId: 'generic:B', colorScheme: 'purple',     fontPairing: 'professional', axes: {},                                          vibe: 'Calm competence for learning spaces.',                  bestFor: ['tutoring', 'review center', 'music school'] },
    { id: 'r-seafoam',      name: 'Seafoam',       designId: 'generic:B', colorScheme: 'teal',       fontPairing: 'minimal',    axes: { shape: 'pill' },                             vibe: 'Modern care, rounded and gentle.',                      bestFor: ['clinic', 'dental', 'therapy'] },
    { id: 'r-gallery',      name: 'Gallery',       designId: 'generic:B', colorScheme: 'black',      fontPairing: 'editorial',  axes: { typecase: 'uppercase', density: 'airy' },    vibe: 'White-cube gallery, photography-first.',                bestFor: ['photography', 'studio', 'architect'] },
    { id: 'r-linen',        name: 'Linen',         designId: 'generic:B', colorScheme: 'cream',      fontPairing: 'warm',       axes: { texture: 'grain' },                          vibe: 'Soft-textured craft, tactile and quiet.',               bestFor: ['tailor', 'boutique', 'crafts'] },
    { id: 'r-skyline',      name: 'Skyline',       designId: 'generic:B', colorScheme: 'navy',       fontPairing: 'professional', axes: { shape: 'sharp' },                          vibe: 'Established professional trust.',                       bestFor: ['accountant', 'law', 'consulting'] },
    { id: 'r-blush',        name: 'Blush',         designId: 'generic:B', colorScheme: 'pink',       fontPairing: 'friendly',   axes: { shape: 'pill' },                             vibe: 'Sweet approachable beauty.',                            bestFor: ['home beauty', 'nail', 'lash'] },

    // ── Cedar & Stone (generic:C) — rugged base ─────────────────────────
    { id: 'r-foreman',      name: 'Foreman',       designId: 'generic:C', colorScheme: 'maroon',     fontPairing: 'bold',       axes: { typecase: 'uppercase' },                     vibe: 'Hard-hat authority, built to last.',                    bestFor: ['construction', 'contractor', 'trades'] },
    { id: 'r-quarry',       name: 'Quarry',        designId: 'generic:C', colorScheme: 'slate',      fontPairing: 'industrial', axes: { shape: 'sharp', texture: 'grain' },          vibe: 'Raw stone and steel, no decoration.',                   bestFor: ['construction', 'masonry', 'demolition'] },
    { id: 'r-timber',       name: 'Timber',        designId: 'generic:C', colorScheme: 'brown',      fontPairing: 'humanist',   axes: { texture: 'lines' },                          vibe: 'Workshop wood-grain craft.',                            bestFor: ['carpentry', 'furniture', 'woodwork'] },
    { id: 'r-voltage',      name: 'Voltage',       designId: 'generic:C', colorScheme: 'yellow',     fontPairing: 'bold',       axes: { shape: 'sharp', density: 'dense' },          vibe: 'High-visibility hazard-tape energy.',                   bestFor: ['electrician', 'generator', 'solar'] },
    { id: 'r-deepwell',     name: 'Deepwell',      designId: 'generic:C', colorScheme: 'navy',       fontPairing: 'professional', axes: {},                                          vibe: 'Dependable, always-on-call service.',                   bestFor: ['plumbing', 'water systems', 'pumps'] },
    { id: 'r-terra',        name: 'Terra',         designId: 'generic:C', colorScheme: 'terracotta', fontPairing: 'industrial', axes: { texture: 'grain' },                          vibe: 'Earth-moving outdoor muscle.',                          bestFor: ['landscaping', 'garden', 'excavation'] },
    { id: 'r-crucible',     name: 'Crucible',      designId: 'generic:C', colorScheme: 'red',        fontPairing: 'bold',       axes: { typecase: 'uppercase', density: 'dense' },   vibe: 'Sparks-flying metalwork intensity.',                    bestFor: ['welding', 'metal', 'fabrication'] },

    // ── Northpoint (generic:D) — dark tech base ─────────────────────────
    { id: 'r-northstar',    name: 'Northstar',     designId: 'generic:D', colorScheme: 'blue',       fontPairing: 'tech',       axes: {},                                            vibe: 'Precise IT competence.',                                bestFor: ['it services', 'computer repair', 'networking'] },
    { id: 'r-carbon',       name: 'Carbon',        designId: 'generic:D', colorScheme: 'black',      fontPairing: 'industrial', axes: { shape: 'sharp', texture: 'grain' },          vibe: 'Matte-black performance garage.',                       bestFor: ['auto detailing', 'car customization', 'tuning'] },
    { id: 'r-circuit',      name: 'Circuit',       designId: 'generic:D', colorScheme: 'teal',       fontPairing: 'tech',       axes: { texture: 'dots' },                           vibe: 'Circuit-board precision, dotted grid.',                 bestFor: ['electronics repair', 'gadgets', 'cctv'] },
    { id: 'r-midnight',     name: 'Midnight',      designId: 'generic:D', colorScheme: 'dark',       fontPairing: 'editorial',  axes: { density: 'airy' },                           vibe: 'After-hours studio cool.',                              bestFor: ['agency', 'recording studio', 'bar'] },
    { id: 'r-redline',      name: 'Redline',       designId: 'generic:D', colorScheme: 'red',        fontPairing: 'bold',       axes: { typecase: 'uppercase' },                     vibe: 'Motorsport urgency, tachometer in the red.',            bestFor: ['auto repair', 'motorcycle', 'racing'] },
    { id: 'r-arcade',       name: 'Arcade',        designId: 'generic:D', colorScheme: 'purple',     fontPairing: 'tech',       axes: { shape: 'pill' },                             vibe: 'Neon gaming-lounge glow.',                              bestFor: ['gaming cafe', 'esports', 'arcade'] },
    { id: 'r-steelworks',   name: 'Steelworks',    designId: 'generic:D', colorScheme: 'slate',      fontPairing: 'industrial', axes: { density: 'dense' },                          vibe: 'Dense machine-shop specification sheet.',               bestFor: ['machine shop', 'parts', 'industrial supply'] },

    // ── Wash House (generic:E) — fresh utility base ─────────────────────
    { id: 'r-washday',      name: 'Washday',       designId: 'generic:E', colorScheme: 'mint',       fontPairing: 'friendly',   axes: { shape: 'pill' },                             vibe: 'Fresh-laundry lightness.',                              bestFor: ['laundry', 'dry cleaning'] },
    { id: 'r-aqua',         name: 'Aqua',          designId: 'generic:E', colorScheme: 'blue',       fontPairing: 'modern',     axes: { shape: 'soft' },                             vibe: 'Clean water clarity.',                                  bestFor: ['water refilling', 'purification', 'carwash'] },
    { id: 'r-sunnyside',    name: 'Sunnyside',     designId: 'generic:E', colorScheme: 'yellow',     fontPairing: 'creative',   axes: { shape: 'pill', density: 'dense' },           vibe: 'Playful, kid-friendly cheer.',                          bestFor: ['daycare', 'kids activities', 'party services'] },
    { id: 'r-sprout',       name: 'Sprout',        designId: 'generic:E', colorScheme: 'green',      fontPairing: 'humanist',   axes: { shape: 'soft' },                             vibe: 'Eco-friendly everyday service.',                        bestFor: ['cleaning', 'eco services', 'recycling'] },
    { id: 'r-citrus',       name: 'Citrus',        designId: 'generic:E', colorScheme: 'orange',     fontPairing: 'friendly',   axes: { texture: 'dots' },                           vibe: 'Zesty grab-and-go freshness.',                          bestFor: ['juice', 'smoothie', 'food stall'] },
    { id: 'r-dispatch',     name: 'Dispatch',      designId: 'generic:E', colorScheme: 'navy',       fontPairing: 'professional', axes: { shape: 'sharp' },                          vibe: 'On-time logistics reliability.',                        bestFor: ['courier', 'moving', 'logistics'] },
    { id: 'r-mintcondition', name: 'Mint Condition', designId: 'generic:E', colorScheme: 'teal',     fontPairing: 'minimal',    axes: {},                                            vibe: 'Like-new repair confidence.',                           bestFor: ['phone repair', 'gadget', 'appliance repair'] },

    // ── Forge family (barbershop:F–J) — palette-locked variations ───────
    { id: 'r-forge',        name: 'Forge Classic', designId: 'barbershop:F', colorScheme: 'auto', fontPairing: 'auto',          axes: {},                                            vibe: 'The flagship dark + brass barbershop.',                 bestFor: ['barbershop'] },
    { id: 'r-forge-grain',  name: 'Forge Grain',   designId: 'barbershop:F', colorScheme: 'auto', fontPairing: 'auto',          axes: { texture: 'grain', typecase: 'uppercase' },   vibe: 'Film-grain vintage barbershop.',                        bestFor: ['barbershop', 'traditional grooming'] },
    { id: 'r-noir',         name: 'Noir',          designId: 'barbershop:G', colorScheme: 'auto', fontPairing: 'auto',          axes: { density: 'airy' },                           vibe: 'Cinematic slow-burn, photography-led.',                 bestFor: ['barbershop', 'tattoo', 'studio'] },
    { id: 'r-static',       name: 'Static',        designId: 'barbershop:H', colorScheme: 'auto', fontPairing: 'auto',          axes: { texture: 'dots', density: 'dense' },         vibe: 'Compressed street-print energy.',                       bestFor: ['barbershop', 'streetwear', 'sneaker'] },
    { id: 'r-whitespace',   name: 'Whitespace',    designId: 'barbershop:I', colorScheme: 'auto', fontPairing: 'minimal',       axes: { density: 'airy' },                           vibe: 'Gallery-minimal, lets the work speak.',                 bestFor: ['barbershop', 'salon', 'boutique'] },
    { id: 'r-zine',         name: 'Zine',          designId: 'barbershop:J', colorScheme: 'auto', fontPairing: 'auto',          axes: { texture: 'lines' },                          vibe: 'Ruled-paper editorial zine.',                           bestFor: ['barbershop', 'cafe', 'retail'] },
    { id: 'r-letterpress',  name: 'Letterpress',   designId: 'barbershop:J', colorScheme: 'auto', fontPairing: 'editorial',     axes: { typecase: 'uppercase' },                     vibe: 'Stamped print-shop authority.',                         bestFor: ['barbershop', 'butcher', 'craft retail'] },

    // ── SalonSpa family (salonspa:K–O) — palette-locked variations ──────
    { id: 'r-atelier',      name: 'Atelier',       designId: 'salonspa:K', colorScheme: 'auto', fontPairing: 'auto',            axes: { density: 'airy' },                           vibe: 'Haute salon, quietly expensive.',                       bestFor: ['premium salon', 'bridal', 'aesthetics'] },
    { id: 'r-engraved',     name: 'Engraved',      designId: 'salonspa:K', colorScheme: 'auto', fontPairing: 'luxury',          axes: { typecase: 'uppercase' },                     vibe: 'Monogrammed, engraved-invitation luxe.',                bestFor: ['luxury spa', 'bridal', 'jewelry'] },
    { id: 'r-conservatory', name: 'Conservatory',  designId: 'salonspa:L', colorScheme: 'auto', fontPairing: 'auto',            axes: { texture: 'grain' },                          vibe: 'Greenhouse botanical, sun-through-leaves.',             bestFor: ['spa', 'skincare', 'organic wellness'] },
    { id: 'r-sterile',      name: 'Pure',          designId: 'salonspa:M', colorScheme: 'auto', fontPairing: 'auto',            axes: { shape: 'sharp' },                            vibe: 'Crisp clinical exactness.',                             bestFor: ['dental', 'derma', 'diagnostics'] },
    { id: 'r-bedside',      name: 'Bedside',       designId: 'salonspa:M', colorScheme: 'auto', fontPairing: 'professional',    axes: { shape: 'pill' },                             vibe: 'Clinical trust with a soft touch.',                     bestFor: ['pediatric clinic', 'vet', 'therapy'] },
    { id: 'r-couture',      name: 'Couture',       designId: 'salonspa:N', colorScheme: 'auto', fontPairing: 'auto',            axes: { typecase: 'uppercase', density: 'airy' },    vibe: 'Runway-editorial glam.',                                bestFor: ['trend salon', 'makeup', 'fashion'] },
    { id: 'r-petal',        name: 'Petal',         designId: 'salonspa:O', colorScheme: 'auto', fontPairing: 'auto',            axes: { shape: 'pill' },                             vibe: 'Soft-petal neighborhood warmth.',                       bestFor: ['salon', 'nails', 'home-service beauty'] },
]

// ─────────────────────────────────────────────────────────────────────────────
// Curated look presets — instant good defaults per business bucket.
// The agent uses these as a strong prior; deterministic fallback when the
// agent call fails. First entry in each list = primary, rest = alternates.
// ─────────────────────────────────────────────────────────────────────────────

export const LOOK_PRESETS: Record<string, DesignPick[]> = {
    cafe: [
        { designId: 'generic:A', colorScheme: 'brown', fontPairing: 'gourmet', reason: 'Warm artisan look suits coffee.' },
        { designId: 'barbershop:J', colorScheme: 'auto', fontPairing: 'auto', reason: 'Paper zine editorial alternative.' },
        { designId: 'generic:B', colorScheme: 'cream', fontPairing: 'classic', reason: 'Calm minimal option.' },
    ],
    restaurant: [
        { designId: 'generic:A', colorScheme: 'terracotta', fontPairing: 'gourmet', reason: 'Appetite-forward warmth.' },
        { designId: 'generic:A', colorScheme: 'wine', fontPairing: 'classic', reason: 'Evening dining mood.' },
        { designId: 'generic:B', colorScheme: 'orange', fontPairing: 'modern', reason: 'Bright casual option.' },
    ],
    barbershop: [
        { designId: 'barbershop:F', colorScheme: 'auto', fontPairing: 'auto', reason: 'Flagship dark + brass barbershop look.' },
        { designId: 'barbershop:I', colorScheme: 'auto', fontPairing: 'auto', reason: 'Minimal gallery alternative.' },
        { designId: 'barbershop:H', colorScheme: 'auto', fontPairing: 'auto', reason: 'Louder street-energy option.' },
    ],
    salon: [
        { designId: 'salonspa:K', colorScheme: 'auto', fontPairing: 'auto', reason: 'Editorial luxe salon flagship.' },
        { designId: 'salonspa:O', colorScheme: 'auto', fontPairing: 'auto', reason: 'Softer friendly alternative.' },
        { designId: 'salonspa:N', colorScheme: 'auto', fontPairing: 'auto', reason: 'Fashion-glam option.' },
    ],
    spa: [
        { designId: 'salonspa:L', colorScheme: 'auto', fontPairing: 'auto', reason: 'Botanical calm fits spa.' },
        { designId: 'salonspa:K', colorScheme: 'auto', fontPairing: 'auto', reason: 'Luxe alternative.' },
        { designId: 'generic:B', colorScheme: 'sage', fontPairing: 'elegant', reason: 'Airy minimal option.' },
    ],
    clinic: [
        { designId: 'salonspa:M', colorScheme: 'auto', fontPairing: 'auto', reason: 'Clinical credibility with warmth.' },
        { designId: 'generic:B', colorScheme: 'teal', fontPairing: 'professional', reason: 'Calm professional alternative.' },
        { designId: 'generic:D', colorScheme: 'blue', fontPairing: 'professional', reason: 'Precise modern option.' },
    ],
    automotive: [
        { designId: 'generic:D', colorScheme: 'blue', fontPairing: 'industrial', reason: 'Technical precision for auto work.' },
        { designId: 'generic:C', colorScheme: 'slate', fontPairing: 'bold', reason: 'Rugged workshop alternative.' },
        { designId: 'generic:D', colorScheme: 'dark', fontPairing: 'tech', reason: 'Darker performance option.' },
    ],
    fitness: [
        { designId: 'generic:D', colorScheme: 'red', fontPairing: 'bold', reason: 'High-energy training look.' },
        { designId: 'barbershop:H', colorScheme: 'auto', fontPairing: 'auto', reason: 'Street kinetic alternative.' },
        { designId: 'generic:B', colorScheme: 'green', fontPairing: 'modern', reason: 'Calmer wellness option.' },
    ],
    education: [
        { designId: 'generic:B', colorScheme: 'purple', fontPairing: 'professional', reason: 'Calm credible learning space.' },
        { designId: 'generic:E', colorScheme: 'blue', fontPairing: 'friendly', reason: 'Friendly practical alternative.' },
        { designId: 'generic:A', colorScheme: 'navy', fontPairing: 'classic', reason: 'Traditional academy option.' },
    ],
    trades: [
        { designId: 'generic:C', colorScheme: 'maroon', fontPairing: 'bold', reason: 'Built-to-last trades energy.' },
        { designId: 'generic:E', colorScheme: 'blue', fontPairing: 'professional', reason: 'Approachable service alternative.' },
        { designId: 'generic:D', colorScheme: 'navy', fontPairing: 'industrial', reason: 'Precise technical option.' },
    ],
    laundry: [
        { designId: 'generic:E', colorScheme: 'mint', fontPairing: 'friendly', reason: 'Fresh utility-service look.' },
        { designId: 'generic:E', colorScheme: 'blue', fontPairing: 'modern', reason: 'Cooler classic alternative.' },
        { designId: 'generic:B', colorScheme: 'teal', fontPairing: 'minimal', reason: 'Calmer premium option.' },
    ],
    retail: [
        { designId: 'generic:A', colorScheme: 'brown', fontPairing: 'modern', reason: 'Warm shopkeeper character.' },
        { designId: 'barbershop:J', colorScheme: 'auto', fontPairing: 'auto', reason: 'Editorial zine alternative.' },
        { designId: 'generic:E', colorScheme: 'yellow', fontPairing: 'creative', reason: 'Bright bargain option.' },
    ],
}

/** Map raw business_type strings onto a LOOK_PRESETS bucket key. */
const BUCKET_KEYWORDS: Array<[RegExp, string]> = [
    [/barber/i, 'barbershop'],
    [/salon|nail|lash|brow|makeup|beauty|aesthetic/i, 'salon'],
    [/\bspa\b|massage|skincare|wellness/i, 'spa'],
    [/clinic|dental|dentist|derma|medical|doctor|vet/i, 'clinic'],
    [/auto|mechanic|tire|garage|car\s?(shop|repair|wash|detail)/i, 'automotive'],
    [/gym|fitness|yoga|pilates|crossfit|martial/i, 'fitness'],
    [/school|tutor|academy|education|learning|driving|music/i, 'education'],
    [/plumb|electric|hvac|aircon|construction|carpentr|landscap|roof|weld|trade/i, 'trades'],
    [/laundry|cleaning|carwash|water|courier|print/i, 'laundry'],
    [/cafe|coffee|roaster|tea|bakery|bake/i, 'cafe'],
    [/restaurant|diner|eatery|bistro|food|grill|catering|carinderia/i, 'restaurant'],
    [/store|shop|retail|boutique|hardware|grocery|sari/i, 'retail'],
]

export function presetForBusinessType(businessType?: string | null): DesignPick[] | null {
    if (!businessType) return null
    for (const [re, bucket] of BUCKET_KEYWORDS) {
        if (re.test(businessType)) return LOOK_PRESETS[bucket] ?? null
    }
    return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt rendering + selection resolution
// ─────────────────────────────────────────────────────────────────────────────

const VALID_DESIGN_IDS = new Set(DESIGN_LIBRARY.map((d) => d.id))
const VALID_SCHEMES = new Set(Object.keys(SCHEME_INFO))
const VALID_PAIRINGS = new Set(Object.keys(PAIRING_INFO))
const RECIPES_BY_ID = new Map(DESIGN_RECIPES.map((r) => [r.id, r]))

/** Expand a curated recipe into a trusted DesignPick (bypasses lock sanitizing). */
export function recipeToPick(recipe: DesignRecipe, reason?: string): DesignPick {
    return {
        designId: recipe.designId,
        colorScheme: recipe.colorScheme,
        fontPairing: recipe.fontPairing,
        axes: recipe.axes && Object.keys(recipe.axes).length > 0 ? recipe.axes : undefined,
        recipeId: recipe.id,
        reason: reason || recipe.vibe,
    }
}

/**
 * Compact plain-text catalog for the selection prompt. Kept terse on
 * purpose — the model only needs enough to discriminate, not the full
 * card.
 */
export function renderDesignLibraryPrompt(): string {
    const designs = DESIGN_LIBRARY.map((d) => {
        const lock = d.lockVariant ? ' [palette locked: prefer colorScheme=auto, fontPairing=auto]' : ''
        const avoid = d.avoidFor?.length ? ` Avoid: ${d.avoidFor.join(', ')}.` : ''
        return `- ${d.id} "${d.name}" — ${d.description} Mood: ${d.mood.join(', ')}. Best for: ${d.bestFor.join(', ')}.${avoid}${lock}\n  Schemes: ${d.recommendedSchemes.join(', ')} | Pairings: ${d.recommendedPairings.join(', ')}`
    }).join('\n')
    const schemes = Object.entries(SCHEME_INFO).map(([id, desc]) => `- ${id}: ${desc}`).join('\n')
    const pairings = Object.entries(PAIRING_INFO).map(([id, desc]) => `- ${id}: ${desc}`).join('\n')
    const recipes = DESIGN_RECIPES.map((r) =>
        `- ${r.id} "${r.name}" (${r.designId}) — ${r.vibe} Best for: ${r.bestFor.join(', ')}.`
    ).join('\n')
    return `CURATED RECIPES — prefer these; each is a guaranteed-good, named design. Pick by recipeId.\n${recipes}\n\nDESIGN CATALOG (base archetypes — use only when no recipe fits, via designId + colorScheme + fontPairing)\n${designs}\n\nCOLOR SCHEMES\n${schemes}\n\nFONT PAIRINGS\n${pairings}`
}

function sanitizePick(raw: any, fallback: DesignPick): DesignPick {
    // Recipe picks are trusted verbatim — they're curated combos.
    const recipe = raw?.recipeId ? RECIPES_BY_ID.get(String(raw.recipeId)) : undefined
    if (recipe) {
        const reason = typeof raw?.reason === 'string' && raw.reason.trim()
            ? raw.reason.trim().slice(0, 200)
            : undefined
        return recipeToPick(recipe, reason)
    }
    const designId = VALID_DESIGN_IDS.has(raw?.designId) ? raw.designId : fallback.designId
    const card = DESIGN_LIBRARY.find((d) => d.id === designId)
    let colorScheme = VALID_SCHEMES.has(raw?.colorScheme) ? raw.colorScheme : fallback.colorScheme
    let fontPairing = VALID_PAIRINGS.has(raw?.fontPairing) ? raw.fontPairing : fallback.fontPairing
    // Locked variants: respect the design's native identity unless the
    // model explicitly picked a recommended scheme for that card.
    if (card?.lockVariant) {
        if (!card.recommendedSchemes.includes(colorScheme)) colorScheme = 'auto'
        if (!card.recommendedPairings.includes(fontPairing)) fontPairing = 'auto'
    }
    const reason = typeof raw?.reason === 'string' && raw.reason.trim()
        ? raw.reason.trim().slice(0, 200)
        : fallback.reason
    return { designId, colorScheme, fontPairing, reason }
}

/**
 * Validate + normalize whatever the model returned into a safe
 * DesignSelection. Falls back to the business-type preset, then to the
 * platform default (generic:A / auto / modern). Never throws.
 */
export function resolveDesignSelection(
    raw: any,
    businessType?: string | null,
): DesignSelection {
    const preset = presetForBusinessType(businessType)
    const defaults: DesignPick[] = preset ?? [
        { designId: 'generic:A', colorScheme: 'auto', fontPairing: 'modern', reason: 'Platform default.' },
        { designId: 'generic:B', colorScheme: 'auto', fontPairing: 'minimal', reason: 'Calm alternative.' },
        { designId: 'generic:E', colorScheme: 'auto', fontPairing: 'friendly', reason: 'Friendly alternative.' },
    ]

    if (!raw || typeof raw !== 'object') {
        return {
            primary: defaults[0]!,
            alternates: defaults.slice(1, 3),
            pickedBy: preset ? 'preset' : 'default',
        }
    }

    const primary = sanitizePick(raw.primary, defaults[0]!)
    const rawAlts: any[] = Array.isArray(raw.alternates) ? raw.alternates : []
    const alternates: DesignPick[] = []
    for (let i = 0; i < rawAlts.length && alternates.length < 2; i++) {
        const alt = sanitizePick(rawAlts[i], defaults[Math.min(alternates.length + 1, defaults.length - 1)]!)
        if (alt.designId !== primary.designId || alt.colorScheme !== primary.colorScheme) {
            alternates.push(alt)
        }
    }
    // Backfill alternates from defaults if the model returned fewer than 2.
    for (const d of defaults) {
        if (alternates.length >= 2) break
        if (d.designId !== primary.designId && !alternates.some((a) => a.designId === d.designId)) {
            alternates.push(d)
        }
    }
    return { primary, alternates, pickedBy: 'agent' }
}

/**
 * Turn a DesignPick into the Customizations fields the astro builder
 * consumes. heroStyle carries the family-routing id.
 */
export function pickToCustomizations(pick: DesignPick): Record<string, any> {
    return {
        heroStyle: pick.designId,
        colorScheme: pick.colorScheme,
        colorSchemeId: pick.colorScheme,
        fontPairing: pick.fontPairing,
        fontPairingId: pick.fontPairing,
        ...(pick.axes ? { designAxes: pick.axes } : {}),
    }
}
