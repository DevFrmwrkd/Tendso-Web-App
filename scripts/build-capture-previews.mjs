#!/usr/bin/env node
/**
 * Build field-agent examples from the ACTUAL Astro page components and fictional
 * Philippine business fixtures. No shared/customer site-data.json is read or written.
 * Each temporary route imports one page so its CSS/initializers stay isolated.
 * Public examples get standalone inline CSS/JS; native carries the same HTML and
 * one shared data-URI copy of every generated photo, independent of web deployment.
 *
 *   node scripts/build-capture-previews.mjs
 *   node scripts/build-capture-previews.mjs --check
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { spawn } from 'node:child_process';
import { build as bundle } from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASTRO = path.join(ROOT, 'astro-site-template');
const FIXTURES = path.join(ROOT, 'scripts/capture-preview-fixtures');
const OUTPUT = path.join(ROOT, 'public/capture-previews');
const NATIVE = path.join(ROOT, 'apps/mobile/generated/capturePreviews.ts');
const NATIVE_CATALOG = path.join(ROOT, 'apps/mobile/services/generated/capturePreviewCatalog.ts');
const SCRATCH = path.join(ROOT, 'output');
const VERSION = 1;
const dependencies = new Map();
const slash = value => value.replaceAll('\\', '/');
const normalizeLines = value => value.replace(/\r\n/g, '\n');
const mime = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };

async function read(file) {
  const absolute = path.resolve(file);
  if (!dependencies.has(absolute)) dependencies.set(absolute, await fs.readFile(absolute));
  return dependencies.get(absolute);
}

function inside(parent, child) {
  const relative = path.relative(parent, child);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

async function sourceDependencies(file) {
  const absolute = path.resolve(file);
  if (dependencies.has(absolute)) return;
  const source = (await read(absolute)).toString('utf8');
  for (const match of source.matchAll(/(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g)) {
    if (!match[1].startsWith('.')) continue;
    const stem = path.resolve(path.dirname(absolute), match[1]);
    let resolved = null;
    for (const candidate of [stem, ...['.astro', '.ts', '.js', '.css'].map(extension => stem + extension)]) {
      try { if ((await fs.stat(candidate)).isFile()) { resolved = candidate; break; } } catch {}
    }
    if (resolved) await sourceDependencies(resolved);
  }
}

function replacePhotos(value, photos) {
  if (typeof value === 'string') return value.replace(/asset:([a-z][a-z0-9-]*)/g, (_match, key) => {
    if (!photos[key]) throw new Error(`Missing capture sample photo: ${key}`);
    return photos[key];
  });
  if (Array.isArray(value)) return value.map(item => replacePhotos(item, photos));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replacePhotos(item, photos)]));
  return value;
}

async function inputs() {
  await read(fileURLToPath(import.meta.url));
  await read(path.join(ASTRO, 'build-worker.mjs'));
  await read(path.join(ASTRO, 'package-lock.json'));
  await read(path.join(ROOT, 'package-lock.json'));
  const catalog = (await read(path.join(ROOT, 'components/editor/templateCatalog.ts'))).toString('utf8');
  const canonical = new Map([...catalog.matchAll(/code:\s*["']([^"']+)["'],\s*label:\s*["']([^"']+)["']/g)]
    .map(match => [match[1], match[2]]));
  const photos = JSON.parse((await read(path.join(FIXTURES, 'photos.json'))).toString('utf8'));
  const assets = {};
  for (const [key, url] of Object.entries(photos)) {
    if (!/^[a-z][a-z0-9-]*$/.test(key) || typeof url !== 'string' || !url.startsWith('/capture-previews/photos/')) {
      throw new Error(`Invalid capture photo mapping: ${key}`);
    }
    const file = path.resolve(ROOT, 'public', url.slice(1));
    if (!inside(path.join(ROOT, 'public/capture-previews/photos'), file) || !mime[path.extname(file)]) {
      throw new Error(`Unsupported capture photo: ${url}`);
    }
    assets[url] = `data:${mime[path.extname(file)]};base64,${(await read(file)).toString('base64')}`;
  }
  const fixtures = [];
  for (const name of (await fs.readdir(FIXTURES)).filter(name => name.endsWith('.json') && name !== 'photos.json').sort()) {
    const businesses = JSON.parse((await read(path.join(FIXTURES, name))).toString('utf8'));
    if (!Array.isArray(businesses)) throw new Error(`Expected a business fixture array: ${name}`);
    for (const business of businesses) {
      if (!business.id || !business.category || !business.siteData?.layout?.businessName || !Array.isArray(business.designs)) {
        throw new Error(`Incomplete fictional business fixture: ${name}`);
      }
      const designNames = business.designNames ?? {};
      if (typeof designNames !== 'object' || Array.isArray(designNames)) {
        throw new Error(`Invalid capture design names: ${name}`);
      }
      for (const [code, label] of Object.entries(designNames)) {
        if (!business.designs.includes(code) || typeof label !== 'string' || !label.trim()) {
          throw new Error(`Invalid capture design name for ${code}: ${name}`);
        }
      }
      for (const code of business.designs) {
        if (!canonical.has(code) || !/^[a-z]+:[A-Z]{1,2}$/.test(code)) throw new Error(`Unknown canonical capture design: ${code}`);
        if (fixtures.some(fixture => fixture.code === code)) throw new Error(`Duplicate capture design: ${code}`);
        const [family, letter] = code.split(':');
        const component = path.join(ASTRO, 'src/components', family, `Page${letter}.astro`);
        await sourceDependencies(component);
        const siteData = replacePhotos(business.siteData, photos);
        siteData.customizations = { ...siteData.customizations, heroStyle: code };
        const label = Object.prototype.hasOwnProperty.call(designNames, code) ? designNames[code].trim() : canonical.get(code);
        fixtures.push({ code, name: label, letter: letter.toLowerCase(), category: business.category,
          businessId: business.id, component, siteData });
      }
    }
  }
  if (!fixtures.length) throw new Error('No capture preview fixtures found.');
  const hash = crypto.createHash('sha256').update(`capture-previews-v${VERSION}\0`);
  for (const [file, data] of [...dependencies].sort(([left], [right]) => left.localeCompare(right))) {
    hash.update(slash(path.relative(ROOT, file))); hash.update('\0');
    hash.update(/\.(?:mjs|js|ts|astro|css|json)$/.test(file) ? normalizeLines(data.toString('utf8')) : data);
    hash.update('\0');
  }
  return { fixtures, assets, sourceHash: hash.digest('hex') };
}

async function child(command, args, cwd) {
  await new Promise((resolve, reject) => {
    const process = spawn(command, args, { cwd, stdio: 'inherit', env: { ...globalThis.process.env, ASTRO_TELEMETRY_DISABLED: '1' }, windowsHide: true });
    process.once('error', reject);
    process.once('exit', code => code === 0 ? resolve() : reject(new Error(`Capture preview Astro build exited ${code}`)));
  });
}

async function standalone(html, dist) {
  // Astro inlines stylesheets; retain a fallback for any future emitted asset.
  for (const match of [...html.matchAll(/<link\b[^>]*href=["'](\/_astro\/[^"']+\.css)["'][^>]*>/g)]) {
    const css = await fs.readFile(path.join(dist, match[1]), 'utf8');
    html = html.replace(match[0], `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`);
  }
  for (const match of [...html.matchAll(/<script\b[^>]*src=["'](\/_astro\/[^"']+\.js)["'][^>]*>\s*<\/script>/g)]) {
    const result = await bundle({ entryPoints: [path.join(dist, match[1])], bundle: true, write: false,
      format: 'iife', platform: 'browser', target: ['es2020'], minify: true, legalComments: 'none' });
    // Inline modules still defer until document parsing finishes.
    html = html.replace(match[0], `<script type="module">${result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script>`);
  }
  if (/(?:href|src)=["']\/_astro\//.test(html)) throw new Error('Capture preview contains an unresolved build asset.');
  return html.replace('<head>', '<head><!-- Fictional Philippine business. Generated example; no customer data. -->');
}

async function main() {
  const { values } = parseArgs({ options: { check: { type: 'boolean' } } });
  const { fixtures, assets, sourceHash } = await inputs();
  if (values.check) {
    const manifest = JSON.parse(await fs.readFile(path.join(OUTPUT, 'manifest.json'), 'utf8'));
    if (manifest.sourceHash !== sourceHash || manifest.documents.length !== fixtures.length) throw new Error('Capture previews are stale. Run node scripts/build-capture-previews.mjs.');
    for (const document of manifest.documents) {
      const digest = crypto.createHash('sha256').update(normalizeLines(await fs.readFile(path.join(OUTPUT, document.file), 'utf8'))).digest('hex');
      if (digest !== document.sha256) throw new Error(`Capture preview changed outside the builder: ${document.code}`);
    }
    const nativeDigest = crypto.createHash('sha256').update(normalizeLines(await fs.readFile(NATIVE, 'utf8'))).digest('hex');
    if (nativeDigest !== manifest.nativeSha256) throw new Error('Native capture preview module is stale.');
    const catalogDigest = crypto.createHash('sha256').update(normalizeLines(await fs.readFile(path.join(OUTPUT, 'catalog.json'), 'utf8'))).digest('hex');
    if (catalogDigest !== manifest.catalogSha256) throw new Error('Capture preview catalog is stale.');
    const catalogJsDigest = crypto.createHash('sha256').update(normalizeLines(await fs.readFile(path.join(OUTPUT, 'catalog.js'), 'utf8'))).digest('hex');
    if (catalogJsDigest !== manifest.catalogJsSha256) throw new Error('Capture preview board catalog is stale.');
    const nativeCatalogDigest = crypto.createHash('sha256').update(normalizeLines(await fs.readFile(NATIVE_CATALOG, 'utf8'))).digest('hex');
    if (nativeCatalogDigest !== manifest.nativeCatalogSha256) throw new Error('Native capture preview catalog is stale.');
    console.log(`Capture previews current: ${fixtures.length} actual templates, ${Object.keys(assets).length} generated photos.`);
    return;
  }
  await fs.mkdir(SCRATCH, { recursive: true });
  const buildRoot = await fs.mkdtemp(path.join(SCRATCH, 'capture-preview-build-'));
  try {
    const pages = path.join(buildRoot, 'src/pages');
    const data = path.join(buildRoot, 'src/data');
    await fs.mkdir(pages, { recursive: true });
    await fs.mkdir(data, { recursive: true });
    await fs.writeFile(path.join(buildRoot, 'package.json'), '{"type":"module","private":true}\n');
    await fs.symlink(path.join(ASTRO, 'node_modules'), path.join(buildRoot, 'node_modules'), 'junction');
    for (const fixture of fixtures) {
      await fs.writeFile(path.join(data, `${fixture.letter}.json`), JSON.stringify(fixture.siteData));
      let component = slash(path.relative(pages, fixture.component));
      if (!component.startsWith('.')) component = './' + component;
      await fs.writeFile(path.join(pages, `${fixture.letter}.astro`),
        `---\nimport Page from ${JSON.stringify(component)};\nimport siteData from '../data/${fixture.letter}.json';\n---\n<Page siteData={siteData} />\n`);
    }
    await child(process.execPath, [path.join(ASTRO, 'build-worker.mjs'), buildRoot], buildRoot);
    const dist = path.join(buildRoot, 'dist');
    const documents = {};
    const entries = [];
    await fs.mkdir(OUTPUT, { recursive: true });
    for (const fixture of fixtures) {
      const html = normalizeLines(await standalone(await fs.readFile(path.join(dist, fixture.letter, 'index.html'), 'utf8'), dist));
      const file = `${fixture.letter}.html`;
      await fs.writeFile(path.join(OUTPUT, file), html);
      documents[fixture.code] = html;
      entries.push({ code: fixture.code, name: fixture.name, category: fixture.category, businessId: fixture.businessId,
        businessName: fixture.siteData.layout.businessName, preview: `/capture-previews/${file}`, file,
        sha256: crypto.createHash('sha256').update(html).digest('hex') });
    }
    const designs = entries.map(({ code, name, category, businessId, businessName, preview }) =>
      ({ code, name, category, businessId, businessName, preview }));
    const catalog = JSON.stringify({ version: VERSION, sourceHash, designs }, null, 2) + '\n';
    const catalogJs = `window.CAPTURE_PREVIEW_CATALOG=${JSON.stringify({ version: VERSION, sourceHash, designs })};\n`;
    await fs.writeFile(path.join(OUTPUT, 'catalog.json'), catalog);
    await fs.writeFile(path.join(OUTPUT, 'catalog.js'), catalogJs);
    const nativeCatalog = `// Generated by scripts/build-capture-previews.mjs. Do not edit.\n// Lightweight metadata only: importing this file never loads HTML or photo bytes.\nexport const CAPTURE_PREVIEW_CATALOG = ${JSON.stringify(designs)} as const;\n`;
    await fs.mkdir(path.dirname(NATIVE_CATALOG), { recursive: true });
    await fs.writeFile(NATIVE_CATALOG, nativeCatalog);
    const native = `// Generated by scripts/build-capture-previews.mjs. Do not edit.\n// Photos are stored once; the selected sample replaces its local paths at runtime.\nexport const CAPTURE_PREVIEW_VERSION = ${VERSION};\nexport const CAPTURE_PREVIEW_SOURCE_HASH = ${JSON.stringify(sourceHash)};\nexport const CAPTURE_PREVIEW_ASSETS: Readonly<Record<string, string>> = ${JSON.stringify(assets)};\nexport const CAPTURE_PREVIEW_DOCUMENTS: Readonly<Record<string, string>> = ${JSON.stringify(documents)};\n`;
    await fs.mkdir(path.dirname(NATIVE), { recursive: true });
    await fs.writeFile(NATIVE, native);
    await fs.writeFile(path.join(OUTPUT, 'manifest.json'), JSON.stringify({ version: VERSION, sourceHash,
      nativeSha256: crypto.createHash('sha256').update(native).digest('hex'),
      catalogSha256: crypto.createHash('sha256').update(catalog).digest('hex'),
      catalogJsSha256: crypto.createHash('sha256').update(catalogJs).digest('hex'),
      nativeCatalogSha256: crypto.createHash('sha256').update(nativeCatalog).digest('hex'), documents: entries }, null, 2) + '\n');
    console.log(`Built ${entries.length} capture examples from actual Astro templates (${Object.keys(assets).length} shared photos).`);
    // Rebuilding a saved legacy sample must not replace the approved mobile
    // shortlist/bundle with the old catalog. The approved builder composes both.
    const approvedCatalogPath = path.join(ROOT, 'public/capture-redesign/catalog.json');
    let approved = false;
    try { approved = JSON.parse(await fs.readFile(approvedCatalogPath, 'utf8')).approved === true; } catch {}
    if (approved) await child(process.execPath, [path.join(ROOT, 'scripts/build-capture-redesign.mjs'), '--bundle-only'], ROOT);
  } finally {
    // Delete only the scratch directory created above, never a caller-supplied path.
    if (path.dirname(buildRoot) !== SCRATCH || !path.basename(buildRoot).startsWith('capture-preview-build-')) throw new Error('Unsafe capture build cleanup path.');
    await fs.rm(buildRoot, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
