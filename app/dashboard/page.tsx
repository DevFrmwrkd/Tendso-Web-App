"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { CreatorShell } from "@/components/shells/CreatorShell";
import { api } from "@/convex/_generated/api";
import { creatorRedirect } from "@/lib/creatorGate";

import { CreatorHome, HomeSkeleton } from "./_components/CreatorHome";

/**
 * The creator's Home (board Main), inside the creator shell. The shell now
 * carries what the old page drew itself: the notifications bell and its
 * unread badge (the same notifications.getUnreadCount subscription), Account,
 * and New submission (the old floating + button). The Home's own queries live
 * in CreatorHome.
 */
export default function DashboardPage() {
    const router = useRouter();
    const { user, isLoaded, isSignedIn } = useUser();

    // Get creator profile from Convex
    const creator = useQuery(api.creators.getByClerkId, user ? { clerkId: user.id } : "skip");

    // Redirect to login if not authenticated
    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            router.push("/login");
        }
    }, [isLoaded, isSignedIn, router]);

    // Redirect to onboarding if no creator profile
    useEffect(() => {
        if (isLoaded && isSignedIn && creator === null) {
            router.push("/onboarding");
        }
    }, [isLoaded, isSignedIn, creator, router]);

    // Redirect admin users to admin dashboard
    useEffect(() => {
        if (isLoaded && isSignedIn && creator && creator.role === "admin") {
            router.push("/admin");
        }
    }, [isLoaded, isSignedIn, creator, router]);

    // Route uncertified creators by lifecycle state (pending / rejected / training).
    useEffect(() => {
        if (isLoaded && isSignedIn && creator) {
            const dest = creatorRedirect(creator);
            if (dest) router.replace(dest);
        }
    }, [isLoaded, isSignedIn, creator, router]);

    // Track last active timestamp
    const updateLastActive = useMutation(api.creators.updateLastActive);
    useEffect(() => {
        if (isLoaded && isSignedIn && user?.id) {
            updateLastActive({ clerkId: user.id });
        }
    }, [isLoaded, isSignedIn, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // A redirect above is on its way: show nothing rather than a creator's Home
    // to someone who is not one (signed out, no profile, admin, staff, or not
    // certified yet).
    const leaving =
        isLoaded &&
        (!isSignedIn ||
            creator === null ||
            (creator !== undefined && (creator.role === "admin" || !creator.certifiedAt || creatorRedirect(creator) !== null)));
    if (leaving) return <div className="r1 min-h-dvh" aria-busy="true" />;

    return <CreatorShell>{creator ? <CreatorHome creator={creator} /> : <HomeSkeleton />}</CreatorShell>;
}
