import { useClerk, useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { createElement } from "react";
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
    return [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1].replaceAll("&amp;", "&"));
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

let mounted = 0;
function ProtectedAffiliateContent() {
    mounted++;
    const current = useAffiliateAccount();
    return createElement("p", {}, `protected-affiliate-content:${current.clerkId}`);
}
function renderBoundary(): string {
    return renderToStaticMarkup(createElement(AffiliateDashboardBoundary, null, createElement(ProtectedAffiliateContent)));
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

    it.each(destinations)("marks only %s current, including after client navigation", (_label, pathname) => {
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

    it.each(AFFILIATE_SECTIONS)("keeps preview destinations protected and marks %s current despite the shared pathname", (section) => {
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
