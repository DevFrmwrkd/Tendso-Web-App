#!/usr/bin/env node
/**
 * V3 strip: finds every `? <ident>.<arrayProp> : [ ...balanced... ]`
 * pattern anywhere in section frontmatter and replaces the array literal
 * with `[]`. Also clears the `length === N ?` guards' arrays.
 *
 * Operates on `astro-site-template/src/components/generic/` AND
 * `astro-site-template/src/components/barbershop/` files.
 * Skips PageX wrappers (they have no template defaults). Idempotent.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TARGET_DIRS = [
    path.join(ROOT, 'astro-site-template', 'src', 'components', 'generic'),
    path.join(ROOT, 'astro-site-template', 'src', 'components', 'barbershop'),
    path.join(ROOT, 'astro-site-template', 'src', 'components', 'salonspa'),
];

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

/**
 * Find every `? <identExpr> : [` in the frontmatter and replace the
 * matching `[ ... ]` (balanced) with `[]`. This kills array fallbacks
 * regardless of how the `<identExpr>` was constructed.
 */
function stripArrayFallbacks(fm) {
    const result = { src: fm, changes: 0 };
    // Regex: `?` followed by identifier-or-property-access, then `:`, then `[`.
    const re = /\?\s*[A-Za-z_$][A-Za-z0-9_$.?\[\]]*\s*:\s*\[/g;
    let scanFrom = 0;
    while (true) {
        re.lastIndex = scanFrom;
        const m = re.exec(result.src);
        if (!m) break;
        const bracketIdx = m.index + m[0].length - 1; // points at '['
        const closeIdx = findMatchingBracket(result.src, bracketIdx);
        if (closeIdx === -1) { scanFrom = m.index + m[0].length; continue; }
        // Skip if it's already empty.
        const between = result.src.slice(bracketIdx + 1, closeIdx).trim();
        if (between === '') { scanFrom = closeIdx + 1; continue; }
        // Replace.
        result.src = result.src.slice(0, bracketIdx) + '[]' + result.src.slice(closeIdx + 1);
        result.changes++;
        scanFrom = bracketIdx + 2;
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
    const files = [];
    for (const dir of TARGET_DIRS) {
        try { await walk(dir, files); } catch { /* dir may not exist yet */ }
    }
    let totalFiles = 0;
    let totalChanges = 0;
    for (const file of files) {
        // Skip PageX wrappers — no defaults to strip.
        if (/Page[A-O]\.astro$/.test(file)) continue;
        const orig = await fs.readFile(file, 'utf-8');
        const m = orig.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (!m) continue;
        const fm = m[1];
        const { src: newFm, changes } = stripArrayFallbacks(fm);
        if (changes === 0) continue;
        const rest = orig.slice(m[0].length);
        const next = `---\n${newFm}\n---${rest}`;
        await fs.writeFile(file, next, 'utf-8');
        console.log(`  ✓ ${path.relative(ROOT, file)}  (${changes})`);
        totalFiles++;
        totalChanges += changes;
    }
    console.log(`\nStripped ${totalFiles} files, ${totalChanges} array literals cleared.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
