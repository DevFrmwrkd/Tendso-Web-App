import fs from "node:fs";
import path from "node:path";

import {
    ALL_TEMPLATES,
    familyOf,
    sectionsForTemplate,
    templateByCode,
    TEMPLATE_FAMILIES,
} from "@/components/editor/templateCatalog";
import { TEMPLATE_FIELD_PATHS } from "@/components/editor/templateFieldPaths.generated";
import { resolveHeroStyle } from "@/lib/templatePicker";

const root = path.join(__dirname, "..", "..");
const components = path.join(root, "astro-site-template", "src", "components");
const categories = [
    { type: "Barber/Salon", letters: ["CA", "CB", "CC"] },
    { type: "Auto Shop", letters: ["CD", "CE", "CF"] },
    { type: "Spa/Massage", letters: ["CG", "CH", "CI"] },
    { type: "Restaurant", letters: ["CJ", "CK", "CL"] },
    { type: "Clinic", letters: ["CM", "CN", "CO"] },
    { type: "Law Office", letters: ["CP", "CQ", "CR"] },
    { type: "Craft/Producer", letters: ["CS", "CT", "CU"] },
    { type: "Other", letters: ["CV", "CW", "CX"] },
];
const styles = ["Editorial", "Immersive", "Studio"];
const businessTemplates = TEMPLATE_FAMILIES.find((family) => family.family === "business")!.templates;

describe("approved business designs", () => {
    it("makes all 24 choices available to the same admin catalog as existing designs", () => {
        expect(businessTemplates.map((template) => template.letter)).toEqual(categories.flatMap((category) => category.letters));
        expect(new Set(ALL_TEMPLATES.map((template) => template.code)).size).toBe(ALL_TEMPLATES.length);
        for (const template of businessTemplates) {
            expect(templateByCode(template.code)).toBe(template);
            expect(familyOf(template.code)).toBe("business");
            expect(template.preview).toBe(`/template-previews/${template.letter.toLowerCase()}.html`);
        }
        // Existing submitted sites keep their saved design as well.
        expect(templateByCode("barbershop:F")).toBeDefined();
        expect(templateByCode("services:AS")).toBeDefined();
    });

    it.each(categories)("renders three approved layouts for $type without replacing customer content", ({ type, letters }) => {
        const router = fs.readFileSync(path.join(root, "astro-site-template", "src", "pages", "index.astro"), "utf8");
        letters.forEach((letter, index) => {
            const code = `business:${letter}`;
            const source = fs.readFileSync(path.join(components, "business", `Page${letter}.astro`), "utf8");
            expect(source).toContain(`../capture-redesign/${styles[index]}.astro`);
            expect(source).toContain(`business_type: ${JSON.stringify(type)}`);
            expect(source).toContain("...siteData");
            expect(source).toContain("...(siteData?.content ?? {})");
            expect(router).toContain(`import Page${letter} from '../components/business/Page${letter}.astro'`);
            expect(router).toContain(`businessLetter === '${letter}' && <Page${letter} siteData={data}`);
            expect(resolveHeroStyle(code, type, "saved-submission")).toBe(code);
        });
    });

    it("offers only the actual rendered sections, in page order, in the admin editor", () => {
        for (const template of businessTemplates) {
            expect(sectionsForTemplate(template.code).map((section) => section.block)).toEqual([
                "HERO", "TRUST", "SERVICES", "ABOUT", "GALLERY", "HOW-IT-WORKS", "FAQ", "LOCATION", "FOOTER",
            ]);
        }
    });

    it("keeps the owner content editable through the existing admin schema", () => {
        for (const template of businessTemplates) {
            expect(TEMPLATE_FIELD_PATHS[template.code]).toEqual(expect.arrayContaining([
                "business_name", "hero.headline", "hero.sub", "hero.image",
                "trust.cells.N.num", "trust.cells.N.label",
                "services.items.N.title", "services.items.N.desc", "services.items.N.note",
                "about.paragraphs.N", "gallery.items.N.image",
                "how.steps.N.body", "faq.items.N.q", "faq.items.N.a",
                "location.phone", "location.address",
            ]));
        }
    });
});
