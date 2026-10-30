import { affiliatePhotoError } from './affiliates';
import { WEBSITE_PRICE, clampSellPrice, formatPHP } from '../packages/shared/pricing';

/** One print layout for native PNG export and the browser's A4 print sheet. */
export const POSTER_PAGE = {
    width: 595.276,
    height: 841.89,
    exportWidth: 2480,
    exportHeight: 3508,
    margin: 34,
    background: '#FFFFFF',
} as const;

export type AffiliatePosterInput = {
    handle: string;
    displayName: string;
    photo?: string | null;
    price: number;
    referralCode?: string | null;
};

export type AffiliatePosterModel = {
    url: string;
    name: string;
    photo: string | null;
    code: string | null;
    price: number;
    priceLabel: string;
    listPriceLabel: string;
    saving: number;
    savingLabel: string;
    hasDiscount: boolean;
};

/** Callers supply saved page/price baselines, never editor drafts or private account records. */
export function createAffiliatePoster(input: AffiliatePosterInput): AffiliatePosterModel {
    const price = clampSellPrice(Number.isFinite(input.price) ? input.price : WEBSITE_PRICE);
    const saving = Math.max(0, WEBSITE_PRICE - price);
    const photo = input.photo?.trim();
    return {
        url: `https://tendso.com/v2/a/${encodeURIComponent(input.handle.trim())}`,
        name: input.displayName.trim().replace(/\s+/g, ' ') || 'Tendso creator',
        photo: photo && !affiliatePhotoError(photo) ? photo : null,
        code: input.referralCode?.trim() || null,
        price,
        priceLabel: formatPHP(price),
        listPriceLabel: formatPHP(WEBSITE_PRICE),
        saving,
        savingLabel: formatPHP(saving),
        hasDiscount: saving > 0,
    };
}

type PosterRect = { kind: 'rect'; id: string; x: number; y: number; width: number; height: number; fill: string; radius?: number; stroke?: string; strokeWidth?: number };
type PosterText = { kind: 'text'; id: string; text: string; x: number; y: number; fontSize: number; weight: 400 | 500 | 600 | 700; fill: string; anchor?: 'start' | 'middle' | 'end' };
type PosterImage = { kind: 'image'; id: 'brand' | 'photo'; x: number; y: number; width: number; height: number; href: string; radius?: number };
type PosterQr = { kind: 'qr'; id: string; x: number; y: number; size: number; value: string };
export type PosterNode = PosterRect | PosterText | PosterImage | PosterQr;

const INK = '#0C0A08';
const MUTED = '#4A4943';
const RULE = '#D8D8D0';
const M = POSTER_PAGE.margin;
const RIGHT = POSTER_PAGE.width - M;

