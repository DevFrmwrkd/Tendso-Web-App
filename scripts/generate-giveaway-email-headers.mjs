#!/usr/bin/env node
// Rebuild the giveaway email header images with:
//   node scripts/generate-giveaway-email-headers.mjs
// Email clients drop tilts, diagonal cuts and web fonts, so each festive header
// in lib/email/giveawayTemplates.ts is one image. Chrome draws each from
// self-contained HTML at 2x (1200x500) into public/email/; no network requests
// run. Override Chrome's location with CHROME_PATH.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(root, 'public', 'email');
const workDirectory = path.join(root, 'output', 'giveaway-email-headers');
const asBase64 = (...parts) => readFileSync(path.join(root, 'public', ...parts)).toString('base64');
const otrMark = asBase64('otr-mark.png');
const tendsoLogo = asBase64('tendso-logo.png');

// Google's own subsets, as app/self-hosted-fonts.css declares them; latin-ext carries ₱.
const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const LATIN_EXT = 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF';
const fontFaces = [
  [800, 'unbounded-latin-800-normal.woff2', LATIN],
  [900, 'unbounded-latin-900-normal.woff2', LATIN],
  [800, 'unbounded-latin-ext-800-normal.woff2', LATIN_EXT],
  [900, 'unbounded-latin-ext-900-normal.woff2', LATIN_EXT],
].map(([weight, file, range]) => `@font-face { font-family: 'Unbounded'; font-weight: ${weight}; src: url(data:font/woff2;base64,${asBase64('fonts', file)}) format('woff2'); unicode-range: ${range}; }`).join('\n');

const GIFT = `<svg class="gift" viewBox="0 0 132 112" aria-hidden="true">
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
</svg>`;

/** One header: the banner word, and either a stamp or the ₱0 sticker. */
const HEADERS = [
  { file: 'giveaway-received.png', banner: 'SALAMAT!', stamp: 'APPLICATION RECEIVED' },
  { file: 'giveaway-approved.png', banner: 'APPROVED!', stamp: 'BY OFF THE RECORD' },
  { file: 'giveaway-live.png', banner: 'IT&#39;S LIVE!', sticker: true },
];

const page = ({ banner, stamp, sticker }) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><style>
${fontFaces}
* { box-sizing: border-box; }
html, body { margin: 0; width: 600px; height: 250px; overflow: hidden; background: #0D0D0D; }
.head { position: relative; width: 600px; height: 250px; overflow: hidden; background: #0D0D0D; font-family: Unbounded, sans-serif; }
.layer { position: absolute; inset: 0; }
.rays { background: repeating-conic-gradient(from 0deg at 50% 62%, rgba(255, 255, 255, .06) 0deg 6deg, transparent 6deg 12deg); }
.stripe { background: #E23A1F; clip-path: polygon(0 84%, 100% 66%, 100% 70%, 0 88%); }
.gold { background: #FFC531; clip-path: polygon(0 88%, 100% 70%, 100% 100%, 0 100%); }
.lockup { position: absolute; left: 0; right: 0; top: 20px; display: flex; align-items: center; justify-content: center; gap: 10px; color: #fff; font-size: 12px; font-weight: 800; letter-spacing: .04em; }
.lockup .otr { height: 24px; filter: invert(1); }
.lockup .tendso { height: 17px; }
.lockup .x { color: #FFC531; font-size: 18px; font-weight: 900; }
.gift { position: absolute; left: 262px; top: 50px; width: 76px; height: 64px; }
.banner { position: absolute; left: 0; right: 0; top: ${sticker ? 104 : 80}px; display: flex; justify-content: center; }
.banner span { padding: .1em .42em .14em; background: #FFC531; border: 5px solid #0D0D0D; border-radius: 18px; box-shadow: 10px 10px 0 #E23A1F; transform: rotate(-3deg); font-size: ${sticker ? 54 : 58}px; font-weight: 900; line-height: 1; letter-spacing: -.03em; color: #0D0D0D; }
.stamp { position: absolute; right: 64px; top: 156px; padding: 5px 11px; border: 4px solid #E23A1F; border-radius: 8px; background: #F3EFE6; color: #E23A1F; transform: rotate(8deg); font-size: 14px; font-weight: 900; letter-spacing: .02em; white-space: nowrap; }
.sticker { position: absolute; right: 46px; top: 58px; width: 88px; height: 88px; border-radius: 50%; background: #E23A1F; color: #fff; border: 4px solid #0D0D0D; outline: 2px dashed #fff; outline-offset: -10px; transform: rotate(12deg); display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 9px; font-weight: 800; line-height: 1.1; }
.sticker strong { font-size: 22px; font-weight: 900; }
</style></head><body>
<div class="head">
  <div class="layer rays"></div>
  <div class="layer stripe"></div>
  <div class="layer gold"></div>
  <div class="lockup"><img class="otr" src="data:image/png;base64,${otrMark}" alt=""><span>OFF THE RECORD</span><span class="x">×</span><img class="tendso" src="data:image/png;base64,${tendsoLogo}" alt=""></div>
  ${sticker ? GIFT : ''}
  <div class="banner"><span>${banner}</span></div>
  ${stamp ? `<span class="stamp">${stamp}</span>` : ''}
  ${sticker ? '<span class="sticker">YOU PAY<strong>₱0</strong></span>' : ''}
</div>
</body></html>`;

const candidates = [
  process.env.CHROME_PATH,
  process.platform === 'win32' && 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  process.platform === 'darwin' && '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
const chrome = candidates.find((candidate) => existsSync(candidate));
if (!chrome) throw new Error('Chrome not found. Set CHROME_PATH.');

mkdirSync(outputDirectory, { recursive: true });
mkdirSync(workDirectory, { recursive: true });
const profileDirectory = mkdtempSync(path.join(tmpdir(), 'tendso-email-headers-'));
try {
  for (const header of HEADERS) {
    const htmlPath = path.join(workDirectory, header.file.replace(/\.png$/, '.html'));
    const pngPath = path.join(outputDirectory, header.file);
    writeFileSync(htmlPath, page(header), 'utf8');
    await new Promise((resolve, reject) => {
      const browser = spawn(chrome, [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--force-device-scale-factor=2',
        '--window-size=600,250',
        '--virtual-time-budget=5000',
        `--user-data-dir=${profileDirectory}`,
        `--screenshot=${pngPath}`,
        pathToFileURL(htmlPath).href,
      ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
      let errors = '';
      browser.stderr.on('data', (chunk) => { errors += chunk.toString(); });
      const timeout = setTimeout(() => {
        browser.kill();
        reject(new Error(`Chrome took more than 60 seconds to draw ${header.file}.`));
      }, 60_000);
      browser.on('error', (error) => { clearTimeout(timeout); reject(error); });
      browser.on('exit', (code) => {
        clearTimeout(timeout);
        if (code === 0 && existsSync(pngPath)) resolve();
        else reject(new Error(`Chrome screenshot failed (${code}): ${errors}`));
      });
    });
    console.log(`Email header: ${pngPath}`);
  }
} finally {
  // This directory was created by mkdtemp above; no user files are removed.
  const resolvedProfile = path.resolve(profileDirectory);
  const expectedPrefix = path.join(path.resolve(tmpdir()), 'tendso-email-headers-');
  if (!resolvedProfile.startsWith(expectedPrefix) || path.dirname(resolvedProfile) !== path.resolve(tmpdir())) {
    throw new Error('Refusing to remove a profile outside the temporary directory.');
  }
  rmSync(profileDirectory, { recursive: true, force: true, maxRetries: 4, retryDelay: 250 });
}
