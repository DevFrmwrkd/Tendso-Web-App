/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

import { applySectionOrder, movableBlocks } from '../../lib/sectionOrder';

const page = (sections: string) => `<!DOCTYPE html><html><head><title>t</title></head><body>
<header><a data-field="nav.brand">Forge</a></header>
<main>${sections}</main>
<footer data-field="footer.brand">Forge <p data-field="footer.blurb">bye</p></footer>
</body></html>`;

const SECTIONS = `
<section id="hero"><h1 data-field="hero.headline">Hi</h1></section>
<div class="divider">---</div>
<section id="about"><p data-field="about.lead">About</p><p data-field="about.role">r</p></section>
<section id="services"><h2 data-field="services.headline">Services</h2></section>
<section id="faq"><h2 data-field="faq.headline">FAQ</h2></section>
<section id="location"><p data-field="location.address">Addr</p></section>
<script>window.keep = 1</script>`;

const ids = (html: string) => cheerio.load(html)('main > *').toArray().map((el) => (el as any).attribs?.id ?? (el as any).name);

describe('movableBlocks', () => {
    it('lists the sections that share a parent, in page order, never the hero or footer', () => {
        expect(movableBlocks(page(SECTIONS))).toEqual(['ABOUT', 'SERVICES', 'FAQ', 'LOCATION']);
    });
    it('is empty for a page with nothing to move', () => {
        expect(movableBlocks(page('<section><h1 data-field="hero.headline">x</h1></section>'))).toEqual([]);
        expect(movableBlocks('')).toEqual([]);
    });
});

describe('applySectionOrder', () => {
    it('deals the sections into their own slots in the new order and leaves everything else in place', () => {
        const out = applySectionOrder(page(SECTIONS), ['FAQ', 'LOCATION', 'ABOUT', 'SERVICES']);
        expect(ids(out)).toEqual(['hero', 'div', 'faq', 'location', 'about', 'services', 'script']);
        expect(out).toContain('window.keep = 1');
        expect(out).toContain('data-field="footer.brand"');
    });

    it('keeps the sections it was not told about after the ones it was, in their old order', () => {
        const out = applySectionOrder(page(SECTIONS), ['FAQ', 'LOCATION']);
        expect(ids(out)).toEqual(['hero', 'div', 'faq', 'location', 'about', 'services', 'script']);
    });

    it('returns the page untouched when the order is the page\'s own, empty, or unusable', () => {
        const html = page(SECTIONS);
        expect(applySectionOrder(html, ['ABOUT', 'SERVICES', 'FAQ', 'LOCATION'])).toBe(html);
        expect(applySectionOrder(html, [])).toBe(html);
        expect(applySectionOrder(html, null)).toBe(html);
        expect(applySectionOrder(html, ['NOPE', 'ALSO-NOPE'])).toBe(html);
        expect(applySectionOrder('', ['FAQ', 'ABOUT'])).toBe('');
    });

    it('never loses a section: the same ids, once each', () => {
        const out = applySectionOrder(page(SECTIONS), ['LOCATION', 'FAQ', 'SERVICES', 'ABOUT']);
        expect([...ids(out)].sort()).toEqual([...ids(page(SECTIONS))].sort());
    });
});

describe('on a real built template (florist:BR has data-field hooks)', () => {
    const file = path.join(__dirname, '../../public/template-previews/br.html');
    const html = fs.readFileSync(file, 'utf8');

    it('reorders without losing any section or field hook', () => {
        const movable = movableBlocks(html);
        if (movable.length < 2) return; // this template keeps its sections where they are
        const reversed = [...movable].reverse();
        const out = applySectionOrder(html, reversed);
        expect(movableBlocks(out)).toEqual(reversed);
        const count = (h: string) => (h.match(/data-field=/g) ?? []).length;
        expect(count(out)).toBe(count(html));
    });
});
