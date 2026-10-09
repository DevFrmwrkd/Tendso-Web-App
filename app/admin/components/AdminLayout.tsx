"use client"

import { useUser } from "@clerk/nextjs"
import { useQuery } from "convex/react"
import { Home, Inbox, ListChecks, MapPin, Megaphone, Phone, Sparkles, Users, Wallet, LayoutTemplate } from "lucide-react"

import { AppShell, type NavEntry, type SidebarProps } from "@/components/r1"
import { api } from "@/convex/_generated/api"
import { useAdminAuth } from "@/hooks/useAdmin"
import { isActiveTeamAccount } from "@/lib/admin-access"

/**
 * The admin and staff frame (board AdminHome, ComponentKit "Sidebars").
 *
 * One 10-item sidebar in two groups: the day's work, then the settings. No
 * fixed header repeating "Overview", no footer. The person sits at the foot
 * and opens Account (which also holds Sign out).
 *
 * Old routes merged into these screens light their item: Call stats is the
 * Stats tab of Calls, App release is the App links tab of Site settings.
 */

// Staff reach Today and Calls. The legacy call-stats URL redirects to Calls.
const STAFF_ROUTES = new Set(["/admin", "/admin/bookings"])

/** No page, sidebar, or protected query mounts while access is unresolved. */
export function AdminAccessGate({ children }: { children: React.ReactNode }) {
    const { canAccess } = useAdminAuth()
    return canAccess ? children : null
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    // Who is looking. Needed BEFORE the badge queries below, which are
    // admin-only and may throw rather than return undefined for anyone else.
    const { user } = useUser()
    const { isAdmin, isStaff, canAccess, creator: me } = useAdminAuth({ allowAccountPage: true })

    // Badges are SKIPPED for everyone but an admin, deliberately.
    // `listPendingApproval` THROWS "Forbidden: admin access required" for a
    // non-admin caller; it does not return undefined. This layout used to
    // render for admins only, so nobody ever hit that — then the staff
    // dashboard started rendering inside it and every staff page load threw.
    // Keep these gated on the role.
    const pendingApprovals = useQuery(api.creators.listPendingApproval, isAdmin ? {} : "skip") as { _id: string }[] | undefined
    const submitted = useQuery(api.submissions.getByStatus, isAdmin ? { status: "submitted" } : "skip")
    const inReview = useQuery(api.submissions.getByStatus, isAdmin ? { status: "in_review" } : "skip")
    const failedPayouts = useQuery(api.withdrawals.getByStatus, isAdmin ? { status: "failed" } : "skip")

    const toReview = (submitted?.length ?? 0) + (inReview?.length ?? 0)
    const waiting = pendingApprovals?.length ?? 0
    const failed = failedPayouts?.length ?? 0

    const items: NavEntry[] = [
        { href: "/admin", label: "Today", icon: Home, exact: true },
        { href: "/admin/submissions", label: "Submissions", icon: Inbox, badge: toReview ? { tone: "attn", count: toReview } : null },
        // Creators waiting for approval need the admin: the gold dot says so.
        {
            href: "/admin/creators",
            label: "Creators",
            icon: Users,
            badge: waiting ? { tone: "attn", count: waiting } : null,
            alsoCurrent: ["/admin/pending-approvals", "/admin/rejected-creators"],
        },
        { href: "/admin/leads", label: "Leads", icon: MapPin },
        { href: "/admin/affiliates", label: "Affiliates", icon: Users },
        {
            href: "/admin/payouts",
            label: "Payouts",
            icon: Wallet,
            badge: failed ? { tone: "bad", count: failed } : null,
            alsoCurrent: ["/admin/withdrawals"],
        },
        { href: "/admin/bookings", label: "Calls", icon: Phone, alsoCurrent: ["/admin/call-stats"] },
        "separator",
        { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
        { href: "/admin/knowledge", label: "Train AI", icon: Sparkles },
        { href: "/admin/featured-sites", label: "Site settings", icon: LayoutTemplate, alsoCurrent: ["/admin/app-release"] },
        { href: "/admin/audit", label: "Audit log", icon: ListChecks },
    ]

    const visible: NavEntry[] = isStaff
        ? items.filter((e): e is Exclude<NavEntry, "separator"> => e !== "separator" && STAFF_ROUTES.has(e.href))
        : items

    const name = [me?.firstName, me?.lastName].filter(Boolean).join(" ") || user?.fullName || ""
    const roleLabel = isStaff ? "Staff" : "Admin"

    const sidebar: SidebarProps = {
        homeHref: "/admin",
        roleLabel,
        items: visible,
        me: name ? { name, meta: roleLabel, href: "/profile" } : null,
    }

    if (!canAccess) return null
    // A suspended team member can still use Account, including Sign out,
    // without seeing the admin frame or starting its protected queries.
    return isActiveTeamAccount(me) ? <AppShell sidebar={sidebar}>{children}</AppShell> : children
}
