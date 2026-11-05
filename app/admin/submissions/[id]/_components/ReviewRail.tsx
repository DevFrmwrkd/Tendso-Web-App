"use client";

import type { LucideIcon } from "lucide-react";
import { CalendarDays, Home, Inbox, LayoutTemplate, ListChecks, MapPin, Megaphone, Phone, Sparkles, Users, Wallet } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "convex/react";

import { Avatar, Dot, Icon, type Tone } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import styles from "../../_queue/SubmissionWorkspace.module.css";

/**
 * The admin sidebar folded to a 64px icon rail, so the review workspace keeps
 * its width for the editor and the preview (board Review: "Admin sidebar,
 * collapsed to a 64px icon rail for the workspace"). Desk only; on a phone the
 * header's "Submissions" link is the way back, and every other admin page has
 * the full menu.
 *
 * A LOCAL MIRROR of app/admin/components/AdminLayout.tsx: the same ten items,
 * the same routes, the same three badges from the same queries, shown as dots
 * with the count in the label. AdminLayout has no rail form and is not this
 * package's to change; if it ever grows one, this file goes. Keep the two in
 * step until then.
 *
 * Only admins reach this page (staff are refused before it renders), so this
 * is the admin set; the badge queries stay gated on the role exactly as in
 * AdminLayout, because listPendingApproval THROWS for anyone else.
 */

type RailEntry =
    | { href: string; label: string; icon: LucideIcon; current?: boolean; badge?: { tone: Tone; count: number } | null; badgeWord?: string }
    | "separator";

export function ReviewRail({ isAdmin, name }: { isAdmin: boolean; name: string | null }) {
    const pendingApprovals = useQuery(api.creators.listPendingApproval, isAdmin ? {} : "skip") as { _id: string }[] | undefined;
    const submitted = useQuery(api.submissions.getByStatus, isAdmin ? { status: "submitted" } : "skip");
    const inReview = useQuery(api.submissions.getByStatus, isAdmin ? { status: "in_review" } : "skip");
    const failedPayouts = useQuery(api.withdrawals.getByStatus, isAdmin ? { status: "failed" } : "skip");

    const toReview = (submitted?.length ?? 0) + (inReview?.length ?? 0);
    const waiting = pendingApprovals?.length ?? 0;
    const failed = failedPayouts?.length ?? 0;

    const entries: RailEntry[] = [
        { href: "/admin", label: "Today", icon: Home },
        {
            href: "/admin/submissions",
            label: "Submissions",
            icon: Inbox,
            current: true,
            badge: toReview ? { tone: "attn", count: toReview } : null,
            badgeWord: `${toReview} need review`,
        },
        {
            href: "/admin/creators",
            label: "Creators",
            icon: Users,
            badge: waiting ? { tone: "attn", count: waiting } : null,
            badgeWord: `${waiting} waiting for approval`,
        },
        { href: "/admin/leads", label: "Leads", icon: MapPin },
        { href: "/admin/visits", label: "Visit requests", icon: CalendarDays },
        { href: "/admin/affiliates", label: "Affiliates", icon: Users },
        {
            href: "/admin/payouts",
            label: "Payouts",
            icon: Wallet,
            badge: failed ? { tone: "bad", count: failed } : null,
            badgeWord: `${failed} failed`,
        },
        { href: "/admin/bookings", label: "Calls", icon: Phone },
        "separator",
        { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
        { href: "/admin/knowledge", label: "Train AI", icon: Sparkles },
        { href: "/admin/featured-sites", label: "Site settings", icon: LayoutTemplate },
        { href: "/admin/audit", label: "Audit log", icon: ListChecks },
    ];

    return (
        <aside
            aria-label="Main navigation"
            className={`hidden flex-none flex-col items-center border-r border-r1-line lg:flex ${styles.rail}`}
        >
            <Link
                href="/admin"
                aria-label="Tendso admin"
                className={`flex flex-none items-center justify-center ${styles.railLink} ${styles.railBrand}`}
            >
                <Image src="/v2/brand/mark-ink-256.png" alt="" width={28} height={28} />
            </Link>
            <nav aria-label="Sections" className="flex flex-col items-center gap-1">
                {entries.map((e, i) =>
                    e === "separator" ? (
                        <span key={`sep${i}`} role="separator" className="my-1.5 h-px w-6 bg-r1-line-3" />
                    ) : (
                        <Link
                            key={e.href}
                            href={e.href}
                            aria-label={e.badge ? `${e.label}, ${e.badgeWord}` : e.label}
                            title={e.label}
                            aria-current={e.current ? "page" : undefined}
                            className={`relative flex items-center justify-center text-r1-ink-3 hover:bg-r1-fill hover:text-r1-ink ${styles.railLink}`}
                        >
                            <Icon icon={e.icon} size={18} />
                            {e.badge && <Dot tone={e.badge.tone} className="absolute right-[7px] top-[7px] h-[7px] w-[7px]" />}
                        </Link>
                    ),
                )}
            </nav>
            {name && (
                <div className="mt-auto flex flex-col items-center">
                    <Link
                        href="/profile"
                        aria-label={`${name}, Admin — account`}
                        title={`${name} · Admin`}
                        className={`flex items-center justify-center hover:bg-r1-fill ${styles.railLink}`}
                    >
                        <Avatar name={name} />
                    </Link>
                </div>
            )}
        </aside>
    );
}
