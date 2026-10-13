#!/usr/bin/env node
// Rebuild the A4 poster with: node scripts/generate-otr-giveaway-poster.mjs
// Chrome is used only to print the self-contained HTML; no network requests run.
// Override its executable with CHROME_PATH on macOS/Linux or another installation.
//
// The poster wears the giveaway page's campaign look (app/giveaway.css): OTR
// black across the top, Tendso gold across the bottom, Unbounded and
// Bricolage Grotesque from public/fonts. Change the two together.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QRCodeSVG } from 'qrcode.react';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const posterUrl = 'https://tendso.com/poster';
const outputDirectory = path.join(root, 'output', 'otr-giveaway-poster');
const htmlPath = path.join(outputDirectory, 'poster.html');
const pdfPath = path.join(root, 'public', '100-pages-giveaway-poster.pdf');
const asBase64 = (...parts) => readFileSync(path.join(root, 'public', ...parts)).toString('base64');
const otrMark = asBase64('otr-mark.png');
const tendsoLogo = asBase64('tendso-logo.png');
// The four-module white quiet zone remains inside the SVG and is never cropped.
const qr = renderToStaticMarkup(React.createElement(QRCodeSVG, {
  value: posterUrl,
  size: 196,
  level: 'M',
  marginSize: 4,
  title: 'Apply for the Off the Record free website giveaway',
}));

