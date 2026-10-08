import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AffiliateOffer } from "@/app/a/[handle]/_components/AffiliateLanding";
import { affiliateBuyHref, creatorPlatform, creatorStoreButtons } from "@/lib/affiliateLanding";
import { WEBSITE_PRICE } from "@/lib/pricing";

// The offer view does not fetch data. The generated ESM client is replaced only
// so Jest's CommonJS renderer can import the same module as the public route.
jest.mock("@/convex/_generated/api", () => ({ api: {} }));

const playUrl = "https://play.google.com/store/apps/details?id=app.tendso";
const iosUrl = "https://apps.apple.com/app/tendso/id12345";
const affiliate = {
    handle: "maria",
    displayName: "Maria Cruz",
    photo: "https://media.tendso.com/maria.jpg",
    message: "Let me help your shop get online.",
    socialLink: "https://m.me/maria",
    referralCode: "MARIA2026",
    price: 1999,
};

describe("public affiliate offer", () => {
    it("shows the affiliate's fixed page fields and discounted website offer", () => {
        const html = renderToStaticMarkup(createElement(AffiliateOffer, {
            handle: "maria", affiliate, playUrl, iosUrl,
        }));

        expect(html).toContain("Maria Cruz");
        expect(html).toContain(affiliate.message);
        expect(html).toContain(`src="${affiliate.photo}"`);
        expect(html).toMatch(/<del[^>]*>₱4,999<\/del>/);
        expect(html).toContain("₱1,999");
        expect(html).toContain("60% off");
        expect(html).toContain('href="/start?affiliate=maria"');
        expect(html).toContain("Get my website");
        expect(html).toContain("MARIA2026");
        expect(html).toContain('aria-label="Copy creator referral code"');
        expect(html).toContain("Download the Tendso app and enter this code");
        expect(html).toContain('href="https://m.me/maria"');
        expect(html).toContain("Download on the App Store");
        expect(html).toContain("Get it on Google Play");
    });

    it("keeps unavailable handles in checkout and reveals no affiliate fields or referral code", () => {
        const html = renderToStaticMarkup(createElement(AffiliateOffer, {
            handle: "missing name&campaign=otr", affiliate: null, playUrl, iosUrl,
        }));

        expect(html).toContain("₱4,999");
        expect(html).not.toContain("<del");
        expect(html).not.toContain("% off");
        expect(html).not.toContain("Your Tendso affiliate");
        expect(html).not.toContain("Creator referral code");
        expect(html).not.toContain("Copy creator referral code");
        expect(html).not.toContain("Download the Tendso app and enter this code");
        expect(html).toContain('href="/start?affiliate=missing%20name%26campaign%3Dotr"');
        expect(html).toContain("Get my website");
    });

    it("shows a plain full-price affiliate offer without a strike-through", () => {
        const html = renderToStaticMarkup(createElement(AffiliateOffer, {
            handle: "maria", affiliate: { ...affiliate, price: WEBSITE_PRICE },
        }));
        expect(html).toContain("Maria Cruz");
        expect(html).toContain("₱4,999");
        expect(html).not.toContain("<del");
        expect(html).not.toContain("% off");
    });

    it("renders page text plainly and refuses unsafe photo or social URLs", () => {
        const html = renderToStaticMarkup(createElement(AffiliateOffer, {
            handle: "maria",
            affiliate: {
                ...affiliate,
                message: "<script>alert('hello')</script>",
                photo: "javascript:alert(1)",
                socialLink: "https://facebook.com.evil.test/maria",
            },
        }));
        expect(html).toContain("&lt;script&gt;");
        expect(html).not.toContain("<script");
        expect(html).not.toContain("javascript:");
        expect(html).not.toContain("facebook.com.evil.test");
    });
});

describe("affiliate checkout link", () => {
    it("encodes the entire handle as one attribution value", () => {
        expect(affiliateBuyHref("other&campaign=otr")).toBe("/start?affiliate=other%26campaign%3Dotr");
        expect(affiliateBuyHref("Unavailable")).toBe("/start?affiliate=Unavailable");
    });
});

describe("creator app store destinations", () => {
    it("recognizes Android, iPhone and iPadOS without treating a desktop Mac as an iPad", () => {
        expect(creatorPlatform("Mozilla/5.0 Android")).toBe("android");
        expect(creatorPlatform("Mozilla/5.0 iPhone")).toBe("ios");
        expect(creatorPlatform("Mozilla/5.0 Macintosh", true)).toBe("ios");
        expect(creatorPlatform("Mozilla/5.0 Macintosh", false)).toBe("other");
    });

    it("links phones to their configured store and makes both stores available on desktop", () => {
        expect(creatorStoreButtons("android", playUrl, iosUrl).map((button) => button.href)).toEqual([playUrl]);
        expect(creatorStoreButtons("ios", playUrl, iosUrl).map((button) => button.href)).toEqual([iosUrl]);
        expect(creatorStoreButtons("other", playUrl, iosUrl).map((button) => button.href)).toEqual([iosUrl, playUrl]);
    });

    it("uses the existing app explainer when a phone has no usable store setting", () => {
        expect(creatorStoreButtons("android", null, iosUrl)[0].href).toBe("/for-creators#app");
        expect(creatorStoreButtons("ios", playUrl, "javascript:alert(1)")[0].href).toBe("/for-creators#app");
        expect(creatorStoreButtons("other", "https://user:pass@play.google.com/app", null)[0].href).toBe("/for-creators#app");
    });
});
