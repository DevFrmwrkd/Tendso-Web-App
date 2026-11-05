/**
 * Section order — move the sections of a BUILT page around.
 *
 * Templates render their sections in a fixed order (the wrappers are .astro
 * files; scripts/gen-template-sections.mjs reads that order into
 * templateSectionOrder.generated.ts). Owners may reorder the sections they can
 * see, so this works on the built HTML, after the template has done its job:
 *
 *   applySectionOrder(html, ["FAQ", "ABOUT", ...])  -> html
 *
 * Used twice, so the preview and the published page cannot disagree: by
 * app/api/generate-website when a site has `customizations.sectionOrder`, and by
 * the owner editor's preview. A site with no `sectionOrder` never reaches this.
 *
 * HOW A SECTION IS FOUND is the editor bridge's own rule (see
 * components/editor/editorBridge.ts `ed:section-visibility`): every element
 * carrying a data-field / data-image-field under the block's prefix votes for
 * its enclosing <section>/<footer> (or an explicit data-block marker), and the
 * richest candidate wins. Reusing it means "hide" and "move" always grab the
 * same element.
 *
 * WHAT MOVES: only sections that are siblings under one parent. Their SLOTS stay
 * where they are and the sections are dealt into the slots in the new order, so
 * everything that is not a movable section (header, marquee strips, dividers,
 * scripts, the hero, the footer) keeps its place. A template whose sections are
 * not siblings simply reports fewer movable sections — it never breaks.
 */

import * as cheerio from 'cheerio';
import type { AnyNode, Element } from 'domhandler';

/** Block name -> the data-field prefix its section's hooks start with. */
export const BLOCK_PREFIX: Record<string, string> = {
    'HERO': 'hero',
    'MARQUEE': 'marquee',
    'TRUST': 'trust',
    'ABOUT': 'about',
    'SERVICES': 'services',
    'WHY-US': 'why',
    'HOW-IT-WORKS': 'how',
    'TESTIMONIALS': 'testimonials',
    'GALLERY': 'gallery',
    'FAQ': 'faq',
    'SERVICE-AREA': 'area',
    'CREDENTIALS': 'credentials',
    'LOCATION': 'location',
    'CTA-BAND': 'ctaBand',
    'FOOTER': 'footer',
};

/** The page's opening and closing sections: never moved. */
const PINNED = new Set(['HERO', 'FOOTER']);

type $ = cheerio.CheerioAPI;

function resolveHost($: $, prefix: string): Element | null {
    const sel = `[data-field^="${prefix}."],[data-image-field^="${prefix}."],[data-field="${prefix}"]`;
    const votes = new Map<Element, number>();
    $(sel).each((_, el) => {
        const marked = $(el).closest(`[data-block="${prefix}"]`)[0];
        const host = (marked ?? $(el).closest('section,footer')[0]) as Element | undefined;
        if (!host) return;
        votes.set(host, (votes.get(host) ?? 0) + 1);
    });
    let best: Element | null = null;
    let n = 0;
    for (const [host, count] of votes) if (count > n) { best = host; n = count; }
    return best;
}

interface Resolved {
    $: $;
    /** Movable blocks, in the page's current order. */
    blocks: string[];
    hosts: Map<string, Element>;
    parent: AnyNode | null;
}

function resolve(html: string): Resolved {
    const $ = cheerio.load(html);
    const hosts = new Map<string, Element>();
    for (const [block, prefix] of Object.entries(BLOCK_PREFIX)) {
        if (PINNED.has(block)) continue;
        const host = resolveHost($, prefix);
        if (host) hosts.set(block, host);
    }
    // The movable set is the largest group of sections sharing one parent.
    const byParent = new Map<AnyNode, string[]>();
    for (const [block, host] of hosts) {
        const p = host.parent;
        if (!p) continue;
        byParent.set(p, [...(byParent.get(p) ?? []), block]);
    }
    let parent: AnyNode | null = null;
    let group: string[] = [];
    for (const [p, blocks] of byParent) if (blocks.length > group.length) { parent = p; group = blocks; }
    if (!parent || group.length < 2) return { $, blocks: [], hosts: new Map(), parent: null };
    // A host that is a descendant of another movable host cannot be dealt separately.
    const usable = group.filter((b) => !group.some((o) => o !== b && hosts.get(o)!.children.includes(hosts.get(b)!)));
    const siblings = (parent as Element).children;
    usable.sort((a, b) => siblings.indexOf(hosts.get(a)!) - siblings.indexOf(hosts.get(b)!));
    return { $, blocks: usable, hosts, parent };
}

/** The sections of this built page an owner can move, in page order. */
export function movableBlocks(html: string): string[] {
    if (!html) return [];
    try { return resolve(html).blocks; } catch { return []; }
}

/**
 * Reorder the movable sections of `html` to follow `order`. Blocks missing from
 * `order` keep their relative position after the ones it names. Returns the
 * input unchanged when there is nothing to do.
 */
export function applySectionOrder(html: string, order: readonly string[] | null | undefined): string {
    if (!html || !order || order.length < 2) return html;
    try {
        const { $, blocks, hosts } = resolve(html);
        if (blocks.length < 2) return html;
        const rank = (b: string) => { const i = order.indexOf(b); return i === -1 ? Number.MAX_SAFE_INTEGER : i; };
        // Stable: unnamed blocks stay in their current relative order.
        const target = blocks.map((b, i) => ({ b, i })).sort((x, y) => rank(x.b) - rank(y.b) || x.i - y.i).map((x) => x.b);
        if (target.every((b, i) => b === blocks[i])) return html;

        // Mark each slot, take every section out, deal them back in the new order.
        const els = target.map((b) => hosts.get(b)!);
        blocks.forEach((b, i) => $(hosts.get(b)!).before(`<tendso-slot data-slot="${i}"></tendso-slot>`));
        blocks.forEach((b) => $(hosts.get(b)!).remove());
        els.forEach((el, i) => { $(`tendso-slot[data-slot="${i}"]`).replaceWith(el); });
        return $.html();
    } catch {
        // Never lose a page over a reorder.
        return html;
    }
}