// Google's own subsets, as app/self-hosted-fonts.css declares them; latin-ext carries ₱.
const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const LATIN_EXT = 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF';
const fontFaces = [
  ['Unbounded', 800, 'unbounded-latin-800-normal.woff2', LATIN],
  ['Unbounded', 900, 'unbounded-latin-900-normal.woff2', LATIN],
  ['Unbounded', 800, 'unbounded-latin-ext-800-normal.woff2', LATIN_EXT],
  ['Unbounded', 900, 'unbounded-latin-ext-900-normal.woff2', LATIN_EXT],
  ['Bricolage Grotesque', 600, 'bricolage-grotesque-latin-600-normal.woff2', LATIN],
  ['Bricolage Grotesque', 800, 'bricolage-grotesque-latin-800-normal.woff2', LATIN],
].map(([family, weight, file, range]) => `  @font-face { font-family: '${family}'; font-style: normal; font-weight: ${weight}; src: url(data:font/woff2;base64,${asBase64('fonts', file)}) format('woff2'); unicode-range: ${range}; }`).join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Off the Record × Tendso — Free website giveaway</title>
<style>
${fontFaces}
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  body { background: #e8e8e8; }
  .poster { position: relative; width: 210mm; height: 297mm; margin: 0 auto; overflow: hidden; background: #f3efe6; color: #0d0d0d; font-family: 'Bricolage Grotesque', Arial, sans-serif; line-height: 1.35; }
  .layer { position: absolute; inset: 0; }
  .rays { background: repeating-conic-gradient(from 0deg at 50% 40%, rgba(13, 13, 13, .05) 0deg 5deg, transparent 5deg 10deg); }
  .dots { position: absolute; width: 300px; height: 300px; background-image: radial-gradient(rgba(13, 13, 13, .22) 1.6px, transparent 2px); background-size: 13px 13px; -webkit-mask-image: radial-gradient(circle, #000 0%, transparent 68%); mask-image: radial-gradient(circle, #000 0%, transparent 68%); }
  .dots.left { left: -150px; top: 30%; }
  .dots.right { right: -150px; top: 38%; }
  .band-otr { background: #0d0d0d; clip-path: polygon(0 0, 100% 0, 100% 15%, 0 24%); }
  .band-stripe { background: #e23a1f; clip-path: polygon(0 75.9%, 100% 66.9%, 100% 68%, 0 77%); }
  .band-gold { background: #ffc531; clip-path: polygon(0 77%, 100% 68%, 100% 100%, 0 100%); }
  .content { position: relative; height: 100%; padding: 40px 44px; display: flex; flex-direction: column; justify-content: space-between; }
  .display { font-family: Unbounded, 'Arial Black', sans-serif; text-transform: uppercase; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 16px; color: #fff; }
  .lockup { display: flex; align-items: center; gap: 12px; }
  .lockup .otr { height: 40px; width: auto; filter: invert(1); }
  .lockup .name { font-size: 16px; font-weight: 800; letter-spacing: .04em; line-height: 1.05; }
  .x { font-family: Unbounded, 'Arial Black', sans-serif; font-weight: 900; color: #ffc531; line-height: 1; }
  .lockup .x { font-size: 26px; }
  .lockup .tendso { height: 28px; width: auto; }
  .community { font-size: 11px; font-weight: 800; letter-spacing: .08em; line-height: 1.45; text-align: right; }
  .title { display: flex; flex-direction: column; align-items: center; text-align: center; }
  .wrap { position: relative; display: flex; flex-direction: column; align-items: center; }
  .gift { position: relative; z-index: 2; width: 112px; height: auto; margin-bottom: -30px; }
  h1 { position: relative; margin: 0; padding: .1em .42em .14em; background: #ffc531; border: 5px solid #0d0d0d; border-radius: 22px; box-shadow: 12px 12px 0 #e23a1f; transform: rotate(-3deg); font-size: 80px; font-weight: 900; line-height: 1; letter-spacing: -.03em; }
  .ribbon { position: relative; z-index: 2; margin: -12px 0 0; padding: 11px 28px; background: #0d0d0d; color: #fff; border: 3px solid #fff; transform: rotate(-3deg) skewX(-10deg); font-size: 21px; font-weight: 800; letter-spacing: .03em; }
  .ribbon > span { display: inline-block; transform: skewX(10deg); }
  .ribbon b { font-weight: inherit; color: #ffc531; }
  .sticker { position: absolute; z-index: 3; top: 0; right: -62px; width: 132px; height: 132px; margin: 0; border-radius: 50%; background: #e23a1f; color: #fff; border: 4px solid #0d0d0d; box-shadow: 5px 5px 0 #0d0d0d; outline: 2px dashed #fff; outline-offset: -11px; transform: rotate(12deg); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; font-size: 10px; font-weight: 800; line-height: 1.1; letter-spacing: .04em; }
  .sticker strong { font-size: 20px; font-weight: 900; letter-spacing: -.02em; }
  .chip { margin: 20px 0 0; display: inline-flex; align-items: center; gap: 10px; padding: 9px 20px; border-radius: 999px; background: #fff; border: 3px solid #0d0d0d; font-size: 17px; font-weight: 800; }
  .chip .label { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: #4a463f; }
  .chip .otr { height: 22px; width: auto; }
  .chip .tendso { height: 18px; width: auto; filter: invert(1); }
  .chip .x { color: #e23a1f; }
  .intro { margin: 18px 0 0; max-width: 600px; font-size: 22px; font-weight: 800; line-height: 1.3; }
  .steps { margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px; }
  .steps li { display: flex; flex-direction: column; align-items: center; text-align: center; }
  .bubble { position: relative; width: 92px; height: 92px; border-radius: 24px; background: #fff; border: 4px solid #0d0d0d; box-shadow: 6px 6px 0 #0d0d0d; display: flex; align-items: center; justify-content: center; }
  .bubble::after { content: ''; position: absolute; left: 16px; bottom: -14px; width: 20px; height: 20px; background: #fff; border-right: 4px solid #0d0d0d; border-bottom: 4px solid #0d0d0d; transform: rotate(45deg); }
  .bubble svg { width: 44px; height: 44px; }
  .badge { position: absolute; right: -16px; top: -16px; width: 42px; height: 42px; border-radius: 50%; background: #e23a1f; color: #fff; border: 3px solid #0d0d0d; font-size: 18px; font-weight: 900; display: flex; align-items: center; justify-content: center; }
  .steps h2 { margin: 30px 0 0; padding: 8px 14px; background: #0d0d0d; color: #ffc531; transform: skewX(-12deg); font-size: 13.5px; font-weight: 800; line-height: 1.2; white-space: nowrap; }
  .steps h2 span { display: inline-block; transform: skewX(12deg); }
  .steps p { margin: 10px 0 0; font-size: 16px; font-weight: 600; color: #2b2721; }
  .apply { position: relative; padding: 20px 28px 20px 20px; background: #fff; border: 4px solid #0d0d0d; border-radius: 26px; box-shadow: 8px 8px 0 #0d0d0d; display: flex; align-items: center; gap: 26px; }
  .scan-me { position: absolute; left: 150px; top: -22px; padding: 6px 14px; border: 3px solid #0d0d0d; border-radius: 999px; background: #e23a1f; color: #fff; transform: rotate(-6deg); font-size: 14px; font-weight: 900; letter-spacing: .04em; }
  .qr { flex: 0 0 48mm; height: 48mm; }
  .qr svg { display: block; width: 100%; height: 100%; }
  .apply-copy { min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 10px; }
  .apply h2 { margin: 0; font-size: 38px; font-weight: 900; line-height: 1; letter-spacing: -.02em; }
  .address { color: #0d0d0d; font-size: 28px; font-weight: 800; text-decoration: underline; text-decoration-thickness: 3px; text-underline-offset: 5px; }
  .apply p { margin: 0; font-size: 17px; font-weight: 600; color: #2b2721; }
  .only { padding: 6px 14px; border-radius: 999px; background: #ffc531; border: 2.5px solid #0d0d0d; font-size: 12px; font-weight: 800; letter-spacing: .04em; }
  .fine { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }
  .fine p { margin: 0; max-width: 660px; font-size: 12px; font-weight: 600; line-height: 1.45; }
  .fine .provider { font-size: 12px; font-weight: 800; letter-spacing: .06em; }
  @media print { body { background: none; } .poster { margin: 0; } }
</style>
</head>
<body>
<main class="poster" aria-label="Off the Record × Tendso website giveaway poster">
  <div class="layer rays"></div>
  <div class="dots left"></div>
  <div class="dots right"></div>
  <div class="layer band-otr"></div>
  <div class="layer band-stripe"></div>
  <div class="layer band-gold"></div>
  <div class="content">
    <header>
      <div class="lockup">
        <img class="otr" src="data:image/png;base64,${otrMark}" alt="">
        <span class="name display">Off the<br>Record</span>
        <span class="x">×</span>
        <img class="tendso" src="data:image/png;base64,${tendsoLogo}" alt="Tendso">
      </div>
      <div class="community display">For our<br>local community</div>
    </header>

    <section class="title">
      <div class="wrap">
        <svg class="gift" viewBox="0 0 132 112" aria-hidden="true">
          <path d="M14 18 4 10M118 18l10-8M30 4l-4-6M102 4l4-6M66 0v-8" stroke="#FFC531" stroke-width="4" stroke-linecap="round"/>
          <g transform="rotate(-8 66 40)">
            <rect x="40" y="10" width="54" height="40" rx="5" fill="#FFFFFF" stroke="#0D0D0D" stroke-width="3.5"/>
            <path d="M40 21h54" stroke="#0D0D0D" stroke-width="3.5"/>
            <circle cx="47" cy="15.5" r="2" fill="#E23A1F"/><circle cx="54" cy="15.5" r="2" fill="#FFC531"/>
            <path d="M48 30h28M48 38h18" stroke="#0D0D0D" stroke-width="3.5" stroke-linecap="round"/>
          </g>
          <rect x="18" y="62" width="96" height="48" rx="5" fill="#E23A1F" stroke="#0D0D0D" stroke-width="3.5"/>
          <rect x="10" y="46" width="112" height="20" rx="5" fill="#E23A1F" stroke="#0D0D0D" stroke-width="3.5" transform="rotate(-4 66 56)"/>
          <rect x="58" y="62" width="16" height="48" fill="#FFC531" stroke="#0D0D0D" stroke-width="3.5"/>
        </svg>
        <h1 class="display">Giveaway</h1>
        <p class="ribbon display"><span>100 free websites <b>✦</b> worth ₱4,999 each</span></p>
        <p class="sticker display"><span>More than</span><strong>₱300K</strong><span>in websites</span></p>
      </div>
      <p class="chip">
        <span class="label">Presented by</span>
        <img class="otr" src="data:image/png;base64,${otrMark}" alt="">Off the Record
        <span class="x">×</span>
        <img class="tendso" src="data:image/png;base64,${tendsoLogo}" alt="Tendso">
      </p>
      <p class="intro">Off the Record is giving local businesses a free website, built by Tendso.</p>
    </section>

    <ol class="steps">
      <li>
        <div class="bubble">
          <svg viewBox="0 0 24 24" fill="none" stroke="#0D0D0D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="1" fill="#FFC531"/><path d="M8 8h8M8 12h5"/><path d="M12 1v3"/></svg>
          <span class="badge display">1</span>
        </div>
        <h2 class="display"><span>Hang this poster</span></h2>
        <p>Put it up where your customers will see it.</p>
      </li>
      <li>
        <div class="bubble">
          <svg viewBox="0 0 24 24" fill="none" stroke="#0D0D0D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" fill="#FFC531"/><circle cx="12" cy="13" r="3.5" fill="#FFFFFF"/></svg>
          <span class="badge display">2</span>
        </div>
        <h2 class="display"><span>Snap &amp; register</span></h2>
        <p>Scan the code and upload a photo of this poster on display.</p>
      </li>
      <li>
        <div class="bubble">
          <svg viewBox="0 0 24 24" fill="none" stroke="#0D0D0D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2" fill="#FFC531"/><path d="M2 9h20"/><path d="m9 14 2 2 4-4"/></svg>
          <span class="badge display">3</span>
        </div>
        <h2 class="display"><span>Get your website</span></h2>
        <p>OTR reviews it. Tendso builds your site once approved.</p>
      </li>
    </ol>

    <section class="apply" aria-label="Apply for a free website">
      <span class="scan-me display">Scan me!</span>
      <div class="qr">${qr}</div>
      <div class="apply-copy">
        <h2 class="display">Scan to apply</h2>
        <a class="address" href="https://tendso.com/libre">tendso.com/libre</a>
        <p>Register now. No payment required for this giveaway.</p>
        <span class="only display">Only 100 websites</span>
      </div>
    </section>

    <div class="fine">
      <p>A one-time Off the Record initiative for up to 100 approved businesses. Applications are subject to OTR review and available slots. Display the poster at your business so OTR can verify your photo.</p>
      <p class="provider display">A gift from Off the Record. Websites by Tendso.</p>
    </div>
  </div>
</main>
</body>
</html>
`;

mkdirSync(outputDirectory, { recursive: true });
writeFileSync(htmlPath, html, 'utf8');
console.log(`Poster HTML: ${htmlPath}`);

if (process.argv.includes('--html-only')) process.exit(0);

const candidates = [
  process.env.CHROME_PATH,
  process.platform === 'win32' && 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  process.platform === 'darwin' && '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
const chrome = candidates.find((candidate) => existsSync(candidate));
if (!chrome) throw new Error('Chrome not found. Set CHROME_PATH, or use --html-only and print the HTML at A4 with no margins.');
const profileDirectory = mkdtempSync(path.join(tmpdir(), 'tendso-otr-poster-'));
try {
  await new Promise((resolve, reject) => {
    const browser = spawn(chrome, [
      '--headless=new',
      '--disable-gpu',
      '--no-pdf-header-footer',
      '--allow-file-access-from-files',
      // Let the embedded fonts finish decoding before the page is printed.
      '--virtual-time-budget=5000',
      `--user-data-dir=${profileDirectory}`,
      `--print-to-pdf=${pdfPath}`,
      pathToFileURL(htmlPath).href,
    ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let errors = '';
    browser.stderr.on('data', (chunk) => { errors += chunk.toString(); });
    const timeout = setTimeout(() => {
      browser.kill();
      reject(new Error('Chrome took more than 60 seconds to print the poster.'));
    }, 60_000);
    browser.on('error', (error) => { clearTimeout(timeout); reject(error); });
    browser.on('exit', (code) => {
      clearTimeout(timeout);
      if (code === 0 && existsSync(pdfPath)) resolve();
      else reject(new Error(`Chrome print failed (${code}): ${errors}`));
    });
  });
  console.log(`A4 poster PDF: ${pdfPath}`);
} finally {
  // This directory was created by mkdtemp above; no user files are removed.
  const resolvedProfile = path.resolve(profileDirectory);
  const expectedPrefix = path.join(path.resolve(tmpdir()), 'tendso-otr-poster-');
  if (!resolvedProfile.startsWith(expectedPrefix) || path.dirname(resolvedProfile) !== path.resolve(tmpdir())) {
    throw new Error('Refusing to remove a profile outside the temporary poster directory.');
  }
  rmSync(profileDirectory, { recursive: true, force: true, maxRetries: 4, retryDelay: 250 });
}
