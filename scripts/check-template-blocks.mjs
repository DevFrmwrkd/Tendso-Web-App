#!/usr/bin/env node
/**
 * Guards the editor's Sections panel against the templates it claims to describe.
 *
 * The panel lists whatever templateCatalog.sectionsForTemplate(code) returns. If
 * that and the actual Page<CODE>.astro wrappers disagree, the panel either offers
 * a switch that controls nothing or hides a section the template really renders —
 * both silent, both only visible to whoever opens the editor.
 *
 * This script re-derives the truth by scanning every wrapper for the sections it
 * renders and the `visibility.*` gate on each, then asserts:
 *
 *   1. every rendered section (bar header/footer) IS gated — an ungated section
 *      can never be removed by an admin, whatever the editor shows
 *   2. the committed templateSectionOrder.generated.ts matches what the wrappers
 *      render, and in the same order
 *   3. every hand-authored label in templateSectionLabels.ts is keyed to a
 *      template that exists and a block that template actually renders — a label
 *      for a section the page has not got would name a switch that is not there
 *   4. a wrapper that defines a Leaflet boot also LOADS leaflet.css and
 *      leaflet.js — defining the boot without them is silent: window.L never
 *      exists, the boot returns, and the section's drawn fallback map face is
 *      all any owner ever sees however many coordinates they type
 *   5. a wrapper frontmatter doc comment never closes itself early — an
 *      asterisk followed by a slash inside the prose ends the comment on the
 *      spot, and the rest of the paragraph is parsed as JavaScript. That
 *      fails EVERY site build, not just this template: index.astro imports
 *      all 65 wrappers into one bundle. No CI job runs the astro build, so
 *      without this check nothing warns until a customer site fails to render
 *   6. no template is missing from the scan
 *
 * Run: node scripts/check-template-blocks.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { businessTemplateBlocks } from './business-template-blocks.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const COMPONENTS = path.join(ROOT, "astro-site-template/src/components");

/** Section-name prefixes, longest-first so CtaBand wins over Cta. */
const TYPES = [
    "Header", "Hero", "Marquee", "Trust", "About", "Services", "Why", "How",
    "Credentials", "Testimonials", "Gallery", "Faq", "Area", "Location", "CtaBand", "Footer",
];
/** Section type -> the ALL_BLOCKS name the editor uses. */
const TYPE_TO_BLOCK = {
    Hero: "HERO", Marquee: "MARQUEE", Trust: "TRUST", About: "ABOUT", Services: "SERVICES",
    Why: "WHY-US", How: "HOW-IT-WORKS", Testimonials: "TESTIMONIALS", Gallery: "GALLERY",
    Faq: "FAQ", Area: "SERVICE-AREA", Credentials: "CREDENTIALS", Location: "LOCATION",
    CtaBand: "CTA-BAND", Footer: "FOOTER",
};
const WORD_BOUNDARY = String.fromCharCode(92) + "b";

const typeOf = (name) =>
    TYPES.filter((t) => name.startsWith(t)).sort((a, b) => b.length - a.length)[0] ?? null;

const bodyOf = (file) => {
    const src = fs.readFileSync(file, "utf8").split("\r\n").join("\n");
    const parts = src.split(/^---$/m);
    return parts.length >= 3 ? parts.slice(2).join("---") : src;
};

/** Locate a component file by name anywhere under components/ (for *Spine). */
const findFile = (name) => {
    for (const fam of fs.readdirSync(COMPONENTS)) {
        const d = path.join(COMPONENTS, fam);
        if (!fs.statSync(d).isDirectory()) continue;
        const direct = path.join(d, `${name}.astro`);
        if (fs.existsSync(direct)) return direct;
        for (const sub of fs.readdirSync(d)) {
            const p = path.join(d, sub);
            if (fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, `${name}.astro`)))
                return path.join(p, `${name}.astro`);
        }
    }
    return null;
};

/** Sections a wrapper renders, following shared *Spine components one level in. */
const collect = (file, acc = new Map(), depth = 0) => {
    if (!file || depth > 2) return acc;
    const businessBlocks = businessTemplateBlocks(file);
    if (businessBlocks) {
        for (const [type, entry] of businessBlocks) if (!acc.has(type)) acc.set(type, entry);
        return acc;
    }
    const body = bodyOf(file);
    for (const m of body.matchAll(/<([A-Z][A-Za-z]+)[\s/>]/g)) {
        const name = m[1];
        if (name === "DOCTYPE") continue;
        if (/Spine$/.test(name)) { collect(findFile(name), acc, depth + 1); continue; }
        const type = typeOf(name);
        if (!type) continue;
        const ls = body.lastIndexOf("\n", m.index) + 1;
        let le = body.indexOf("\n", m.index);
        if (le === -1) le = body.length;
        const g = /visibility\.([A-Za-z]+)/.exec(body.slice(ls, le));
        // Keep the gated sighting if we previously saw an ungated one.
        if (!acc.has(type) || (g && !acc.get(type).gate)) acc.set(type, { comp: name, gate: g?.[1] ?? null });
    }
    return acc;
};

