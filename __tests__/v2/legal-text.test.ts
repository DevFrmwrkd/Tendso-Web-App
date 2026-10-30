import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

/** Words only: no comments, no JSX tags or their attributes, one space between tokens. */
const soup = (s: string) =>
    s
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
        .replace(/<[^>]*>/g, " ")
        .replace(/\bexport\b/g, "")
        .replace(/termsDocSections/g, "sections")
        .replace(/policySections/g, "policySections")
        .replace(/\s+/g, " ")
        .trim();

const region = (src: string, from: string, endMarker: string) => {
    const a = src.indexOf(from);
    const b = src.indexOf(endMarker, a);
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(a);
    return soup(src.slice(a, b));
};

describe("v2 legal pages carry the production legal text, unchanged", () => {
    const mine = read("components/v2/pages-a/legal-content.tsx");

    it("privacy policy sections match app/privacy-policy/page.tsx word for word", () => {
        const prod = read("app/privacy-policy/page.tsx");
        const a = region(prod, "const policySections: LegalSection[] = [", "\n];");
        const b = region(mine, "const policySections: LegalSection[] = [", "\n];");
        expect(b).toBe(a);
        expect(a.length).toBeGreaterThan(2000);
    });

    it("terms of service sections match app/terms-of-service/page.tsx word for word", () => {
        const prod = read("app/terms-of-service/page.tsx");
        const a = region(prod, "const termsSections = [", "\nexport default");
        // `mine` ends after the second array; take it to the end of the file
        const bFull = soup(mine.slice(mine.indexOf("const termsSections = [")));
        expect(bFull).toBe(a);
        expect(a.length).toBeGreaterThan(2000);
    });

    it("intros and the dated line match the live pages", () => {
        const priv = read("app/privacy-policy/page.tsx");
        const terms = read("app/terms-of-service/page.tsx");
        expect(priv).toContain('const INTRO = "Your privacy matters to us. How Tendso collects, uses, and protects your personal information.";');
        expect(terms).toContain('const INTRO = "The operational guidelines governing your use of the Tendso Creator Network.";');
        expect(mine).toContain("Your privacy matters to us. How Tendso collects, uses, and protects your personal information.");
        expect(mine).toContain("The operational guidelines governing your use of the Tendso Creator Network.");
        expect(priv).toContain('updated="February 2026"');
        expect(mine).toContain('updated: "February 2026"');
    });
});
