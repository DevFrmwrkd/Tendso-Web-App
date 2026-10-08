import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import GiveawayPage from "@/app/100-pages-giveaway/page";

let mockStatus: { open: boolean; slotsLeft: number; given: number } | undefined;
jest.mock("convex/react", () => ({ useQuery: () => mockStatus }));
jest.mock("@/convex/_generated/api", () => ({ api: { giveaway: { giveawayStatus: "giveaway:giveawayStatus" } } }));

describe("public giveaway landing", () => {
    it("shows live availability and links to the application and printable poster while open", () => {
        mockStatus = { open: true, slotsLeft: 3, given: 95 };
        const html = renderToStaticMarkup(createElement(GiveawayPage));

        expect(html).toContain("3 of 100 slots left");
        expect(html).toContain('href="/start?campaign=giveaway&amp;src=direct"');
        expect(html).toContain('href="/100-pages-giveaway-poster.pdf" download=""');
        expect(html).toContain("Any walk-in business where customers will see the poster");
        expect(html).toContain("any print shop");
        expect(html).toContain("your storefront or sign in the shot");
    });

    it("replaces the offer with only the closed message and a plain, full-price start link", () => {
        mockStatus = { open: false, slotsLeft: 0, given: 100 };
        const html = renderToStaticMarkup(createElement(GiveawayPage));

        expect(html).toContain("Thank you! All 100 free websites have been given away.");
        expect(html).toContain("Already applied? Your slot is safe.");
        expect(html).toContain("You can still get one for ₱4,999.");
        expect(html).toContain('href="/start"');
        expect(html).not.toContain("campaign=");
        expect(html).not.toContain("Download poster");
        expect(html).not.toContain("Who qualifies?");
        expect(html).not.toContain("<header");
        expect(html).not.toContain("<footer");
    });

    it("waits for availability before offering an application link", () => {
        mockStatus = undefined;
        const html = renderToStaticMarkup(createElement(GiveawayPage));

        expect(html).toContain("Checking available slots");
        expect(html).not.toContain("100 of 100 slots left");
        expect(html).not.toContain('href="/start?campaign=giveaway');
        expect(html).toContain("disabled");
    });
});
