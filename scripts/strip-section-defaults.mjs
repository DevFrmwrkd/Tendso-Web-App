#!/usr/bin/env node
/**
 * Strip template-branded fallback defaults from generic Astro section
 * components. Replaces every "|| 'demo string'" pattern in section
 * frontmatter with an empty default. The transformer's deriveDefaultsFor
 * layer (lib/astro-builder.ts) now provides business-aware fallbacks at
 * build time, so no per-section demo strings should remain.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TARGET_DIR = path.join(ROOT, 'astro-site-template', 'src', 'components', 'generic');

// Per-template defaults we want to clear. Patterns target the typical
// "const x = something || 'demo'" shape inside Astro frontmatter.
const RULES = [
    // Marquees
    [/'Fresh Roasted Daily ✺ Single Origin ✺ Pour-Over Bar ✺ Whole Bean Retail'/g, "'Quality ◆ Trusted ◆ Local ◆ Reliable'"],
    [/'breathe ✦ move ✦ restore ✦ arrive'/g,                                          "'Quality ◆ Trusted ◆ Local ◆ Reliable'"],
    [/'Landscape Design ◆ Hardscaping ◆ Patios & Walls ◆ Irrigation ◆ Lawn Care'/g,    "'Quality ◆ Trusted ◆ Local ◆ Reliable'"],
    [/'MANAGED IT \/ CYBERSECURITY \/ HELPDESK \/ CLOUD & BACKUP \/ NETWORKS \/ ON-SITE SUPPORT'/g, "'Quality ◆ Trusted ◆ Local ◆ Reliable'"],
    [/'Wash ● Dry ● Fold ● Delivered ● Dry Cleaning'/g,                                "'Quality ◆ Trusted ◆ Local ◆ Reliable'"],

    // Trust band cell defaults — replace with empty array so the transformer's
    // auto-hide visibility logic kicks in (section won't render when empty).
    // Hits both inline + multi-line array literals.
    [/(content\.trust\?\.cells && content\.trust\.cells\.length === 4\)\s*\?\s*content\.trust\.cells\s*:\s*)\[[\s\S]*?\]/g, '$1[]'],

    // Why-Us section tags
    [/'Why Ironwood'/g,        "'Why us'"],
    [/'Why Stillwater'/g,      "'Why us'"],
    [/'Why Cedar & Stone'/g,   "'Why us'"],
    [/'Why Northpoint'/g,      "'Why us'"],
    [/'Why Wash House'/g,      "'Why us'"],

    // Why-Us section default items — replace with empty array
    [/(why\.items && why\.items\.length === [34]\s*\?\s*why\.items\s*:\s*)\[[\s\S]*?\];/g, '$1[];'],

    // How-It-Works step defaults
    [/(how\.steps && how\.steps\.length === 3\s*\?\s*how\.steps\s*:\s*)\[[\s\S]*?\];/g, '$1[];'],
    [/(how\.steps && how\.steps\.length\s*\?\s*how\.steps\s*:\s*)\[[\s\S]*?\];/g,         '$1[];'],

    // Testimonials default items
    [/(testimonials\?\.items && [^\?]*\?\s*testimonials\.items\s*:\s*)\[[\s\S]*?\];/g, '$1[];'],
    [/(t\.items && t\.items\.length\s*\?\s*t\.items\s*:\s*)\[[\s\S]*?\];/g,             '$1[];'],

    // FAQ default items
    [/(faq\.items && faq\.items\.length\s*\?\s*faq\.items\s*:\s*)\[[\s\S]*?\];/g, '$1[];'],

    // Gallery captions (already neutral; nothing critical here)

    // Service-area + credentials sections (per-template city/places lists)
    [/'Kerns', 'Buckman', 'Laurelhurst', 'Sunnyside', 'Hawthorne', 'Sellwood', 'Alberta', 'Irvington'/g, ''],
    [/'Boulder', 'Louisville', 'Lafayette', 'Superior', 'Niwot', 'Gunbarrel', 'Erie', 'Longmont'/g,       ''],
    [/'Downtown', 'East Austin', 'South Congress', 'The Domain', 'Round Rock', 'Cedar Park', 'Pflugerville', 'Westlake'/g, ''],
    [/'Downtown', 'Belltown', 'Capitol Hill', 'Queen Anne', 'Ballard', 'Fremont', 'South Lake Union', 'West Seattle'/g,    ''],
    [/'Mission', 'SoMa', 'Hayes Valley', 'Noe Valley', 'Bernal Heights', 'Potrero Hill', 'Dogpatch', 'Castro'/g,           ''],

    // About paragraph defaults — already neutralized in prior pass; this
    // catches anything missed.
    [/'A short story about why this business exists\. Edit in the About section\.',\s*'We kept classes small[^']*'/g, "''"],
    [/'A short story about why this business exists\. Edit in the About section\.',\s*'Every pound is washed[^']*'/g,  "''"],

    // Why-Us section headlines per template
    [/'The difference is the freshness\.'/g,            "''"],
    [/'Small by design\.'/g,                             "''"],
    [/'Reasons crews get rehired\.'/g,                   "''"],
    [/'Built for businesses, not buzzwords\.'/g,          "''"],
    [/'Easy to love, easy to use\.'/g,                    "''"],

    // Per-template service item defaults — strip arrays with branded copy.
    // Cedar & Stone services list (the "Landscape Design & Build" one)
    [/'01', title: 'Landscape Design & Build'[\s\S]*?'05', title: 'Tree & Shrub Work', desc: '[^']*' \}/g, ''],

    // Hero kicker defaults like "Portland, OR · Yoga"
    [/'Portland, OR · Yoga · Pilates · Breathwork'/g,         "''"],
    [/'Boulder, CO · Design · Build · Maintain'/g,             "''"],
    [/'Austin, TX · Managed IT for small business'/g,         "''"],
    [/'Seattle, WA · Wash · Dry · Fold · Delivered'/g,         "''"],
    [/'Small-batch · roasted on Mission St · Est\. 2014'/g,    "''"],

    // CTA-band headline defaults
    [/'Come for one cup\.<br \/><em>Leave with a bag\.<\/em>'/g,         "''"],
    [/'Your mat is <em>waiting\.<\/em>'/g,                                 "''"],
    [/"Let's break <em>ground\.<\/em>"/g,                                  "''"],
    [/'Stop fighting <em>your tech\.<\/em>'/g,                             "''"],
    [/'Hand us your <em>laundry\.<\/em>'/g,                                "''"],

    // CTA primary label defaults
    [/'Plan your visit'/g,             "''"],
    [/'Book your first class'/g,        "''"],
    [/'Get your free quote'/g,           "''"],
    [/'Book a free IT review'/g,         "''"],
    [/'Schedule your first pickup'/g,   "''"],

    // Generic headline defaults left from earlier neutralization
    [/'Find us on Mission St\.'/g,    "''"],
    [/'Find the studio\.'/g,           "''"],
    [/'On Granite Rd, Boulder\.'/g,    "''"],
    [/'Downtown Austin office\.'/g,    "''"],
    [/'Find us on Harbor St\.'/g,      "''"],

    // Per-template hero kicker / sub
    [/'Small-batch · roasted on Mission St · Est\. 2014'/g, "''"],
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
            const matchLen = (before.match(pat) || []).length;
            subs += matchLen;
        }
        if (src !== orig) {
            await fs.writeFile(file, src, 'utf-8');
            totalFiles++;
            totalSubs += subs;
            console.log(`  ✓ ${path.relative(ROOT, file)}  (${subs})`);
        }
    }
    console.log(`\nStripped ${totalFiles} files, ${totalSubs} substitutions.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
