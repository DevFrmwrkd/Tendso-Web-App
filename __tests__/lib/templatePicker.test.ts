/**
 * The default template a site gets.
 *
 * The bug being locked out: `heroStyle` used to default to the bare letter
 * 'A'. index.astro gates every wrapper on a FULL `family:LETTER` code, so 'A'
 * matched nothing and the page rendered the "Coming soon" stub with zero
 * sections. Real astro builds of the same fixture: 'A' -> 0 sections,
 * 'generic:A' -> 10, 'florist:BR' -> 12.
 *
 * So the load-bearing assertion in here is the dull one — every value this
 * module can emit must be a code the catalogue actually contains.
 */

import { TEMPLATE_FAMILIES } from "@/components/editor/templateCatalog";
import { autoTemplateFor, familyForBusinessType, resolveHeroStyle } from "@/lib/templatePicker";

const ALL_CODES = new Set(
    TEMPLATE_FAMILIES.flatMap((f) => f.templates.map((t) => t.code)),
);
const codesOf = (family: string) =>
    TEMPLATE_FAMILIES.find((f) => f.family === family)!.templates.map((t) => t.code);

describe("autoTemplateFor", () => {
    it("never returns a bare letter — always a code index.astro can dispatch on", () => {
        const types = [
            "Barber/Salon", "Auto Shop", "Spa/Massage", "Restaurant", "Clinic",
            "Law Office", "Craft/Producer", "Other", "Flower Shop", "Hotel",
            "", undefined, null, "something nobody has ever typed",
        ];
        for (const t of types) {
            for (const seed of ["jd7", "j97ebvpf3kb9626kyamk0reyyn8f89d5", "", "x"]) {
                const code = autoTemplateFor(t as string, seed);
                expect(code).toMatch(/^[a-z]+:[A-Z]+$/);
                expect(ALL_CODES.has(code)).toBe(true);
            }
        }
    });

    it("is deterministic, so a regenerate cannot reshuffle a reviewed site", () => {
        const a = autoTemplateFor("Barber/Salon", "jd76xp415b3mhyex4n61gcvw9h8ayegn");
        const b = autoTemplateFor("Barber/Salon", "jd76xp415b3mhyex4n61gcvw9h8ayegn");
        expect(a).toBe(b);
    });

    it("puts a trade in a family that suits it", () => {
        expect(familyForBusinessType("Flower shop")).toBe("florist");
        expect(familyForBusinessType("Barbershop")).toBe("barbershop");
        expect(familyForBusinessType("Dental Clinic")).toBe("medical");
        expect(familyForBusinessType("Welding and steel fabrication")).toBe("trades");
        expect(familyForBusinessType("Coffee roaster")).toBe("foodcraft");
        expect(familyForBusinessType("Beach resort")).toBe("hospitality");
        // A florist must not fall into retail on the word "shop".
        expect(familyForBusinessType("Flower shop")).not.toBe("retail");
    });

    it("falls back to generic — not to nothing — for an unknown trade", () => {
        const code = autoTemplateFor("interdimensional plumbing consultancy for cats", "seed");
        expect(ALL_CODES.has(code)).toBe(true);
    });

    it("spreads shops of the same trade across the family", () => {
        // Barbershop has 6 designs; 40 different submissions must not all land
        // on one, or neighbouring shops get identical sites.
        const seen = new Set<string>();
        for (let i = 0; i < 40; i++) seen.add(autoTemplateFor("Barber/Salon", `submission-${i}`));
        expect(seen.size).toBeGreaterThan(1);
        for (const code of seen) expect(codesOf("barbershop")).toContain(code);
    });
});

describe("resolveHeroStyle", () => {
    it("keeps an explicit pick untouched", () => {
        expect(resolveHeroStyle("filipino:BC", "Restaurant", "seed")).toBe("filipino:BC");
        expect(resolveHeroStyle("hospitality:BK", "Barber/Salon", "seed")).toBe("hospitality:BK");
    });

    it("upgrades the legacy bare letter to the code it meant", () => {
        // Rows in production store exactly this.
        expect(resolveHeroStyle("A", "Restaurant", "seed")).toBe("generic:A");
        expect(resolveHeroStyle("BR", "Other", "seed")).toBe("florist:BR");
    });

    it("repairs an unrenderable value instead of passing it through", () => {
        for (const junk of ["", "   ", "nonsense", "generic:ZZ", null, undefined, 42, {}]) {
            const code = resolveHeroStyle(junk, "Barber/Salon", "seed");
            expect(ALL_CODES.has(code)).toBe(true);
        }
    });
});
