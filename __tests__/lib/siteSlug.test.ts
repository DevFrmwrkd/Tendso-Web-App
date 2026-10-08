/**
 * Hostnames for customer sites.
 *
 * The cases below are the REAL businesses in production, because the old
 * Worker-name rules mangled several of them and two of them collide.
 */

import {
    slugifyBusinessName,
    isUsableSlug,
    resolveSiteSlug,
    slugFromHost,
    siteUrlForSlug,
    hostedSiteHome,
    RESERVED_SLUGS,
} from "@/lib/siteSlug";

describe("slugifyBusinessName", () => {
    it("joins on apostrophes instead of splitting", () => {
        expect(slugifyBusinessName("Kel's Meatshop")).toBe("kels-meatshop");
        expect(slugifyBusinessName("Joan’s cafe")).toBe("joans-cafe");
        expect(slugifyBusinessName("Juan’s Barber Shop")).toBe("juans-barber-shop");
    });

    it("folds accents instead of destroying them", () => {
        // Was "lumi-re-candles".
        expect(slugifyBusinessName("Lumière Candles")).toBe("lumiere-candles");
        expect(slugifyBusinessName("Niño's Tindahan")).toBe("ninos-tindahan");
    });

    it("reads & as and", () => {
        expect(slugifyBusinessName("Jennifer & Agie’s Flowershop"))
            .toBe("jennifer-and-agies-flowershop");
        expect(slugifyBusinessName("Beauty me salon massage &Spa"))
            .toBe("beauty-me-salon-massage-and-spa");
    });

    it("handles the rest of the real production names", () => {
        const cases: Array<[string, string]> = [
            ["Neighborhood", "neighborhood"],
            ["Deluxia Coffee", "deluxia-coffee"],
            ["Aurora villa", "aurora-villa"],
            ["5th Food Avenue", "5th-food-avenue"],
            ["Divine Sari Sari Store", "divine-sari-sari-store"],
            ["Rowald Metal Works", "rowald-metal-works"],
            ["J. Sales Glass Aluminum Supply", "j-sales-glass-aluminum-supply"],
            ["LITRATO by K&S PHOTOBOOTH", "litrato-by-k-and-s-photobooth"],
        ];
        for (const [name, expected] of cases) expect(slugifyBusinessName(name)).toBe(expected);
    });

    it("returns empty rather than inventing a name", () => {
        expect(slugifyBusinessName("")).toBe("");
        expect(slugifyBusinessName("!!!")).toBe("");
        expect(slugifyBusinessName(null)).toBe("");
    });

    it("never emits a label DNS would reject", () => {
        const names = [
            "Kel's Meatshop", "Lumière Candles", "-leading dash-", "  spaced  ",
            "A".repeat(200), "5th Food Avenue", "Jennifer & Agie’s Flowershop",
        ];
        for (const n of names) {
            const s = slugifyBusinessName(n);
            if (!s) continue;
            expect(s.length).toBeLessThanOrEqual(63);
            expect(s).toMatch(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/);
        }
    });
});

describe("resolveSiteSlug", () => {
    it("gives the two Lumiere Candles different addresses", () => {
        const first = resolveSiteSlug("Lumière Candles", []);
        const second = resolveSiteSlug("Lumière Candles", [first]);
        expect(first).toBe("lumiere-candles");
        expect(second).toBe("lumiere-candles-2");
        expect(second).not.toBe(first);
    });

    it("keeps counting past the second collision", () => {
        const taken = ["sari-sari-store", "sari-sari-store-2", "sari-sari-store-3"];
        expect(resolveSiteSlug("Sari Sari Store", taken)).toBe("sari-sari-store-4");
    });

    it("refuses reserved names without losing the business", () => {
        for (const word of ["Admin", "WWW", "API", "Mail", "Tendso"]) {
            const slug = resolveSiteSlug(word, []);
            expect(RESERVED_SLUGS.has(slug)).toBe(false);
            expect(isUsableSlug(slug)).toBe(true);
            // The owner's word survives in the address.
            expect(slug.startsWith(word.toLowerCase())).toBe(true);
        }
    });

    it("falls back rather than failing when a name yields nothing", () => {
        const slug = resolveSiteSlug("!!!", [], "jd76xp415b3mhyex");
        expect(isUsableSlug(slug)).toBe(true);
    });

    it("always returns something DNS accepts", () => {
        const names = ["", "!!!", "Admin", "Lumière Candles", "A".repeat(300), null];
        for (const n of names) {
            expect(isUsableSlug(resolveSiteSlug(n as string, ["lumiere-candles"]))).toBe(true);
        }
    });
});

describe("slugFromHost", () => {
    it("accepts exactly one label under the suffix", () => {
        expect(slugFromHost("neighborhood.sites.tendso.com")).toBe("neighborhood");
        expect(slugFromHost("Deluxia-Coffee.Sites.Tendso.Com")).toBe("deluxia-coffee");
        expect(slugFromHost("neighborhood.sites.tendso.com:443")).toBe("neighborhood");
    });

    it("refuses anything that is not a site we issued", () => {
        for (const h of [
            "www.tendso.com",
            "tendso.com",
            "sites.tendso.com",              // the bare suffix, no slug
            "a.b.sites.tendso.com",          // two labels — not ours to serve
            "evil.sites.tendso.com.attacker.com",
            "",
            null,
            undefined,
        ]) {
            expect(slugFromHost(h as string)).toBeNull();
        }
    });

    it("refuses a reserved label even if someone points DNS at it", () => {
        expect(slugFromHost("admin.sites.tendso.com")).toBeNull();
        expect(slugFromHost("api.sites.tendso.com")).toBeNull();
    });
});

describe("siteUrlForSlug", () => {
    it("builds the public address", () => {
        expect(siteUrlForSlug("neighborhood")).toBe("https://neighborhood.sites.tendso.com");
    });
});

describe("hostedSiteHome", () => {
    it("gives the home page the way the site's canonical writes it", () => {
        expect(hostedSiteHome("https://layug-wood-works.sites.tendso.com/")).toBe("https://layug-wood-works.sites.tendso.com/");
        expect(hostedSiteHome("https://layug-wood-works.sites.tendso.com")).toBe("https://layug-wood-works.sites.tendso.com/");
        expect(hostedSiteHome(" http://Aurora-Villa.Sites.Tendso.com/rooms?x=1 ")).toBe("https://aurora-villa.sites.tendso.com/");
    });

    it("refuses URLs that are not one of our hosted sites", () => {
        for (const u of [
            "https://benjoetiresupply.com/",
            "https://hapag.pages.dev/",
            "https://www.tendso.com/",
            "https://admin.sites.tendso.com/",  // reserved
            "https://a.b.sites.tendso.com/",    // two labels
            "layug-wood-works.sites.tendso.com", // no scheme, not a URL
            "",
            null,
            undefined,
        ]) {
            expect(hostedSiteHome(u as string)).toBeNull();
        }
    });
});
