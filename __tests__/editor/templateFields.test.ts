/**
 * The Content panel used to offer every field in the schema on every template.
 * An admin editing Villa Marindu got Rating, Price, Price unit, Feature chips
 * and Image on each services row — but that design's inclusion ledger draws a
 * numeral, a name, a description and one tag, so six of the nine inputs wrote to
 * storage and changed nothing on the page.
 *
 * scripts/gen-template-fields.mjs reads the bound paths off the components;
 * gen-template-fields --check guards it against drift. These tests guard the
 * MANIFEST's shape and the promises the filter makes.
 */
import fs from "node:fs";
import path from "node:path";

import { TEMPLATE_FIELD_PATHS } from "@/components/editor/templateFieldPaths.generated";
import { TEMPLATE_SECTION_ORDER } from "@/components/editor/templateSectionOrder.generated";
import {
    GENERIC_CONTENT_SCHEMA,
    type ListSpec,
} from "@/components/editor/genericContentSchema";

const itemKeys = (code: string, listPath: string) =>
    (TEMPLATE_FIELD_PATHS[code] ?? [])
        .filter((p) => p.startsWith(`${listPath}.N.`))
        .map((p) => p.slice(`${listPath}.N.`.length))
        .sort();

describe("TEMPLATE_FIELD_PATHS", () => {
    it("covers every template the section manifest knows", () => {
        for (const code of Object.keys(TEMPLATE_SECTION_ORDER))
            expect(TEMPLATE_FIELD_PATHS[code]?.length).toBeGreaterThan(0);
    });

    it("records what Villa Marindu's inclusion ledger actually draws", () => {
        // The design's row is: numeral | name + description | tag. Nothing else.
        expect(itemKeys("hospitality:BK", "services.items")).toEqual(["desc", "tag", "title"]);
    });

    it("records the fuller room card on Kubo Stays, so the filter is not global", () => {
        const bj = itemKeys("hospitality:BJ", "services.items");
        for (const k of ["title", "desc", "tag", "meta", "rating", "price", "duration", "features", "image"])
            expect(bj).toContain(k);
        // The two templates are in the same family and must still differ.
        expect(bj.length).toBeGreaterThan(itemKeys("hospitality:BK", "services.items").length);
    });

    it("normalises every list index to N, so one entry covers all rows", () => {
        for (const [code, paths] of Object.entries(TEMPLATE_FIELD_PATHS))
            for (const p of paths)
                expect(p).not.toMatch(/\.\d+(\.|$)/);
    });

    it("only records paths under a known content root", () => {
        // READ the roots, do not restate them. This test used to carry its own
        // copy of the list "mirroring" scripts/gen-template-fields.mjs, which
        // made three places that had to agree: the generator, the guard, and
        // here. Adding `contact` to the generator broke this test while the
        // behaviour it protects was fine — the copy had simply drifted, which is
        // the exact failure the template tooling keeps producing.
        //
        // Parsed out of the source rather than imported because the generator is
        // an .mjs run by node, and jest's module interop is not worth the risk
        // for one array.
        const generator = fs.readFileSync(
            path.join(__dirname, "..", "..", "scripts", "gen-template-fields.mjs"),
            "utf8",
        );
        const block = generator.match(/export const ROOTS = \[([\s\S]*?)\];/);
        expect(block).not.toBeNull();
        const roots = new Set(
            [...block![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]),
        );
        expect(roots.size).toBeGreaterThan(15);

        // Anything outside the list means the scan started matching CSS classes
        // or identifiers.
        for (const paths of Object.values(TEMPLATE_FIELD_PATHS))
            for (const p of paths) expect(roots.has(p.split(".")[0])).toBe(true);
    });

    it("pins the services row hooks that no sidebar input owns", () => {
        // A data-field on a path the schema does not declare is a DEAD HOOK:
        // clickable in the v3 preview, owned by no input, editable nowhere. Three
        // of them predate this manifest, and the manifest is simply the first
        // thing to make them countable — it does not create or worsen them, and
        // the field filter ignores them (an undeclared path matches no spec).
        //
        // This assertion exists so the set cannot GROW unnoticed. A new name here
        // means someone bound a hook without declaring it; declare it in
        // genericContentSchema.ts or drop the hook.
        const spec = GENERIC_CONTENT_SCHEMA
            .find((g) => g.id === "services")!
            .fields.find((f) => (f as ListSpec).path === "services.items") as ListSpec;
        const declared = new Set((spec.itemFields ?? []).map((f) => f.path));
        const orphans = new Set<string>();
        for (const code of Object.keys(TEMPLATE_FIELD_PATHS))
            for (const k of itemKeys(code, "services.items"))
                if (!declared.has(k)) orphans.add(k);
        expect([...orphans].sort()).toEqual([
            "badge",       // an older card badge; the schema calls it `tag`
            "body",        // an older description key; the schema calls it `desc`
            "bullets.N",   // a nested per-row list the schema has no spec for
            "cta.href",    // a per-row button; the schema's is section-wide
            "cta.text",
            "features.N",  // nested chips; the schema declares one scalar
            "num",         // a stored numeral; every current template derives it
        ]);
    });

    it("records every schema-declared row field that a template does bind", () => {
        const spec = GENERIC_CONTENT_SCHEMA
            .find((g) => g.id === "services")!
            .fields.find((f) => (f as ListSpec).path === "services.items") as ListSpec;
        const declared = (spec.itemFields ?? []).map((f) => f.path);
        // Kubo Stays draws the full room card, so every declared key must be
        // reachable there — otherwise the filter would hide a live input.
        const bj = new Set(itemKeys("hospitality:BJ", "services.items"));
        for (const k of declared) expect(bj.has(k)).toBe(true);
    });
});
