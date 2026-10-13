#!/usr/bin/env node
// Rebuild the A4 poster with: node scripts/generate-otr-giveaway-poster.mjs
// Chrome is used only to print the self-contained HTML; no network requests run.
// Override its executable with CHROME_PATH on macOS/Linux or another installation.
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
const logo = readFileSync(path.join(root, 'public', 'otr-mark.png')).toString('base64');
// The four-module white quiet zone remains inside the SVG and is never cropped.
const qr = renderToStaticMarkup(React.createElement(QRCodeSVG, {
  value: posterUrl,
  size: 196,
  level: 'M',
  marginSize: 4,
  title: 'Apply for the Off the Record free website giveaway',
}));

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Off the Record — Free Tendso website giveaway</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #101010; background: #e8e8e8; }
  .poster { width: 210mm; height: 297mm; padding: 15mm 17mm 13mm; margin: 0 auto; background: #fff; display: flex; flex-direction: column; }
  .brand { display: flex; align-items: center; gap: 14px; padding-bottom: 9mm; border-bottom: 2px solid #101010; }
  .mark { width: 18mm; height: auto; }
  .wordmark { font-size: 27px; font-weight: 900; line-height: .98; letter-spacing: -.7px; }
  .brand-note { margin-left: auto; font-size: 11px; font-weight: 700; line-height: 1.45; text-align: right; letter-spacing: 1.2px; text-transform: uppercase; }
  .eyebrow { margin: 10mm 0 5mm; display: flex; align-items: center; gap: 9px; font-size: 12px; font-weight: 700; letter-spacing: 1.3px; text-transform: uppercase; }
  .eyebrow::before { content: ''; width: 9px; height: 9px; border-radius: 50%; background: #f2532d; }
  h1 { margin: 0; font-size: 68px; line-height: .99; letter-spacing: -3.3px; font-weight: 900; }
  h1 span { display: block; }
  .intro { margin: 5mm 0 0; max-width: 157mm; font-size: 19px; line-height: 1.4; }
  .steps { margin: 8mm 0 0; padding: 0; list-style: none; display: grid; gap: 4.5mm; }
  .steps li { display: flex; align-items: flex-start; gap: 12px; }
  .number { flex: 0 0 27px; height: 27px; display: flex; align-items: center; justify-content: center; border: 1.5px solid #101010; border-radius: 50%; font-size: 13px; font-weight: 700; }
  .step-text { padding-top: 2px; font-size: 16px; line-height: 1.35; }
  .apply { margin-top: auto; padding-top: 6mm; border-top: 2px solid #101010; display: flex; align-items: center; gap: 5mm; }
  .qr { flex: 0 0 48mm; height: 48mm; }
  .qr svg { display: block; width: 100%; height: 100%; }
  .apply h2 { margin: 0 0 9px; font-size: 25px; font-weight: 900; line-height: 1.03; letter-spacing: -.7px; }
  .address { display: inline-block; color: #101010; font-size: 21px; line-height: 1.4; font-weight: 700; text-decoration-thickness: 1px; text-underline-offset: 4px; }
  .apply p { margin: 10px 0 0; font-size: 12px; line-height: 1.45; }
  .fine-print { margin: 5mm 0 0; font-size: 10px; line-height: 1.5; }
  .provider { margin: 3mm 0 0; font-size: 10px; font-weight: 700; letter-spacing: .8px; text-transform: uppercase; }
  @media print { body { background: #fff; } .poster { margin: 0; } }
</style>
</head>
<body>
<main class="poster" aria-label="Off the Record community giveaway poster">
  <header class="brand">
    <img class="mark" src="data:image/png;base64,${logo}" alt="">
    <div class="wordmark">OFF THE<br>RECORD</div>
    <div class="brand-note">For our<br>local community</div>
  </header>
  <p class="eyebrow">100 free websites · One-time giveaway</p>
  <h1><span>A free website.</span><span>From Off</span><span>the Record.</span></h1>
  <p class="intro">Off the Record is giving local businesses a free website built by <strong>Tendso.</strong></p>
  <ol class="steps">
    <li><span class="number">1</span><div class="step-text"><strong>Hang this OTR poster</strong> in your business.</div></li>
    <li><span class="number">2</span><div class="step-text"><strong>Register your business</strong> and upload a photo of this poster on display.</div></li>
    <li><span class="number">3</span><div class="step-text"><strong>OTR reviews your application.</strong><br>Tendso builds your free website once approved.</div></li>
  </ol>
  <section class="apply" aria-label="Apply for a free website">
    <div class="qr">${qr}</div>
    <div>
      <h2>SCAN TO APPLY</h2>
      <a class="address" href="https://tendso.com/libre">tendso.com/libre</a>
      <p>Register now.<br>No payment required for this giveaway.</p>
    </div>
  </section>
  <p class="fine-print">A one-time Off the Record initiative for up to 100 approved businesses. Applications are subject to OTR review and available slots. Display the poster at your business so OTR can verify your photo.</p>
  <p class="provider">A gift from Off the Record. Websites by Tendso.</p>
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
