import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ADMIN_PATH_HEADER, type AdminSession } from "../../lib/admin-access";

const state = vi.hoisted(() => ({
    user: { id: "current-user", fullName: "Team Member" } as { id: string; fullName: string } | null,
    clerkLoaded: true,
    convex: { isLoading: false, isAuthenticated: true },
    session: undefined as AdminSession | null | undefined,
    pathname: "/admin",
    queries: [] as { name: string; args: unknown }[],
    replace: vi.fn(),
    serverAuth: vi.fn(),
    getToken: vi.fn(),
    fetchQuery: vi.fn(),
}));

vi.mock("@clerk/nextjs", () => ({ useUser: () => ({ user: state.user, isLoaded: state.clerkLoaded }) }));
vi.mock("@clerk/nextjs/server", () => ({
    auth: state.serverAuth,
    clerkMiddleware: (handler: unknown) => handler,
    createRouteMatcher: () => () => false,
}));
vi.mock("convex/nextjs", () => ({ fetchQuery: state.fetchQuery }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ [ADMIN_PATH_HEADER]: state.pathname }) }));
vi.mock("next/navigation", () => ({
    usePathname: () => state.pathname,
    useRouter: () => ({ replace: state.replace }),
    redirect: (path: string) => { throw new Error(`redirect:${path}`); },
}));
vi.mock("convex/react", () => ({
    useConvexAuth: () => state.convex,
    useQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
        const name = getFunctionName(reference);
        state.queries.push({ name, args });
        if (args === "skip") return undefined;
        return name === "adminAccess:me" ? state.session : [];
    },
}));
vi.mock("@/components/r1", () => ({
    AppShell: ({ children, sidebar }: { children: ReactNode; sidebar: { roleLabel: string; items: ({ label: string } | string)[] } }) => createElement("main", { "data-admin-shell": sidebar.roleLabel },
        createElement("nav", {}, sidebar.items.filter((item) => typeof item !== "string").map((item, index) => createElement("span", { key: index }, typeof item === "string" ? item : item.label))), children),
}));

import AdminLayout, { AdminAccessGate } from "../../app/admin/components/AdminLayout";
import AdminRouteLayout from "../../app/admin/layout";
import proxy from "../../proxy";

let mounted = 0;
function ProtectedPage() {
    mounted++;
    return createElement("p", {}, "private-admin-record");
}

function renderGate() {
    return renderToStaticMarkup(createElement(AdminAccessGate, null, createElement(AdminLayout, null, createElement(ProtectedPage))));
}

beforeEach(() => {
    vi.clearAllMocks();
    state.user = { id: "current-user", fullName: "Team Member" };
    state.clerkLoaded = true;
    state.convex = { isLoading: false, isAuthenticated: true };
    state.session = { clerkId: "current-user", creator: { role: "admin" }, isOwner: false };
    state.pathname = "/admin";
    state.queries = [];
    state.getToken.mockResolvedValue("verified-convex-token");
    state.serverAuth.mockResolvedValue({ userId: "current-user", getToken: state.getToken });
    state.fetchQuery.mockImplementation(async () => state.session);
    mounted = 0;
});

describe("persistent client admin boundary", () => {
    it.each(["creator", "affiliate", "system"])("never mounts protected children or the sidebar for %s", (role) => {
        state.session!.creator = { role, certifiedAt: 1 };
        expect(renderGate()).toBe("");
        expect(mounted).toBe(0);
        expect(state.queries.every((query) => query.name === "adminAccess:me")).toBe(true);
    });

    it("holds all content during token hydration and does not ask Convex for the role yet", () => {
        state.convex = { isLoading: true, isAuthenticated: false };
        expect(renderGate()).toBe("");
        expect(mounted).toBe(0);
        expect(state.queries).toEqual([{ name: "adminAccess:me", args: "skip" }]);
    });

    it("holds content until the role query resolves and after an account switch", () => {
        state.session = undefined;
        expect(renderGate()).toBe("");
        state.session = { clerkId: "previous-user", creator: { role: "admin" }, isOwner: false };
        expect(renderGate()).toBe("");
        expect(mounted).toBe(0);
    });

    it("shows the full admin frame only after authentication and role verification", () => {
        const html = renderGate();
        expect(html).toContain('data-admin-shell="Admin"');
        expect(html).toContain("private-admin-record");
        expect(html).toContain("Creators");
        expect(mounted).toBe(1);
    });

    it("shows staff only Today and Calls, then blocks forbidden navigation before mounting the destination", () => {
        state.session!.creator = { role: "staff" };
        state.pathname = "/admin/bookings";
        const html = renderGate();
        expect(html).toContain('data-admin-shell="Staff"');
        expect(html).toContain("Today");
        expect(html).toContain("Calls");
        expect(html).not.toContain("Creators");
        expect(state.queries.filter((query) => query.name !== "adminAccess:me").every((query) => query.args === "skip")).toBe(true);
        mounted = 0;
        state.pathname = "/admin/creators";
        expect(renderGate()).toBe("");
        expect(mounted).toBe(0);
    });

    it("hides existing content immediately when a live admin account becomes suspended", () => {
        expect(renderGate()).toContain("private-admin-record");
        state.session!.creator = { role: "admin", status: "suspended" };
        mounted = 0;
        expect(renderGate()).toBe("");
        expect(mounted).toBe(0);
    });

    it("preserves the existing team Account frame without letting disabled staff retain an admin sidebar", () => {
        state.pathname = "/profile";
        state.session!.creator = { role: "staff" };
        expect(renderToStaticMarkup(createElement(AdminLayout, null, createElement(ProtectedPage)))).toContain('data-admin-shell="Staff"');
        state.session!.creator = { role: "staff", status: "suspended" };
        state.queries = [];
        const html = renderToStaticMarkup(createElement(AdminLayout, null, createElement(ProtectedPage)));
        expect(html).toContain("private-admin-record");
        expect(html).not.toContain("data-admin-shell");
        expect(state.queries.filter((query) => query.name !== "adminAccess:me").every((query) => query.args === "skip")).toBe(true);
    });
});

