import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc } from "../../convex/_generated/dataModel";

const state = vi.hoisted(() => ({ account: null as Doc<"creators"> | null, aiKeyMounts: 0 }));

vi.mock("@clerk/nextjs", () => ({
    useUser: () => ({
        isLoaded: true, isSignedIn: true,
        user: { id: "team", fullName: "Team Member", externalAccounts: [], passwordEnabled: true, primaryEmailAddress: { emailAddress: "team@example.test" } },
    }),
    SignOutButton: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    usePathname: () => "/profile",
    useSearchParams: () => new URLSearchParams(),
}));
vi.mock("convex/react", () => ({
    useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
    useQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
        if (args === "skip") return undefined;
        const name = getFunctionName(reference);
        if (name === "creators:getByClerkId") return state.account;
        if (name === "adminAccess:me") return { clerkId: "team", creator: state.account, isOwner: false };
        return [];
    },
}));
vi.mock("@/app/profile/_components/AiKeyCard", () => ({
    AiKeyCard: () => {
        state.aiKeyMounts++;
        if (state.account?.isDeleted || state.account?.status === "deleted" || state.account?.status === "suspended") {
            throw new Error("Forbidden: creator access required for contributing an AI key");
        }
        return createElement("section", { "data-ai-key": true }, "AI key");
    },
}));
vi.mock("@/app/profile/_components/EditProfileDrawer", () => ({ EditProfileDrawer: () => null }));
vi.mock("@/app/profile/_components/PasswordDrawer", () => ({ PasswordDrawer: () => null }));
vi.mock("@/app/profile/_components/PayoutDrawer", () => ({ PayoutDrawer: () => null }));

import AccountView from "../../app/profile/_components/AccountView";

beforeEach(() => {
    state.aiKeyMounts = 0;
    state.account = {
        _id: "team" as Doc<"creators">["_id"], _creationTime: 1,
        clerkId: "team", email: "team@example.test", firstName: "Team", lastName: "Member", role: "staff",
    };
});

describe("personal Account after admin access is revoked", () => {
    it("preserves the ordinary creator's existing AI key card", () => {
        Object.assign(state.account!, { role: "creator", certifiedAt: 1 });
        expect(renderToStaticMarkup(createElement(AccountView))).toContain("data-ai-key");
        expect(state.aiKeyMounts).toBe(1);
    });

    it.each(["admin", "staff"])("retains the AI key card for active %s", (role) => {
        state.account!.role = role;
        const html = renderToStaticMarkup(createElement(AccountView));
        expect(html).toContain("data-ai-key");
        expect(html).toContain("Sign out");
        expect(state.aiKeyMounts).toBe(1);
    });

    it.each(["admin", "staff"])("keeps sign out, profile and security usable for inactive %s without a forbidden AI query", (role) => {
        for (const inactive of [{ status: "suspended" }, { status: "deleted" }, { isDeleted: true }]) {
            Object.assign(state.account!, { role, status: undefined, isDeleted: undefined }, inactive);
            const html = renderToStaticMarkup(createElement(AccountView));
            expect(html).toContain("Sign out");
            expect(html).toContain("Security");
            expect(html).toContain("Team Member");
            expect(html).not.toContain("data-ai-key");
            expect(html).not.toContain("Today");
            expect(state.aiKeyMounts).toBe(0);
        }
    });
});
