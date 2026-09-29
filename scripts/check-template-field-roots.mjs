#!/usr/bin/env node
/**
 * Guards against a template binding content the editor can never reach.
 *
 * THE FAILURE THIS CATCHES. gen-template-fields.mjs reads the editable paths
 * straight off the components, but it only counts a token whose first segment is
 * one of the content ROOTS the schema declares — and it FAILS OPEN, by design,
 * so anything it does not recognise is simply skipped in silence. That is the
 * right call for the generator: a spare input an admin ignores beats a missing
 * one they need.
 *
 * But it means a template can bind `data-field="specialOffer.headline"`, render
 * that text on the live site, and have it never appear in the Content panel.
 * Nothing errors. Nothing 404s. The page looks finished. The field is simply
 * uneditable, forever — which breaks the rule that a template is a configurable
 * shell, and turns every later change request into a developer job, on a product
 * that promises free edits for a year.
 *
 * So this reads the same attributes and asserts the opposite thing: every
 * data-field / data-image-field / data-href-field must name a root the schema
 * knows. It imports ROOTS from the generator rather than copying it, because two
 * lists that can drift is the bug this directory keeps re-learning.
 *
 * Usage:
 *   node scripts/check-template-field-roots.mjs
 *
 * Exit 1 lists every offending file, line and path.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOTS } from "./gen-template-fields.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMPONENTS = path.resolve(__dirname, "..", "astro-site-template/src/components");

/**
 * Roots that are real handles but deliberately NOT content-editable, so their
 * absence from ROOTS is correct and must not be reported.
 *
 * `nav` is layout-backed: the header assembles it from the site's navigation
 * structure, and SandboxEditorV3's SKIP list excludes `nav.brand`, `nav.status`
 * and `nav.links` by name because editing them as raw text corrupts that
 * structure. Navigation is edited through the sidebar's `navbar_links` schema
 * path instead. 34 bindings across the header components rely on this, and
 * flagging them would make the guard noise — which is worse than no guard,
 * because a guard people learn to ignore protects nothing.
 */
const LAYOUT_ROOTS = new Set(["nav"]);

const KNOWN = new Set([...ROOTS, ...LAYOUT_ROOTS]);

/**
 * Both shapes the templates actually use, and nothing else:
 *   data-field="about.body"
 *   data-field={`services.items.${i}.title`}
 * A binding built by a call — data-field={fieldFor(i)} — cannot be resolved
 * statically, so it is skipped rather than guessed at. Guessing would make this
 * cry wolf, and a guard nobody trusts is worse than no guard.
 */
const ATTR = /data-(?:field|image-field|href-field)=(?:"([^"]*)"|\{`([^`]*)`\})/g;

/** The first segment of a path, with any interpolation removed. */
function rootOf(raw) {
    const cleaned = raw.replace(/\$\{[^}]*\}/g, "N").trim();
    if (!cleaned) return null;
    return cleaned.split(".")[0];
}

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else if (entry.name.endsWith(".astro")) out.push(full);
    }
    return out;
}

const offences = [];
for (const file of walk(COMPONENTS)) {
    const src = fs.readFileSync(file, "utf8");
    const lines = src.split("\n");
    lines.forEach((line, i) => {
        ATTR.lastIndex = 0;
        let m;
        while ((m = ATTR.exec(line))) {
            const raw = m[1] ?? m[2] ?? "";
            const root = rootOf(raw);
            if (!root) continue;
            if (!KNOWN.has(root)) {
                offences.push({
                    file: path.relative(path.resolve(__dirname, ".."), file).replace(/\\/g, "/"),
                    line: i + 1,
                    path: raw,
                    root,
                });
            }
        }
    });
}

if (offences.length === 0) {
    console.log(`✓ every data-field path names a known content root (${ROOTS.length} roots)`);
    process.exit(0);
}

console.error(`✗ ${offences.length} binding(s) name a content root the schema does not declare.`);
console.error("  The text will render on the site and be UNEDITABLE in the admin editor.");
console.error("  Either use an existing root, or add the new one to the schema and to");
console.error("  ROOTS in scripts/gen-template-fields.mjs.\n");
for (const o of offences) {
    console.error(`  ${o.file}:${o.line}`);
    console.error(`      ${o.path}   (root "${o.root}" is not declared)`);
}
console.error(`\n  known roots: ${ROOTS.join(", ")}`);
process.exit(1);
