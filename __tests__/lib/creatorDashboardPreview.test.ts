import { useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CreatorHome, CreatorHomeView } from "@/app/dashboard/_components/CreatorHome";
import { sampleCreator, sampleLeads, sampleSubmissions, sampleWithdrawals } from "@/app/admin/preview/_lib/samples";
import { CreatorShellView } from "@/components/shells/CreatorShell";
import { AffiliateDashboardPreview, CreatorDashboardPreview } from "@/app/admin/preview/_components/DashboardPreviews";

jest.mock("convex/react", () => ({
    useQuery: jest.fn(), useConvexAuth: jest.fn(),
    useMutation: () => jest.fn(), useAction: () => jest.fn(), usePaginatedQuery: jest.fn(),
}));
jest.mock("@/convex/_generated/api", () => ({ api: jest.requireActual("convex/server").anyApi }));
jest.mock("@/app/affiliates/dashboard/_components/ShareTools.module.css", () => ({}));
jest.mock("@clerk/nextjs", () => ({ useUser: jest.fn() }));
jest.mock("next/navigation", () => ({
    usePathname: () => "/admin/preview/creator",
    useRouter: jest.fn(),
}));

const referrals = { pending: 2, qualified: 0, paid: 1 };
const viewProps = {
    creator: sampleCreator,
    submissions: sampleSubmissions,
    leads: sampleLeads,
    withdrawals: sampleWithdrawals,
    referrals,
};

beforeEach(() => {
    jest.clearAllMocks();
    (useQuery as jest.Mock).mockImplementation(() => { throw new Error("Preview attempted a live query"); });
});

describe("creator dashboard presentation", () => {
    it.each([
        ["Creator", CreatorDashboardPreview],
        ["Affiliate", AffiliateDashboardPreview],
    ])("mounts the actual %s preview with a sample-data notice and no live reads", (view, component) => {
        const html = renderToStaticMarkup(createElement(component));
        expect(html).toContain(`${view} preview · Sample data`);
        expect(html).toContain("Use View as above");
        expect(useQuery).not.toHaveBeenCalled();
    });

    it("renders the current home and navigation from samples without loading any accounts", () => {
        const html = renderToStaticMarkup(createElement(CreatorShellView, {
            name: "Sam Reyes", open: 2, unread: 2, preview: true,
        }, createElement(CreatorHomeView, { ...viewProps, preview: true })));
        for (const text of ["Mabuhay, Sam.", "Get Corner Coffee paid", "Sunrise Bakery", "SAMPLE-C", "Recent activity", "New submission", "Submissions", "Wallet", "Referrals", "Sam Reyes"]) {
            expect(html).toContain(text);
        }
        expect(useQuery).not.toHaveBeenCalled();
        const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
        expect(hrefs.length).toBeGreaterThan(10);
        expect(hrefs.every((href) => href.startsWith("/admin/preview/creator#"))).toBe(true);
    });

    it("keeps empty/new creator preview actions within the preview", () => {
        const html = renderToStaticMarkup(createElement(CreatorHomeView, {
            ...viewProps, creator: { ...sampleCreator, balance: 0, totalEarnings: 0 }, submissions: [], withdrawals: [], preview: true,
        }));
        expect(html).toContain("New submission");
        expect(html).toContain('href="/admin/preview/creator#submit-info"');
        expect(html).not.toContain('href="/submit/info"');
        expect(useQuery).not.toHaveBeenCalled();
    });

    it("retains live creator destinations when preview is not set", () => {
        const html = renderToStaticMarkup(createElement(CreatorShellView, {
            name: "Sam Reyes", open: 2, unread: 2,
        }, createElement(CreatorHomeView, viewProps)));
        for (const href of ["/dashboard", "/submit/info", "/leads", "/wallet", "/referrals", "/submissions?open=preview-payment"]) {
            expect(html).toContain(`href="${href}"`);
        }
        expect(html).not.toContain('href="/admin/preview/creator#');
    });

    it("preserves live home query arguments and renders the same presentation", () => {
        (useQuery as jest.Mock).mockImplementation((reference) => {
            switch (getFunctionName(reference)) {
                case "submissions:getByCreatorId": return sampleSubmissions;
                case "leads:listForMobileCRM": return { leads: sampleLeads };
                case "withdrawals:getByCreator": return sampleWithdrawals;
                case "referrals:getStats": return referrals;
                default: throw new Error("Unexpected live query");
            }
        });
        const actual = renderToStaticMarkup(createElement(CreatorHome, { creator: sampleCreator }));
        const expected = renderToStaticMarkup(createElement(CreatorHomeView, viewProps));
        expect(actual).toBe(expected);
        expect((useQuery as jest.Mock).mock.calls.map(([reference, args]) => [getFunctionName(reference), args])).toEqual([
            ["submissions:getByCreatorId", { creatorId: sampleCreator._id }],
            ["leads:listForMobileCRM", {}],
            ["withdrawals:getByCreator", { creatorId: sampleCreator._id }],
            ["referrals:getStats", { referrerId: sampleCreator._id }],
        ]);
    });
});