// Conservative advance estimates keep longer saved names/codes inside the same print area.
function units(text: string): number {
    return Array.from(text).reduce((total, char) => total + (
        /[MW@%]/.test(char) ? .98 : /[ilI1\s.,'|]/.test(char) ? .34 : /[A-Z0-9]/.test(char) ? .74 : /[a-z]/.test(char) ? .64 : 1
    ), 0);
}

function wrap(text: string, maxUnits: number): string[] {
    const lines: string[] = [];
    let line = '';
    for (const char of Array.from(text)) {
        if (line && units(line + char) > maxUnits) { lines.push(line.trim()); line = ''; }
        line += char;
    }
    if (line) lines.push(line.trim());
    return lines;
}

/** All text uses alphabetic SVG baselines in A4 point coordinates. */
export function boldOfferPosterScene(model: AffiliatePosterModel): PosterNode[] {
    const nodes: PosterNode[] = [];
    const rect = (id: string, x: number, y: number, width: number, height: number, fill: string, radius?: number) =>
        nodes.push({ kind: 'rect', id, x, y, width, height, fill, ...(radius ? { radius } : {}) });
    const text = (id: string, value: string, x: number, top: number, fontSize: number, weight: PosterText['weight'] = 500, fill = INK, anchor?: PosterText['anchor']) =>
        nodes.push({ kind: 'text', id, text: value, x, y: top + fontSize * .97, fontSize, weight, fill, ...(anchor ? { anchor } : {}) });

    rect('paper', 0, 0, POSTER_PAGE.width, POSTER_PAGE.height, POSTER_PAGE.background);
    nodes.push({ kind: 'image', id: 'brand', x: M, y: 35, width: 30, height: 30, href: '/v2/brand/mark-ink-256.png' });
    text('brand-name', 'tendso', M + 39, 36, 29, 600);
    text('audience', 'FOR LOCAL SHOPS', RIGHT, 47, 9, 600, MUTED, 'end');
    text('eyebrow', 'MADE FROM YOUR PHONE', M, 110, 10, 600, MUTED);
    text('headline-shop', 'Your shop', M, 135, 72, 600);
    text('headline-online', 'online.', M, 204, 72, 600);
    text('ownership', 'Pay once, own it.', M, 291, 31);
    rect('offer', M, 352, RIGHT - M, 123, '#E4F222', 20);
    text('price-caption', 'ONE-TIME WEBSITE PRICE', M + 21, 369, 10, 600);
    text('price', model.priceLabel, M + 19, 389, 61, 600);
    if (model.hasDiscount) {
        text('list-price', model.listPriceLabel, RIGHT - 116, 405, 19, 400, MUTED);
        rect('list-price-strike', RIGHT - 116, 417, 74, .8, MUTED);
        text('saving', `Save ${model.savingLabel}`, RIGHT - 116, 438, 12);
    }
    text('preview-before-payment', 'See it first. Pay to publish.', M, 498, 20);
    nodes.push({ kind: 'qr', id: 'shop-page-qr', x: M - 5, y: 549, size: 159, value: model.url });
    text('scan-first', 'Scan to see your', M + 181, 552, 25, 600);
    text('scan-second', 'website offer.', M + 181, 582, 25, 600);

    if (model.code) {
        text('code-caption', 'CREATOR CODE', M + 181, 637, 9, 600, MUTED);
        const maxWidth = RIGHT - (M + 181);
        // Current codes are 4–16 characters; historical codes are preserved in full too.
        const codeFont = Math.min(28, Math.max(9, maxWidth / units(model.code)));
        const codeLines = wrap(model.code, maxWidth / codeFont);
        const safeFont = codeLines.length > 2 ? Math.min(codeFont, maxWidth * 2 / units(model.code)) : codeFont;
        wrap(model.code, maxWidth / safeFont).forEach((part, index) => text(`creator-code-${index}`, part, M + 181, 654 + index * (safeFont + 2), safeFont, 600));
        text('code-instruction-first', 'Enter this code before you pay', M + 181, 704, 11, 400, MUTED);
        text('code-instruction-second', 'to use this website price.', M + 181, 720, 11, 400, MUTED);
    }

    rect('footer-rule', M, 744, RIGHT - M, .8, RULE);
    if (model.photo) {
        nodes.push({ kind: 'image', id: 'photo', x: M, y: 757, width: 29, height: 29, href: model.photo, radius: 14.5 });
    } else {
        rect('avatar-background', M, 757, 29, 29, '#F1F3D4', 14.5);
        text('avatar-initial', Array.from(model.name)[0]?.toUpperCase() || 'T', M + 14.5, 762, 15, 600, INK, 'middle');
    }
    const byline = `Shared by ${model.name}`;
    const footerWidth = RIGHT - (M + 39);
    const nameFont = Math.min(12, Math.max(8, footerWidth / units(byline)));
    const nameLines = wrap(byline, footerWidth / nameFont);
    const fittedNameFont = nameLines.length > 2 ? footerWidth * 2 / units(byline) : nameFont;
    wrap(byline, footerWidth / fittedNameFont).forEach((part, index) => text(`byline-${index}`, part, M + 39, nameLines.length > 1 ? 751 + index * 12 : 757, fittedNameFont, 500));
    const displayUrl = model.url.replace(/^https:\/\//, '');
    const urlFont = Math.min(10, footerWidth / units(displayUrl));
    text('page-link', displayUrl, M + 39, 781, urlFont, 400, MUTED);
    text('current-offer', 'See the current offer at the link.', M, 797, 8, 400, MUTED);
    return nodes;
}
