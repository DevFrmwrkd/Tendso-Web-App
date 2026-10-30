#!/usr/bin/env node
'use strict';

/** Bundle the actual public creator page into a native-safe, offline preview document. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const preview = path.join(root, 'apps/mobile/preview');
const generated = path.join(root, 'apps/mobile/generated/creatorPagePreview.ts');
const dependencies = new Map();
const assetCache = new Map();
const slash = value => value.replaceAll('\\', '/');
const normalizeLines = value => value.replace(/\r\n/g, '\n');
const read = file => {
  const absolute = path.resolve(file);
  if (!dependencies.has(absolute)) dependencies.set(absolute, fs.readFileSync(absolute));
  return dependencies.get(absolute);
};
const mime = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};

function inlineAsset(publicPath) {
  if (assetCache.has(publicPath)) return assetCache.get(publicPath);
  const publicRoot = path.join(root, 'public');
  const file = path.resolve(publicRoot, publicPath.replace(/^\//, ''));
  if (!file.startsWith(publicRoot + path.sep) || !mime[path.extname(file)]) throw new Error(`Unsupported preview asset: ${publicPath}`);
  const data = `data:${mime[path.extname(file)]};base64,${read(file).toString('base64')}`;
  assetCache.set(publicPath, data);
  return data;
}

function inlineSourceAssets(source) {
  return source.replace(/(["'])(\/v2\/[a-zA-Z0-9_./-]+\.(?:png|jpe?g|webp|svg))\1/g,
    (_match, quote, url) => quote + inlineAsset(url) + quote);
}

function cssSource(file) {
  return normalizeLines(read(path.join(root, file)).toString('utf8')).replace(/url\(\s*(["']?)(\/[^)'"\s]+)\1\s*\)/g,
    (_match, _quote, url) => `url("${inlineAsset(url)}")`);
}

async function build() {
  read(__filename);
  // The native font adapter must be rebuilt when the public page's font setup changes.
  read(path.join(root, 'components/v2/fonts.ts'));
  const dynamicAssets = {};
  // Photo's name prop is a shorthand for this local public directory.
  const contentFile = path.join(root, 'components/v2/creators/ShopLinkContent.tsx');
  for (const match of read(contentFile).toString('utf8').matchAll(/<Photo\s+name=["']([^"']+)["']/g)) {
    const url = `/v2/creators/photos/${match[1]}`;
    dynamicAssets[url] = inlineAsset(url);
  }
  const aliases = new Map([
    ['next/link', path.join(preview, 'next-link.jsx')],
    ['next/image', path.join(preview, 'next-image.jsx')],
    ['@/lib/v2/creatorData', path.join(preview, 'store-links.jsx')],
    ['@/components/v2/fonts', path.join(preview, 'fonts.js')],
  ]);
  const result = await esbuild.build({
    absWorkingDir: root,
    entryPoints: [path.join(preview, 'creator-page-entry.jsx')],
    outfile: 'creator-page-preview.js',
    bundle: true,
    write: false,
    minify: true,
    metafile: true,
    treeShaking: true,
    platform: 'browser',
    format: 'iife',
    target: ['es2020'],
    jsx: 'automatic',
    legalComments: 'none',
    logLevel: 'silent',
    tsconfig: path.join(root, 'tsconfig.json'),
    define: {
      'process.env.NODE_ENV': '"production"',
      'process.env.NEXT_PUBLIC_APP_STORE_URL': 'undefined',
      'process.env.NEXT_PUBLIC_GOOGLE_PLAY_URL': 'undefined',
    },
    plugins: [{
      name: 'standalone-creator-preview',
      setup(builder) {
        builder.onResolve({ filter: /.*/ }, args => {
          if (aliases.has(args.path)) return { path: aliases.get(args.path) };
          const relative = args.path.startsWith('.') ? path.resolve(args.resolveDir, args.path).replace(/\.[jt]sx?$/, '') : null;
          if (relative === path.join(root, 'components/v2/fonts')) return { path: path.join(preview, 'fonts.js') };
          if (/^(react|react-dom)(?:\/|$)/.test(args.path)) return { path: require.resolve(args.path, { paths: [root] }) };
          if (args.path === 'creator-preview:inline-assets') return { path: args.path, namespace: 'creator-preview' };
          if (/^(?:convex|@clerk|@vercel|@tendso\/convex-client)(?:\/|$)/.test(args.path)) {
            throw new Error(`Runtime data/tracking dependency is forbidden in a page preview: ${args.path}`);
          }
        });
        builder.onLoad({ filter: /.*/, namespace: 'creator-preview' }, () => ({
          contents: `const assets=${JSON.stringify(dynamicAssets)};export function previewAsset(value){return typeof value==='string'?(assets[value]||(value.startsWith('data:image/')||value.startsWith('https:')?value:'')):'';}`,
          loader: 'js',
        }));
        builder.onLoad({ filter: /\.[jt]sx?$/ }, args => {
          if (args.path.includes(`${path.sep}node_modules${path.sep}`)) return;
          const extension = path.extname(args.path).slice(1);
          return { contents: inlineSourceAssets(read(args.path).toString('utf8')), loader: extension, resolveDir: path.dirname(args.path) };
        });
        builder.onLoad({ filter: /\.css$/ }, args => {
          read(args.path);
          return { contents: '', loader: 'js' };
        });
      },
    }],
  });

  for (const input of Object.keys(result.metafile.inputs)) {
    if (input.startsWith('creator-preview:')) continue;
    read(path.resolve(root, input));
  }
  let fonts = '';
  for (const weight of [400, 500, 600, 700]) {
    fonts += `@font-face{font-family:"Onest";font-style:normal;font-weight:${weight};font-display:swap;src:url("${inlineAsset(`/fonts/onest-latin-${weight}-normal.woff2`)}") format("woff2")}\n`;
  }
  fonts += `@font-face{font-family:"JetBrains Mono";font-style:normal;font-weight:500;font-display:swap;src:url("${inlineAsset('/fonts/jetbrains-mono-latin-500-normal.woff2')}") format("woff2")}\n`;
  const css = [
    'html,body{margin:0;min-height:100%;padding:0}*,*::before,*::after{box-sizing:border-box}button{background:none;border:0}svg{display:block;vertical-align:middle}.creator-preview-fonts{--font-v2-onest:"Onest";--font-v2-mono:"JetBrains Mono"}',
    fonts,
    cssSource('components/v2/tokens.css'),
    cssSource('components/v2/components.css'),
    cssSource('components/v2/creators/creators.css'),
  ].join('\n');
  const javascript = result.outputFiles.find(file => file.path.endsWith('.js')).text;
  if (/\bprocess\.env\b/.test(javascript)) throw new Error('Preview contains a runtime environment dependency.');
  if (/\b(?:https?:\/\/[^"'\s]*\/v2\/)/.test(javascript)) throw new Error('Preview contains a remote /v2 asset dependency.');
  const hash = crypto.createHash('sha256');
  hash.update(`creator-page-preview-v1\0esbuild:${esbuild.version}\0`);
  const inputs = [...dependencies.entries()].map(([file, data]) => [slash(path.relative(root, file)), data])
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  for (const [file, data] of inputs) {
    hash.update(file); hash.update('\0');
    hash.update(/\.(?:[cm]?[jt]sx?|css|json)$/.test(file) ? normalizeLines(data.toString('utf8')) : data);
    hash.update('\0');
  }
  const sourceHash = hash.digest('hex');
  const csp = "default-src 'none'; connect-src 'none'; img-src data: https:; style-src 'unsafe-inline'; font-src data:; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; media-src 'none'";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="${csp}"><title>Creator page preview</title><style>${css.replace(/<\/style/gi, '<\\/style')}</style></head><body><div id="creator-page-root"></div><script>${javascript.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
  const output = `// Generated by scripts/build-affiliate-page-preview.cjs. Do not edit.\n// Web renderer dependencies stay inside the HTML; native imports only strings and numbers.\nexport const CREATOR_PAGE_PREVIEW_VERSION = 1;\nexport const CREATOR_PAGE_PREVIEW_SOURCE_HASH = '${sourceHash}';\nexport const CREATOR_PAGE_PREVIEW_HTML: string = ${JSON.stringify(html)};\n`;
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(generated) || normalizeLines(fs.readFileSync(generated, 'utf8')) !== output) {
      throw new Error('Creator page preview is stale. Run npm run mobile:preview:build and commit the generated module.');
    }
    console.log(`Creator page preview is current (${sourceHash.slice(0, 12)}).`);
  } else {
    fs.mkdirSync(path.dirname(generated), { recursive: true });
    fs.writeFileSync(generated, output);
    console.log(`Generated standalone creator page preview: ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MiB, ${assetCache.size} inline assets, source ${sourceHash.slice(0, 12)}.`);
  }
}

build().catch(error => { console.error(error.message); process.exitCode = 1; });
