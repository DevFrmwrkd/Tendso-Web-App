#!/usr/bin/env node
/**
 * Regenerates components/editor/templateSectionOrder.generated.ts — the ordered
 * list of toggleable sections each template actually renders.
 *
 * WHY THIS EXISTS. The editor used to describe every template with the same
 * fourteen block names, in the same order, under the same internal labels
 * ("WHY-US", "SERVICE-AREA", "CTA-BAND"). That was wrong twice over: the order
 * was ALL_BLOCKS declaration order rather than the order the page renders, and
 * the membership came from a hand-written "base list plus two exception sets"
 * that nobody re-derives when a wrapper changes. An admin opening the Sections
 * panel on Kubo Stays saw a generic schema, not their site.
 *
 * The truth is in the wrappers. Each Page<CODE>.astro renders its sections in
 * order, each on a line carrying its own `visibility.<key>` gate, so both the
 * MEMBERSHIP and the ORDER can be read straight out of the file. This script
 * does that and writes the result to a committed .ts file the editor imports.
 *
 * The file is committed rather than computed at runtime because the editor is a
 * client bundle and cannot read the .astro sources.
 *
 * Usage:
 *   node scripts/gen-template-sections.mjs           # rewrite the generated file
 *   node scripts/gen-template-sections.mjs --check   # fail if it is stale (CI)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { businessTemplateBlocks } from './business-template-blocks.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const COMPONENTS = path.join(ROOT, "astro-site-template/src/components");
const OUT = path.join(ROOT, "components/editor/templateSectionOrder.generated.ts");

/** Section-name prefixes, longest-first so CtaBand wins over Cta. */
const TYPES = [
    "Header", "Hero", "Marquee", "Trust", "About", "Services", "Why", "How",
    "Credentials", "Testimonials", "Gallery", "Faq", "Area", "Location", "CtaBand", "Footer",
];

/**
 * Section type -> the ALL_BLOCKS name the editor toggles.
 * Header is absent on purpose: no wrapper gates on it, so it is not a toggle.
 */
const TYPE_TO_BLOCK = {
    Hero: "HERO", Marquee: "MARQUEE", Trust: "TRUST", About: "ABOUT", Services: "SERVICES",
    Why: "WHY-US", How: "HOW-IT-WORKS", Testimonials: "TESTIMONIALS", Gallery: "GALLERY",
    Faq: "FAQ", Area: "SERVICE-AREA", Credentials: "CREDENTIALS", Location: "LOCATION",
    CtaBand: "CTA-BAND", Footer: "FOOTER",
};

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

/**
 * The sections a wrapper renders, IN DOCUMENT ORDER, following shared *Spine
 * components one level in. A Map keyed by section type, so the first sighting
 * fixes the position and a later duplicate cannot reorder it.
 */
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
        if (!acc.has(type)) acc.set(type, { comp: name, gate: g?.[1] ?? null });
        else if (g && !acc.get(type).gate) acc.set(type, { comp: name, gate: g[1] });
    }
    return acc;
};

const manifest = {};
for (const fam of fs.readdirSync(COMPONENTS)) {
    const d = path.join(COMPONENTS, fam);
    if (!fs.statSync(d).isDirectory()) continue;
    for (const f of fs.readdirSync(d)) {
        const m = /^Page([A-Z]+)\.astro$/.exec(f);
        if (!m) continue;
        const rows = collect(path.join(d, f));
        manifest[`${fam}:${m[1]}`] = [...rows.keys()]
            .map((t) => TYPE_TO_BLOCK[t])
            .filter(Boolean);
    }
}

const codes = Object.keys(manifest).sort();
const body = codes
    .map((c) => `    ${JSON.stringify(c)}: [${manifest[c].map((b) => JSON.stringify(b)).join(", ")}],`)
    .join("\n");

const file = `/* AUTO-GENERATED by scripts/gen-template-sections.mjs — DO NOT EDIT BY HAND.
 *
 * The toggleable sections each template renders, IN PAGE ORDER, read straight
 * out of every Page<CODE>.astro. Regenerate after adding or reordering a
 * section in any wrapper:
 *
 *   node scripts/gen-template-sections.mjs
 *
 * \`node scripts/gen-template-sections.mjs --check\` fails when this file has
 * gone stale, which is what keeps the editor's Sections panel honest.
 *
 * HEADER is deliberately absent: no wrapper gates on it, so it is not a toggle.
 */
export const TEMPLATE_SECTION_ORDER: Record<string, string[]> = {
${body}
};
`;

if (process.argv.includes("--check")) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
    const norm = (s) => s.split("\r\n").join("\n");
    if (norm(current) !== norm(file)) {
        console.error(
            "✗ templateSectionOrder.generated.ts is STALE — a wrapper's sections changed.\n" +
            "  Run: node scripts/gen-template-sections.mjs"
        );
        process.exit(1);
    }
    console.log(`✓ template section order OK — ${codes.length} templates, generated file matches the wrappers`);
} else {
    fs.writeFileSync(OUT, file);
    console.log(`wrote ${path.relative(ROOT, OUT)} — ${codes.length} templates`);
}
