import { helpViewParams, publicHelpDestination } from "@/app/knowledge/routing";
import { articleHref, categoryHref, CONTACT_HREF, CREATOR_FAQ_HREF, HELP_HOME } from "@/app/knowledge/_components/model";

describe("default redesigned help destinations", () => {
    it("reads shared search/topic values on the server, including repeated and empty parameters", () => {
        expect(helpViewParams({})).toEqual({ initialQuery: "", initialTopic: "all" });
        expect(helpViewParams({ q: ["price", "ignored"], cat: ["payments", "ignored"] })).toEqual({ initialQuery: "price", initialTopic: "payments" });
        expect(helpViewParams({ q: "", cat: "" })).toEqual({ initialQuery: "", initialTopic: "all" });
    });
    it("opens the new help front and preserves repeated search/campaign values", () => {
        expect(publicHelpDestination({})).toBe("/help");
        expect(publicHelpDestination({ ws: "help", q: "website price", src: ["video", "poster"], ignored: undefined })).toBe("/help?q=website+price&src=video&src=poster");
    });
    it("opens the requested topic in the new answers view", () => {
        expect(publicHelpDestination({ cat: "pay & publish", ref: "MIKA30" })).toBe("/help?cat=pay+%26+publish&ref=MIKA30#answers");
        expect(categoryHref({ workspace: "help", slug: "pay & publish" })).toBe("/help?cat=pay%20%26%20publish#answers");
    });
    it("keeps full public articles crawlable without stale workspace/topic parameters", () => {
        expect(publicHelpDestination({ ws: "help", article: "pay again", cat: "payments", src: ["one", "two"] })).toBe("/knowledge/pay%20again?src=one&src=two");
        expect(articleHref({ workspace: "help", slug: "pay again" })).toBe("/knowledge/pay%20again");
    });
    it("does not turn an untrusted article or redirect query into an external redirect", () => {
        expect(publicHelpDestination({ article: "//example.invalid" })).toBe("/knowledge/%2F%2Fexample.invalid");
        expect(publicHelpDestination({ redirect_url: "https://example.invalid" })).toBe("/help?redirect_url=https%3A%2F%2Fexample.invalid");
    });
    it("leaves the gated wiki under its access-checked route", () => {
        expect(publicHelpDestination({ ws: ["wiki", "help"], cat: "payments", article: "first-visit" })).toBeNull();
        expect(categoryHref({ workspace: "wiki", slug: "first visit" })).toBe("/knowledge?ws=wiki&cat=first%20visit");
        expect(articleHref({ workspace: "wiki", slug: "first visit" })).toBe("/knowledge?ws=wiki&article=first%20visit");
    });
    it("uses the redesigned help URLs for shared navigation", () => {
        expect(HELP_HOME).toBe("/help");
        expect(CONTACT_HREF).toBe("/help#contact");
        expect(CREATOR_FAQ_HREF).toBe("/help#answers");
    });
});
