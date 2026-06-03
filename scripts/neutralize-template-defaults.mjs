#!/usr/bin/env node
/**
 * Neutralize template-specific demo strings in the generic Astro components.
 * Replaces Ironwood/Stillwater/Cedar&Stone/Northpoint/WashHouse brand
 * names, addresses, phones, and the most jarring template-specific copy
 * with neutral placeholders so the editor's empty-state preview doesn't
 * read like Ironwood / Stillwater / etc when applied to an unrelated
 * business.
 *
 * Safe to run multiple times — pattern-based, idempotent.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TARGET_DIR = path.join(ROOT, 'astro-site-template', 'src', 'components', 'generic');

const RULES = [
    // ── Brand names in default `||` ──
    [/layout\.businessName \|\| 'Ironwood'/g,      "layout.businessName || 'Your Business'"],
    [/layout\.businessName \|\| 'Stillwater'/g,    "layout.businessName || 'Your Business'"],
    [/layout\.businessName \|\| 'Cedar & Stone'/g, "layout.businessName || 'Your Business'"],
    [/layout\.businessName \|\| 'Northpoint IT'/g, "layout.businessName || 'Your Business'"],
    [/layout\.businessName \|\| 'Wash House'/g,    "layout.businessName || 'Your Business'"],

    // ── Phone numbers ──
    [/\(415\) 555-0102/g,  '+0 000 000 0000'],
    [/\(503\) 555-0148/g,  '+0 000 000 0000'],
    [/\(303\) 555-0173/g,  '+0 000 000 0000'],
    [/\(512\) 555-0190/g,  '+0 000 000 0000'],
    [/\(206\) 555-0117/g,  '+0 000 000 0000'],

    // ── Street addresses ──
    [/88 Mission St/g,    'Your address line 1'],
    [/214 Linden Ave/g,   'Your address line 1'],
    [/1190 Granite Rd/g,  'Your address line 1'],
    [/530 Folsom St/g,    'Your address line 1'],
    [/76 Harbor St/g,     'Your address line 1'],

    // ── City / state postal ──
    [/Portland, OR 97232/g,       'Your city, state postal'],
    [/Boulder, CO 80302/g,        'Your city, state postal'],
    [/Austin, TX 78701/g,         'Your city, state postal'],
    [/Seattle, WA 98101/g,        'Your city, state postal'],
    [/San Francisco, CA 94105/g,  'Your city, state postal'],

    // ── About blurbs (long demo copy) ──
    [/'Ironwood started with a borrowed drum roaster and a stubborn belief that a neighborhood deserves coffee roasted <em>close enough to smell it<\/em> on the walk in\.'/g,
     "'A short story about why this business exists. Edit in the About section.'"],
    [/'Stillwater began as a single borrowed room and a standing intention: make somewhere people could put the day down for an hour\. No mirrors to perform for, no leaderboards, no rush\.'/g,
     "'A short story about why this business exists. Edit in the About section.'"],
    [/'Northpoint started because small businesses deserve the same reliable tech as the big firms — without hiring a full-time team\. We become your IT department: monitoring quietly in the background and showing up fast when something breaks\.'/g,
     "'A short story about why this business exists. Edit in the About section.'"],
    [/'Wash House opened to fix a simple problem: laundry eats your weekend\. So we built a bright, friendly spot where you can wash it yourself in clean, modern machines — or just hand it to us and get it back folded\.'/g,
     "'A short story about why this business exists. Edit in the About section.'"],

    // ── Footer blurbs ──
    [/'Small-batch coffee, roasted in the window on Mission St and poured over the bar by hand since 2014\.'/g,
     "'A brief one-line description of what this business does. Edit in the Footer section.'"],
    [/'A small neighborhood studio for unhurried yoga, reformer pilates and breathwork on Linden Ave, Portland\.'/g,
     "'A brief one-line description of what this business does. Edit in the Footer section.'"],
    [/'Landscape design, build, and hardscaping across Boulder County\. Licensed, insured, and built to last\.'/g,
     "'A brief one-line description of what this business does. Edit in the Footer section.'"],
    [/'Managed IT, cybersecurity, and support that keeps Austin small businesses running\.'/g,
     "'A brief one-line description of what this business does. Edit in the Footer section.'"],
    [/'Wash & fold, free pickup & delivery, dry cleaning, and a bright self-service laundromat on Harbor St, Seattle\.'/g,
     "'A brief one-line description of what this business does. Edit in the Footer section.'"],

    // ── CTA band sub-line address fallbacks ──
    [/'88 Mission St'/g,           "''"],
    [/'214 Linden Ave, Portland'/g, "''"],
    [/'1190 Granite Rd, Boulder'/g, "''"],
    [/'530 Folsom St, Austin'/g,   "''"],
    [/'76 Harbor St, Seattle'/g,   "''"],

    // ── Service area body fallbacks ──
    [/'The café is on Mission St, but our roaster delivers whole-bean and wholesale orders to neighborhoods across San Francisco\.'/g,
     "'Describe the area you serve. Edit in the Service area section.'"],
    [/'The studio sits on Linden Ave, an easy ride from neighborhoods all over the east and inner city\.'/g,
     "'Describe the area you serve. Edit in the Service area section.'"],
    [/'Based on Granite Rd, our crews cover Boulder and the surrounding Front Range towns\.'/g,
     "'Describe the area you serve. Edit in the Service area section.'"],
    [/'Based downtown on Folsom St, we support businesses across the metro — remote in minutes, on-site same day\.'/g,
     "'Describe the area you serve. Edit in the Service area section.'"],
    [/"Our drivers cover neighborhoods all around Harbor St — schedule a window and we'll be there\."/g,
     "'Describe the area you serve. Edit in the Service area section.'"],

    // ── Hero default copy ──
    [/'Coffee worth the walk down Mission St\.'/g,                                          "''"],
    [/'Small-batch · roasted on Mission St · Est\. 2014'/g,                                  "''"],
    [/"We roast in small batches three mornings a week and pour every cup over the bar by hand\. Pull up a stool — the good stuff goes fast\."/g, "''"],
    [/'Portland, OR · Yoga · Pilates · Breathwork'/g,                                        "''"],
    [/'A small neighborhood studio for unhurried movement — group flows, reformer pilates, and breathwork led by teachers who actually learn your name\.'/g, "''"],
    [/'Boulder, CO · Design · Build · Maintain'/g,                                            "''"],
    [/'Cedar & Stone designs, builds, and maintains landscapes and hardscapes across the Front Range — done right the first time and built to last through Colorado seasons\.'/g, "''"],
    [/'Austin, TX · Managed IT for small business'/g,                                         "''"],
    [/'We keep your computers, network, and data running so you can run the business\. Fast helpdesk, proactive monitoring, and real humans who pick up the phone\.'/g, "''"],
    [/'Seattle, WA · Wash · Dry · Fold · Delivered'/g,                                        "''"],
    [/"Drop it off or we'll pick it up — washed, folded, and back to your door, usually next day\. Plus dry cleaning and a bright self-service laundromat on Harbor St\."/g, "''"],

    // ── Per-template floating tags ──
    [/'Est\. on Linden Ave'/g, "''"],
    [/'on Harbor St'/g,         "''"],

    // ── Per-template hero headlines & section copy ──
    [/'A corner roastery, built on <em>the long pull\.<\/em>'/g, "''"],
    [/'A quiet room on a <em>loud street\.<\/em>'/g, "''"],
    [/'Built by crews who <em>show up\.<\/em>'/g,    "''"],
    [/'Your IT department, <em>on call\.<\/em>'/g,   "''"],
    [/"The neighborhood's <em>laundry room\.<\/em>"/g, "''"],

    // ── Section "Why X" headlines ──
    [/'The difference is the freshness\.'/g,           "''"],
    [/'Small by design\.'/g,                            "''"],
    [/'Reasons crews get rehired\.'/g,                  "''"],
    [/'Built for businesses, not buzzwords\.'/g,        "''"],
    [/'Easy to love, easy to use\.'/g,                  "''"],

    // ── Footer note "Roasted fresh · bagged with a date" etc ──
    [/'Roasted fresh · bagged with a date'/g, "''"],
    [/'Move gently · breathe fully'/g,         "''"],
    [/'Licensed · Insured · Warrantied'/g,     "''"],
    [/'\/\/ uptime is the product'/g,          "''"],
    [/'Wash · Dry · Fold · Delivered'/g,       "''"],
];

async function walk(dir, out) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) await walk(full, out);
        else if (e.isFile() && e.name.endsWith('.astro')) out.push(full);
    }
    return out;
}

async function main() {
    const files = await walk(TARGET_DIR, []);
    let totalFiles = 0;
    let totalSubs = 0;
    for (const file of files) {
        const orig = await fs.readFile(file, 'utf-8');
        let src = orig;
        let subs = 0;
        for (const [pat, repl] of RULES) {
            const before = src;
            src = src.replace(pat, repl);
            // Quick count of substitutions for reporting.
            const matchLen = (before.match(pat) || []).length;
            subs += matchLen;
        }
        if (src !== orig) {
            await fs.writeFile(file, src, 'utf-8');
            totalFiles++;
            totalSubs += subs;
            console.log(`  ✓ ${path.relative(ROOT, file)} (${subs} subs)`);
        }
    }
    console.log(`\nNeutralized ${totalFiles} files, ${totalSubs} substitutions.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
