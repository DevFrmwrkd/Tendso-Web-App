"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { Bell, LogOut } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { api } from "@/convex/_generated/api";

import styles from "./PortalFrame.module.css";

const NotificationsDrawer = dynamic(() => import("@/app/notifications/_components/NotificationsDrawer").then(module => module.NotificationsDrawer), { ssr: false });

/** Only mount on live portal pages. Every notification read uses the current verified Clerk account. */
export function PortalUtilities() {
    const { user, isLoaded, isSignedIn } = useUser();
    const { signOut } = useClerk();
    const { isAuthenticated, isLoading } = useConvexAuth();
    const ready = isLoaded && isSignedIn && !isLoading && isAuthenticated && !!user;
    const session = useQuery(api.adminAccess.me, ready ? {} : "skip");
    const candidate = ready && session?.clerkId === user.id ? session.creator : null;
    const account = candidate && candidate.clerkId === user?.id && candidate.role === "affiliate" && !candidate.isDeleted
        && (candidate.status === "active" || candidate.status === "suspended") ? candidate : null;
    const unread = useQuery(api.notifications.getUnreadCount, account ? { creatorId: account._id } : "skip");
    const actor = account ? `${account.clerkId}:${account._id}:${account.status}` : null;
    const [openFor, setOpenFor] = useState<string | null>(null);
    const [signingOut, setSigningOut] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const currentActor = useRef(actor);

    useEffect(() => {
        currentActor.current = actor;
        setOpenFor(null);
        setError(null);
        setSigningOut(false);
        return () => { currentActor.current = null; };
    }, [actor]);

    if (!account || !actor) return null;
    return <>
        <button type="button" className={styles.utilityButton} onClick={() => setOpenFor(actor)} aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
            <Bell size={18} aria-hidden="true" />Notifications{unread ? <span className={styles.badge}>{unread > 99 ? "99+" : unread}</span> : null}
        </button>
        <button type="button" className={styles.utilityButton} disabled={signingOut} onClick={async () => {
            setSigningOut(true);
            setError(null);
            try { await signOut({ redirectUrl: "/v2/creators" }); }
            catch { if (currentActor.current === actor) { setError("Could not sign out. Try again."); setSigningOut(false); } }
        }}><LogOut size={18} aria-hidden="true" />{signingOut ? "Signing out…" : "Sign out"}</button>
        {error ? <span role="alert" className={styles.utilityError}>{error}</span> : null}
        {openFor === actor ? <NotificationsDrawer key={actor} open onClose={() => setOpenFor(null)} creator={account} /> : null}
    </>;
}
