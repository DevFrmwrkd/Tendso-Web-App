#!/usr/bin/env node
/**
 * Build the review-only 24-site comparison from the actual Astro templates.
 * No shared/customer site-data, native bundle, live catalog or router is changed.
 *
 * node scripts/build-capture-redesign.mjs
 * node scripts/build-capture-redesign.mjs --astro-node-modules <existing-directory>
 * node scripts/build-capture-redesign.mjs --check
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { build as bundle } from 'esbuild';
import { load } from 'cheerio';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASTRO = path.join(ROOT, 'astro-site-template');
const COMPONENTS = path.join(ASTRO, 'src/components/capture-redesign');
const FIXTURES = path.join(ROOT, 'scripts/capture-redesign-fixtures.json');
const PUBLIC = path.join(ROOT, 'public');
const OUTPUT = path.join(PUBLIC, 'capture-redesign');
const SCRATCH = path.join(ROOT, 'output');
const VERSION = 1;
const TYPES = ['Barber/Salon', 'Auto Shop', 'Spa/Massage', 'Restaurant', 'Clinic', 'Law Office', 'Craft/Producer', 'Other'];
const STYLES = [
  { id: 'editorial', name: 'Editorial', description: 'An elegant editorial composition with generous space and a carefully composed photo story.' },
  { id: 'immersive', name: 'Immersive', description: 'A photo-led experience with confident typography, rich colour and a strong sense of place.' },
  { id: 'studio', name: 'Studio', description: 'A clear, contemporary layout that puts the business, its work and practical details first.' },
];
const dependencies = new Map();
const slash = value => value.replaceAll('\\', '/');
const normalize = value => value.replace(/\r\n/g, '\n');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const inside = (parent, child) => {
  const relative = path.relative(parent, child);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};

async function read(file) {
  const absolute = path.resolve(file);
  if (!dependencies.has(absolute)) dependencies.set(absolute, await fs.readFile(absolute));
  return dependencies.get(absolute);
}

async function publicAsset(url) {
  if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//')) return;
  const pathname = url.split(/[?#]/)[0];
  if (!/\.(?:webp|jpe?g|png|svg|woff2?)$/i.test(pathname)) return;
  const file = path.resolve(PUBLIC, '.' + decodeURIComponent(pathname));
  if (!inside(PUBLIC, file)) throw new Error(`Unsafe review asset path: ${pathname}`);
  await read(file);
}

async function referencedAssets(value) {
  if (typeof value === 'string') { await publicAsset(value); return; }
  if (Array.isArray(value)) { for (const item of value) await referencedAssets(item); return; }
  if (value && typeof value === 'object') for (const item of Object.values(value)) await referencedAssets(item);
}

async function sourceDependencies(file) {
  const absolute = path.resolve(file);
  if (dependencies.has(absolute)) return;
  if (!inside(COMPONENTS, absolute)) throw new Error('Review templates may import only their local review sources.');
  const source = (await read(absolute)).toString('utf8');
  for (const match of source.matchAll(/(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g)) {
    if (!match[1].startsWith('.')) continue;
    const stem = path.resolve(path.dirname(absolute), match[1]);
    let resolved;
    for (const candidate of [stem, ...['.astro', '.ts', '.js', '.css'].map(extension => stem + extension)]) {
      try { if ((await fs.stat(candidate)).isFile()) { resolved = candidate; break; } } catch { /* Try the next normal extension. */ }
    }
    if (!resolved) throw new Error(`Unresolved review import: ${match[1]}`);
    await sourceDependencies(resolved);
  }
  // Font/image references in template markup and CSS are part of the review source.
  for (const match of source.matchAll(/(?:['"(])(\/(?!\/)[^\s'"<>)]*\.(?:webp|jpe?g|png|svg|woff2?)(?:[?#][^\s'"<>)]*)?)/gi)) await publicAsset(match[1]);
}

