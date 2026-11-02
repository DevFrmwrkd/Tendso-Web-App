/** Actual-renderer section metadata for the approved business wrappers. */
import fs from 'node:fs';
import path from 'node:path';

const BLOCKS = {
    HERO: { type: 'Hero', gate: 'heroSection', slot: 'hero' },
    TRUST: { type: 'Trust', gate: 'trustBlock', slot: 'highlights' },
    SERVICES: { type: 'Services', gate: 'servicesSection', slot: 'services' },
    ABOUT: { type: 'About', gate: 'aboutSection', slot: 'story' },
    GALLERY: { type: 'Gallery', gate: 'gallerySection', slot: 'gallery' },
    'HOW-IT-WORKS': { type: 'How', gate: 'howItWorksBlock', slot: 'process' },
    FAQ: { type: 'Faq', gate: 'faqBlock', slot: 'faq' },
    LOCATION: { type: 'Location', gate: 'locationBlock', slot: 'visit' },
    FOOTER: { type: 'Footer', gate: 'contactSection', slot: 'footer' },
};

/**
 * Returns null for conventional section-component wrappers. Business wrappers
 * explicitly identify their full-page renderer and list the blocks it draws;
 * the actual renderer's DOM markers and visible slots must agree with that list.
 */
export function businessTemplateBlocks(file) {
    if (path.basename(path.dirname(file)) !== 'business') return null;
    const source = fs.readFileSync(file, 'utf8');
    const declaration = /@template-blocks\s+([^\r\n*]+)/.exec(source)?.[1]?.trim();
    const rendererImport = /from\s+['"](\.\.\/capture-redesign\/(?:Editorial|Immersive|Studio)\.astro)['"]/.exec(source)?.[1];
    if (!declaration || !rendererImport) throw new Error(`Business wrapper lacks renderer metadata: ${file}`);
    const renderer = path.resolve(path.dirname(file), rendererImport);
    const rendered = fs.readFileSync(renderer, 'utf8');
    const declared = declaration.split(/\s+/).map(token => {
        const [block, gate] = token.split(':');
        const definition = BLOCKS[block];
        if (!definition || definition.gate !== gate) throw new Error(`Unknown business block/gate ${token}: ${file}`);
        return { block, ...definition };
    });
    const actual = [...rendered.matchAll(/data-template-block=["']([A-Z-]+)["']/g)].map(match => match[1]);
    if (actual.join('>') !== declared.map(row => row.block).join('>')) {
        throw new Error(`Business section order differs from actual renderer: ${file}\nDeclared: ${declared.map(row => row.block)}\nRendered: ${actual}`);
    }
    for (const row of declared) {
        if (!new RegExp(`\\b(?:b|business)\\.visible\\.${row.slot}\\b`).test(rendered))
            throw new Error(`Business ${row.block} has no actual visibility slot: ${renderer}`);
    }
    return new Map(declared.map(row => [row.type, { comp: `${path.basename(renderer, '.astro')}:${row.block}`, gate: row.gate }]));
}
