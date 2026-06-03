#!/usr/bin/env node
/**
 * Remove the "pad to N tiles" logic from gallery components A–E. After
 * this, galleries only render tiles that have a real image. If zero,
 * the items array is empty, the .map() emits nothing, and the section
 * collapses (visibility flag in lib/astro-builder.ts already hides the
 * whole section when no photos exist).
 *
 * Idempotent.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FILES = ['A', 'B', 'C', 'D', 'E'].map((L) =>
    path.join(ROOT, 'astro-site-template', 'src', 'components', 'generic', 'gallery', `Gallery${L}.astro`),
);

for (const file of FILES) {
    let src = await fs.readFile(file, 'utf-8');
    const orig = src;
    // Drop the padding line.
    src = src.replace(/while \(items\.length < \d+\) items\.push\(\{[^}]*\}\);?\n?/g, '');
    src = src.replace(/while \(items\.length < \d+\) \{[\s\S]*?\}\n?/g, '');
    // Filter the items array to only those with non-empty `image`.
    // Replace `items.slice(0, N).map(` → `items.filter((it) => it && it.image).slice(0, N).map(`
    src = src.replace(
        /items\.slice\((\d+),\s*(\d+)\)\.map\(/g,
        'items.filter((it: any) => it && it.image).slice($1, $2).map(',
    );
    if (src !== orig) {
        await fs.writeFile(file, src, 'utf-8');
        console.log('  ✓', path.relative(ROOT, file));
    } else {
        console.log('  ·', path.relative(ROOT, file), '(unchanged)');
    }
}
