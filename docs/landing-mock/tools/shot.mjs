// Screenshot helper for the mock.
// usage: node docs/landing-mock/tools/shot.mjs <file-or-url> <out.png> [width=1440] [height=900] [scrollY=0] [waitMs=1800]
// Needs playwright-core: resolves it from the session scratchpad install or a global install.
import { createRequire } from 'node:module';
import path from 'node:path';
const req = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PW_PATH, '/private/tmp/claude-501/-Volumes-SSD-New-Coding-Projects-Tendso-App/483ca8c2-a58c-4230-9b97-ce17356f700a/scratchpad/rec/node_modules/playwright-core', 'playwright-core']) {
  if (!p) continue; try { pw = req(p); break; } catch {}
}
if (!pw) { console.error('playwright-core not found; set PW_PATH'); process.exit(1); }
const [,, target, out, w = 1440, h = 900, sy = 0, wait = 1800] = process.argv;
const url = /^https?:|^file:/.test(target) ? target : 'file://' + path.resolve(target);
const b = await pw.chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(url, { waitUntil: 'load' });
await p.waitForTimeout(600);
if (+sy) { await p.evaluate((y) => (window.T?.lenis ? window.T.lenis.scrollTo(y, { immediate: true }) : scrollTo(0, y)), +sy); }
await p.waitForTimeout(+wait);
await p.screenshot({ path: out });
const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
console.log(JSON.stringify({ out, errors: errs, horizontalOverflow: overflow }));
await b.close();
