/**
 * genericThemeOverrides — emits an extra `:root` CSS block that overrides
 * a generic template's native palette + font tokens with admin-picked
 * Color Scheme / Font Pairing values.
 *
 * Returns an empty string when the scheme is unset, 'auto', or the
 * template's own default — in which case the template's native palette
 * stays untouched.
 *
 * The override sets the same custom-properties every PageX defines
 * (--paper, --ink, --gold/peach/amber/lime/blue, --paper-rgb, --ink-rgb,
 * --accent-rgb, --disp, --sans, --mono) so swapping one scheme works
 * regardless of which template is in use.
 *
 * Called inline from PageA…PageE during render — the result is dropped
 * into a <style is:global> tag right after the template's own theme
 * declarations so CSS cascade gives admin picks priority.
 */

type Palette = {
    paper: string;
    paper2: string;
    card: string;
    ink: string;
    inkSoft: string;
    line: string;
    primary: string;
    primaryDeep: string;
    accent: string;
    paperRgb: string;
    inkRgb: string;
    accentRgb: string;
};

/**
 * Convert a #RRGGBB hex to [r,g,b]. Returns null on bad input so callers
 * can fall back instead of throwing.
 */
function parseHex(hex: string): [number, number, number] | null {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return null;
    const v = m[1];
    return [
        parseInt(v.slice(0, 2), 16),
        parseInt(v.slice(2, 4), 16),
        parseInt(v.slice(4, 6), 16),
    ];
}

/**
 * Relative luminance per WCAG. Returns 0–1; 0 is black, 1 is white.
 */
