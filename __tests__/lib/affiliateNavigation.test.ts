import { useClerk, useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { createElement, type EffectCallback } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
    AffiliateDashboardBoundary,
    AffiliateShellView,
    useAffiliateAccount,
} from "@/app/affiliates/dashboard/_components/AffiliateShell";
import { AFFILIATE_SECTIONS, affiliateHref, affiliateSection } from "@/app/affiliates/dashboard/_lib/navigation";
import type { Doc } from "@/convex/_generated/dataModel";

jest.mock("@clerk/nextjs", () => ({
    useUser: jest.fn(),
    useClerk: jest.fn(),
    SignOutButton: ({ children }: { children: import("react").ReactNode }) => children,
}));
jest.mock("convex/react", () => ({ useConvexAuth: jest.fn(), useQuery: jest.fn() }));
jest.mock("@/convex/_generated/api", () => ({ api: jest.requireActual("convex/server").anyApi }));
jest.mock("next/navigation", () => ({
    usePathname: () => state.pathname,
    useRouter: () => ({ replace: state.replace, push: state.push }),
}));
jest.mock("@/components/v2/fonts", () => ({ v2Fonts: "test-v2-fonts" }));
jest.mock("@/components/v2/creators/creators.css", () => ({}));
jest.mock("@/components/v2/creators/PortalFrame.module.css", () => ({}));
jest.mock("@/components/v2/creators/PortalUtilities", () => ({ PortalUtilities: () => null }));
jest.mock("@/app/affiliates/dashboard/_components/AffiliatePageFrame.module.css", () => ({}));

const account: Doc<"creators"> = {
    _id: "own-affiliate" as Doc<"creators">["_id"],
    _creationTime: 1,
    clerkId: "current-user",
    email: "affiliate@example.com",
    role: "affiliate",
    status: "active",
    firstName: "Ana",
    lastName: "Cruz",
    affiliateHandle: "ana-cruz",
    balance: 1500,
};
type TestSession = { clerkId: string; creator: Doc<"creators"> | null; isOwner: boolean };
const state = {
    user: { id: "current-user", fullName: "Ana Cruz" } as { id: string; fullName: string } | null,
    clerkLoaded: true,
    signedIn: true,
    convex: { isLoading: false, isAuthenticated: true },
    session: undefined as TestSession | null | undefined,
    pathname: "/affiliates/dashboard",
    replace: jest.fn(),
    push: jest.fn(),
    signOut: jest.fn(),
};

const destinations = [
    ["Home", "/affiliates/dashboard"],
    ["My page", "/affiliates/dashboard/my-page"],
    ["Sales", "/affiliates/dashboard#pt-shops"],
    ["Wallet", "/affiliates/dashboard/payouts"],
    ["Referrals", "/affiliates/dashboard#pt-agents"],
    ["Account", "/affiliates/dashboard/account"],
] as const;

