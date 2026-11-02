#!/usr/bin/env node
/**
 * Exercise the REAL production router, including every legacy template import
 * and its CSS, against fictional edited content. The shared site-data file is
 * neither read nor written. Builds are isolated under output/ and the review
 * HTML is retained at output/business-production-check/ for browser inspection.
 *
 * node scripts/check-business-templates.mjs --astro-node-modules <directory>
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { spawn } from 'node:child_process';
import { build as bundle } from 'esbuild';
import { load } from 'cheerio';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASTRO = path.join(ROOT, 'astro-site-template');
const SOURCE = path.join(ASTRO, 'src');
const SCRATCH = path.join(ROOT, 'output');
const OUTPUT = path.join(SCRATCH, 'business-production-check');
const BLOCKS = ['HERO', 'TRUST', 'SERVICES', 'ABOUT', 'GALLERY', 'HOW-IT-WORKS', 'FAQ', 'LOCATION', 'FOOTER'];
const PHOTO = '/capture-previews/photos/law-office-sample-v1.webp';
const GALLERY_PHOTO = '/capture-previews/photos/clinic-redesign-v1.webp';
const inside = (parent, child) => {
    const relative = path.relative(parent, child);
    return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};

/** Canonical transformed Astro data, not the board's old aliases or customer data. */
function fixture(code, hidden = false) {
    const name = hidden ? 'Fictional QA Clinic' : 'Fictional QA Legal Office';
    return {
        layout: {
            businessName: name, tagline: 'QA edited introductory copy.', colorScheme: 'auto', fontPairing: 'auto',
            contact: { phone: '+639000000011', address: 'Old fictional contact address', email: 'qa-office@example.test' },
        },
        customizations: { heroStyle: code },
        visibility: hidden ? {
            heroImage: false, trustBlock: false, servicesSection: false, aboutSection: false,
            gallerySection: false, howItWorksBlock: false, faqBlock: false, locationBlock: false, contactSection: false,
        } : {},
        content: {
            business_name: name, business_type: hidden ? 'Clinic' : 'Law Office', business_city: 'QA Sample City',
            hero: {
                kicker: 'QA edited eyebrow', headline: 'QA edited headline for a real production route.',
                sub: 'QA edited introductory copy.', image: PHOTO,
                cta1: { text: 'QA arrange a visit', href: '#visit' },
            },
            trust: { cells: [{ label: 'QA edited trust label' }] },
            services: { headline: 'QA edited services heading', items: [
                { title: 'QA edited service title', desc: 'QA edited service description.', note: 'QA edited service note', price: 'QA agreed fee' },
            ] },
            about: { headline: 'QA edited story heading', lead: 'QA edited story lead.', paragraphs: ['QA edited story paragraph.'] },
            gallery: { headline: 'QA edited gallery heading', items: [
                { image: GALLERY_PHOTO, caption: 'QA edited image caption', alt: 'Fictional QA room' },
            ] },
            how: { headline: 'QA edited process heading', steps: [{ title: 'QA edited process title', body: 'QA edited process body.' }] },
            faq: { headline: 'QA edited FAQ heading', items: [{ q: 'QA edited question?', a: 'QA edited answer.' }] },
            location: {
                headline: 'QA edited visit heading', phone: '+639000000022', address: 'QA edited fictional address',
                hours: 'QA weekday appointments',
            },
            contact: { email: 'qa-office@example.test' },
            footer: { brand: 'QA edited footer brand', blurb: 'QA edited footer copy.' },
        },
    };
}

const CASES = [
    { id: 'law-editorial', code: 'business:CP', layout: 'editorial', kind: 'law' },
    { id: 'law-immersive', code: 'business:CQ', layout: 'immersive', kind: 'law' },
    { id: 'law-studio', code: 'business:CR', layout: 'studio', kind: 'law' },
    { id: 'clinic-hidden', code: 'business:CM', layout: 'editorial', kind: 'clinic', hidden: true },
    { id: 'legacy-barber', code: 'barbershop:F', page: 'F' },
    { id: 'legacy-generic', code: 'generic:A', page: 'A' },
];