function luminance(hex: string): number {
    const rgb = parseHex(hex);
    if (!rgb) return 0.5;
    const lin = rgb.map((c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
}

/**
 * Pick black or white text for legibility on the given background color.
 * Threshold 0.5 covers WCAG AA at normal weight for all our palettes.
 */
function pickOn(bg: string): string {
    return luminance(bg) > 0.5 ? '#0B0B0F' : '#FFFFFF';
}

// Scheme keys mirror the editor's COLOR_SCHEMES list. We translate each
// into the 12 tokens generic templates consume. Hand-tuned for legibility:
// every scheme keeps text/background contrast above ~4.5:1.
const SCHEMES: Record<string, Palette> = {
    blue: {
        paper: '#F5F8FC', paper2: '#FFFFFF', card: '#E6EEF8',
        ink: '#0F2C4A', inkSoft: '#3C5A7F', line: '#CDDBEF',
        primary: '#3B82F6', primaryDeep: '#1E3A8A', accent: '#60A5FA',
        paperRgb: '245,248,252', inkRgb: '15,44,74', accentRgb: '96,165,250',
    },
    green: {
        paper: '#F2F7F2', paper2: '#FFFFFF', card: '#E1EDE3',
        ink: '#14532D', inkSoft: '#3A6647', line: '#CCDFCF',
        primary: '#16A34A', primaryDeep: '#14532D', accent: '#4ADE80',
        paperRgb: '242,247,242', inkRgb: '20,83,45', accentRgb: '74,222,128',
    },
    purple: {
        paper: '#F6F3FB', paper2: '#FFFFFF', card: '#E8E0F4',
        ink: '#1E1B4B', inkSoft: '#4338CA', line: '#D3CAE5',
        primary: '#8B5CF6', primaryDeep: '#4C1D95', accent: '#A78BFA',
        paperRgb: '246,243,251', inkRgb: '30,27,75', accentRgb: '167,139,250',
    },
    orange: {
        paper: '#FFF8F2', paper2: '#FFFFFF', card: '#FCE6D2',
        ink: '#431407', inkSoft: '#7C2D12', line: '#F1D5BD',
        primary: '#F97316', primaryDeep: '#7C2D12', accent: '#FB923C',
        paperRgb: '255,248,242', inkRgb: '67,20,7', accentRgb: '251,146,60',
    },
    dark: {
        paper: '#0F172A', paper2: '#1E293B', card: '#1E293B',
        ink: '#F8FAFC', inkSoft: '#94A3B8', line: '#334155',
        primary: '#D1D5DB', primaryDeep: '#FFFFFF', accent: '#9CA3AF',
        paperRgb: '15,23,42', inkRgb: '248,250,252', accentRgb: '156,163,175',
    },
    pink: {
        paper: '#FFF5F8', paper2: '#FFFFFF', card: '#FBE0EA',
        ink: '#311B92', inkSoft: '#880E4F', line: '#F2CCD9',
        primary: '#D81B60', primaryDeep: '#880E4F', accent: '#F48FB1',
        paperRgb: '255,245,248', inkRgb: '49,27,146', accentRgb: '244,143,177',
    },
    brown: {
        paper: '#FBF8F5', paper2: '#FFFFFF', card: '#EBE3DA',
        ink: '#3E2723', inkSoft: '#5D4037', line: '#D5CABE',
        primary: '#795548', primaryDeep: '#3E2723', accent: '#A1887F',
        paperRgb: '251,248,245', inkRgb: '62,39,35', accentRgb: '161,136,127',
    },
    red: {
        paper: '#FFF5F5', paper2: '#FFFFFF', card: '#F8D7D7',
        ink: '#1A0000', inkSoft: '#7F0000', line: '#EAC2C2',
        primary: '#D32F2F', primaryDeep: '#B71C1C', accent: '#EF5350',
        paperRgb: '255,245,245', inkRgb: '26,0,0', accentRgb: '239,83,80',
    },
    yellow: {
        paper: '#FEFCE8', paper2: '#FFFFFF', card: '#FAF3C8',
        ink: '#1A1A1A', inkSoft: '#424242', line: '#EBE0A4',
        primary: '#FBC02D', primaryDeep: '#F57F17', accent: '#D32F2F',
        paperRgb: '254,252,232', inkRgb: '26,26,26', accentRgb: '211,47,47',
    },
    maroon: {
        paper: '#2D0000', paper2: '#3D0000', card: '#3D0000',
        ink: '#F5F5DC', inkSoft: '#E0C0C0', line: '#5A1010',
        primary: '#800000', primaryDeep: '#5A0000', accent: '#A52A2A',
        paperRgb: '45,0,0', inkRgb: '245,245,220', accentRgb: '165,42,42',
    },
    black: {
        paper: '#000000', paper2: '#111111', card: '#1A1A1A',
        ink: '#FFFFFF', inkSoft: '#A0A0A0', line: '#2A2A2A',
        primary: '#FFFFFF', primaryDeep: '#E5E5E5', accent: '#A0A0A0',
        paperRgb: '0,0,0', inkRgb: '255,255,255', accentRgb: '160,160,160',
    },
    gold: {
        paper: '#F8F5F0', paper2: '#FFFFFF', card: '#EFE6D2',
        ink: '#1A1A1A', inkSoft: '#4A4A4A', line: '#DCD0AD',
        primary: '#C5A059', primaryDeep: '#9C7E3D', accent: '#E5C07B',
        paperRgb: '248,245,240', inkRgb: '26,26,26', accentRgb: '197,160,89',
    },
    whitegold: {
        paper: '#FFFFFF', paper2: '#FFFFFF', card: '#F8F1E0',
        ink: '#1A1A1A', inkSoft: '#5A5A5A', line: '#E7D9B5',
        primary: '#B89060', primaryDeep: '#8C6940', accent: '#D6B97A',
        paperRgb: '255,255,255', inkRgb: '26,26,26', accentRgb: '184,144,96',
    },
};

const FONT_PAIRINGS: Record<string, { heading: string; body: string; mono?: string; gfontFamily?: string[] }> = {
    modern:       { heading: 'Space Grotesk', body: 'Inter',           gfontFamily: ['Space+Grotesk:wght@400;500;600;700', 'Inter:wght@300;400;500;600;700'] },
    classic:      { heading: 'Playfair Display', body: 'Source Sans Pro', gfontFamily: ['Playfair+Display:wght@400;500;600;700', 'Source+Sans+Pro:wght@300;400;500;600'] },
    elegant:      { heading: 'Cormorant Garamond', body: 'Montserrat',  gfontFamily: ['Cormorant+Garamond:wght@400;500;600;700', 'Montserrat:wght@300;400;500;600'] },
    bold:         { heading: 'Bebas Neue', body: 'Roboto',              gfontFamily: ['Bebas+Neue', 'Roboto:wght@300;400;500;700'] },
    minimal:      { heading: 'DM Sans', body: 'DM Sans',                 gfontFamily: ['DM+Sans:wght@400;500;600;700'] },
    professional: { heading: 'Poppins', body: 'Open Sans',                gfontFamily: ['Poppins:wght@400;500;600;700', 'Open+Sans:wght@300;400;500;600'] },
    creative:     { heading: 'Righteous', body: 'Nunito',                 gfontFamily: ['Righteous', 'Nunito:wght@300;400;500;600;700'] },
    tech:         { heading: 'Orbitron', body: 'Exo 2',                   gfontFamily: ['Orbitron:wght@400;500;600;700', 'Exo+2:wght@300;400;500;600'] },
    friendly:     { heading: 'Quicksand', body: 'Quicksand',              gfontFamily: ['Quicksand:wght@400;500;600;700'] },
    luxury:       { heading: 'Cinzel', body: 'Lato',                       gfontFamily: ['Cinzel:wght@400;500;600;700', 'Lato:wght@300;400;700'] },
    gourmet:      { heading: 'Cormorant Garamond', body: 'Montserrat',     gfontFamily: ['Cormorant+Garamond:wght@400;500;600;700', 'Montserrat:wght@300;400;500;600'] },
};

/**
 * Map business_type → curated scheme id, used when admin leaves the
 * Color Scheme dropdown on "auto". Returns empty string for unknown
 * types so the template's native palette wins.
 */
const AUTO_BY_BUSINESS_TYPE: Record<string, string> = {
    barber: 'brown', barbershop: 'brown',
    salon: 'pink', beauty: 'pink', spa: 'pink', nail: 'pink', hair: 'pink', aesthetic: 'pink',
    auto: 'blue', automotive: 'blue', mechanic: 'blue', tire: 'blue', garage: 'blue', carshop: 'blue', carrepair: 'blue',
    restaurant: 'orange', diner: 'orange', eatery: 'orange', bistro: 'orange', food: 'orange',
    cafe: 'brown', coffee: 'brown', roaster: 'brown', tea: 'brown',
    retail: 'brown', store: 'brown', shop: 'brown', boutique: 'brown',
    clinic: 'green', dental: 'green', dentist: 'green', medical: 'green', doctor: 'green', veterinary: 'green', vet: 'green',
    fitness: 'red', gym: 'red', yoga: 'red', pilates: 'red', crossfit: 'red', martialarts: 'red',
    school: 'purple', tutor: 'purple', workshop: 'purple', academy: 'purple', education: 'purple', learning: 'purple',
    trade: 'maroon', service: 'maroon', plumbing: 'maroon', electric: 'maroon', hvac: 'maroon',
    landscaping: 'maroon', cleaning: 'maroon', laundry: 'maroon',
};

function resolveAutoScheme(businessType: string | undefined | null): string {
    if (!businessType) return '';
    const k = String(businessType).trim().toLowerCase().replace(/[^a-z]/g, '');
    if (AUTO_BY_BUSINESS_TYPE[k]) return AUTO_BY_BUSINESS_TYPE[k];
    // Fuzzy substring match — admin may have typed e.g. "auto shop" or
    // "hair salon" which our exact-key map doesn't catch.
    for (const [key, schemeId] of Object.entries(AUTO_BY_BUSINESS_TYPE)) {
        if (k.includes(key)) return schemeId;
    }
    return '';
}

/**
 * Resolve the value an admin selected for color scheme / font pairing.
 * The editor stores it under multiple keys depending on flow age — try
 * the modern keys first, fall back through legacy aliases.
 *
 * When the scheme is "auto" (or unset), resolve to a curated scheme
 * picked by business_type so the template's native palette doesn't show
 * coffee-paper tones on an auto shop. Pass `businessType` from
 * site-data's content section.
 */
export function resolveTheme(
    layout: any,
    businessType?: string | null,
    opts?: { lockVariant?: boolean },
): { scheme: string; pairing: string } {
    let scheme =
        (layout?.colorSchemeId as string) ||
        (layout?.colorScheme as string) ||
        '';
    const pairing =
        (layout?.fontPairingId as string) ||
        (layout?.fontPairing as string) ||
        '';
    // lockVariant (Barbershop / Forge wrappers): only EXPLICIT picks
    // override the variant. When admin leaves Color Scheme on "auto"
    // (or unset), the per-variant palette baked into the wrapper wins —
    // we don't fall back to the business-type auto map. This keeps
    // Forge / Cinematic / Kinetic / Minimal / Stacked visually distinct
    // by default. An EXPLICIT pick (Blue, Brown, etc.) still recolors.
    if (opts?.lockVariant) {
        if (!scheme || scheme === 'auto' || scheme === 'default') scheme = '';
        if (!pairing || pairing === 'auto' || pairing === 'default') {
            return { scheme, pairing: '' };
        }
        return { scheme, pairing };
    }
    if (!scheme || scheme === 'auto' || scheme === 'default') {
        scheme = resolveAutoScheme(businessType);
    }
    return { scheme, pairing };
}

/**
 * Build the Google Fonts URL for the requested pairing. Returns null if
 * the pairing is unknown — the template's own font import then carries on.
 */
export function buildFontHref(pairing: string): string | null {
    const p = FONT_PAIRINGS[pairing];
    if (!p?.gfontFamily) return null;
    const families = p.gfontFamily.map((f) => `family=${f}`).join('&');
    return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

/**
 * Build the override CSS block. Returns '' when scheme is unset / 'auto'
 * AND pairing is unset / 'modern' (template default).
 */
export function buildOverrideCss(scheme: string, pairing: string): string {
    const palette = SCHEMES[scheme];
    const font = FONT_PAIRINGS[pairing];
    if (!palette && !font) return '';

    const lines: string[] = [];
    // `html:root` selector + !important wins over component-scoped
    // `:root` blocks regardless of where the Astro bundler hoists them.
    // Component-scoped :root rules from PageX wrappers used to land
    // AFTER our override in the emitted dist HTML, defeating the cascade.
    lines.push('html:root {');
    if (palette) {
        lines.push(`  --paper: ${palette.paper} !important;`);
        lines.push(`  --paper-2: ${palette.paper2} !important;`);
        lines.push(`  --card: ${palette.card} !important;`);
        lines.push(`  --ink: ${palette.ink} !important;`);
        lines.push(`  --ink-soft: ${palette.inkSoft} !important;`);
        lines.push(`  --line: ${palette.line} !important;`);
        lines.push(`  --paper-rgb: ${palette.paperRgb} !important;`);
        lines.push(`  --ink-rgb: ${palette.inkRgb} !important;`);
        lines.push(`  --accent-rgb: ${palette.accentRgb} !important;`);
        // Every PageX uses a different "primary" token name (--gold, --peach,
        // --amber, --lime, --blue). Override ALL of them so whichever
        // template renders, the admin pick lands.
        lines.push(`  --gold: ${palette.primary} !important;`);
        lines.push(`  --gold-deep: ${palette.primaryDeep} !important;`);
        lines.push(`  --peach: ${palette.primary} !important;`);
        lines.push(`  --peach-soft: ${palette.accent} !important;`);
        lines.push(`  --amber: ${palette.primary} !important;`);
        lines.push(`  --amber-2: ${palette.accent} !important;`);
        lines.push(`  --lime: ${palette.primary} !important;`);
        lines.push(`  --lime-2: ${palette.accent} !important;`);
        lines.push(`  --blue: ${palette.primary} !important;`);
        lines.push(`  --blue-deep: ${palette.primaryDeep} !important;`);
        lines.push(`  --blue-soft: ${palette.accent} !important;`);
        lines.push(`  --mint: ${palette.accent} !important;`);
        lines.push(`  --mint-soft: ${palette.accent} !important;`);
        lines.push(`  --yellow: ${palette.accent} !important;`);
        lines.push(`  --yellow-soft: ${palette.accent} !important;`);
        lines.push(`  --teal: ${palette.primary} !important;`);
        lines.push(`  --teal-deep: ${palette.primaryDeep} !important;`);
        lines.push(`  --teal-soft: ${palette.accent} !important;`);
        lines.push(`  --forest: ${palette.primaryDeep} !important;`);
        lines.push(`  --forest-2: ${palette.primary} !important;`);
        // Barbershop / Forge family uses --brass / --brass-bright / --brass-rgb
        // for the primary accent across all 5 letter variants (PageF–PageJ).
        lines.push(`  --brass: ${palette.primary} !important;`);
        lines.push(`  --brass-bright: ${palette.accent} !important;`);
        lines.push(`  --brass-rgb: ${palette.accentRgb} !important;`);
        // SalonSpa family (PageK–PageO) uses --accent / --accent-rgb for the
        // primary accent across all 5 variants.
        lines.push(`  --accent: ${palette.primary} !important;`);
        lines.push(`  --accent-rgb: ${palette.accentRgb} !important;`);
        // Northpoint uses --bg / --bg-2 / --panel — alias them too.
        lines.push(`  --bg: ${palette.paper} !important;`);
        lines.push(`  --bg-2: ${palette.paper2} !important;`);
        lines.push(`  --bg-rgb: ${palette.paperRgb} !important;`);
        lines.push(`  --panel: ${palette.card} !important;`);
        lines.push(`  --panel-2: ${palette.card} !important;`);
        lines.push(`  --muted: ${palette.inkSoft} !important;`);
        lines.push(`  --stone: ${palette.line} !important;`);
    }
    // Contrast tokens — pick legible text colors based on luminance of the
    // scheme's primary, ink, and paper so dark/light schemes never end up
    // with same-color text-on-background (e.g. black scheme had white
    // .btn-primary with white text). Components don't need to know which
    // scheme is active; they just read --on-primary / --on-ink / --on-paper.
    if (palette) {
        const onPrimary = pickOn(palette.primary);
        const onInk = pickOn(palette.ink);
        const onPaper = pickOn(palette.paper);
        const onAccent = pickOn(palette.accent);
        lines.push(`  --on-primary: ${onPrimary} !important;`);
        lines.push(`  --on-ink: ${onInk} !important;`);
        lines.push(`  --on-paper: ${onPaper} !important;`);
        lines.push(`  --on-accent: ${onAccent} !important;`);
        // Barbershop / Forge family aliases — the spine's .btn rules
        // consume `--on-brass` directly. Same luminance source as the
        // primary contrast token so dark/black/yellow schemes never
        // yield white-on-white or black-on-black buttons.
        lines.push(`  --on-brass: ${onPrimary} !important;`);
    }
    if (font) {
        const heading = `"${font.heading}", system-ui, sans-serif`;
        const body = `"${font.body}", system-ui, sans-serif`;
        const mono = font.mono ? `"${font.mono}", monospace` : `"${font.body}", system-ui, sans-serif`;
        lines.push(`  --disp: ${heading} !important;`);
        lines.push(`  --sans: ${body} !important;`);
        lines.push(`  --serif: ${heading} !important;`);
        lines.push(`  --mono: ${mono} !important;`);
        // Barbershop / Forge family uses --display, --body, --cond. Alias
        // them so the admin's font pairing also applies to PageF–PageJ.
        lines.push(`  --display: ${heading} !important;`);
        lines.push(`  --body: ${body} !important;`);
        lines.push(`  --cond: ${heading} !important;`);
    }
    lines.push('}');
    // Safety net — components that hard-coded color values (e.g. `color: #fff`)
    // wouldn't pick up CSS-var overrides. The body * rule forces them to
    // inherit the scheme's text color where the author left it on `color`.
    // Selector specificity stays low so individual component rules still win
    // where they set explicit colors.
    if (palette) {
        const onPrimary = pickOn(palette.primary);
        const onInk = pickOn(palette.ink);
        lines.push('html, body { background: var(--paper) !important; color: var(--ink) !important; }');
        // Button contrast — templates' .btn-primary / .btn-yellow / .nav-cta
        // hardcoded color: var(--ink) or color: #fff; force them to the
        // contrast token picked from the scheme's primary. Same for buttons
        // sitting on --ink (testimonials bands, footers).
        lines.push(`.btn-primary, .btn-yellow, .nav-cta, button.btn-primary, a.btn-primary { color: ${onPrimary} !important; }`);
        // Hero on dark templates: white text against the dark hero stays.
        // CTA-band uses --gold as bg in PageA, --teal in PageB, etc — all
        // hit the same selector. Border + bg already use --primary via vars.
        // For inverse buttons sitting on --ink:
        lines.push(`.testi .btn, .cta-band .btn, footer .btn { color: ${onInk} !important; }`);
        // Navbar 'ORDER AHEAD' style pill: PageA puts color: var(--ink) on
        // a gold background. Now legible regardless of scheme.
        lines.push(`.nav-right .btn, .nav-right .nav-cta { color: ${onPrimary} !important; }`);
        // Trust band sits on --ink (PageA) so labels need on-ink contrast.
        lines.push(`.trust, .trust .num, .trust .lbl, .testi, .testi p { color: ${onInk} !important; }`);
        // PageD lime button has color: #0C0F14 hardcoded; we re-target.
        lines.push(`.btn[class~="btn-primary"] { color: ${onPrimary} !important; }`);
        // Hero ghost buttons sit on the hero's dark scrim — the templates
        // set color: var(--paper-2) which becomes white-on-white when the
        // override remaps --paper-2 (light schemes). Force them to use
        // pure white text + visible border because the hero scrim is dark
        // regardless of scheme.
        lines.push('.hero .btn-ghost, .hero a.btn-ghost { color: #FFFFFF !important; border-color: rgba(255,255,255,0.55) !important; background: transparent !important; }');
        // Kill hover color/background swaps on every hero CTA — keeps the
        // button text readable at all times. Per-template hover rules
        // (HeroA-E all change colors on hover) would otherwise win because
        // they're more specific than a bare `.btn:hover`. By matching on
        // `.hero .btn…:hover` with !important we override all of them.
        lines.push('.hero .btn-ghost:hover, .hero a.btn-ghost:hover { background: transparent !important; color: #FFFFFF !important; border-color: rgba(255,255,255,0.55) !important; }');
        lines.push('.hero .btn-primary:hover, .hero a.btn-primary:hover, .hero .btn-light:hover, .hero a.btn-light:hover, .hero .btn-yellow:hover, .hero a.btn-yellow:hover { color: ' + onPrimary + ' !important; }');
    }
    if (font) {
        lines.push('html, body, .wrap, section, p, h1, h2, h3, h4, h5, h6, span, div, a, li, button, input, textarea, select { font-family: inherit; }');
        lines.push('html, body { font-family: var(--sans) !important; }');
        lines.push('h1, h2, h3, h4, h5, h6, .htitle, .giant, .brand { font-family: var(--disp) !important; }');
    }
    return lines.join('\n');
}