async function inputs() {
  await read(fileURLToPath(import.meta.url));
  await read(path.join(ASTRO, 'build-worker.mjs'));
  await read(path.join(ASTRO, 'package-lock.json'));
  await read(path.join(ROOT, 'package-lock.json'));
  const fixtures = JSON.parse((await read(FIXTURES)).toString('utf8'));
  if (!Array.isArray(fixtures) || fixtures.length !== TYPES.length) throw new Error('Expected exactly eight fictional review business fixtures.');
  const ids = new Set(), types = new Set();
  for (const fixture of fixtures) {
    if (!/^[a-z][a-z0-9-]*$/.test(fixture.id ?? '') || ids.has(fixture.id)) throw new Error('Review business IDs must be unique safe slugs.');
    if (!TYPES.includes(fixture.businessType) || types.has(fixture.businessType)) throw new Error('Each supported business type must appear exactly once.');
    if (!fixture.siteData?.layout?.businessName || fixture.siteData?.sample !== true)
      throw new Error(`Review fixture must name and explicitly mark a fictional business: ${fixture.id}`);
    if (fixture.siteData.content?.business_type !== fixture.businessType) throw new Error(`Review business-type mismatch: ${fixture.id}`);
    ids.add(fixture.id); types.add(fixture.businessType);
    await referencedAssets(fixture.siteData);
  }
  for (const style of STYLES) await sourceDependencies(path.join(COMPONENTS, `${style.name}.astro`));
  const hash = crypto.createHash('sha256').update(`capture-redesign-v${VERSION}\0`);
  for (const [file, data] of [...dependencies].sort(([left], [right]) => left.localeCompare(right))) {
    hash.update(slash(path.relative(ROOT, file))); hash.update('\0');
    hash.update(/\.(?:mjs|js|ts|astro|css|json)$/.test(file) ? normalize(data.toString('utf8')) : data);
    hash.update('\0');
  }
  return { fixtures, sourceHash: hash.digest('hex') };
}