function verify(html, testCase, data) {
    const $ = load(html);
    const text = value => String(value ?? '').replace(/\s+/g, ' ').trim();
    assert.equal($('html').length, 1, `${testCase.id}: multiple page wrappers rendered`);
    assert.ok(text($('title').text()).includes(data.layout.businessName), `${testCase.id}: document identity lost`);
    if (testCase.page) {
        assert.equal($('html').attr('data-page'), testCase.page, `${testCase.id}: legacy router no longer dispatches`);
        assert.equal($('[data-capture-layout]').length, 0, `${testCase.id}: new template leaked into legacy page`);
        return;
    }
    assert.equal($('html').attr('data-template-code'), testCase.code, `${testCase.id}: canonical template identity lost`);
    assert.equal($('html').attr('data-capture-layout'), testCase.layout, `${testCase.id}: wrong layout`);
    assert.equal($('html').attr('data-capture-kind') ?? $('html').attr('data-business-kind'), testCase.kind, `${testCase.id}: wrong business category`);
    assert.equal($('h1').length, 1, `${testCase.id}: expected one real headline`);
    assert.equal(text($('[data-field="hero.headline"]').text()), data.content.hero.headline, `${testCase.id}: edited headline lost`);
    assert.equal($('meta[name="description"]').attr('content'), data.content.hero.sub, `${testCase.id}: SEO description lost`);
    assert.equal($('[data-template-block]').map((_index, element) => $(element).attr('data-template-block')).get().join(','),
        (testCase.hidden ? ['HERO'] : BLOCKS).join(','), `${testCase.id}: section membership/order or editor visibility lost`);
    const ids = $('[id]').map((_index, element) => $(element).attr('id')).get();
    assert.equal(new Set(ids).size, ids.length, `${testCase.id}: duplicate rendered IDs`);
    for (const href of $('a[href]').map((_index, element) => $(element).attr('href')).get())
        if (href?.startsWith('#') && href.length > 1) assert.ok(ids.includes(href.slice(1)), `${testCase.id}: anchor ${href} targets a hidden/missing section`);
    if (testCase.hidden) {
        assert.equal($('img[data-image-field="hero.image"]').length, 0, `${testCase.id}: hidden hero photo still rendered`);
        for (const value of ['QA edited service title', 'QA edited story paragraph.', 'QA edited question?', 'QA edited fictional address'])
            assert.ok(!text($('body').clone().find('style,script').remove().end().text()).includes(value), `${testCase.id}: hidden content leaked: ${value}`);
        return;
    }
    const expectedFields = {
        'services.items.0.title': 'QA edited service title', 'services.items.0.desc': 'QA edited service description.',
        'services.items.0.note': 'QA edited service note', 'about.paragraphs.0': 'QA edited story paragraph.',
        'gallery.items.0.caption': 'QA edited image caption', 'how.steps.0.body': 'QA edited process body.',
        'faq.items.0.q': 'QA edited question?', 'faq.items.0.a': 'QA edited answer.',
        'location.address': 'QA edited fictional address', 'location.hours': 'QA weekday appointments',
    };
    for (const [field, value] of Object.entries(expectedFields))
        assert.ok($(`[data-field="${field}"]`).toArray().some(element => text($(element).text()) === value), `${testCase.id}: actual editable field ${field} lost`);
    assert.equal($('img[data-image-field="hero.image"]').attr('src'), PHOTO, `${testCase.id}: edited hero image lost`);
    assert.equal($('img[data-image-field="gallery.items.0.image"]').attr('src'), GALLERY_PHOTO, `${testCase.id}: edited gallery image lost`);
    assert.ok($('a[href="tel:+639000000022"]').length > 0, `${testCase.id}: edited phone lost to stale layout contact`);
    assert.ok(!text($('body').text()).includes('[object Object]'), `${testCase.id}: object rendered instead of copy`);
}

