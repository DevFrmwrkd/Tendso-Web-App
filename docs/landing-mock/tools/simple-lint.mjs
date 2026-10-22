// Simplicity lint for every app screen on a page (Theo's rule #1: never overwhelm — a grandmother must get it).
// usage: node tools/simple-lint.mjs <page.html> [--json]
// Per screen (.screen-root): visible words (status bar excluded), buttons/pills, text smaller than 16px.
// Limits: words ≤ 20 (camera screens ≤ 12), tappable controls ≤ 3, answer options (.a-opt / [data-option]) ≤ 4, small-text elements = 0.
import { createRequire } from 'node:module';
import path from 'node:path';
const req = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PW_PATH, '/private/tmp/claude-501/-Volumes-SSD-New-Coding-Projects-Tendso-App/483ca8c2-a58c-4230-9b97-ce17356f700a/scratchpad/rec/node_modules/playwright-core', 'playwright-core']) {
  if (!p) continue; try { pw = req(p); break; } catch {}
}
const file = path.resolve(process.argv[2]);
const b = await pw.chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1600, height: 1200 } });
await p.goto('file://' + file); await p.waitForTimeout(4000);
const rows = await p.evaluate(() => {
  const out = [];
  document.querySelectorAll('.screen-root').forEach((root, i) => {
    const scr = root.firstElementChild || root;
    const name = scr.dataset?.screen || scr.className?.toString().split(' ').find((c) => c.startsWith('scr-')) || root.closest('[data-name]')?.dataset.name || ('#' + i);
    const label = root.closest('figure, .step, [class*="step"], li')?.querySelector('h3, h4, .name, [class*="name"]')?.textContent?.trim().slice(0, 30) || '';
    const rr = root.getBoundingClientRect();
    const scale = rr.width / 390 || 1;
    let words = 0, small = 0; const smallTexts = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode; const el = n.parentElement;
      if (!el || el.closest('.sb, .a-home, .a-tabbar, [aria-hidden="true"], script, style')) continue;
      const t = n.textContent.trim(); if (!t) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.bottom < rr.top || r.top > rr.bottom) continue; // outside the visible screen
      words += t.split(/\s+/).filter((w) => /[\p{L}\p{N}₱]/u.test(w)).length;
      const px = parseFloat(cs.fontSize);
      if (px < 16) { small++; if (smallTexts.length < 4) smallTexts.push(t.slice(0, 24) + ` (${px}px)`); }
    }
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.top < rr.bottom && r.bottom > rr.top && !e.closest('.sb, .a-tabbar'); };
    const opts = [...root.querySelectorAll('.a-opt, [data-option]')].filter(vis);
    const taps = [...root.querySelectorAll('button, a, .door, .a-pill, [role="button"], .a-chip, [class*="pill"], [class*="btn"]')]
      .filter((e) => vis(e) && !e.closest('.a-opt, [data-option]')).length;
    const camera = /cam|guide|camera/i.test(name);
    const lim = camera ? 12 : 20;
    out.push({ name, label, words, taps, opts: opts.length, small, ok: words <= lim && taps <= 3 && opts.length <= 4 && small === 0, smallTexts, lim });
  });
  return out;
});
await b.close();
if (process.argv.includes('--json')) { console.log(JSON.stringify(rows, null, 1)); process.exit(0); }
let bad = 0;
for (const r of rows) {
  if (!r.ok) bad++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${String(r.name).padEnd(22)} ${r.label.padEnd(30)} words ${String(r.words).padStart(3)}/${r.lim}  taps ${r.taps}/3  options ${r.opts}/4  small ${r.small}${r.smallTexts.length ? '  e.g. ' + r.smallTexts.join(' | ') : ''}`);
}
console.log(`\n${rows.length - bad}/${rows.length} screens pass`);
