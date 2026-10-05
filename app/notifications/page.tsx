"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CreatorHome, HomeSkeleton } from "@/app/dashboard/_components/CreatorHome";
import { CreatorShell } from "@/components/shells/CreatorShell";
import { api } from "@/convex/_generated/api";
import { creatorRedirect } from "@/lib/creatorGate";

import { NotificationsDrawer } from "./_components/NotificationsDrawer";
import { QuietBoundary } from "./_components/QuietBoundary";
import { useMinWidth } from "./_components/useMinWidth";

/**
 * Notifications (board Notifications): a drawer over Home. The route stays
 * (the shell's bell and sidebar link here, and so may bookmarks); closing the
 * drawer goes Home, as the board's close does.
 *
 * The Home behind is scenery, inert under the open drawer. It is drawn only
 * where it shows (the drawer covers a phone's whole screen) and only for a
 * certified creator, the one person Home is for. This page keeps its own
 * guard, as before: signed out goes to /login, nothing else redirects.
 */
export default function NotificationsPage() {
    const router = useRouter();
    const { user, isLoaded } = useUser();
    const creator = useQuery(api.creators.getByClerkId, user ? { clerkId: user.id } : "skip");
    const wide = useMinWidth(640);
    const [open, setOpen] = useState(true);

    useEffect(() => {
        if (isLoaded && !user) router.push("/login");
    }, [isLoaded, user, router]);

    // Close at once, then go Home; replace so Back does not reopen the drawer.
    const close = () => {
        setOpen(false);
        router.replace("/dashboard");
    };

    const loading = !isLoaded || (!!user && creator === undefined);
    const homeFor = creator && creator.role !== "admin" && creator.certifiedAt && creatorRedirect(creator) === null ? creator : null;

    return (
        <>
            {homeFor || loading ? (
                <CreatorShell>
                    {wide &&
                        (homeFor ? (
                            <QuietBoundary>
                                <CreatorHome creator={homeFor} />
                            </QuietBoundary>
                        ) : (
                            <HomeSkeleton />
                        ))}
                </CreatorShell>
            ) : (
                <div className="r1 min-h-dvh" />
            )}
            <NotificationsDrawer open={open} onClose={close} creator={creator} />
        </>
    );
}
