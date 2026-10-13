import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import GiveawayPage from "@/app/100-pages-giveaway/page";
import { metadata } from "@/app/100-pages-giveaway/layout";
import { PosterStep } from "@/app/start/_components/PosterStep";

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
        expect(html).toContain("Off the Record is giving 100 local businesses a free Tendso website.");
        expect(html).toContain("Any walk-in business where customers will see the Off the Record poster");
        expect(html).toContain("any print shop");
        expect(html).toContain("your storefront or sign in the shot");
        expect(html).toContain("Off the Record checks eligibility; Tendso builds and delivers your free website.");
        expect(html).not.toContain("300,000");
    });

    it("describes sites as given only when all 100 were actually delivered", () => {
        mockStatus = { open: false, slotsLeft: 0, given: 100 };
        const html = renderToStaticMarkup(createElement(GiveawayPage));

        expect(html).toContain("Off the Record’s 100 free websites have been given away.");
        expect(html).toContain("Applications already under review stay in the queue.");
        expect(html).toContain("You can still get one for ₱4,999.");
        expect(html).toContain('href="/start"');
        expect(html).not.toContain("campaign=");
        expect(html).not.toContain("Download poster");
        expect(html).not.toContain("Who qualifies?");
        expect(html).toContain("Off the Record website giveaway");
    });

    it("distinguishes a fully reserved allocation from websites already given away", () => {
        mockStatus = { open: false, slotsLeft: 0, given: 0 };
        const html = renderToStaticMarkup(createElement(GiveawayPage));

        expect(html).toContain("All giveaway slots are currently reserved.");
        expect(html).toContain("applications still awaiting review");
        expect(html).not.toContain("100 free websites have been given away");
        expect(html).not.toContain('href="/start?campaign=giveaway');
    });

    it("does not claim the campaign is full when intake is closed with slots remaining", () => {
        mockStatus = { open: false, slotsLeft: 100, given: 0 };
        const html = renderToStaticMarkup(createElement(GiveawayPage));

        expect(html).toContain("Off the Record’s giveaway is currently closed.");
        expect(html).not.toContain("all 100");
        expect(html).not.toContain("All giveaway slots");
        expect(html).not.toContain("given away");
    });

    it("waits for availability before offering an application link", () => {
        mockStatus = undefined;
        const html = renderToStaticMarkup(createElement(GiveawayPage));

        expect(html).toContain("Checking available slots");
        expect(html).not.toContain("100 of 100 slots left");
        expect(html).not.toContain('href="/start?campaign=giveaway');
        expect(html).toContain("disabled");
    });

    it("provides the OTR poster download directly in the evidence step", () => {
        const html = renderToStaticMarkup(createElement(PosterStep, {
            photo: null, busy: false, error: null, tried: false, onPick: () => {}, onRemove: () => {},
        }));
        expect(html).toContain("Show your Off the Record poster.");
        expect(html).toContain('href="/100-pages-giveaway-poster.pdf" download=""');
        expect(html).toContain("Off the Record checks this photo before your free Tendso website is built.");
    });

    it("identifies OTR as the giver in search and social sharing metadata", () => {
        expect(metadata.title).toBe("Off the Record: 100 free Tendso websites");
        expect(metadata.openGraph?.title).toContain("Off the Record");
        expect(metadata.twitter?.title).toContain("Off the Record");
        expect(JSON.stringify(metadata)).not.toContain("300,000");
    });
});