async function standalone(source, dist) {
    let html = source.replace(/\r\n/g, '\n');
    for (const match of [...html.matchAll(/<link\b[^>]*href=["'](\/_astro\/[^"']+\.css)["'][^>]*>/g)]) {
        const css = await fs.readFile(path.join(dist, match[1]), 'utf8');
        html = html.replace(match[0], `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`);
    }
    for (const match of [...html.matchAll(/<script\b[^>]*src=["'](\/_astro\/[^"']+\.js)["'][^>]*>\s*<\/script>/g)]) {
        const result = await bundle({ entryPoints: [path.join(dist, match[1])], bundle: true, write: false, format: 'iife', platform: 'browser', target: ['es2020'], minify: true, legalComments: 'none' });
        html = html.replace(match[0], `<script type="module">${result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script>`);
    }
    assert.ok(!/(?:href|src)=["']\/_astro\//.test(html), 'Unresolved build asset in production-route review page');
    return html;
}

async function main() {
    const { values } = parseArgs({ options: { 'astro-node-modules': { type: 'string' } } });
    const modules = path.resolve(values['astro-node-modules'] ?? path.join(ASTRO, 'node_modules'));
    for (const pkg of ['astro', '@tailwindcss/vite']) await fs.access(path.join(modules, pkg, 'package.json'));
    for (const photo of [PHOTO, GALLERY_PHOTO]) await fs.access(path.join(ROOT, 'public', photo.slice(1)));
    await fs.mkdir(SCRATCH, { recursive: true });
    const buildRoot = await fs.mkdtemp(path.join(SCRATCH, 'business-production-build-'));
    try {
        const sourceIndex = path.join(SOURCE, 'pages/index.astro');
        // Exclude the entire shared data directory, not just known filenames.
        await fs.cp(SOURCE, path.join(buildRoot, 'src'), { recursive: true,
            filter: source => source !== path.join(SOURCE, 'data') && source !== sourceIndex });
        const router = await fs.readFile(sourceIndex, 'utf8');
        assert.equal((router.match(/import siteData from '\.\.\/data\/site-data\.json';/g) ?? []).length, 1, 'Production router data import changed; update this isolated probe explicitly.');
        await fs.mkdir(path.join(buildRoot, 'src/data'), { recursive: true });
        await fs.writeFile(path.join(buildRoot, 'package.json'), '{"type":"module","private":true}\n');
        await fs.writeFile(path.join(buildRoot, 'tsconfig.json'), '{"extends":"astro/tsconfigs/strict","include":["src/**/*",".astro/types.d.ts"]}\n');
        await fs.symlink(modules, path.join(buildRoot, 'node_modules'), 'junction');
        const worker = path.join(buildRoot, 'build-worker.mjs');
        await fs.copyFile(path.join(ASTRO, 'build-worker.mjs'), worker);
        for (const testCase of CASES) {
            const data = fixture(testCase.code, testCase.hidden);
            await fs.writeFile(path.join(buildRoot, 'src/data', `${testCase.id}.json`), JSON.stringify(data));
            // Keep every original import and every line of routing logic intact.
            await fs.writeFile(path.join(buildRoot, 'src/pages', `${testCase.id}.astro`),
                router.replace("import siteData from '../data/site-data.json';", `import siteData from '../data/${testCase.id}.json';`));
        }
        await new Promise((resolve, reject) => {
            const child = spawn(process.execPath, [worker, buildRoot], { cwd: buildRoot, windowsHide: true, stdio: 'inherit', timeout: 180_000, env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' } });
            child.once('error', reject);
            child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Production Astro probe exited ${code}`)));
        });
        await fs.mkdir(OUTPUT, { recursive: true });
        for (const testCase of CASES) {
            const html = await standalone(await fs.readFile(path.join(buildRoot, 'dist', testCase.id, 'index.html'), 'utf8'), path.join(buildRoot, 'dist'));
            await fs.writeFile(path.join(OUTPUT, `${testCase.id}.html`), html);
        }
        for (const testCase of CASES)
            verify(await fs.readFile(path.join(OUTPUT, `${testCase.id}.html`), 'utf8'), testCase, fixture(testCase.code, testCase.hidden));
        await fs.writeFile(path.join(OUTPUT, 'manifest.json'), JSON.stringify({ fictional: true, productionRouter: true, cases: CASES }, null, 2) + '\n');
        console.log(`Verified ${CASES.length} actual production-router pages; review HTML: ${OUTPUT}`);
    } finally {
        const resolved = await fs.realpath(buildRoot);
        assert.ok(inside(SCRATCH, resolved) && path.dirname(resolved) === SCRATCH && path.basename(resolved).startsWith('business-production-build-'), 'Unsafe production probe cleanup target');
        await fs.rm(resolved, { recursive: true, force: true });
    }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
