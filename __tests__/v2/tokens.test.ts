import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

/** Strip block comments so words in prose do not count as code. */
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const p = join(dir, name);
        return statSync(p).isDirectory() ? walk(p) : [p];
    });
}

describe("design v2 tokens", () => {
    const tokens = stripComments(read("components/v2/tokens.css"));
    const components = stripComments(read("components/v2/components.css"));

    it("never puts the accent in the colour namespace (that would create text-/border-/ring- utilities)", () => {
        expect(tokens).not.toMatch(/--color-v2-accent/);
    });

    it("exposes the accent only as background utilities", () => {
        const utilities = [...tokens.matchAll(/@utility\s+([\w-]+)/g)].map((m) => m[1]);
        expect(utilities.length).toBeGreaterThan(0);
        for (const u of utilities) expect(u).toMatch(/^bg-v2-accent/);
    });

    it("pairs the accent with ink text only", () => {
        expect(tokens).toMatch(/--v2-accent:\s*#E4F222/i);
        expect(tokens).toMatch(/--v2-on-accent:\s*#0C0A08/i);
    });

    it("declares no custom property outside a v2 scope (no :root, html or body rule)", () => {
        expect(tokens).not.toMatch(/(^|[\s,}])(:root|html|body)\s*[,{]/);
    });

    it("defines every --v2-* variable the components read", () => {
        const defined = new Set([...tokens.matchAll(/(--v2-[\w-]+)\s*:/g)].map((m) => m[1]));
        // --v2-nav-h and --v2-mark-k are component-local with a fallback; the font vars come from next/font.
        const local = new Set(["--v2-nav-h", "--v2-mark-k"]);
        const used = new Set([...components.matchAll(/var\((--v2-[\w-]+)/g)].map((m) => m[1]));
        for (const v of used) {
            if (local.has(v)) continue;
            expect(defined).toContain(v);
        }
    });

    it("no v2 source uses an accent text, border or ring utility", () => {
        const files = [...walk(join(ROOT, "components/v2")), ...walk(join(ROOT, "app/v2-kit"))].filter((f) => /\.(tsx?|css)$/.test(f));
        const offending: string[] = [];
        for (const f of files) {
            const src = f.endsWith(".css") ? stripComments(readFileSync(f, "utf8")) : readFileSync(f, "utf8");
            if (/(?:text|border|ring|outline|fill|stroke|decoration|from|to|via)-v2-accent/.test(src)) offending.push(f);
        }
        expect(offending).toEqual([]);
    });
});
