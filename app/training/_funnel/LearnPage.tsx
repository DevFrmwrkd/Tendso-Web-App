"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { api } from "@/convex/_generated/api";

import { FunnelFallback, FunnelFrame } from "./FunnelFrame";
import { LearnStep } from "./LearnStep";

/**
 * Stage 2 of certification, for both routes that show it:
 *  - /training (guarded): the redirects it always had, unchanged.
 *  - /training-lessons (not guarded): it was a plain page of lessons with no
 *    checks of its own, so it keeps none; sign-in is still enforced by the
 *    middleware (proxy.ts), as before.
 */
export function LearnPage({ guarded }: { guarded: boolean }) {
    const router = useRouter();
    const { user, isLoaded } = useUser();
    const creator = useQuery(api.creators.getByClerkId, user ? { clerkId: user.id } : "skip");

    useEffect(() => {
        if (guarded && isLoaded && !user) router.push("/login");
    }, [guarded, isLoaded, user, router]);

    useEffect(() => {
        if (!guarded) return;
        // Internal staff have no training to do — send them home. Nothing routes
        // them here any more, but typing the URL used to strand them: no
        // certifiedAt and no admin role meant this page simply kept them.
        if (creator?.role === "staff") {
            router.push("/admin");
            return;
        }
        if (creator && (creator.certifiedAt || creator.role === "admin")) router.push("/dashboard");
    }, [guarded, creator, router]);

    // /training waited for the creator lookup before showing anything (so a
    // certified creator never saw the lessons on the way to /dashboard).
    // /training-lessons only needs the signed-in user, whose id keys the
    // lesson progress.
    if (!isLoaded || !user || (guarded && creator === undefined)) return <FunnelFallback view={2} creator={creator} />;

    return (
        <FunnelFrame view={2} creator={creator}>
            <LearnStep userId={user.id} />
        </FunnelFrame>
    );
}