function linksIn(html: string): string[] {
    // React can add image preload <link>s; only anchors are navigation.
    return [...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map((match) => match[1].replaceAll("&amp;", "&"));
}
function creatorPortalNavHtml(html: string): string {
    const nav = html.match(/<nav\b[^>]*aria-label="Creator portal"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
    expect(nav).toBeDefined();
    return nav!;
}
function pageMainHtml(html: string): string {
    const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1];
    expect(main).toBeDefined();
    return main!;
}

let mounted = 0;
function ProtectedAffiliateContent() {
    mounted++;
    const current = useAffiliateAccount();
    return createElement("p", {}, `protected-affiliate-content:${current.clerkId}`);
}
function renderBoundary(): string {
    return renderToStaticMarkup(createElement(AffiliateDashboardBoundary, null, createElement(ProtectedAffiliateContent)));
}

/** SSR leaves effects inert; commit only the boundary's own first effect to inspect its redirect. */
function renderAndCommitBoundaryRedirect(): string {
    const effects: EffectCallback[] = [];
    const react = jest.requireActual<typeof import("react")>("react");
    const spy = jest.spyOn(react, "useEffect").mockImplementation(effect => { effects.push(effect); });
    try {
        const html = renderBoundary();
        expect(effects.length).toBeGreaterThan(0);
        effects[0]();
        return html;
    } finally { spy.mockRestore(); }
}

beforeEach(() => {
    jest.clearAllMocks();
    mounted = 0;
    state.user = { id: "current-user", fullName: "Ana Cruz" };
    state.clerkLoaded = true;
    state.signedIn = true;
    state.convex = { isLoading: false, isAuthenticated: true };
    state.session = { clerkId: "current-user", creator: { ...account }, isOwner: false };
    state.pathname = "/affiliates/dashboard";
    (useUser as jest.Mock).mockImplementation(() => ({ user: state.user, isLoaded: state.clerkLoaded, isSignedIn: state.signedIn }));
    (useClerk as jest.Mock).mockReturnValue({ signOut: state.signOut });
    (useConvexAuth as jest.Mock).mockImplementation(() => state.convex);
    (useQuery as jest.Mock).mockImplementation((reference, args) => {
        if (args === "skip") return undefined;
        switch (getFunctionName(reference)) {
            case "adminAccess:me": return state.session;
            case "creators:getByClerkId": return state.session?.creator;
            case "businessOwners:me": return state.session?.isOwner ? { clerkId: state.session.clerkId } : null;
            default: throw new Error("Unexpected account-boundary query");
        }
    });
});

describe("affiliate navigation", () => {
    const portalLinks = [
        "/affiliates/dashboard#top", "/affiliates/dashboard#pt-links", "/affiliates/dashboard#pt-agents",
        "/affiliates/dashboard#pt-shops", "/affiliates/dashboard/payouts", "/affiliates/dashboard/my-page",
    ];
    it("maps account sections to redesigned destinations and keeps admin previews protected", () => {
        expect(AFFILIATE_SECTIONS).toEqual(["home", "my-page", "sales", "wallet", "referrals", "account"]);
        for (const [index, section] of AFFILIATE_SECTIONS.entries()) {
            expect(affiliateSection(section)).toBe(section);
            expect(affiliateHref(section)).toBe(destinations[index][1]);
            expect(affiliateHref(section, true)).toBe(section === "home" ? "/admin/preview/affiliate" : "/admin/preview/affiliate?section=" + section);
        }
        for (const invalid of [undefined, null, "", "../wallet", "sales&creatorId=other", "ADMIN", {}, ["sales"]]) expect(affiliateSection(invalid)).toBe("home");
    });

    it("uses the redesigned portal navigation for live account pages", () => {
        const html = renderToStaticMarkup(createElement(AffiliateShellView, { account }, "affiliate-section"));
        expect(linksIn(creatorPortalNavHtml(html))).toEqual(portalLinks);
        expect(html).toContain('href="/affiliates/dashboard/account"');
        expect(pageMainHtml(html)).toContain("affiliate-section");
        expect(html).not.toContain('aria-label="Main navigation"');
        expect(html).not.toContain("t-tabbar");
        for (const forbidden of ["/submit", "/submissions", "/leads", "/training", "/certification-quiz", "/wallet", "/referrals"]) expect(linksIn(html)).not.toContain(forbidden);
        expect(useUser).not.toHaveBeenCalled();
        expect(useConvexAuth).not.toHaveBeenCalled();
        expect(useQuery).not.toHaveBeenCalled();
    });

    it.each([
        ["/affiliates/dashboard", "/affiliates/dashboard#top"],
        ["/affiliates/dashboard/my-page", "/affiliates/dashboard/my-page"],
        ["/affiliates/dashboard/account", "/affiliates/dashboard/account"],
        ["/affiliates/dashboard/payouts", "/affiliates/dashboard/payouts"],
        ["/v2/creators/portal/my-page", "/affiliates/dashboard/my-page"],
        ["/v2/creators/portal/account", "/affiliates/dashboard/account"],
        ["/v2/creators/portal/payouts", "/affiliates/dashboard/payouts"],
    ])("marks only the redesigned destination current at %s", (pathname, destination) => {
        state.pathname = pathname;
        const html = renderToStaticMarkup(createElement(AffiliateShellView, { account }, "account-content"));
        expect(linksIn(creatorPortalNavHtml(html))).toEqual(portalLinks);
        const current = html.match(/<a\b[^>]*aria-current="page"[^>]*>[\s\S]*?<\/a>/g) ?? [];
        expect(current).toHaveLength(1);
        expect(current[0]).toContain('href="' + destination + '"');
        expect(html).toContain("account-content");
        expect(html).not.toContain("Back to portal");
    });

    it("keeps the editor sample inside protected admin destinations", () => {
        state.pathname = "/admin/preview/affiliate";
        const html = renderToStaticMarkup(createElement(AffiliateShellView, { account, preview: true, section: "my-page" }, "sample-editor-content"));
        const links = linksIn(creatorPortalNavHtml(html));
        expect(links).toContain("/admin/preview/affiliate?section=my-page");
        expect(links).toContain("/admin/preview/affiliate?section=sales");
        expect(links).toContain("/admin/preview/affiliate?section=wallet");
        expect(linksIn(html).every(href => AFFILIATE_SECTIONS.some(section => affiliateHref(section, true) === href))).toBe(true);
        expect(html).toContain("sample-editor-content");
        expect(useQuery).not.toHaveBeenCalled();
        expect(useUser).not.toHaveBeenCalled();
    });
});

describe("affiliate dashboard account boundary", () => {
    it("mounts protected content and supplies only the verified affiliate account", () => {
        expect(renderBoundary()).toContain("protected-affiliate-content:current-user");
        expect(mounted).toBe(1);
        expect((useQuery as jest.Mock).mock.calls.map(([reference, args]) => [getFunctionName(reference), args])).toEqual([
            ["adminAccess:me", {}],
        ]);
    });

    it("preserves suspended affiliates' access to history and existing earnings", () => {
        state.session!.creator!.status = "suspended";
        expect(renderBoundary()).toContain("protected-affiliate-content:current-user");
        expect(mounted).toBe(1);
    });

    it.each(["active", "suspended"].flatMap(status => ["/affiliates/dashboard/my-page", "/v2/creators/portal/my-page", "/v2/creators/portal/account", "/v2/creators/portal/payouts"].map(pathname => ({ status, pathname }))))("keeps $pathname behind the verified $status affiliate boundary", ({ status, pathname }) => {
        state.pathname = pathname;
        state.session!.creator!.status = status;
        const html = renderBoundary();
        expect(creatorPortalNavHtml(html)).toContain('href="/affiliates/dashboard/my-page"');
        expect(pageMainHtml(html)).toContain("protected-affiliate-content:current-user");
        expect(mounted).toBe(1);
        expect((useQuery as jest.Mock).mock.calls.map(([reference, args]) => [getFunctionName(reference), args])).toEqual([
            ["adminAccess:me", {}],
        ]);
        if (status === "suspended") expect(pageMainHtml(html)).toContain("Page changes, sharing, and payouts are paused.");
    });

    it.each(["pending", "wrong role", "deleted", "previous identity", "previous creator", "signed out"])("does not bypass the canonical My page boundary for %s", (condition) => {
        state.pathname = "/v2/creators/portal/my-page";
        if (condition === "pending") state.session!.creator!.status = "pending";
        if (condition === "wrong role") state.session!.creator!.role = "creator";
        if (condition === "deleted") state.session!.creator!.isDeleted = true;
        if (condition === "previous identity") state.session!.clerkId = "previous-user";
        if (condition === "previous creator") state.session!.creator!.clerkId = "previous-user";
        if (condition === "signed out") { state.user = null; state.signedIn = false; }
        const html = renderBoundary();
        expect(html).not.toContain("protected-affiliate-content");
        expect(html).not.toContain('aria-label="Creator portal"');
        expect(mounted).toBe(0);
        if (condition === "signed out") expect((useQuery as jest.Mock).mock.calls.every(([, args]) => args === "skip")).toBe(true);
    });

    it.each(destinations)("shows awaiting approval before mounting a pending affiliate's %s deep link", (_label, pathname) => {
        state.pathname = pathname;
        state.session!.creator!.status = "pending";
        const html = renderBoundary();
        expect(html).toContain("Waiting for admin approval");
        expect(html).toContain("Your affiliate signup is complete.");
        expect(html).toContain("This screen will update when your account is approved.");
        expect(html).toContain("Sign out");
        expect(html).not.toContain("Account unavailable");
        expect(html).not.toContain("protected-affiliate-content");
        expect(mounted).toBe(0);
        expect((useQuery as jest.Mock).mock.calls.map(([reference]) => getFunctionName(reference))).toEqual(["adminAccess:me"]);
    });

    it("opens the requested section when the live pending account becomes active", () => {
        state.pathname = "/affiliates/dashboard/wallet";
        state.session!.creator!.status = "pending";
        expect(renderBoundary()).toContain("Waiting for admin approval");
        expect(mounted).toBe(0);

        state.session!.creator!.status = "active";
        const html = renderBoundary();
        expect(html).toContain("protected-affiliate-content:current-user");
        expect(html).not.toContain("Waiting for admin approval");
        expect(creatorPortalNavHtml(html)).toContain('href="/affiliates/dashboard/payouts"');
        expect(mounted).toBe(1);
    });

    it.each(["creator", "admin", "staff", "system", undefined])("does not mount affiliate content for a %s account", (role) => {
        state.session!.creator!.role = role;
        expect(renderBoundary()).not.toContain("protected-affiliate-content");
        expect(mounted).toBe(0);
    });

    it.each([{ isDeleted: true }, { status: "deleted" }])("does not mount a deleted affiliate: %j", (fields) => {
        Object.assign(state.session!.creator!, fields);
        expect(renderBoundary()).not.toContain("protected-affiliate-content");
        expect(mounted).toBe(0);
    });

    it.each([undefined, "pending", "approved"])("does not turn an unresolved affiliate lifecycle status %s into active access", (status) => {
        state.session!.creator!.status = status;
        expect(renderBoundary()).not.toContain("protected-affiliate-content");
        expect(mounted).toBe(0);
    });

    it("does not mount affiliate content for an owner or an account that has not joined", () => {
        state.session!.creator = null;
        state.session!.isOwner = true;
        expect(renderBoundary()).not.toContain("protected-affiliate-content");
        state.session!.isOwner = false;
        expect(renderBoundary()).not.toContain("protected-affiliate-content");
        expect(mounted).toBe(0);
    });

    it.each(["Clerk loading", "Convex loading", "Convex signed out", "Clerk signed out"])("holds protected content and skips identity queries while %s", (condition) => {
        if (condition === "Clerk loading") state.clerkLoaded = false;
        if (condition === "Convex loading") state.convex = { isLoading: true, isAuthenticated: true };
        if (condition === "Convex signed out") state.convex = { isLoading: false, isAuthenticated: false };
        if (condition === "Clerk signed out") { state.user = null; state.signedIn = false; }
        expect(renderBoundary()).not.toContain("protected-affiliate-content");
        expect(mounted).toBe(0);
        expect((useQuery as jest.Mock).mock.calls.every(([, args]) => args === "skip")).toBe(true);
    });

    it("holds protected content for an unresolved or absent authenticated identity", () => {
        state.session = undefined;
        expect(renderBoundary()).not.toContain("protected-affiliate-content");
        state.session = null;
        expect(renderBoundary()).not.toContain("protected-affiliate-content");
        expect(mounted).toBe(0);
    });

    it("does not render cached account data or data from the previous Convex JWT after a login switch", () => {
        state.session!.creator!.clerkId = "previous-user";
        expect(renderBoundary()).not.toContain("protected-affiliate-content");
        state.session!.creator!.clerkId = "current-user";
        state.session!.clerkId = "previous-user";
        expect(renderBoundary()).not.toContain("protected-affiliate-content");
        expect(mounted).toBe(0);
    });

    it("unmounts protected content when a live affiliate account becomes deleted or changes role", () => {
        expect(renderBoundary()).toContain("protected-affiliate-content:current-user");
        mounted = 0;
        state.session!.creator!.isDeleted = true;
        expect(renderBoundary()).not.toContain("protected-affiliate-content");
        state.session!.creator!.isDeleted = false;
        state.session!.creator!.role = "creator";
        expect(renderBoundary()).not.toContain("protected-affiliate-content");
        expect(mounted).toBe(0);
    });
});

describe("canonical creator page entry redirects", () => {
    it.each([
        ["/v2/creators/portal/my-page", "/affiliates/join?returnTo=%2Faffiliates%2Fdashboard%2Fmy-page&login=1"],
        ["/v2/creators/portal/my-page/", "/affiliates/join?returnTo=%2Faffiliates%2Fdashboard%2Fmy-page&login=1"],
        ["/v2/creators/portal/account", "/affiliates/join?returnTo=%2Faffiliates%2Fdashboard%2Faccount&login=1"],
        ["/v2/creators/portal/payouts", "/affiliates/join?returnTo=%2Faffiliates%2Fdashboard%2Fpayouts&login=1"],
        ["/affiliates/dashboard/my-page", "/affiliates/join?returnTo=%2Faffiliates%2Fdashboard%2Fmy-page&login=1"],
        ["/affiliates/dashboard/wallet", "/affiliates/join?returnTo=%2Faffiliates%2Fdashboard%2Fpayouts&login=1"],
    ])("sends a signed-out visitor at %s to %s", (pathname, destination) => {
        state.pathname = pathname;
        state.user = null;
        state.signedIn = false;
        state.convex = { isLoading: false, isAuthenticated: false };
        const html = renderAndCommitBoundaryRedirect();
        expect(state.replace).toHaveBeenCalledTimes(1);
        expect(state.replace).toHaveBeenCalledWith(destination);
        expect(html).not.toContain("protected-affiliate-content");
        expect(mounted).toBe(0);
        expect((useQuery as jest.Mock).mock.calls.every(([, args]) => args === "skip")).toBe(true);
    });

    it.each([
        ["/v2/creators/portal/my-page", "/affiliates/join?returnTo=%2Faffiliates%2Fdashboard%2Fmy-page"],
        ["/v2/creators/portal/my-page/", "/affiliates/join?returnTo=%2Faffiliates%2Fdashboard%2Fmy-page"],
        ["/v2/creators/portal/account", "/affiliates/join?returnTo=%2Faffiliates%2Fdashboard%2Faccount"],
        ["/v2/creators/portal/payouts", "/affiliates/join?returnTo=%2Faffiliates%2Fdashboard%2Fpayouts"],
        ["/affiliates/dashboard/my-page", "/affiliates/join?returnTo=%2Faffiliates%2Fdashboard%2Fmy-page"],
        ["/affiliates/dashboard/wallet", "/affiliates/join?returnTo=%2Faffiliates%2Fdashboard%2Fpayouts"],
    ])("sends a verified login without a creator profile at %s to %s", (pathname, destination) => {
        state.pathname = pathname;
        state.session!.creator = null;
        const html = renderAndCommitBoundaryRedirect();
        expect(state.replace).toHaveBeenCalledTimes(1);
        expect(state.replace).toHaveBeenCalledWith(destination);
        expect(html).not.toContain("protected-affiliate-content");
        expect(mounted).toBe(0);
        expect((useQuery as jest.Mock).mock.calls.map(([reference, args]) => [getFunctionName(reference), args])).toEqual([
            ["adminAccess:me", {}],
        ]);
    });

    it.each(["/v2/creators/portal/my-page", "/v2/creators/portal/account", "/v2/creators/portal/payouts"].flatMap(pathname =>
        ["Clerk loading", "Convex loading", "session unresolved", "previous identity", "owner", "admin", "pending", "deleted"].map(condition => ({ pathname, condition }))))(
        "keeps existing canonical account gates at $pathname while $condition", ({ pathname, condition }) => {
            state.pathname = pathname;
            if (condition === "Clerk loading") { state.clerkLoaded = false; state.signedIn = false; }
            if (condition === "Convex loading") { state.convex = { isLoading: true, isAuthenticated: true }; state.session!.creator = null; }
            if (condition === "session unresolved") state.session = undefined;
            if (condition === "previous identity") { state.session!.clerkId = "previous-user"; state.session!.creator = null; }
            if (condition === "owner") { state.session!.creator = null; state.session!.isOwner = true; }
            if (condition === "admin") state.session!.creator!.role = "admin";
            if (condition === "pending") state.session!.creator!.status = "pending";
            if (condition === "deleted") state.session!.creator!.isDeleted = true;
            const html = renderAndCommitBoundaryRedirect();
            expect(state.replace).not.toHaveBeenCalled();
            expect(html).not.toContain("protected-affiliate-content");
            expect(mounted).toBe(0);
        },
    );
});
