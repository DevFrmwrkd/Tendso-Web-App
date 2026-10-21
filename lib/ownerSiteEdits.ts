/**
 * Owner site editing — the pure rules (no DB, no framework). Shared by the
 * Convex functions (convex/ownerSiteEdits.ts), the build route and the tests.
 *
 * WHAT AN OWNER MAY CHANGE, and the one idea behind every rule here: an owner's
 * draft is the admin editor's draft (same `extractedContent` + `customizations`
 * shapes, so the same build path renders it), but it comes from a browser we do
 * not trust. So the server never stores what it is handed; it stores what
 * `cleanOwnerDraft` returns:
 *
 *   · Text is plain text. Tags are stripped (a handful of bare inline tags the
 *     generators already emit, like <em>, survive), `javascript:` / `data:`
 *     values are blanked, control characters go.
 *   · A string the owner did NOT change is kept byte-for-byte, so opening the
 *     editor and publishing without touching anything never rewrites a headline
 *     the AI wrote with an <em> in it.
 *   · The facts that live on the submission (business name, phone, email, the
 *     map pin), customer reviews (guarded by the testimonial rules) and the
 *     enhanced-image bookkeeping are put back to what the site already had.
 *   · Design is a closed list: a template code that exists, a colour scheme and
 *     a font pairing the editor offers, a section order drawn from the sections
 *     that template actually renders. Anything else is dropped.
 *   · Sections: an owner can hide what the template lets them hide; the
 *     essentials (hero, services, location, footer) are never hidden.
 */

import { COLOR_SCHEMES, FONT_PAIRINGS, ALL_BLOCKS } from '../components/editor/editorConstants';
import { TEMPLATE_SECTION_ORDER } from '../components/editor/templateSectionOrder.generated';

// ── Limits ────────────────────────────────────────────────────────────────
/** The draft row has to fit a Convex document (1 MiB) with room to spare. */
export const MAX_DRAFT_BYTES = 700_000;
export const MAX_TEXT_LENGTH = 6_000;
export const MAX_DEPTH = 12;
export const MAX_ARRAY_LENGTH = 200;

// ── Design vocabulary ─────────────────────────────────────────────────────
/** The per-section style keys a template pick stamps (mirrors useEditorDraft). */
export const STYLE_KEYS = [
    'aboutStyle', 'servicesStyle', 'galleryStyle', 'contactStyle', 'trustStyle',
    'whyUsStyle', 'howItWorksStyle', 'testimonialsStyle', 'faqStyle',
    'serviceAreaStyle', 'credentialsStyle', 'ctaBandStyle',
] as const;

/** Blocks an owner may never hide. Same set as templateCatalog.BLOCK_TIER 'essential'. */
export const ESSENTIAL_BLOCKS = ['HERO', 'SERVICES', 'LOCATION', 'FOOTER'] as const;
/** Blocks that cannot be moved: the page opens with the hero and ends with the footer. */
export const PINNED_BLOCKS = ['HERO', 'FOOTER'] as const;

const SCHEME_IDS = new Set<string>(COLOR_SCHEMES.map((c) => c.id));
const FONT_IDS = new Set<string>(FONT_PAIRINGS.map((f) => f.id));
const VIS_KEY_TO_BLOCK = new Map<string, string>(ALL_BLOCKS.map((b) => [b.visKey, b.name]));
const ESSENTIAL_VIS_KEYS = new Set<string>(
    ALL_BLOCKS.filter((b) => (ESSENTIAL_BLOCKS as readonly string[]).includes(b.name)).map((b) => b.visKey),
);

export function isKnownTemplate(code: unknown): code is string {
    return typeof code === 'string' && Object.prototype.hasOwnProperty.call(TEMPLATE_SECTION_ORDER, code);
}

/** The letter in a template code: "hospitality:BJ" -> "BJ". */
export function templateLetter(code: string): string {
    return code.split(':')[1] ?? 'A';
}

/** The families whose palette is hand-tuned: "auto" must stay "auto" for them. */
export function isBrandedTemplate(code: string): boolean {
    return !code.startsWith('generic:');
}

/** The blocks a template renders, in page order (HERO first, FOOTER last). */
export function templateBlocks(code: string | undefined | null): string[] {
    return code && isKnownTemplate(code) ? [...TEMPLATE_SECTION_ORDER[code]] : [];
}

/**
 * A stored section order, made safe for a template: only blocks the template
 * renders and may move, each once, with anything missing appended in page
 * order. Returns [] (= "the template's own order") when nothing was customised.
 */
export function cleanSectionOrder(order: unknown, code: string | undefined | null): string[] {
    if (!Array.isArray(order)) return [];
    const movable = templateBlocks(code).filter((b) => !(PINNED_BLOCKS as readonly string[]).includes(b));
    const wanted = new Set(movable);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of order) {
        if (typeof raw !== 'string' || !wanted.has(raw) || seen.has(raw)) continue;
        seen.add(raw);
        out.push(raw);
    }
    if (out.length === 0) return [];
    for (const b of movable) if (!seen.has(b)) out.push(b);
    // An order identical to the template's own is not a customisation.
    return out.every((b, i) => b === movable[i]) ? [] : out;
}

