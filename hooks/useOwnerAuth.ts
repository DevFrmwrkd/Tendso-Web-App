"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from 'react';
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
    const account = useQuery(api.creators.getByClerkId, user ? { clerkId: user.id } : 'skip');
    const ensure = useMutation(api.owners.ensure);
    const [error, setError] = useState<string | null>(null);
    const attempted = useRef<string | null>(null);
    const actor = user?.id ?? null;
    const ownerMatches = !!actor && owner?.clerkId === actor;
    const currentActor = useRef(actor); currentActor.current = actor;
    const eligible = account === null || !!account?.isDeleted || account?.status === 'deleted';
    useEffect(() => {
        if (attempted.current !== actor) setError(null);
        if (!actor || owner !== null || !eligible || attempted.current === actor) return;
        attempted.current = actor;
        let active = true;
        void ensure({}).catch(() => {
            if (active && currentActor.current === actor) setError('We could not connect your websites. Please sign out and try again.');
        });
        return () => { active = false; };
    }, [actor, owner, eligible, ensure]);
    const connecting = !!actor && owner === null && eligible && !error;
    const loading = !isLoaded || (!!user && (owner === undefined || account === undefined || connecting));
    return {
        owner: ownerMatches ? owner : null,
        isOwner: ownerMatches && eligible,
        isSignedIn: !!isSignedIn,
        loading,
        error: account && !eligible ? 'Use the business owner’s email to open this website.' : error,
    };
}
