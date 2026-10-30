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
    ["Sales", "/affiliates/dashboard/sales"],
    ["Wallet", "/affiliates/dashboard/wallet"],
    ["Referrals", "/affiliates/dashboard/referrals"],
    ["Account", "/affiliates/dashboard/account"],
] as const;

function linksIn(html: string): string[] {
    // React can add image preload <link>s; only anchors are navigation.
    return [...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map((match) => match[1].replaceAll("&amp;", "&"));
}
function sidebarHtml(html: string): string {
    const nav = html.match(/<aside\b[^>]*aria-label="Main navigation"[^>]*>([\s\S]*?)<\/aside>/)?.[1];
    expect(nav).toBeDefined();
    return nav!;
}
function currentSidebarLinks(html: string): string[] {
    return html.match(/<a\b(?=[^>]*class="[^"]*\bt-nav-item\b)(?=[^>]*aria-current="page")[^>]*>[\s\S]*?<\/a>/g) ?? [];
}
function mobileTabsHtml(html: string): string {
    const nav = html.match(/<nav\b[^>]*class="[^"]*t-tabbar[^"]*"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
    expect(nav).toBeDefined();
    return nav!;
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
    it("maps all six sections to their live and protected preview URLs", () => {
        expect(AFFILIATE_SECTIONS).toEqual(["home", "my-page", "sales", "wallet", "referrals", "account"]);
        for (const [index, section] of AFFILIATE_SECTIONS.entries()) {
            expect(affiliateSection(section)).toBe(section);
            expect(affiliateHref(section)).toBe(destinations[index][1]);
            expect(affiliateHref(section, true)).toBe(section === "home" ? "/admin/preview/affiliate" : `/admin/preview/affiliate?section=${section}`);
        }
        for (const invalid of [undefined, null, "", "../wallet", "sales&creatorId=other", "ADMIN", {}, ["sales"]]) {
            expect(affiliateSection(invalid)).toBe("home");
        }
    });

    it("renders all six affiliate destinations without creator capture, CRM, or training links", () => {
        const html = renderToStaticMarkup(createElement(AffiliateShellView, { account }, "affiliate-section"));
        const nav = sidebarHtml(html);
        for (const [label, href] of destinations) {
            expect(nav).toContain(`href="${href}"`);
            expect(nav).toContain(label);
        }
        expect(new Set(linksIn(nav)).size).toBe(6);
        expect(linksIn(html).every((href) => href.startsWith("/affiliates/dashboard"))).toBe(true);
        for (const forbidden of ["/submit", "/submissions", "/leads", "/training", "/certification-quiz", "/wallet", "/referrals"]) {
            expect(linksIn(html)).not.toContain(forbidden);
        }
        expect(html).not.toContain("New submission");
        expect(useUser).not.toHaveBeenCalled();
        expect(useConvexAuth).not.toHaveBeenCalled();
        expect(useQuery).not.toHaveBeenCalled();
    });

    it("keeps all four phone tabs within the affiliate portal and Account reachable from navigation", () => {
        const html = renderToStaticMarkup(createElement(AffiliateShellView, { account }));
        const tabs = mobileTabsHtml(html);
        const hrefs = linksIn(tabs);
        expect(hrefs).toHaveLength(4);
        expect(new Set(hrefs).size).toBe(hrefs.length);
        expect(hrefs).toContain("/affiliates/dashboard");
        expect(hrefs).toContain("/affiliates/dashboard/wallet");
        expect(hrefs).toContain("/affiliates/dashboard/sales");
        expect(hrefs).toContain("/affiliates/dashboard/referrals");
        expect(sidebarHtml(html)).toContain('href="/affiliates/dashboard/account"');
        expect(html).toContain('aria-label="Open navigation"');
        expect(hrefs.every((href) => destinations.some(([, destination]) => destination === href))).toBe(true);
        expect(tabs).not.toContain("t-tabbar-new");
    });

    it.each(destinations.filter(([label]) => label !== "My page"))("marks only %s current, including after client navigation", (_label, pathname) => {
        state.pathname = pathname;
        const html = renderToStaticMarkup(createElement(AffiliateShellView, { account }));
        const nav = sidebarHtml(html);
        const current = currentSidebarLinks(nav);
        expect(current).toHaveLength(1);
        expect(current[0]).toContain(`href="${pathname}"`);
        const mobileCurrent = mobileTabsHtml(html).match(/<a\b[^>]*aria-current="page"[^>]*>[\s\S]*?<\/a>/g) ?? [];
        expect(mobileCurrent).toHaveLength([destinations[0][1], destinations[2][1], destinations[3][1], destinations[4][1]].some((href) => href === pathname) ? 1 : 0);
        if (mobileCurrent.length) expect(mobileCurrent[0]).toContain(`href="${pathname}"`);
    });

    it.each(AFFILIATE_SECTIONS.filter(section => section !== "my-page"))("keeps preview destinations protected and marks %s current despite the shared pathname", (section) => {
        state.pathname = "/admin/preview/affiliate";
        const html = renderToStaticMarkup(createElement(AffiliateShellView, { account, preview: true, section }));
        const nav = sidebarHtml(html);
        const hrefs = linksIn(nav);
        expect(new Set(hrefs).size).toBe(6);
        expect(linksIn(html).every((href) => AFFILIATE_SECTIONS.some((key) => affiliateHref(key, true) === href))).toBe(true);
        const current = currentSidebarLinks(nav);
        expect(current).toHaveLength(1);
        expect(current[0]).toContain(`href="${affiliateHref(section, true)}"`);
        const mobileCurrent = mobileTabsHtml(html).match(/<a\b[^>]*aria-current="page"[^>]*>[\s\S]*?<\/a>/g) ?? [];
        expect(mobileCurrent).toHaveLength(["home", "sales", "wallet", "referrals"].includes(section) ? 1 : 0);
        if (mobileCurrent.length) expect(mobileCurrent[0]).toContain(`href="${affiliateHref(section, true)}"`);
        expect(useQuery).not.toHaveBeenCalled();
        expect(useUser).not.toHaveBeenCalled();
    });

    it.each([
        "/v2/creators/portal/my-page", "/v2/creators/portal/my-page/",
        "/affiliates/dashboard/my-page", "/affiliates/dashboard/my-page/",
    ])("uses the same creator portal frame for the exact live route %s", (pathname) => {
        state.pathname = pathname;
        const html = renderToStaticMarkup(createElement(AffiliateShellView, { account }, "page-editor-content"));
        const nav = creatorPortalNavHtml(html);
        expect(linksIn(nav)).toEqual([
            "/v2/creators/portal#top", "/v2/creators/portal#pt-links", "/v2/creators/portal#pt-agents",
            "/v2/creators/portal#pt-shops", "/v2/creators/portal/payouts", "/v2/creators/portal/my-page",
        ]);
        const current = nav.match(/<a\b[^>]*aria-current="page"[^>]*>[\s\S]*?<\/a>/g) ?? [];
        expect(current).toHaveLength(1);
        expect(current[0]).toContain('href="/v2/creators/portal/my-page"');
        expect(current[0]).toContain("My page");
        const main = pageMainHtml(html);
        expect(main).toContain("page-editor-content");
        expect(main).toContain("Creator rules");
        expect(main).toContain("Paid on real sales only.");
        expect(html).not.toContain("Back to portal");
        expect(html).toMatch(/<main\b[^>]*class="[^"]*\bwrap\b[^"]*\bpt-main\b[^"]*"[^>]*id="top"/);
        expect(html).toContain('class="v2 test-v2-fonts cr ag cp cp-solo pt"');
        expect(html).not.toContain('aria-label="Main navigation"');
        expect(html).not.toContain("t-tabbar");
        expect(useUser).not.toHaveBeenCalled();
        expect(useConvexAuth).not.toHaveBeenCalled();
        expect(useQuery).not.toHaveBeenCalled();
    });

    it.each([
        "/affiliates/dashboard", "/affiliates/dashboard/my-page/extra", "/affiliates/dashboard/my-page-other",
        "/v2/creators/portal/my-page/extra", "/v2/creators/portal/my-page-other",
    ])("keeps the existing shell for a non-editor route %s", (pathname) => {
        state.pathname = pathname;
        const html = renderToStaticMarkup(createElement(AffiliateShellView, { account, section: "my-page" }));
        expect(sidebarHtml(html)).toContain('href="/affiliates/dashboard/my-page"');
        expect(mobileTabsHtml(html)).toBeDefined();
        expect(html).not.toContain('aria-label="Creator portal"');
    });

    it.each(["/admin/preview/affiliate", "/affiliates/dashboard/my-page", "/v2/creators/portal/my-page"])("keeps the My page preview inside protected preview destinations at %s", (pathname) => {
        state.pathname = pathname;
        const html = renderToStaticMarkup(createElement(AffiliateShellView, { account, preview: true, section: "my-page" }, "sample-editor-content"));
        const nav = creatorPortalNavHtml(html);
        expect(linksIn(nav)).toEqual([
            "/admin/preview/affiliate?section=my-page",
            "/admin/preview/affiliate", "/admin/preview/affiliate", "/admin/preview/affiliate?section=referrals",
            "/admin/preview/affiliate?section=sales", "/admin/preview/affiliate?section=wallet",
        ]);
        const current = nav.match(/<a\b[^>]*aria-current="page"[^>]*>[\s\S]*?<\/a>/g) ?? [];
        expect(current).toHaveLength(1);
        expect(current[0]).toContain('href="/admin/preview/affiliate?section=my-page"');
        expect(linksIn(html).every(href => AFFILIATE_SECTIONS.some(section => affiliateHref(section, true) === href))).toBe(true);
        const main = pageMainHtml(html);
        expect(main).toContain('href="/admin/preview/affiliate"');
        expect(main).toContain("Back to portal");
        expect(main).toContain("sample-editor-content");
        expect(html).not.toContain('aria-label="Main navigation"');
        expect(useQuery).not.toHaveBeenCalled();
        expect(useUser).not.toHaveBeenCalled();
    });

    it("uses the selected preview section instead of the live pathname to choose the frame", () => {
        state.pathname = "/affiliates/dashboard/my-page";
        const html = renderToStaticMarkup(createElement(AffiliateShellView, { account, preview: true, section: "wallet" }));
        expect(currentSidebarLinks(sidebarHtml(html))[0]).toContain('href="/admin/preview/affiliate?section=wallet"');
        expect(html).not.toContain('aria-label="Creator portal"');
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
        expect(creatorPortalNavHtml(html)).toContain('href="/v2/creators/portal/my-page"');
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
        expect(currentSidebarLinks(sidebarHtml(html))[0]).toContain('href="/affiliates/dashboard/wallet"');
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
        ["/v2/creators/portal/my-page", "/v2/creators/signup?login=1"],
        ["/v2/creators/portal/my-page/", "/v2/creators/signup?login=1"],
        ["/v2/creators/portal/account", "/v2/creators/signup?login=1"],
        ["/v2/creators/portal/payouts", "/v2/creators/signup?login=1"],
        ["/affiliates/dashboard/my-page", "/affiliates/join"],
        ["/affiliates/dashboard/wallet", "/affiliates/join"],
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
        ["/v2/creators/portal/my-page", "/v2/creators/signup"],
        ["/v2/creators/portal/my-page/", "/v2/creators/signup"],
        ["/v2/creators/portal/account", "/v2/creators/signup"],
        ["/v2/creators/portal/payouts", "/v2/creators/signup"],
        ["/affiliates/dashboard/my-page", "/affiliates/join"],
        ["/affiliates/dashboard/wallet", "/affiliates/join"],
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
