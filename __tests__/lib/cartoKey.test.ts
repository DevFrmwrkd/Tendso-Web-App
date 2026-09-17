/**
 * CARTO watermarks every tile requested without `?key=` with "API KEY
 * REQUIRED". The key is not in the templates; lib/carto.ts writes it into the
 * finished HTML. These tests run that rewrite over the tile URL of every real
 * template, so a new template whose URL shape the pattern misses fails here
 * instead of shipping a watermarked map.
 */
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { withCartoKey } from "@/lib/carto";

const KEY = "test-key_123";

function templatesWithMaps(): Array<{ file: string; source: string }> {
    const root = join(__dirname, "..", "..", "astro-site-template", "src", "components");
    const out: Array<{ file: string; source: string }> = [];
    for (const family of readdirSync(root, { withFileTypes: true })) {
        if (!family.isDirectory()) continue;
        for (const file of readdirSync(join(root, family.name))) {
            if (!/^Page\w+\.astro$/.test(file)) continue;
            const source = readFileSync(join(root, family.name, file), "utf-8");
            if (source.includes("basemaps.cartocdn.com")) out.push({ file: `${family.name}/${file}`, source });
        }
    }
    return out;
}

describe("withCartoKey", () => {
    const templates = templatesWithMaps();

    it("finds the templates that draw maps", () => {
        expect(templates.length).toBeGreaterThan(50);
    });

    it.each(templates.map((t) => [t.file, t.source]))("keys every tile URL in %s", (_file, source) => {
        const tileUrls = source.match(/basemaps\.cartocdn\.com/g)!.length;
        const out = withCartoKey(source, KEY);
        expect(out.match(/\.png\?key=test-key_123['"]/g)?.length).toBe(tileUrls);
    });

    it("covers both hosts and both tile suffixes", () => {
        const html = [
            `'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'`,
            `"https://basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png"`,
        ].join("\n");
        expect(withCartoKey(html, KEY)).toBe(
            [
                `'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=test-key_123'`,
                `"https://basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png?key=test-key_123"`,
            ].join("\n"),
        );
    });

    it("is idempotent and swaps in a rotated key", () => {
        const url = `'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'`;
        const once = withCartoKey(url, KEY);
        expect(withCartoKey(once, KEY)).toBe(once);
        expect(withCartoKey(once, "new")).toBe(`'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=new'`);
    });

    it("leaves HTML untouched when no key is configured", () => {
        const url = `'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'`;
        expect(withCartoKey(url, "")).toBe(url);
    });

    it("does not touch other CARTO assets or other tile hosts", () => {
        const html = `<link href="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"><img src="https://tile.openstreetmap.org/1/1/1.png">`;
        expect(withCartoKey(html, KEY)).toBe(html);
    });
});
