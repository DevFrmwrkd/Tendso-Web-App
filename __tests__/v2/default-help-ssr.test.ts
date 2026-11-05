import DefaultHelpPage from "@/app/help/page";
import V2HelpPage from "@/app/v2/help/page";
import { loadHelp } from "@/app/knowledge/_components/loadHelp";

jest.mock("@/app/knowledge/_components/loadHelp", () => ({ loadHelp: jest.fn() }));
jest.mock("@/components/v2/pages-b/HelpPage", () => ({ HelpPage: () => null }));

const initial = { categories: [], articles: [], faqs: [] };
beforeEach(() => { jest.mocked(loadHelp).mockReset().mockResolvedValue(initial); });

describe("server-rendered help route data", () => {
    it.each([DefaultHelpPage, V2HelpPage])("hands cached content and shared filters to the client view before rendering", async Page => {
        const result = await Page({ searchParams: Promise.resolve({ q: ["payment", "unused"], cat: "pricing" }) });
        expect(result.props).toEqual({ initial, initialQuery: "payment", initialTopic: "pricing" });
        expect(loadHelp).toHaveBeenCalledTimes(1);
    });

    it("still renders the initial view with defaults when the live data source is unavailable", async () => {
        jest.mocked(loadHelp).mockResolvedValue(null);
        const result = await DefaultHelpPage({ searchParams: Promise.resolve({}) });
        expect(result.props).toEqual({ initial: null, initialQuery: "", initialTopic: "all" });
    });
});