// ── Text ──────────────────────────────────────────────────────────────────
const ALLOWED_INLINE = /<\/?(?:em|strong|b|i|br)\s*\/?>/gi;

/** Plain text with the bare inline tags the generators emit left alone. */
export function cleanText(input: string, max = MAX_TEXT_LENGTH): string {
    let s = input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
    // Park the allowed tags, drop every other tag, then bring them back.
    const kept: string[] = [];
    s = s.replace(ALLOWED_INLINE, (m) => { kept.push(m.toLowerCase().replace(/\s+/g, '')); return `\u0001${kept.length - 1}\u0002`; });
    // A tag starts with `<` and a letter, `/`, `!` or `?`; a lone `<` is just a character.
    s = s.replace(/<[/!?]?[A-Za-z][^>]*>?/g, '').replace(/[<>]/g, '');
    // Unbalanced inline tags (a stray </em> left after its opener was stripped)
    // would bleed into the next element: keep them only when every one pairs up.
    const balanced = (['em', 'strong', 'b', 'i'] as const).every((t) => {
        const open = kept.filter((k) => k === `<${t}>`).length;
        const close = kept.filter((k) => k === `</${t}>`).length;
        return open === close;
    });
    s = s.replace(/\u0001(\d+)\u0002/g, (_m, i: string) => {
        const tag = kept[Number(i)] ?? '';
        return balanced || /^<br\s*\/?>$/.test(tag) ? tag : '';
    });
    if (s.length > max) s = s.slice(0, max);
    return s;
}

/** A value that could execute or smuggle a payload when it lands in href/src. */
export function isUnsafeUrl(value: string): boolean {
    return /^\s*(?:javascript|vbscript|data|file|blob):/i.test(value.replace(/[\u0000- ]/g, ''));
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
/** Convex reserves `$`-keys; anything else a site already holds stays. */
const isSafeKey = (k: string) => k.length > 0 && k.length <= 200 && !k.startsWith('$') && !FORBIDDEN_KEYS.has(k);

/**
 * Deep-clean `next`, comparing against `base` so an unchanged string is kept
 * exactly as it was. Throws OwnerDraftError for shapes we refuse outright.
 */
export function cleanAgainst(next: unknown, base: unknown, depth = 0): unknown {
    if (depth > MAX_DEPTH) throw new OwnerDraftError('That page is nested too deeply.');
    if (next === null || next === undefined) return next ?? undefined;
    if (typeof next === 'string') {
        if (typeof base === 'string' && base === next) return next;
        if (isUnsafeUrl(next)) return '';
        return cleanText(next);
    }
    if (typeof next === 'number') return Number.isFinite(next) ? next : undefined;
    if (typeof next === 'boolean') return next;
    if (Array.isArray(next)) {
        if (next.length > MAX_ARRAY_LENGTH) throw new OwnerDraftError('One of the lists is too long.');
        const baseArr = Array.isArray(base) ? base : [];
        return next.map((item, i) => {
            const v = cleanAgainst(item, baseArr[i], depth + 1);
            // JSON turns holes into null; never store a hole.
            return v === undefined ? null : v;
        });
    }
    if (typeof next === 'object') {
        const out: Record<string, unknown> = {};
        const baseObj = base && typeof base === 'object' && !Array.isArray(base) ? (base as Record<string, unknown>) : {};
        for (const [k, v] of Object.entries(next as Record<string, unknown>)) {
            if (!isSafeKey(k)) continue;
            const cleaned = cleanAgainst(v, baseObj[k], depth + 1);
            if (cleaned !== undefined) out[k] = cleaned;
        }
        return out;
    }
    return undefined; // functions, symbols, bigint
}

export class OwnerDraftError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'OwnerDraftError';
    }
}

/** Top-level content keys an owner cannot change: the live site's own value is put back. */
export const LOCKED_CONTENT_KEYS = [
    'business_name', 'business_type', 'contact', 'googleMapsUrl', 'messaging',
    'testimonials', 'enhancedImages', 'favicon', 'ogImage',
] as const;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

