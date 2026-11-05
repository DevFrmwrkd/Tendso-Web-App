import { loginReturnPath } from "@/app/auth/_components/loginReturnPath";
import { adminAccessFor, isActiveTeamAccount } from "./admin-access";
import { creatorRedirect, type CreatorGateInput } from "./creatorGate";

export interface SignInAccount extends CreatorGateInput {
    clerkId: string;
    status?: string;
    isDeleted?: boolean;
}
export interface SignInSession {
    clerkId: string;
    creator: SignInAccount | null;
    isOwner: boolean;
}
export type SignInResolution =
    | { status: "loading" }
    | { status: "signed_out" }
    | { status: "blocked"; message: string }
    | { status: "ready"; href: string };

/** No cached role or caller-supplied destination can select another account's workspace. */
export function signInDestination(input: {
    clerkLoaded: boolean;
    userId: string | null;
    convexLoading: boolean;
    convexAuthenticated: boolean;
    session: SignInSession | null | undefined;
    returnTo?: string;
}): SignInResolution {
    if (!input.clerkLoaded) return { status: "loading" };
    if (!input.userId) return { status: "signed_out" };
    if (input.convexLoading || !input.convexAuthenticated || input.session === undefined) return { status: "loading" };
    const session = input.session;
    if (!session) return { status: "blocked", message: "We couldn’t verify your account. Please sign out and try again." };
    if (session.clerkId !== input.userId || session.creator && session.creator.clerkId !== input.userId) return { status: "loading" };
    const account = session.creator;
    const requested = loginReturnPath(input.returnTo);
    if (account?.isDeleted || account?.status === "deleted") return { status: "blocked", message: "This account is no longer available. Contact Tendso if you need help." };

    if (account?.role === "admin" || account?.role === "staff") {
        if (!isActiveTeamAccount(account)) return { status: "blocked", message: "Access to this account is paused. Contact the Tendso team for help." };
        if (requested === "/knowledge?ws=wiki" || requested === "/profile") return { status: "ready", href: requested };
        const permitted = requested.startsWith("/admin") && adminAccessFor(session, requested).allowed;
        return { status: "ready", href: permitted ? requested : "/admin" };
    }
    if (account?.role === "affiliate") {
        if (!["active", "pending", "suspended"].includes(account.status ?? "")) return { status: "blocked", message: "This creator account is unavailable. Contact Tendso for help." };
        // Suspended creators retain their existing read-only sales/earnings access.
        const canOpenSection = account.status !== "pending" && requested.startsWith("/affiliates/dashboard");
        return { status: "ready", href: canOpenSection ? requested : "/affiliates/dashboard" };
    }
    if (account) {
        if (account.role && account.role !== "creator") return { status: "blocked", message: "This account does not have a Tendso workspace. Contact our team for help." };
        if (account.status === "suspended") return { status: "blocked", message: "Access to this account is paused. Contact the Tendso team for help." };
        const lifecycle = creatorRedirect(account);
        if (lifecycle) return { status: "ready", href: lifecycle };
        if (requested === "/knowledge?ws=wiki" || requested === "/profile") return { status: "ready", href: requested };
        return { status: "ready", href: "/dashboard" };
    }
    if (session.isOwner) {
        const ownerDestination = /^\/my-business(?:\/|$)|^\/pay\//.test(requested);
        return { status: "ready", href: ownerDestination ? requested : "/my-business/today" };
    }
    return { status: "ready", href: "/onboarding" };
}
