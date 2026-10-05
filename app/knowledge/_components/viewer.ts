"use client";

import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { creatorRedirect, type CreatorGateInput } from "@/lib/creatorGate";

/*
 * Who is reading the Help Center. It is public, so most readers are signed
 * out; a signed-in reader gets "Back to my home" in the header (the board's
 * creator variant) and, if certified, the creator wiki.
 */

export type Viewer =
    | { status: "loading" }
    | { status: "signedOut" }
    | { status: "signedIn"; home: string; name: string; accountHref: string | null };

/**
 * A creator's home: the same routing the app does after sign-in. Admins go to
 * /admin (app/dashboard sends them there); everyone else follows
 * lib/creatorGate (staff → /admin, rejected, waiting for approval or still
 * training → that screen), and an approved creator lands on /dashboard.
 */
export function homeOf(creator: CreatorGateInput): string {
    if (creator.role === "admin") return "/admin";
    return creatorRedirect(creator) ?? "/dashboard";
}

export function useViewer(): Viewer {
    const { user, isLoaded, isSignedIn } = useUser();
    const convexAuth = useConvexAuth();
    const creator = useQuery(api.creators.getByClerkId, user ? { clerkId: user.id } : "skip");
    // Business owners are a separate table (convex/businessOwners.ts). `me`
    // reads the Convex identity, so it waits until Convex has the Clerk token;
    // asked earlier it answers null and an owner would be sent to /dashboard.
    const owner = useQuery(api.businessOwners.me, user && convexAuth.isAuthenticated ? {} : "skip");

    if (!isLoaded) return { status: "loading" };
    if (!isSignedIn || !user) return { status: "signedOut" };

    const fallbackName = user.fullName || user.primaryEmailAddress?.emailAddress || "Your account";
    if (creator === undefined) return { status: "loading" };
    if (creator) {
        const name = [creator.firstName, creator.lastName].filter(Boolean).join(" ").trim() || fallbackName;
        return { status: "signedIn", home: homeOf(creator), name, accountHref: "/profile" };
    }
    if (convexAuth.isLoading || (convexAuth.isAuthenticated && owner === undefined)) return { status: "loading" };
    if (owner) return { status: "signedIn", home: "/my-business", name: owner.name || fallbackName, accountHref: "/my-business" };
    // Signed in with no profile yet: /dashboard is where the app sends them
    // (it forwards to onboarding).
    return { status: "signedIn", home: "/dashboard", name: fallbackName, accountHref: null };
}

/**
 * Whether this reader may open the creator wiki (an admin or a certified
 * creator; convex/knowledge.ts decides). undefined while it is not known yet:
 * Convex runs signed-out until Clerk hands it a token, and asking then would
 * answer false and flash the locked wiki at a certified creator.
 */
export function useWikiAccess(): boolean | undefined {
    const { isLoading, isAuthenticated } = useConvexAuth();
    const can = useQuery(api.knowledge.canAccessWiki, isAuthenticated ? {} : "skip");
    if (isLoading) return undefined;
    if (!isAuthenticated) return false;
    return can;
}
