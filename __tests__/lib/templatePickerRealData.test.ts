/**
 * The picker, against the actual businesses in production.
 *
 * 19 of the 30 real submissions have businessType "Other", so a type-only
 * choice would send two thirds of the queue to the generic family. These are
 * the real names, and the assertion is that the obvious ones land where a
 * person would put them.
 */

import { familyForBusinessType, autoTemplateFor } from "@/lib/templatePicker";
import { TEMPLATE_FAMILIES } from "@/components/editor/templateCatalog";

const ALL_CODES = new Set(TEMPLATE_FAMILIES.flatMap((f) => f.templates.map((t) => t.code)));

// [businessType, businessName, expected family]
const REAL: ReadonlyArray<readonly [string, string, string]> = [
    ["Other", "Jennifer & Agie's Flowershop", "florist"],
    ["Other", "Deluxia Coffee", "foodcraft"],
    ["Other", "Joan's cafe", "foodcraft"],
    ["Other", "Aurora villa", "hospitality"],
    ["Other", "Rowald Metal Works", "trades"],
    ["Other", "Kel's Meatshop", "retail"],
    ["Other", "Divine Sari Sari Store", "retail"],
    ["Other", "Jun and Grace Store", "retail"],
    ["Other", "Gideon Computer Shop", "retail"],
    ["Other", "Print Zone Printing Services", "services"],
    ["Other", "Lumière Candles", "foodcraft"],
    // Genuinely both. "Eatery" wins because the restaurant pattern is ordered
    // ahead of retail, and for a place that serves food that is the better of
    // the two — the menu is the draw, not the shelves.
    ["Other", "Mychiel Store & Eatery", "restaurant"],
    // An explicit type still wins over the name.
    ["Barber/Salon", "YOHA", "barbershop"],
    ["Restaurant", "5th Food Avenue", "restaurant"],
    ["Auto Shop", "J. Sales Glass Aluminum Supply", "autoshop"],
];

describe("templatePicker against production submissions", () => {
    it.each(REAL)("%s / %s -> %s", (type, name, expected) => {
        expect(familyForBusinessType(type, name)).toBe(expected);
    });

    it("gives every real business a renderable code", () => {
        for (const [type, name] of REAL) {
            const code = autoTemplateFor(type, `seed-${name}`, name);
            expect(ALL_CODES.has(code)).toBe(true);
        }
    });

    it("does not put every 'Other' on the same design", () => {
        const others = REAL.filter(([t]) => t === "Other");
        const codes = new Set(others.map(([t, n]) => autoTemplateFor(t, `seed-${n}`, n)));
        expect(codes.size).toBeGreaterThan(3);
    });
});
