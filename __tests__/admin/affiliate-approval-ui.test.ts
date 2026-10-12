import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc } from "../../convex/_generated/dataModel";

const state = vi.hoisted(() => ({
    user: { id: "admin-user" } as { id: string } | null,
    convex: { isAuthenticated: true, isLoading: false },
    session: { clerkId: "admin-user", creator: { role: "admin", status: "active" }, isOwner: false } as {
        clerkId: string; creator: { role?: string; status?: string; isDeleted?: boolean } | null; isOwner: boolean;
    } | null | undefined,
    affiliates: [] as Doc<"creators">[] | undefined,
    queries: [] as { name: string; args: unknown }[],
    mutations: [] as string[],
    actions: new Map<string, () => Promise<void>>(),
    updateStatus: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    replace: vi.fn(),
}));

vi.mock("@clerk/nextjs", () => ({ useUser: () => ({ user: state.user, isLoaded: true }) }));
vi.mock("next/navigation", () => ({
    usePathname: () => "/admin/affiliates",
    useRouter: () => ({ replace: state.replace }),
}));
vi.mock("convex/react", () => ({
    useConvexAuth: () => state.convex,
    useQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
        const name = getFunctionName(reference);
        state.queries.push({ name, args });
        if (args === "skip") return undefined;
        return name === "adminAccess:me" ? state.session : state.affiliates;
    },
    useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
        state.mutations.push(getFunctionName(reference));
        return state.updateStatus;
    },
}));
vi.mock("sonner", () => ({ toast: { success: state.success, error: state.error } }));
vi.mock("../../app/admin/components/AdminLayout", () => ({ default: ({ children }: { children: ReactNode }) => createElement("main", {}, children) }));
vi.mock("@/components/r1", () => ({
    Button: ({ children, onClick, ...props }: { children: ReactNode; onClick: () => Promise<void>; "aria-label": string; disabled?: boolean }) => {
        state.actions.set(props["aria-label"], onClick);
        return createElement("button", { "aria-label": props["aria-label"], disabled: props.disabled }, children);
    },
    EmptyState: ({ title }: { title: string }) => createElement("p", {}, title),
    Loading: ({ label, children }: { label: string; children?: ReactNode }) => createElement("div", { "aria-label": label }, children),
    PageHeader: ({ title, sub }: { title: string; sub: string }) => createElement("header", {}, createElement("h1", {}, title), createElement("p", {}, sub)),
    SkeletonRows: () => null,
    Status: ({ word }: { word: string }) => createElement("span", {}, word),
}));

import AdminAffiliatesPage from "../../app/admin/affiliates/page";

function affiliate(id: string, name: string, status: string): Doc<"creators"> {
    return { _id: id as Doc<"creators">["_id"], _creationTime: 1, clerkId: `clerk-${id}`, email: `${id}@example.com`, firstName: name, role: "affiliate", status, affiliateHandle: id };
}
const pending = affiliate("pending-affiliate", "Pending Person", "pending");
const active = affiliate("active-affiliate", "Active Person", "active");
const suspended = affiliate("suspended-affiliate", "Suspended Person", "suspended");
const renderPage = () => renderToStaticMarkup(createElement(AdminAffiliatesPage));

beforeEach(() => {
    vi.clearAllMocks();
    state.user = { id: "admin-user" };
    state.convex = { isAuthenticated: true, isLoading: false };
    state.session = { clerkId: "admin-user", creator: { role: "admin", status: "active" }, isOwner: false };
    state.affiliates = [active, suspended, pending];
    state.queries = []; state.mutations = []; state.actions.clear();
    state.updateStatus.mockResolvedValue(undefined);
});

describe("affiliate approval administration", () => {
    it("puts pending signups first without changing the server list and labels each lifecycle accurately", () => {
        const html = renderPage();
        expect(html.indexOf("Pending Person")).toBeLessThan(html.indexOf("Active Person"));
        expect(state.affiliates).toEqual([active, suspended, pending]);
        const row = html.match(/<li\b[^>]*>[\s\S]*?<\/li>/)?.[0];
        expect(row).toContain("Pending approval");
        expect(row).toContain("Approve Pending Person");
        expect(row).not.toContain("Suspend");
        expect(row).not.toContain(">Active<");
        expect([...state.actions.keys()]).toEqual(["Approve Pending Person", "Suspend Active Person", "Reactivate Suspended Person"]);
    });

    it("approves only the chosen pending affiliate using the existing admin status mutation", async () => {
        renderPage();
        await state.actions.get("Approve Pending Person")!();
        expect(state.updateStatus).toHaveBeenCalledExactlyOnceWith({ id: pending._id, status: "active" });
        expect(state.success).toHaveBeenCalledWith("Pending Person approved.");
        expect(state.error).not.toHaveBeenCalled();
        expect(state.mutations.every((name) => name === "creators:updateStatus")).toBe(true);
    });

    it("retains suspension and reactivation without treating either as signup approval", async () => {
        renderPage();
        await state.actions.get("Suspend Active Person")!();
        await state.actions.get("Reactivate Suspended Person")!();
        expect(state.updateStatus.mock.calls).toEqual([[{ id: active._id, status: "suspended" }], [{ id: suspended._id, status: "active" }]]);
        expect(state.success.mock.calls).toEqual([["Active Person suspended."], ["Suspended Person reactivated."]]);
    });

    it("reports an approval failure and allows retry", async () => {
        state.updateStatus.mockRejectedValueOnce(new Error("Approval failed"));
        renderPage();
        await state.actions.get("Approve Pending Person")!();
        expect(state.error).toHaveBeenCalledWith("Approval failed");
        expect(state.success).not.toHaveBeenCalled();
        renderPage();
        await state.actions.get("Approve Pending Person")!();
        expect(state.success).toHaveBeenCalledWith("Pending Person approved.");
    });

    it("keeps unknown or deleted statuses unavailable rather than labeling them active", () => {
        state.affiliates = [affiliate("deleted", "Deleted Person", "deleted"), affiliate("unknown", "Unknown Person", "other")];
        const html = renderPage();
        expect(html.match(/Unavailable/g)).toHaveLength(2);
        expect(state.actions.size).toBe(0);
    });

    it.each(["creator", "affiliate", "staff", undefined])("does not query the list or expose actions for role %s", (role) => {
        state.session!.creator = { role, status: "active" };
        const html = renderPage();
        expect(html).not.toContain("Pending Person");
        expect(state.queries.find((query) => query.name === "affiliates:list")?.args).toBe("skip");
        expect(state.mutations).toEqual([]);
        expect(state.actions.size).toBe(0);
    });

    it.each(["suspended", "deleted"])("does not expose approval actions for a %s admin", (status) => {
        state.session!.creator = { role: "admin", status };
        renderPage();
        expect(state.queries.find((query) => query.name === "affiliates:list")?.args).toBe("skip");
        expect(state.actions.size).toBe(0);
    });

    it("waits for matching Clerk and Convex identities before reading pending signups", () => {
        state.session!.clerkId = "previous-admin";
        renderPage();
        expect(state.queries.find((query) => query.name === "affiliates:list")?.args).toBe("skip");
        expect(state.actions.size).toBe(0);
    });
});