const scanned = {};
for (const fam of fs.readdirSync(COMPONENTS)) {
    const d = path.join(COMPONENTS, fam);
    if (!fs.statSync(d).isDirectory()) continue;
    for (const f of fs.readdirSync(d)) {
        const m = /^Page([A-Z]+)\.astro$/.exec(f);
        if (!m) continue;
        scanned[`${fam}:${m[1]}`] = collect(path.join(d, f));
    }
}

// ── Read the SHIPPED manifest, so this verifies what the editor actually
//    imports rather than a copy that could drift from it.
const generated = fs.readFileSync(
    path.join(ROOT, "components/editor/templateSectionOrder.generated.ts"), "utf8");
const declared = {};
for (const m of generated.matchAll(/"([^"]+)":\s*\[([^\]]*)\]/g)) {
    declared[m[1]] = [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}
if (!Object.keys(declared).length)
    throw new Error("could not parse templateSectionOrder.generated.ts — is it empty?");

// ── Hand-authored labels. These cannot change WHICH sections are offered, only
//    what they are called, so the only failure they can cause is a label keyed
//    to a block its template never renders.
const labelSrc = fs.readFileSync(
    path.join(ROOT, "components/editor/templateSectionLabels.ts"), "utf8");
const labelled = {};
{
    const body = labelSrc.slice(labelSrc.indexOf("TEMPLATE_SECTION_LABELS"));
    let code = null;
    for (const line of body.split("\n")) {
        const codeM = /^\s{4}"([^"]+)":\s*\{/.exec(line);
        if (codeM) { code = codeM[1]; labelled[code] = []; continue; }
        if (/^\s{4}\},/.test(line)) { code = null; continue; }
        const blockM = /^\s{8}"([A-Z-]+)":/.exec(line);
        if (code && blockM) labelled[code].push(blockM[1]);
    }
}

const errors = [];
const codes = Object.keys(scanned).sort();

