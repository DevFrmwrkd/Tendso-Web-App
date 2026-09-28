/**
 * site-theme — the curated palettes and font pairings a generated site is built
 * with, as plain data.
 *
 * These tables were only reachable from the editor before, which meant anything
 * outside the browser that wanted to know what a site LOOKS like had to guess.
 * They live here now because two runtimes need them: the editor's live preview
 * (components/editor/themeOverride.ts, which re-exports from this file) and the
 * offline holding page (lib/holding-page.ts), which is rendered by a Next route
 * AND by a Convex action.
 *
 * ⚠️ SOURCE OF TRUTH: astro-site-template/src/lib/genericThemeOverrides.ts —
 * that file bakes these values into the real site at build time. This is the
 * pure mirror of its tables. Change one, change both, or a site and its holding
 * page will disagree about what colour it is.
 *
 * Pure data and pure functions only. No DOM, no node, no framework imports —
 * Convex bundles this.
 */

export type Palette = {
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

export function parseHex(hex: string): [number, number, number] | null {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return null;
    const v = m[1];
    return [
        parseInt(v.slice(0, 2), 16),
        parseInt(v.slice(2, 4), 16),
        parseInt(v.slice(4, 6), 16),
    ];
}

export function luminance(hex: string): number {
    const rgb = parseHex(hex);
    if (!rgb) return 0.5;
    const lin = rgb.map((c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
}

export function pickOn(bg: string): string {
    return luminance(bg) > 0.5 ? '#0B0B0F' : '#FFFFFF';
}

export const SCHEMES: Record<string, Palette> = {
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


export type FontPairing = { heading: string; body: string; mono?: string; gfontFamily?: string[] };

export const FONT_PAIRINGS: Record<string, FontPairing> = {
    modern: { heading: 'Space Grotesk', body: 'Inter', gfontFamily: ['Space+Grotesk:wght@400;500;600;700', 'Inter:wght@300;400;500;600;700'] },
    classic: { heading: 'Playfair Display', body: 'Source Sans Pro', gfontFamily: ['Playfair+Display:wght@400;500;600;700', 'Source+Sans+Pro:wght@300;400;500;600'] },
    elegant: { heading: 'Cormorant Garamond', body: 'Montserrat', gfontFamily: ['Cormorant+Garamond:wght@400;500;600;700', 'Montserrat:wght@300;400;500;600'] },
    bold: { heading: 'Bebas Neue', body: 'Roboto', gfontFamily: ['Bebas+Neue', 'Roboto:wght@300;400;500;700'] },
    minimal: { heading: 'DM Sans', body: 'DM Sans', gfontFamily: ['DM+Sans:wght@400;500;600;700'] },
    professional: { heading: 'Poppins', body: 'Open Sans', gfontFamily: ['Poppins:wght@400;500;600;700', 'Open+Sans:wght@300;400;500;600'] },
    creative: { heading: 'Righteous', body: 'Nunito', gfontFamily: ['Righteous', 'Nunito:wght@300;400;500;600;700'] },
    tech: { heading: 'Orbitron', body: 'Exo 2', gfontFamily: ['Orbitron:wght@400;500;600;700', 'Exo+2:wght@300;400;500;600'] },
    friendly: { heading: 'Quicksand', body: 'Quicksand', gfontFamily: ['Quicksand:wght@400;500;600;700'] },
    luxury: { heading: 'Cinzel', body: 'Lato', gfontFamily: ['Cinzel:wght@400;500;600;700', 'Lato:wght@300;400;700'] },
    gourmet: { heading: 'Cormorant Garamond', body: 'Montserrat', gfontFamily: ['Cormorant+Garamond:wght@400;500;600;700', 'Montserrat:wght@300;400;500;600'] },
};


export const AUTO_BY_BUSINESS_TYPE: Record<string, string> = {
    barber: 'brown', barbershop: 'brown',
    salon: 'pink', beauty: 'pink', spa: 'pink', nail: 'pink', hair: 'pink', aesthetic: 'pink',
    // Florist family (BR · Bloom) default = pink, the rose the design is built
    // on. ABOVE the retail line on purpose: the fuzzy scan below returns the
    // FIRST key contained in the typed type, and "flower shop" normalises to
    // `flowershop`, which contains retail's `shop`.
    florist: 'pink', flower: 'pink', floral: 'pink', bouquet: 'pink',
    auto: 'orange', autoshop: 'orange', automotive: 'orange', mechanic: 'orange', tire: 'orange', garage: 'orange', carshop: 'orange', carrepair: 'orange',
    restaurant: 'orange', diner: 'orange', eatery: 'orange', bistro: 'orange', food: 'orange',
    cafe: 'orange', coffee: 'brown', roaster: 'brown', tea: 'brown',
    retail: 'brown', store: 'brown', shop: 'brown', boutique: 'brown', apparel: 'brown', clothing: 'brown',
    clinic: 'green', dental: 'green', dentist: 'green', medical: 'green', doctor: 'green', veterinary: 'green', vet: 'green',
    fitness: 'red', gym: 'red', yoga: 'red', pilates: 'red', crossfit: 'red', martialarts: 'red',
    school: 'purple', tutor: 'purple', workshop: 'purple', academy: 'purple', education: 'purple', learning: 'purple',
    trade: 'maroon', service: 'maroon', plumbing: 'maroon', electric: 'maroon', hvac: 'maroon',
    landscaping: 'maroon', cleaning: 'maroon', laundry: 'maroon',
    hotel: 'brown', motel: 'brown', resort: 'brown', villa: 'brown', hostel: 'brown',
    guesthouse: 'brown', homestay: 'brown', staycation: 'brown', apartment: 'brown',
    condo: 'brown', lodge: 'brown', transient: 'brown', airbnb: 'brown', bnb: 'brown', inn: 'brown',
};


/**
 * Resolve an 'auto'/unset scheme to a curated scheme by business type, matching
 * the astro build's resolveAutoScheme so the live preview picks the same colour
 * the rebuild will. Returns '' when unknown (template's native palette wins).
 */
export function resolveAutoScheme(businessType: string | undefined | null): string {
    if (!businessType) return '';
    const k = String(businessType).trim().toLowerCase().replace(/[^a-z]/g, '');
    if (AUTO_BY_BUSINESS_TYPE[k]) return AUTO_BY_BUSINESS_TYPE[k];
    for (const [key, schemeId] of Object.entries(AUTO_BY_BUSINESS_TYPE)) {
        if (k.includes(key)) return schemeId;
    }
    return '';
}


/** The palette a scheme id resolves to, or null when the id is unknown. */
export function getSchemePalette(schemeId: string | undefined | null): Palette | null {
    if (!schemeId) return null;
    return SCHEMES[schemeId] ?? null;
}

/** The font pairing an id resolves to, or null when the id is unknown. */
export function getFontPairing(pairingId: string | undefined | null): FontPairing | null {
    if (!pairingId) return null;
    return FONT_PAIRINGS[pairingId] ?? null;
}

/**
 * The scheme a site is actually built with.
 *
 * Mirrors lib/astro-builder.ts:356 — an explicit id wins, 'auto' (or nothing)
 * falls back to the business type, and an unknown type leaves the template's
 * own palette in place, which is why this can return ''.
 */
export function resolveSchemeId(
    customizations: { colorSchemeId?: string; colorScheme?: string } | null | undefined,
    businessType?: string | null,
): string {
    const explicit = customizations?.colorSchemeId || customizations?.colorScheme || '';
    if (explicit && explicit !== 'auto' && SCHEMES[explicit]) return explicit;
    return resolveAutoScheme(businessType);
}

/** The font pairing a site is built with. Mirrors lib/astro-builder.ts:357. */
export function resolvePairingId(
    customizations: { fontPairingId?: string; fontPairing?: string } | null | undefined,
): string {
    const explicit = customizations?.fontPairingId || customizations?.fontPairing || '';
    return explicit && FONT_PAIRINGS[explicit] ? explicit : 'modern';
}

/** Relative luminance contrast ratio between two hex colours (WCAG). */
export function contrastRatio(a: string, b: string): number {
    const la = luminance(a);
    const lb = luminance(b);
    const [hi, lo] = la > lb ? [la, lb] : [lb, la];
    return (hi + 0.05) / (lo + 0.05);
}

/** Blend two hex colours. `amount` is how much of `a` survives (0–1). */
export function mixHex(a: string, b: string, amount: number): string {
    const ca = parseHex(a);
    const cb = parseHex(b);
    if (!ca || !cb) return a;
    const t = Math.min(1, Math.max(0, amount));
    const out = ca.map((v, i) => Math.round(v * t + cb[i]! * (1 - t)));
    return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** True when a background wants light text on it. */
export function isDarkColor(hex: string): boolean {
    return luminance(hex) <= 0.5;
}
