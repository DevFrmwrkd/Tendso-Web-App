import { convexTest } from "convex-test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { adminAccessFor, adminClientAccess, type AdminSession } from "../../lib/admin-access";

const modules = {
    "./_generated/server.js": () => import("../../convex/_generated/server"),
    "./adminAccess.ts": () => import("../../convex/adminAccess"),
};

const session = (role?: string, extra: Partial<NonNullable<AdminSession["creator"]>> = {}): AdminSession => ({
    clerkId: "current-user",
    creator: { role, ...extra },
    isOwner: false,
});

describe("admin route policy", () => {
    const adminPaths = ["/admin", "/admin/", "/admin/bookings", "/admin/call-stats", "/admin/creators", "/admin/affiliates", "/admin/submissions/123", "/admin/payouts", "/admin/knowledge", "/admin/audit"];

    it.each(adminPaths)("allows an active admin to open %s", (pathname) => {
        expect(adminAccessFor(session("admin"), pathname)).toEqual({ allowed: true, redirectTo: null });
    });

    it.each(["/admin", "/admin/", "/admin/bookings", "/admin/bookings/", "/admin/call-stats"])("allows staff to open their screen %s", (pathname) => {
        expect(adminAccessFor(session("staff"), pathname)).toEqual({ allowed: true, redirectTo: null });
    });

    it.each(["/admin/creators", "/admin/affiliates", "/admin/submissions/123", "/admin/payouts", "/admin/bookings/export", "/admin/call-stats/export"])("rejects a staff direct visit or client navigation to %s", (pathname) => {
        expect(adminAccessFor(session("staff"), pathname)).toEqual({ allowed: false, redirectTo: "/admin" });
    });

    it.each([
        [session("creator", { certifiedAt: 1 }), "/dashboard"],
        [session(undefined, { certifiedAt: 1 }), "/dashboard"],
        [session("creator"), "/training"],
        [session("creator", { quizPassedAt: 1 }), "/pending"],
        [session("creator", { rejectedAt: 1 }), "/verification-rejected"],
        [session("affiliate", { certifiedAt: 1 }), "/affiliates/dashboard"],
        [session("system"), "/profile"],
        [{ clerkId: "owner", creator: null, isOwner: true }, "/my-business"],
        [{ clerkId: "new", creator: null, isOwner: false }, "/onboarding"],
    ] as const)("redirects each nonteam account to its existing destination", (account, destination) => {
        expect(existsSync(resolve(process.cwd(), `app${destination}/page.tsx`))).toBe(true);
        for (const pathname of adminPaths) {
            expect(adminAccessFor(account, pathname)).toEqual({ allowed: false, redirectTo: destination });
        }
    });

    it.each(["admin", "staff"])("rejects suspended and deleted %s accounts regardless of path", (role) => {
        for (const inactive of [{ status: "suspended" }, { status: "deleted" }, { isDeleted: true }]) {
            for (const pathname of adminPaths) {
                expect(adminAccessFor(session(role, inactive), pathname)).toEqual({ allowed: false, redirectTo: "/profile" });
            }
        }
    });
});

describe("client authentication and live navigation", () => {
    const ready = {
        clerkLoaded: true,
        userId: "current-user",
        convexLoading: false,
        convexAuthenticated: true,
        session: session("admin"),
        pathname: "/admin",
    };

    it.each([
        { clerkLoaded: false },
        { convexLoading: true },
        { session: undefined },
        { session: { ...session("admin"), clerkId: "previous-user" } },
    ])("never allows cached admin data to render while auth or account lookup is unresolved: %j", (patch) => {
        expect(adminClientAccess({ ...ready, ...patch })).toEqual({ loading: true, allowed: false, redirectTo: null });
    });

    it.each([{ userId: null }, { convexAuthenticated: false }, { session: null }])("fails closed when a session disappears: %j", (patch) => {
        expect(adminClientAccess({ ...ready, ...patch })).toEqual({ loading: false, allowed: false, redirectTo: "/login?redirect_url=%2Fadmin" });
    });

    it("removes access synchronously when staff navigate away from Calls or an admin is suspended", () => {
        const staff = { ...ready, session: session("staff"), pathname: "/admin/bookings" };
        expect(adminClientAccess(staff).allowed).toBe(true);
        expect(adminClientAccess({ ...staff, pathname: "/admin/submissions" })).toEqual({ loading: false, allowed: false, redirectTo: "/admin" });
        expect(adminClientAccess({ ...ready, session: session("admin", { status: "suspended" }) })).toEqual({ loading: false, allowed: false, redirectTo: "/profile" });
    });

    it("keeps the personal Account page reachable without expanding actual admin access", () => {
        for (const role of ["admin", "staff"]) {
            const disabled = { ...ready, session: session(role, { status: "suspended" }), pathname: "/profile", allowAccountPage: true };
            expect(adminClientAccess(disabled)).toEqual({ loading: false, allowed: true, redirectTo: null });
            expect(adminClientAccess({ ...disabled, pathname: "/admin" }).allowed).toBe(false);
            expect(adminClientAccess({ ...disabled, session: session("creator", { certifiedAt: 1 }) }).allowed).toBe(false);
        }
    });
});

describe("session-owned role lookup", () => {
    async function setup() {
        const t = convexTest(schema, modules);
        await t.run(async (ctx) => {
            await ctx.db.insert("creators", { clerkId: "admin", email: "admin@example.test", role: "admin" });
            await ctx.db.insert("creators", { clerkId: "creator", email: "creator@example.test", role: "creator" });
            await ctx.db.insert("creators", { clerkId: "disabled", email: "disabled@example.test", role: "staff", status: "suspended" });
            await ctx.db.insert("businessOwners", { clerkId: "owner", email: "owner@example.test", createdAt: 1 });
        });
        return t;
    }

    it("returns no account without a verified Convex identity", async () => {
        const t = await setup();
        expect(await t.query(api.adminAccess.me, {})).toBeNull();
    });

    it("resolves only the authenticated subject and refuses caller-supplied account selectors", async () => {
        const t = await setup();
        const creator = t.withIdentity({ subject: "creator" });
        const me = await creator.query(api.adminAccess.me, {});
        expect(me?.clerkId).toBe("creator");
        expect(me?.creator?.role).toBe("creator");
        await expect(creator.query(api.adminAccess.me, { clerkId: "admin" } as never)).rejects.toThrow();
        const admin = await t.withIdentity({ subject: "admin" }).query(api.adminAccess.me, {});
        expect(admin?.creator?.role).toBe("admin");
    });

    it("distinguishes owners from new logins and preserves inactive self state for a safe redirect", async () => {
        const t = await setup();
        expect(await t.withIdentity({ subject: "owner" }).query(api.adminAccess.me, {})).toEqual({ clerkId: "owner", creator: null, isOwner: true });
        expect(await t.withIdentity({ subject: "new" }).query(api.adminAccess.me, {})).toEqual({ clerkId: "new", creator: null, isOwner: false });
        const disabled = await t.withIdentity({ subject: "disabled" }).query(api.adminAccess.me, {});
        expect(disabled?.creator?.status).toBe("suspended");
        expect(adminAccessFor(disabled!, "/admin").allowed).toBe(false);
    });
});
