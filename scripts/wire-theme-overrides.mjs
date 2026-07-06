#!/usr/bin/env node
/**
 * Wire the genericThemeOverrides helper into each PageA…PageE (generic)
 * and PageF…PageJ (barbershop) wrapper. Idempotent — safe to re-run.
 * Looks for already-injected markers before touching.
 *
 * The barbershop Page wrappers share the same FooterF import regardless of
 * letter, so the anchor for the helper import differs per family.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const HELPER_IMPORT = "import { resolveTheme, buildFontHref, buildOverrideCss } from '../../lib/genericThemeOverrides';";
const RESOLVER_LINES = [
    'const { scheme: __themeScheme, pairing: __themePairing } = resolveTheme(layout, (content as any).business_type);',
    'const __overrideCss = buildOverrideCss(__themeScheme, __themePairing);',
    'const __fontHref = buildFontHref(__themePairing);',
];

const FAMILIES = [
    {
        dir: 'generic',
        letters: ['A', 'B', 'C', 'D', 'E'],
        // Per-letter Footer{Letter}.
        footerImportFor: (L) => new RegExp(`(import Footer${L} from '\\./footer/Footer${L}\\.astro';)`),
    },
    {
        dir: 'barbershop',
        letters: ['F', 'G', 'H', 'I', 'J'],
        // Barbershop family reuses FooterF across all letter variants.
        footerImportFor: () => /(import FooterF from '\.\/footer\/FooterF\.astro';)/,
    },
    {
        dir: 'salonspa',
        letters: ['K', 'L', 'M', 'N', 'O'],
        // SalonSpa family reuses FooterK across all letter variants.
        footerImportFor: () => /(import FooterK from '\.\/footer\/FooterK\.astro';)/,
    },
    {
        dir: 'autoshop',
        letters: ['P', 'Q', 'R', 'S', 'T'],
        // Autoshop family reuses FooterP across all letter variants.
        footerImportFor: () => /(import FooterP from '\.\/footer\/FooterP\.astro';)/,
    },
    {
        dir: 'restaurant',
        letters: ['U', 'V', 'W', 'X', 'Y'],
        // Restaurant family reuses FooterU across all letter variants.
        footerImportFor: () => /(import FooterU from '\.\/footer\/FooterU\.astro';)/,
    },
    {
        dir: 'shirtstore',
        letters: ['Z', 'AA', 'AB', 'AC', 'AD'],
        // Shirtstore family reuses FooterZ across all letter variants.
        footerImportFor: () => /(import FooterZ from '\.\/footer\/FooterZ\.astro';)/,
    },
];

for (const fam of FAMILIES) {
    for (const L of fam.letters) {
        const file = path.join(
            ROOT, 'astro-site-template', 'src', 'components', fam.dir, `Page${L}.astro`
        );
        let src;
        try {
            src = await fs.readFile(file, 'utf-8');
        } catch (err) {
            console.log(`  ! ${path.relative(ROOT, file)} (missing — skipped)`);
            continue;
        }
        const before = src;

        if (!src.includes("from '../../lib/genericThemeOverrides'")) {
            const footerImportRe = fam.footerImportFor(L);
            src = src.replace(footerImportRe, (m) => `${m}\n${HELPER_IMPORT}`);
        }

        if (!src.includes('__overrideCss')) {
            const visAnchor = /(const visibility = siteData\.visibility \?\? \{\};)/;
            src = src.replace(visAnchor, (m) => `${m}\n${RESOLVER_LINES.join('\n')}`);
        }

        if (!src.includes('set:html={__overrideCss}')) {
            src = src.replace(
                /<\/style>(\r?\n\s*)<\/head>/,
                `</style>$1  {__fontHref && <link href={__fontHref} rel="stylesheet" />}\n  <style is:global set:html={__overrideCss}></style>\n</head>`,
            );
        }

        if (src !== before) {
            await fs.writeFile(file, src, 'utf-8');
            console.log(`  ✓ ${path.relative(ROOT, file)}`);
        } else {
            console.log(`  · ${path.relative(ROOT, file)} (unchanged)`);
        }
    }
}
console.log('Done.');