/** The content an owner may save: cleaned, with the locked facts restored from `base`. */
export function cleanOwnerContent(next: unknown, base: unknown): Obj {
    if (!isObj(next)) throw new OwnerDraftError('Nothing to save.');
    const baseObj: Obj = isObj(base) ? base : {};
    const cleaned = cleanAgainst(next, baseObj) as Obj;

    for (const key of LOCKED_CONTENT_KEYS) {
        if (key in baseObj) cleaned[key] = baseObj[key];
        else delete cleaned[key];
    }
    // The map pin is a fact about the shop, not text on the page.
    if (isObj(cleaned.location)) {
        const baseLoc = isObj(baseObj.location) ? baseObj.location : {};
        const loc: Obj = { ...cleaned.location };
        for (const k of ['lat', 'lng']) {
            if (k in baseLoc) loc[k] = baseLoc[k]; else delete loc[k];
        }
        cleaned.location = loc;
    }
    // Section visibility: known keys, booleans, essentials always on.
    if (cleaned.visibility !== undefined) {
        const vis: Obj = {};
        if (isObj(cleaned.visibility)) {
            for (const [k, v] of Object.entries(cleaned.visibility)) {
                if (!VIS_KEY_TO_BLOCK.has(k) || typeof v !== 'boolean') continue;
                if (ESSENTIAL_VIS_KEYS.has(k) && v === false) continue;
                vis[k] = v;
            }
        }
        cleaned.visibility = vis;
    }
    if (JSON.stringify(cleaned).length > MAX_DRAFT_BYTES) {
        throw new OwnerDraftError('That is too much to save at once. Try fewer changes.');
    }
    return cleaned;
}

/**
 * The customizations an owner may save. Starts from the live site's own
 * customizations (so roleColors and every key an owner cannot touch are kept)
 * and applies only: template, colour scheme, font pairing, section order.
 */
export function cleanOwnerCustomizations(next: unknown, base: unknown): Obj {
    const baseObj: Obj = isObj(base) ? { ...base } : {};
    const want: Obj = isObj(next) ? next : {};
    const out: Obj = { ...baseObj };

    const baseHero = typeof baseObj.heroStyle === 'string' ? baseObj.heroStyle : '';
    let hero = baseHero;
    if (typeof want.heroStyle === 'string' && isKnownTemplate(want.heroStyle)) hero = want.heroStyle;

    if (hero && hero !== baseHero) {
        // A template pick: stamp it the way the editor's picker does.
        out.heroStyle = hero;
        for (const k of STYLE_KEYS) out[k] = hero;
        out.navbarStyle = templateLetter(hero);
        if (isBrandedTemplate(hero)) {
            out.colorScheme = 'auto'; out.colorSchemeId = 'auto';
            out.fontPairing = 'auto'; out.fontPairingId = 'auto';
        }
    }

    const scheme = pickId(want.colorScheme ?? want.colorSchemeId, SCHEME_IDS);
    // After a template switch the new template's own look is the default; an
    // explicit scheme in the same save still wins.
    const switched = hero !== baseHero;
    if (scheme !== undefined && (!switched || scheme !== (baseObj.colorScheme ?? baseObj.colorSchemeId))) {
        out.colorScheme = scheme; out.colorSchemeId = scheme;
    }
    const font = pickId(want.fontPairing ?? want.fontPairingId, FONT_IDS);
    if (font !== undefined && (!switched || font !== (baseObj.fontPairing ?? baseObj.fontPairingId))) {
        out.fontPairing = font; out.fontPairingId = font;
    }

    const order = cleanSectionOrder(want.sectionOrder, hero || baseHero);
    if (order.length) out.sectionOrder = order; else delete out.sectionOrder;
    return out;
}

function pickId(v: unknown, allowed: Set<string>): string | undefined {
    return typeof v === 'string' && allowed.has(v) ? v : undefined;
}

/** A cleaned owner draft: content + customizations. */
export function cleanOwnerDraft(
    input: { content: unknown; customizations: unknown },
    base: { content: unknown; customizations: unknown },
): { content: Obj; customizations: Obj } {
    const customizations = cleanOwnerCustomizations(input.customizations, base.customizations);
    const content = cleanOwnerContent(input.content, base.content);
    // A hidden section a template does not render is meaningless; drop its flag.
    const blocks = new Set(templateBlocks(String(customizations.heroStyle ?? '')));
    if (blocks.size && isObj(content.visibility)) {
        const vis: Obj = {};
        for (const [k, v] of Object.entries(content.visibility)) {
            const block = VIS_KEY_TO_BLOCK.get(k);
            if (block && (blocks.has(block) || v === true)) vis[k] = v;
        }
        content.visibility = vis;
    }
    return { content, customizations };
}

/** Stable, key-order-independent equality for drafts (Convex does not keep key order). */
export function sameJson(a: unknown, b: unknown): boolean {
    return canonical(a) === canonical(b);
}
function canonical(v: unknown): string {
    if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
    if (isObj(v)) {
        return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
    }
    return JSON.stringify(v) ?? 'null';
}

/**
 * Photos: image URLs an owner may put in a slot. https only — uploads go through
 * Convex storage, originals and polished renders are https URLs already.
 */
export function isAllowedImageUrl(value: unknown): value is string {
    return typeof value === 'string' && /^https:\/\/[^\s"'<>]+$/i.test(value) && value.length < 2048;
}
