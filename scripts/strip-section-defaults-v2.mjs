#!/usr/bin/env node
/**
 * Comprehensive strip of all template-branded default arrays in generic
 * Astro section components. Replaces every "length [check] ? items : [..]"
 * fallback with ": []" so empty templates render zero rows and the
 * transformer's derived-defaults layer (lib/astro-builder.ts) takes over.
 *
 * Idempotent. Safe to re-run.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TARGET_DIR = path.join(ROOT, 'astro-site-template', 'src', 'components', 'generic');

// We target ANY `? <ident>.items : [ ... ]` or `? <ident>.steps : [...]`
// pattern in frontmatter, since every one of those is a template default.
// The regex grabs the ternary's "false" branch (the array literal) and
// replaces it with `[]`. Uses non-greedy + balanced bracket matching.
const PATTERNS = [
    // Pattern A: variable name `items`, `steps`, `cells`, `places`, `links`,
    //   `paragraphs`, `social`, `hours`, `notes`, `headlineLines`, etc.
    // Pattern is: `<arrayName>.length [maybe === N]
    //                ? <arrayName>
    //                : [ ... ]`
    // where the array literal is the part to clear.
];

function isFalseBranchStart(src, i) {
    // Walk back to find ` : [` after we matched `? <thing>`.
    // Just look for the literal `: [` after the cursor i.
    while (i < src.length && /\s/.test(src[i])) i++;
    if (src[i] !== ':') return -1;
    i++;
    while (i < src.length && /\s/.test(src[i])) i++;
    if (src[i] !== '[') return -1;
    return i;
}

function findMatchingBracket(src, openIdx) {
    if (src[openIdx] !== '[') return -1;
    let depth = 0;
    let inStr = null;
    let escaped = false;
    for (let i = openIdx; i < src.length; i++) {
        const c = src[i];
        if (inStr) {
            if (escaped) { escaped = false; continue; }
            if (c === '\\') { escaped = true; continue; }
            if (c === inStr) { inStr = null; }
            continue;
        }
        if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
        if (c === '[') depth++;
        else if (c === ']') {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
}

function stripFallbackArrays(src) {
    // Match: `<ident>.length [maybe `=== N`] ? <ident>` then capture the
    // following `: [ … ]` (balanced) and replace it with `: []`.
    const ternaryRe = /\.(items|steps|cells|places|links|paragraphs|social|hours|notes|headlineLines|stats|small)\b\s*(?:&&\s*[A-Za-z0-9_.?]+\.length\s*(?:===\s*\d+)?\s*)?\?\s*[A-Za-z0-9_.?]+\s*(?::\s*\[)/g;
    let result = src;
    let scanFrom = 0;
    let scanned = '';
    // We process the source iteratively because regex.lastIndex shifts when
    // we splice. Iterate, find next match, find its ":[", find matching "]",
    // replace.
    while (true) {
        ternaryRe.lastIndex = 0;
        const sub = result.slice(scanFrom);
        const m = ternaryRe.exec(sub);
        if (!m) break;
        const matchStart = scanFrom + m.index;
        const colonBracketEnd = scanFrom + m.index + m[0].length - 1; // points at the '['
        // Find matching closing ']'
        const closeIdx = findMatchingBracket(result, colonBracketEnd);
        if (closeIdx === -1) {
            scanFrom = matchStart + m[0].length;
            continue;
        }
        // Replace the array literal with []
        result = result.slice(0, colonBracketEnd) + '[]' + result.slice(closeIdx + 1);
        // Advance past the replacement so we don't loop forever.
        scanFrom = colonBracketEnd + 2;
    }
    return result;
}

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
    let touched = 0;
    for (const file of files) {
        const orig = await fs.readFile(file, 'utf-8');
        // Only operate on frontmatter (between leading --- and the second ---).
        const m = orig.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (!m) continue;
        const fm = m[1];
        const newFm = stripFallbackArrays(fm);
        if (newFm === fm) continue;
        const rest = orig.slice(m[0].length);
        const next = `---\n${newFm}\n---${rest}`;
        await fs.writeFile(file, next, 'utf-8');
        console.log(`  ✓ ${path.relative(ROOT, file)}`);
        touched++;
    }
    console.log(`\nStripped ${touched} files.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