async function runWorker(worker, buildRoot) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [worker, buildRoot], {
      cwd: buildRoot, stdio: 'inherit', windowsHide: true,
      env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
    });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Review Astro build exited ${code}`)));
  });
}

async function standalone(source, dist) {
  let html = normalize(source);
  for (const match of [...html.matchAll(/<link\b[^>]*href=["'](\/_astro\/[^"']+\.css)["'][^>]*>/g)]) {
    const css = await fs.readFile(path.join(dist, match[1]), 'utf8');
    html = html.replace(match[0], `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`);
  }
  for (const match of [...html.matchAll(/<script\b[^>]*src=["'](\/_astro\/[^"']+\.js)["'][^>]*>\s*<\/script>/g)]) {
    const result = await bundle({ entryPoints: [path.join(dist, match[1])], bundle: true, write: false,
      format: 'iife', platform: 'browser', target: ['es2020'], minify: true, legalComments: 'none' });
    html = html.replace(match[0], `<script type="module">${result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script>`);
  }
  if (/(?:href|src)=["']\/_astro\//.test(html)) throw new Error('Review page contains an unresolved build asset.');
  return html.replace('<head>', '<head><!-- Review-only actual template; fictional sample data. Not the live mobile catalog. -->');
}

/** Check the rendered visitor content, rather than mirroring template source. */
async function verifyDocument(html, fixture, style) {
  const $ = load(html), id = `${fixture.id}-${style.id}`;
  const fail = message => { throw new Error(`${id}: ${message}`); };
  const text = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  if ($('html').attr('data-capture-layout') !== style.id) fail('wrong actual layout rendered');
  if ($('main').length !== 1 || $('h1').length !== 1 || !text($('h1').text())) fail('expected one main landmark and one populated H1');
  if (!text($('title').text()).includes(fixture.siteData.layout.businessName)) fail('page title lost the business identity');
  const visibleCopy = text($('body').clone().find('script,style').remove().end().text());
  if (visibleCopy.includes('[object Object]')) fail('object data rendered as visitor copy');
  const ids = $('[id]').map((_index, element) => $(element).attr('id')).get();
  if (new Set(ids).size !== ids.length) fail('duplicate HTML IDs');
  const idSet = new Set(ids);
  for (const href of $('a[href]').map((_index, element) => $(element).attr('href')).get()) {
    if (href?.startsWith('#') && href.length > 1 && !idSet.has(decodeURIComponent(href.slice(1)))) fail(`broken internal anchor ${href}`);
  }
  if (!$('header nav,header details nav').length) fail('main navigation is missing');
  for (const service of fixture.siteData.content.services?.items ?? []) {
    if (!text($('main').text()).includes(text(service.title))) fail(`service content is missing: ${service.title}`);
  }
  const summaries = $('main details summary').map((_index, element) => text($(element).text())).get();
  for (const item of fixture.siteData.content.faq?.items ?? []) {
    const question = text(item.question ?? item.q);
    if (!summaries.some(summary => summary.includes(question))) fail(`interactive FAQ is missing: ${question}`);
    if (!visibleCopy.includes(text(item.answer ?? item.a))) fail(`FAQ answer is missing: ${question}`);
  }
  for (const hour of fixture.siteData.content.location?.hours ?? []) {
    if (!visibleCopy.includes(text(hour.days)) || !visibleCopy.includes(text(hour.time))) fail('opening hours are missing or malformed');
  }
  if (!visibleCopy.includes('Fictional')) fail('fictional sample disclosure is missing');
  for (const element of $('img').toArray()) {
    if (!$(element).attr('src') || !text($(element).attr('alt'))) fail('a content image has no source or descriptive alternative');
  }
  const assets = [
    ...$('img[src],script[src],link[rel="stylesheet"][href],link[rel="preload"][href]').map((_index, element) => $(element).attr('src') ?? $(element).attr('href')).get(),
    ...[...$('style').text().matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g)].map(match => match[1]),
  ];
  for (const url of assets) {
    if (url.startsWith('data:')) continue;
    if (url.startsWith('/')) { await publicAsset(url); continue; }
    if (!/^https?:\/\//.test(url)) fail(`unresolved relative asset ${url}`);
    const external = new URL(url);
    if (external.username || external.password) fail('an asset URL contains credentials');
  }
  return { id, services: fixture.siteData.content.services?.items?.length ?? 0, faq: summaries.length, images: $('img').length };
}

async function check({ fixtures, sourceHash }) {
  const manifest = JSON.parse(await fs.readFile(path.join(OUTPUT, 'manifest.json'), 'utf8'));
  if (manifest.version !== VERSION || manifest.sourceHash !== sourceHash || manifest.documents?.length !== fixtures.length * STYLES.length)
    throw new Error('Capture redesign is stale. Run scripts/build-capture-redesign.mjs.');
  const expected = new Map(fixtures.flatMap(fixture => STYLES.map(style => [`${fixture.id}-${style.id}`, { fixture, style }])));
  for (const document of manifest.documents) {
    const source = expected.get(document.id);
    if (!source || document.file !== `${document.id}.html`) throw new Error('Review manifest contains an unexpected or repeated document.');
    expected.delete(document.id);
    const file = path.resolve(OUTPUT, document.file);
    if (!inside(OUTPUT, file)) throw new Error('Unsafe review manifest path.');
    const html = normalize(await fs.readFile(file, 'utf8'));
    if (digest(html) !== document.sha256)
      throw new Error(`Review page was changed outside the builder: ${document.id}`);
    await verifyDocument(html, source.fixture, source.style);
  }
  if (expected.size) throw new Error('Review manifest is missing a design.');
  for (const [file, field] of [['catalog.json', 'catalogSha256'], ['catalog.js', 'catalogJsSha256']]) {
    if (digest(normalize(await fs.readFile(path.join(OUTPUT, file), 'utf8'))) !== manifest[field]) throw new Error(`Review ${file} is stale.`);
  }
  console.log(`Capture redesign current: ${manifest.documents.length} actual pages, ${fixtures.length} business types, three layouts per type. Rendered identity, landmarks, services, FAQ, hours, anchors and asset contracts passed. Review only.`);
}

async function main() {
  const { values } = parseArgs({ options: { check: { type: 'boolean' }, 'astro-node-modules': { type: 'string' } } });
  const input = await inputs();
  if (values.check) { await check(input); return; }
  const dependencyRoot = path.resolve(values['astro-node-modules'] ?? path.join(ASTRO, 'node_modules'));
  for (const packageName of ['astro', '@tailwindcss/vite']) {
    try { await fs.access(path.join(dependencyRoot, packageName, 'package.json')); }
    catch { throw new Error(`Missing ${packageName} dependencies. Install Astro dependencies or pass --astro-node-modules with an existing directory.`); }
  }
  await fs.mkdir(SCRATCH, { recursive: true });
  const buildRoot = await fs.mkdtemp(path.join(SCRATCH, 'capture-redesign-build-'));
  try {
    const pages = path.join(buildRoot, 'src/pages'), data = path.join(buildRoot, 'src/data');
    const reviewSources = path.join(buildRoot, 'src/components/capture-redesign');
    await fs.mkdir(pages, { recursive: true }); await fs.mkdir(data, { recursive: true });
    await fs.writeFile(path.join(buildRoot, 'package.json'), '{"type":"module","private":true}\n');
    await fs.writeFile(path.join(buildRoot, 'tsconfig.json'), '{"extends":"astro/tsconfigs/strict","include":["src/**/*",".astro/types.d.ts"]}\n');
    await fs.symlink(dependencyRoot, path.join(buildRoot, 'node_modules'), 'junction');
    // Run the existing worker unchanged from scratch so package resolution uses
    // that scratch-only dependency junction, never a temporary worktree link.
    const worker = path.join(buildRoot, 'build-worker.mjs');
    await fs.copyFile(path.join(ASTRO, 'build-worker.mjs'), worker);
    // Copy the exact source buffers included in sourceHash. Importing from the
    // worktree would also load that checkout's unrelated tsconfig/dependencies.
    for (const [file, contents] of dependencies) if (inside(COMPONENTS, file)) {
      const target = path.join(reviewSources, path.relative(COMPONENTS, file));
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, contents);
    }
    for (const fixture of input.fixtures) {
      await fs.writeFile(path.join(data, `${fixture.id}.json`), JSON.stringify(fixture.siteData));
      for (const style of STYLES) {
        let component = slash(path.relative(pages, path.join(reviewSources, `${style.name}.astro`)));
        if (!component.startsWith('.')) component = './' + component;
        await fs.writeFile(path.join(pages, `${fixture.id}-${style.id}.astro`),
          `---\nimport Page from ${JSON.stringify(component)};\nimport siteData from '../data/${fixture.id}.json';\n---\n<Page siteData={siteData} />\n`);
      }
    }
    await runWorker(worker, buildRoot);
    const dist = path.join(buildRoot, 'dist'), documents = [], designs = [];
    await fs.mkdir(OUTPUT, { recursive: true });
    for (const fixture of input.fixtures) for (const style of STYLES) {
      const id = `${fixture.id}-${style.id}`, file = `${id}.html`;
      const html = await standalone(await fs.readFile(path.join(dist, id, 'index.html'), 'utf8'), dist);
      await verifyDocument(html, fixture, style);
      await fs.writeFile(path.join(OUTPUT, file), html);
      designs.push({ id, businessType: fixture.businessType, kind: fixture.kind ?? fixture.id, style: style.id,
        name: style.name, businessName: fixture.siteData.layout.businessName, preview: `/capture-redesign/${file}`,
        recommended: style.id === 'editorial', description: style.description });
      documents.push({ id, file, sha256: digest(html) });
    }
    const catalog = JSON.stringify({ version: VERSION, reviewOnly: true, sourceHash: input.sourceHash, designs }, null, 2) + '\n';
    const catalogJs = `window.CAPTURE_REDESIGN_CATALOG=${JSON.stringify({ version: VERSION, reviewOnly: true, sourceHash: input.sourceHash, designs })};\n`;
    await fs.writeFile(path.join(OUTPUT, 'catalog.json'), catalog);
    await fs.writeFile(path.join(OUTPUT, 'catalog.js'), catalogJs);
    await fs.writeFile(path.join(OUTPUT, 'manifest.json'), JSON.stringify({ version: VERSION, reviewOnly: true,
      sourceHash: input.sourceHash, catalogSha256: digest(catalog), catalogJsSha256: digest(catalogJs), documents }, null, 2) + '\n');
    console.log(`Built ${documents.length} review-only pages from three actual Astro layouts and eight fictional business fixtures.`);
  } finally {
    // Every recursive removal is confined to the unique scratch directory that
    // this invocation created. Node removes contained junctions, not their targets.
    const realBuildRoot = await fs.realpath(buildRoot);
    if (!inside(SCRATCH, realBuildRoot) || path.dirname(realBuildRoot) !== SCRATCH
      || !path.basename(realBuildRoot).startsWith('capture-redesign-build-')) throw new Error('Unsafe review build cleanup target.');
    await fs.rm(realBuildRoot, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
