import { messageUsHref, sourceHref, tidy } from "@/components/v2/chat/tidy";
import { isFieldAgentSale, pendingCopy } from "@/components/v2/pages-b/payRules";

describe("v2 pay copy", () => {
    it("treats web and app owner sales as not field-agent sales", () => {
        expect(isFieldAgentSale({ contentSource: "owner_intake" })).toBe(false);
        expect(isFieldAgentSale({ contentSource: "owner_app" })).toBe(false);
        expect(isFieldAgentSale(null)).toBe(false);
    });

    it("treats a sale built in the shop as a field-agent sale", () => {
        expect(isFieldAgentSale({})).toBe(true);
        expect(isFieldAgentSale({ contentSource: null })).toBe(true);
        expect(isFieldAgentSale({ contentSource: "voice_interview" })).toBe(true);
    });

    it("says the site is live only for a live field-agent sale", () => {
        const agent = pendingCopy({ agentSale: true, live: true });
        expect(agent.title).toBe("Your site is live.");
        expect(agent.sub).toBe("Pay to keep it live.");

        for (const copy of [pendingCopy({ agentSale: false, live: true }), pendingCopy({ agentSale: false, live: false }), pendingCopy({ agentSale: true, live: false })]) {
            expect(copy.title).toBe("Your site is ready.");
            expect(copy.sub).toBe("See it first. Then pay once to publish.");
            expect(JSON.stringify(copy).toLowerCase()).not.toContain("already up");
            expect(JSON.stringify(copy)).not.toMatch(/48|72/);
        }
    });
});

describe("Ask Tendso helpers", () => {
    it("keeps a short answer whole", () => {
        const t = tidy("Pay once, after you see it.");
        expect(t).toEqual({ short: "Pay once, after you see it.", full: "Pay once, after you see it.", clipped: false });
    });

    it("clips a long answer on a sentence and keeps the full text", () => {
        const sentence = "Your site is built in about twenty minutes after the interview and the photos are in. ";
        const long = sentence.repeat(8).trim();
        const t = tidy(long);
        expect(t.clipped).toBe(true);
        expect(t.short.length).toBeLessThan(long.length);
        expect(t.short.endsWith(".")).toBe(true);
        expect(t.full).toBe(long);
    });

    it("strips markdown bold and turns list dashes into bullets", () => {
        expect(tidy("**Free** edits.\n- one\n- two").full).toBe("Free edits.\n• one\n• two");
    });

    it("builds the Message us link with the question in the body", () => {
        const href = messageUsHref("Can I change my hours?");
        expect(href.startsWith("mailto:")).toBe(true);
        expect(decodeURIComponent(href)).toContain("Can I change my hours?");
    });

    it("links a source to its article page", () => {
        expect(sourceHref("how-much")).toBe("/knowledge/how-much");
        expect(sourceHref("a b")).toBe("/knowledge/a%20b");
    });
});
