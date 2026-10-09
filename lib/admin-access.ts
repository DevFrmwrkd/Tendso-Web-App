import { creatorRedirect, type CreatorGateInput } from "./creatorGate";

// Set by proxy.ts from the actual request, overwriting any caller header.
export const ADMIN_PATH_HEADER = "x-tendso-admin-path";
export const STAFF_ADMIN_PATHS = new Set(["/admin", "/admin/bookings", "/admin/call-stats"]);

export interface AdminAccount extends CreatorGateInput {
    status?: string;
    isDeleted?: boolean;
}

export interface AdminSession {
    clerkId: string;
    creator: AdminAccount | null;
    isOwner: boolean;
}

export function isActiveTeamAccount(account: AdminAccount | null | undefined): boolean {
    return !!account
        && (account.role === "admin" || account.role === "staff")
        && !account.isDeleted
        && account.status !== "deleted"
        && account.status !== "suspended";
}

function accountHome(session: AdminSession): string {
    const account = session.creator;
    if (!account) return session.isOwner ? "/my-business" : "/onboarding";
    // Account is shared by every role and does not send staff back to /admin.
    if (account.role === "admin" || account.role === "staff") return "/profile";
    if (account.isDeleted || account.status === "deleted") return "/onboarding";
    if (account.role === "affiliate") return "/affiliates/dashboard";
    if (account.role && account.role !== "creator") return "/profile";
    return creatorRedirect(account) ?? "/dashboard";
}

export function adminAccessFor(session: AdminSession, pathname: string): { allowed: boolean; redirectTo: string | null } {
    const path = pathname.replace(/\/+$/, "") || "/";
    const isAdminPath = path === "/admin" || path.startsWith("/admin/");
    if (isAdminPath && isActiveTeamAccount(session.creator)) {
        if (session.creator?.role === "admin" || STAFF_ADMIN_PATHS.has(path)) {
            return { allowed: true, redirectTo: null };
        }
        return { allowed: false, redirectTo: "/admin" };
    }
    return { allowed: false, redirectTo: accountHome(session) };
}

export function adminLoginPath(pathname: string): string {
    return `/login?redirect_url=${encodeURIComponent(pathname)}`;
}

/** Never use a cached role until both auth providers agree on the session. */
export function adminClientAccess(input: {
    clerkLoaded: boolean;
    userId: string | null;
    convexLoading: boolean;
    convexAuthenticated: boolean;
    session: AdminSession | null | undefined;
    pathname: string;
    allowAccountPage?: boolean;
}): { loading: boolean; allowed: boolean; redirectTo: string | null } {
    const { clerkLoaded, userId, convexLoading, convexAuthenticated, session, pathname } = input;
    if (!clerkLoaded || (userId && convexLoading)) {
        return { loading: true, allowed: false, redirectTo: null };
    }
    if (!userId || !convexAuthenticated) {
        return { loading: false, allowed: false, redirectTo: adminLoginPath(pathname) };
    }
    if (session === undefined || (session && session.clerkId !== userId)) {
        return { loading: true, allowed: false, redirectTo: null };
    }
    if (!session) {
        return { loading: false, allowed: false, redirectTo: adminLoginPath(pathname) };
    }
    // AdminLayout also frames the personal Account page. Disabled team
    // members may reach that page to sign out, without admin privileges.
    if (input.allowAccountPage && pathname === "/profile"
        && (session.creator?.role === "admin" || session.creator?.role === "staff")) {
        return { loading: false, allowed: true, redirectTo: null };
    }
    return { loading: false, ...adminAccessFor(session, pathname) };
}
