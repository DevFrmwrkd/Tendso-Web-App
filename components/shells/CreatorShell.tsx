"use client";

import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { Bell, BookOpen, Gift, Home, Inbox, MapPin, Plus, User, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { AppShell, Dot, Icon, TabBar, type NavLinkEntry, type SidebarProps } from "@/components/r1";
import { api } from "@/convex/_generated/api";

/**
 * The creator's frame (boards Main, Submissions, NewSubmission, Leads, Wallet,
 * Referrals, Account): the sidebar on a desk; on a phone a top bar with the
 * notifications bell and the menu, plus the interim bottom tab bar.
 *
 * It only reads. Every page inside keeps its own auth and certification
 * redirects, exactly as before; the queries here are the same ones those pages
 * already run, so Convex serves them from the same subscription.
 */

/**
 * A submission still on its way: a draft to finish, or one waiting on review,
 * the site or the owner's payment. The Submissions badge counts these.
 */
const OPEN_STATUSES = new Set([
    "draft",
    "pending",
    "submitted",
    "in_review",
    "approved",
    "website_generated",
    "deployed",
    "pending_payment",
]);

const HOME: NavLinkEntry = { href: "/dashboard", label: "Home", icon: Home, exact: true };
const REFERRALS: NavLinkEntry = { href: "/referrals", label: "Referrals", icon: Gift };
const WALLET: NavLinkEntry = { href: "/wallet", label: "Wallet", icon: Wallet };
// Account absorbs the old profile sub-pages, which redirect into it.
const ACCOUNT: NavLinkEntry = { href: "/profile", label: "Account", icon: User, alsoCurrent: ["/edit-profile", "/change-password", "/connect-ai"] };

export function CreatorShell({ children }: { children: ReactNode }) {
    const router = useRouter();
    const { user, isLoaded, isSignedIn } = useUser();
    const { isAuthenticated } = useConvexAuth();
    const creator = useQuery(api.creators.getByClerkId, user ? { clerkId: user.id } : "skip");
    const affiliate = creator?.role === "affiliate";
    const missingProfile = creator === null;
    const submissions = useQuery(api.submissions.getByCreatorId, isAuthenticated && creator && !affiliate ? { creatorId: creator._id } : "skip");
    const unread = useQuery(api.notifications.getUnreadCount, creator && !affiliate ? { creatorId: creator._id } : "skip");
    useEffect(() => {
        if (isLoaded && !isSignedIn) router.replace("/login");
        else if (isLoaded && isSignedIn && missingProfile) router.replace("/onboarding");
        else if (affiliate) router.replace("/affiliates/dashboard");
    }, [isLoaded, isSignedIn, missingProfile, affiliate, router]);

    const open = submissions?.filter((s) => OPEN_STATUSES.has(s.status)).length ?? 0;
    const name = [creator?.firstName, creator?.lastName].filter(Boolean).join(" ") || user?.fullName || "";

    // Wait for account type before mounting capture pages nested in this shell.
    if (!isAuthenticated || creator === undefined || affiliate) return <div className="r1 min-h-dvh" aria-busy="true" />;

    return <CreatorShellView name={name} open={open} unread={unread ?? 0}>{children}</CreatorShellView>;
}

/** The same navigation frame without account subscriptions or redirects. */
export function CreatorShellView({ children, name, open = 0, unread = 0, preview = false }: {
    children?: ReactNode;
    name: string;
    open?: number;
    unread?: number;
    preview?: boolean;
}) {
    const href = (path: string) => preview ? `/admin/preview/creator#${path.slice(1).replaceAll("/", "-")}` : path;
    const entry = (item: NavLinkEntry): NavLinkEntry => preview
        ? { ...item, href: href(item.href), isCurrent: () => item.href === HOME.href }
        : item;
    const sidebar: SidebarProps = {
        homeHref: href("/dashboard"),
        primary: { href: href("/submit/info"), label: "New submission", icon: Plus, currentPrefix: "/submit" },
        items: [
            HOME,
            { href: "/leads", label: "Leads", icon: MapPin },
            { href: "/submissions", label: "Submissions", icon: Inbox, badge: open ? { count: open } : null },
            WALLET,
            REFERRALS,
            { href: "/knowledge", label: "Learn", icon: BookOpen },
        ].map(entry),
        footItems: [entry({ href: "/notifications", label: "Notifications", icon: Bell, badge: unread ? { tone: "attn", count: unread } : null })],
        me: name ? { name, meta: "Creator", href: href(ACCOUNT.href) } : null,
    };

    return (
        <AppShell
            sidebar={sidebar}
            topbarActions={
                <Link
                    href={href("/notifications")}
                    className="t-btn t-btn-ghost t-btn-icon relative"
                    aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
                >
                    <Icon icon={Bell} size={18} />
                    {unread ? <Dot tone="attn" className="absolute right-2 top-2" /> : null}
                </Link>
            }
            tabbar={<TabBar items={[HOME, REFERRALS, WALLET, ACCOUNT].map(entry)} center={{ href: href("/submit/info"), label: "New submission", icon: Plus }} />}
        >
            {children}
        </AppShell>
    );
}
