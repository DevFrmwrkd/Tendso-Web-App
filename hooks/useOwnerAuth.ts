"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * Owner-portal auth hook — mirrors useAdminAuth, but for the businessOwners
 * audience (separate Clerk identity, passwordless). Returns the owner profile
 * and loading state. `isOwner` is true once a businessOwners row exists for the
 * signed-in Clerk user (i.e. they've claimed at least one website).
 */
export function useOwnerAuth() {
    const { user, isLoaded, isSignedIn } = useUser();
    const owner = useQuery(
        api.businessOwners.me,
        user ? {} : "skip",
    );
    const loading = !isLoaded || (!!user && owner === undefined);
    return {
        owner: owner ?? null,
        isOwner: !!owner,
        isSignedIn: !!isSignedIn,
        loading,
    };
}