describe("server admin layout", () => {
    it("requires a Clerk session before querying a role or returning children", async () => {
        state.serverAuth.mockResolvedValue({ userId: null, getToken: state.getToken });
        await expect(AdminRouteLayout({ children: createElement(ProtectedPage) })).rejects.toThrow("redirect:/login?redirect_url=%2Fadmin");
        expect(state.getToken).not.toHaveBeenCalled();
        expect(state.fetchQuery).not.toHaveBeenCalled();
        expect(mounted).toBe(0);
    });

    it("fails closed when Clerk cannot supply a Convex token", async () => {
        state.getToken.mockResolvedValue(null);
        await expect(AdminRouteLayout({ children: createElement(ProtectedPage) })).rejects.toThrow("redirect:/login?redirect_url=%2Fadmin");
        expect(state.fetchQuery).not.toHaveBeenCalled();
    });

    it("passes the session token to a parameterless self-role query", async () => {
        const result = await AdminRouteLayout({ children: createElement(ProtectedPage) });
        expect(state.getToken).toHaveBeenCalledWith({ template: "convex" });
        expect(state.fetchQuery).toHaveBeenCalledWith(expect.anything(), {}, { token: "verified-convex-token" });
        expect(result.type).toBe(AdminAccessGate);
    });

    it.each([
        [{ role: "creator", certifiedAt: 1 }, "/dashboard"],
        [{ role: "affiliate" }, "/affiliates/dashboard"],
        [{ role: "admin", status: "suspended" }, "/profile"],
        [{ role: "staff", isDeleted: true }, "/profile"],
    ] as const)("redirects a forbidden account before returning an admin component", async (account, destination) => {
        state.session!.creator = account;
        await expect(AdminRouteLayout({ children: createElement(ProtectedPage) })).rejects.toThrow(`redirect:${destination}`);
        expect(mounted).toBe(0);
    });

    it("rejects a token result for a different Clerk subject", async () => {
        state.session!.clerkId = "other-user";
        await expect(AdminRouteLayout({ children: createElement(ProtectedPage) })).rejects.toThrow("redirect:/login?redirect_url=%2Fadmin");
    });

    it("uses the requested pathname to reject staff direct visits while preserving the call-stats redirect", async () => {
        state.session!.creator = { role: "staff" };
        state.pathname = "/admin/creators";
        await expect(AdminRouteLayout({ children: createElement(ProtectedPage) })).rejects.toThrow("redirect:/admin");
        state.pathname = "/admin/call-stats";
        await expect(AdminRouteLayout({ children: createElement(ProtectedPage) })).resolves.toHaveProperty("type", AdminAccessGate);
    });
});

describe("admin request pathname", () => {
    it("overwrites a caller-supplied staff-safe pathname with the actual admin URL", async () => {
        const runProxy = proxy as unknown as (auth: () => Promise<{ userId: string }>, req: NextRequest) => Promise<Response>;
        const response = await runProxy(async () => ({ userId: "current-user" }), new NextRequest("https://tendso.com/admin/creators", { headers: { [ADMIN_PATH_HEADER]: "/admin" } }));
        expect(response.headers.get(`x-middleware-request-${ADMIN_PATH_HEADER}`)).toBe("/admin/creators");
    });
});