// ── UNSCOPED GLOBALS ──────────────────────────────────────────────────
//    index.astro imports every wrapper, so Astro bundles every is:global
//    block into ONE stylesheet that ships on every page. A bare element
//    selector in one of them reaches all 63 templates.
//
//    Two blocks shipped h1,h2,h3,h4{text-transform:uppercase} and
//    capitalised the headings of every mixed-case design in the catalogue.
//    Nothing caught it: the build passes, tsc passes, every other check here
//    passes, and the page renders perfectly — just in the wrong case.
//
//    Only text-transform is policed. The other properties those blocks set
//    (font-family, weight, leading) are overridden by every template that
//    styles its own headings, so they never surface. text-transform is the
//    one almost nobody declares, which is exactly why it leaked.
{
    const walkStyles = (dir) => {
        for (const f of fs.readdirSync(dir)) {
            const p = path.join(dir, f);
            if (fs.statSync(p).isDirectory()) { walkStyles(p); continue; }
            if (!f.endsWith(".astro")) continue;
            const src = fs.readFileSync(p, "utf8");
            for (const block of src.matchAll(/<style[^>]*is:global[^>]*>([\s\S]*?)<\/style>/g)) {
                // Comments first. A rule with one above it would otherwise read
                // as a selector called `/* Buttons … */ .btn`, which is neither
                // page-prefixed nor a class and so reports a phantom leak.
                const css = block[1].replace(/\/\*[\s\S]*?\*\//g, " ");
                for (const rule of css.split("}")) {
                    if (!/text-transform\s*:/i.test(rule)) continue;
                    const sel = (rule.split("{")[0] || "").trim();
                    if (!sel || sel.startsWith("@")) continue;
                    // Split on TOP-LEVEL commas only: `:where(h1,h2,h3,h4)`
                    // carries its own, and splitting inside it turns a properly
                    // scoped rule into three bare element selectors.
                    const parts = [];
                    let depth = 0, cur = "";
                    for (const ch of sel) {
                        if (ch === "(") depth++;
                        else if (ch === ")") depth--;
                        if (ch === "," && depth === 0) { parts.push(cur); cur = ""; continue; }
                        cur += ch;
                    }
                    parts.push(cur);
                    // Scoped enough: every part is either page-prefixed or a
                    // class (a class cannot collide across templates).
                    const scoped = parts.every((one) => /\[data-(?:page|capture-layout)|^\./.test(one.trim()));
                    if (scoped) continue;
                    const short = sel.replace(/\s+/g, " ").slice(0, 70);
                    errors.push(
                        path.relative(ROOT, p) +
                        ': is:global sets text-transform on the UNSCOPED selector "' + short +
                        '" — it reaches every template. Prefix it with html[data-page="…"].'
                    );
                }
            }
        }
    };
    walkStyles(COMPONENTS);
}

// ── Leaflet wiring. Cheap, and it catches a failure that is invisible in
//    every automated check we have: the page builds, the section renders, the
//    map just never appears.
for (const fam of fs.readdirSync(COMPONENTS)) {
    const d = path.join(COMPONENTS, fam);
    if (!fs.statSync(d).isDirectory()) continue;
    for (const f of fs.readdirSync(d)) {
        if (!/^Page[A-Z]+\.astro$/.test(f)) continue;
        const src = fs.readFileSync(path.join(d, f), "utf8");
        if (!/InitMap\s*=\s*function/.test(src)) continue;
        if (!/leaflet@[\d.]+\/dist\/leaflet\.js/.test(src))
            errors.push(`${fam}/${f}: defines a map boot but never loads leaflet.js — window.L is undefined, so the boot returns and the map never appears`);
        if (!/leaflet@[\d.]+\/dist\/leaflet\.css/.test(src))
            errors.push(`${fam}/${f}: defines a map boot but never loads leaflet.css — the tiles render as a stack of unpositioned images`);
    }
}

// ── A frontmatter doc comment that closes itself early. Nothing else catches
//    this: no CI job runs `astro build`, and when it does fail it takes EVERY
//    template down with it, because index.astro imports all 65 wrappers into a
//    single bundle. Three wrappers shipped a token list written as the word
//    "accent" followed by an asterisk and a slash, which ends the comment
//    mid-sentence; esbuild then parses the remaining prose as JavaScript and
//    stops at the first bare word. The site build fails; nothing warns first.
const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);
const COMMENT_CLOSE = "*" + "/";
const COMMENT_OPEN = "/" + "*";
for (const fam of fs.readdirSync(COMPONENTS)) {
    const d = path.join(COMPONENTS, fam);
    if (!fs.statSync(d).isDirectory()) continue;
    for (const f of fs.readdirSync(d)) {
        if (!/^Page[A-Z]+[.]astro$/.test(f)) continue;
        const src = fs.readFileSync(path.join(d, f), "utf8").split(CR + LF).join(LF);
        // The frontmatter only. A closer inside the template body is markup or
        // CSS, not a comment, and is not this script's business.
        const fm = src.split(/^---$/m)[1] ?? "";
        let open = false;
        for (const [i, line] of fm.split(LF).entries()) {
            if (!open) {
                const o = line.indexOf(COMMENT_OPEN);
                if (o === -1) continue;
                open = true;
                // A one-line comment opens and closes on the same line; only
                // what follows the opener can close it.
                const rest = line.slice(o + 2);
                const c = rest.indexOf(COMMENT_CLOSE);
                if (c === -1) continue;
                open = false;
                continue;
            }
            const c = line.indexOf(COMMENT_CLOSE);
            if (c === -1) continue;
            open = false;
            // A legitimate terminator is alone on its line. Prose in front of
            // it means the comment ended somewhere its author did not intend.
            const before = line.slice(0, c).trim();
            if (before !== "" && before !== "*")
                errors.push(
                    fam + "/" + f + ": the frontmatter doc comment closes itself on line " +
                    (i + 1) + " of the frontmatter — " + JSON.stringify(line.trim().slice(0, 64)) +
                    ". Everything after it is parsed as JavaScript, which breaks the build for " +
                    "ALL templates, not only this one.",
                );
        }
    }
}

for (const code of codes) {
    const rows = scanned[code];

    // 1. every rendered section must be removable
    for (const [type, info] of rows) {
        if (type === "Header" || type === "Footer") continue;
        if (!info.gate) errors.push(`${code}: <${info.comp}> renders with no visibility gate — an admin can never remove it`);
    }

    // 2. the generated manifest must equal the rendered set, IN ORDER
    const actual = [...rows.keys()].map((t) => TYPE_TO_BLOCK[t]).filter(Boolean);
    const decl = declared[code];
    if (!decl) {
        errors.push(`${code}: missing from templateSectionOrder.generated.ts — run node scripts/gen-template-sections.mjs`);
    } else {
        for (const b of decl) if (!actual.includes(b)) errors.push(`${code}: the editor offers a ${b} toggle but the template never renders it`);
        for (const b of actual) if (!decl.includes(b)) errors.push(`${code}: template renders ${b} but the editor hides its toggle`);
        if (decl.join(">") !== actual.join(">") && decl.length === actual.length)
            errors.push(`${code}: section ORDER is stale — page renders ${actual.join(" > ")}, editor lists ${decl.join(" > ")}`);
    }

    // 3. every hand-authored label must name a section this template renders
    for (const b of labelled[code] ?? [])
        if (!actual.includes(b))
            errors.push(`${code}: templateSectionLabels names a ${b} section this template does not render`);
}

for (const code of Object.keys(labelled))
    if (!scanned[code]) errors.push(`templateSectionLabels: "${code}" is not a real template code`);

console.log(`scanned ${codes.length} template wrappers`);
if (errors.length) {
    console.error(`\n${errors.length} block-manifest problem(s):\n  ` + errors.join("\n  "));
    process.exit(1);
}
console.log("✓ template blocks OK — every rendered section is gated, the editor's toggles match reality in membership and order, and every label names a section that exists");
