import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ShopLinkPage } from "@/components/v2/creators/ShopLinkPage";
import { EarnLinkPage } from "@/components/v2/creators/EarnLinkPage";
import { GetTheApp } from "@/components/v2/creators/LinkPageParts";
import type { CreatorCard } from "@/lib/v2/creatorTypes";

jest.mock("@/lib/campaign", () => ({ rememberAffiliate: jest.fn() }));
jest.mock("@/lib/v2/creatorData", () => ({ useCreatorCard: jest.fn(), useRecordClick: jest.fn() }));
jest.mock("@/components/v2/creators/Chrome", () => ({ SoloBar: () => null, MiniFoot: () => null }));
jest.mock("@/components/v2/creators/Photo", () => ({ Photo: () => null }));
jest.mock("@/components/v2/PhoneFrame", () => ({ PhoneFrame: () => null }));
jest.mock("@/components/v2/creators/Stores", () => ({ StoreRow: () => null }));

const base: CreatorCard = { handle: "mika", name: "Mika Santos", photo: null, code: "MIKA30", listPrice: 4999, price: 3499, saving: 1500, percentOff: 30 };
function render(card: CreatorCard = base) {
    jest.requireMock("@/lib/v2/creatorData").useCreatorCard.mockReturnValue({ status: "found", card });
    return renderToStaticMarkup(createElement(ShopLinkPage, { handle: card.handle }));
}

describe("public creator page", () => {
    it("shows the saved message as text and independent platform links", () => {
        const html = render({ ...base, message: "Your shop deserves a website.\n<script>hello</script>", socialLinks: {
            messenger: "https://m.me/mika", facebook: "https://www.facebook.com/mika",
            instagram: "https://www.instagram.com/mika", tiktok: "https://www.tiktok.com/@mika", youtube: "https://www.youtube.com/@mika",
        } });
        expect(html).toContain("A note from Mika");
        expect(html).toContain("Your shop deserves a website.\n&lt;script&gt;hello&lt;/script&gt;");
        expect(html).not.toContain("<script>");
        for (const url of ["https://m.me/mika", "https://www.facebook.com/mika", "https://www.instagram.com/mika", "https://www.tiktok.com/@mika", "https://www.youtube.com/@mika"]) {
            expect(html).toContain(`href="${url}" target="_blank" rel="noopener noreferrer"`);
        }
        for (const label of ["Message on Messenger", "Facebook", "Instagram", "TikTok", "YouTube"]) expect(html).toContain(label);
    });

    it("hides empty settings and rejects unsafe or mismatched platform links on read", () => {
        const html = render({ ...base, message: "   ", socialLinks: { instagram: "https://instagram.com.evil.test/mika", youtube: "javascript:alert(1)", tiktok: "https://www.youtube.com/@mika" } });
        expect(html).not.toContain("A note from");
        expect(html).not.toContain("Find Mika online");
        expect(html).not.toContain("javascript:");
        expect(html).not.toContain("evil.test");
    });

    it("gives owners clear price, preview and code instructions without a build-time guarantee", () => {
        const html = render();
        expect(html).toContain("Your shop online.<br/>Pay once, own it.");
        expect(html).toContain("Shared by Mika Santos");
        expect(html).toContain("Save ₱1,500 with Mika&#x27;s code. See it first. Pay to publish.");
        expect(html).toContain("Enter this code before you pay to use this website price.");
        expect(html).toContain("Preview it and request changes.");
        expect(html).not.toContain("20 minutes");
        const fullPrice = render({ ...base, price: 4999, saving: 0 });
        expect(fullPrice).toContain("One-time website price.");
        expect(fullPrice).not.toContain("<s>");
        expect(fullPrice).not.toContain("Save ₱");
    });

    it("keeps the agent code instructions separate from website payment", () => {
        const html = renderToStaticMarkup(createElement(GetTheApp, { card: base, label: "Who sent you?", instructions: "Enter this code in ‘Who sent you?’ when you join as a field agent." }));
        expect(html).toContain("join as a field agent");
        expect(html).not.toContain("before you pay");
        jest.requireMock("@/lib/v2/creatorData").useCreatorCard.mockReturnValue({ status: "found", card: base });
        const invite = renderToStaticMarkup(createElement(EarnLinkPage, { handle: base.handle }));
        expect(invite.match(/when you join as a field agent/g)).toHaveLength(2);
        expect(invite).not.toContain("before you pay");
    });
});
