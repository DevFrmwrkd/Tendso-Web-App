// Download every Google font this app uses and emit a self-hosted stylesheet,
// so `next build` never touches the network for fonts again.
//
// Faithfulness matters more than cleverness here: we ask Google for exactly the
// axes/weights/styles each declaration asked for, keep its @font-face blocks
// verbatim (including unicode-range, which is what makes subsetting work), and
// only rewrite the url() to point at a local copy of the very same woff2.
const fs = require("fs");
const path = require("path");

const REPO = process.argv[2];
const FONT_DIR = path.join(REPO, "public", "fonts");
const CSS_OUT = path.join(REPO, "app", "self-hosted-fonts.css");

// A modern browser UA is required — Google serves woff2 only to clients it
// believes support it, and ttf to everything else.
const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// Mirrors the next/font/google declarations exactly. `query` is the CSS2 spec,
// `subsets` the unicode-range groups to keep, `cssVar` the variable downstream
// CSS already reads, `stack` the fallbacks that were in place before.
const FAMILIES = [
    { name: "Fraunces", query: "ital,opsz,wght@0,9..144,100..900;1,9..144,100..900", subsets: ["latin", "latin-ext"], cssVar: "--font-fraunces", stack: 'Georgia, serif' },
    { name: "Plus Jakarta Sans", query: "wght@400;500;600;700", subsets: ["latin", "latin-ext"], cssVar: "--font-plus-jakarta", stack: 'system-ui, sans-serif' },
    { name: "Playfair Display", query: "ital,wght@0,400;0,700;0,800;0,900;1,400;1,700;1,800;1,900", subsets: ["latin", "latin-ext"], cssVar: "--font-playfair", stack: 'Georgia, serif' },
    { name: "JetBrains Mono", query: "wght@400;500;700", subsets: ["latin"], cssVar: "--font-mono", stack: 'ui-monospace, monospace' },
    { name: "Instrument Serif", query: "ital@0;1", subsets: ["latin"], cssVar: "--font-instrument-serif", stack: 'Georgia, serif' },
    { name: "Onest", query: "wght@300;400;500;600;700", subsets: ["latin"], cssVar: "--font-onest", stack: 'ui-sans-serif, system-ui, sans-serif' },
    { name: "Newsreader", query: "ital,wght@0,400;0,500;0,600;1,400;1,500;1,600", subsets: ["latin"], cssVar: "--font-kb-serif", stack: 'Georgia, serif' },
    { name: "Schibsted Grotesk", query: "wght@400;500;600;700", subsets: ["latin"], cssVar: "--font-kb-sans", stack: 'ui-sans-serif, system-ui, sans-serif' },
    { name: "Bricolage Grotesque", query: "wght@400;600;800", subsets: ["latin"], cssVar: "--font-bricolage", stack: 'ui-sans-serif, system-ui, sans-serif' },
    { name: "Outfit", query: "wght@300;400;600", subsets: ["latin"], cssVar: "--font-outfit", stack: 'ui-sans-serif, system-ui, sans-serif' },
];

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function main() {
    fs.mkdirSync(FONT_DIR, { recursive: true });
    const chunks = [];
    const vars = [];
    let files = 0;

    for (const fam of FAMILIES) {
        const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fam.name).replace(/%20/g, "+")}:${fam.query}&display=swap`;
        const res = await fetch(url, { headers: { "User-Agent": UA } });
        if (!res.ok) throw new Error(`${fam.name}: CSS ${res.status}`);
        const css = await res.text();

        // Google emits "/* latin */" immediately before each @font-face.
        const blocks = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)];
        if (!blocks.length) throw new Error(`${fam.name}: no @font-face blocks parsed`);

        let kept = 0;
        const out = [];
        for (const [, subset, block] of blocks) {
            if (!fam.subsets.includes(subset)) continue;
            const m = block.match(/url\((https:\/\/[^)]+\.woff2)\)/);
            if (!m) continue;
            const weight = (block.match(/font-weight:\s*([^;]+);/) || [, "400"])[1].trim();
            const style = (block.match(/font-style:\s*([^;]+);/) || [, "normal"])[1].trim();
            const file = `${slug(fam.name)}-${subset}-${slug(weight)}-${style}.woff2`;
            const bin = await fetch(m[1], { headers: { "User-Agent": UA } });
            if (!bin.ok) throw new Error(`${fam.name}: woff2 ${bin.status}`);
            fs.writeFileSync(path.join(FONT_DIR, file), Buffer.from(await bin.arrayBuffer()));
            files++;
            kept++;
            out.push(`/* ${fam.name} — ${subset} ${weight} ${style} */\n${block.replace(m[0], `url(/fonts/${file}) format('woff2')`)}`);
        }
        if (!kept) throw new Error(`${fam.name}: kept 0 blocks (subsets ${fam.subsets})`);
        chunks.push(out.join("\n\n"));
        vars.push(`  ${fam.cssVar}: "${fam.name}", ${fam.stack};`);
        console.log(`  ${fam.name.padEnd(22)} ${kept} face(s)`);
    }

    const header = `/**
 * Self-hosted web fonts.
 *
 * WHY THIS FILE EXISTS. These families used to come from next/font/google,
 * which downloads them DURING THE BUILD. That made every production deploy
 * depend on ten live fetches to Google, and on 2026-09-28 one of them
 * (Schibsted Grotesk) failed and took the whole deploy with it — twice — while
 * the identical commit had built fine minutes earlier. A font is not worth a
 * broken deploy, and a build that can fail for reasons outside the repository
 * is not a build you can trust at 1pm.
 *
 * The files in /public/fonts are the exact woff2 Google served for the exact
 * axes, weights and styles each declaration asked for, and the @font-face rules
 * below are Google's own, verbatim — unicode-range included, so subsetting
 * still works and browsers still download only the ranges they need. The only
 * edit is the url(), which now points at our copy.
 *
 * The --font-* variables are declared here because that is the seam every
 * consumer already used (globals.css, knowledge.css). Nothing downstream had to
 * change, and nothing downstream can tell the difference.
 *
 * Regenerate with scripts/selfhost-fonts.js if a declaration changes.
 * All ten families are OFL-licensed, so redistributing the files is permitted.
 */

`;
    const rootBlock = `:root {\n${vars.join("\n")}\n}\n\n`;
    fs.writeFileSync(CSS_OUT, header + rootBlock + chunks.join("\n\n") + "\n");
    console.log(`\n${files} woff2 files -> public/fonts/`);
    console.log(`stylesheet -> app/self-hosted-fonts.css`);
}
main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
