"use client"

/**
 * /admin/creators: "Who is waiting to be let in?" (Round 1, board Creators).
 *
 * Three tabs with counts: Waiting for approval (the default, and what the
 * page is for), All creators, Rejected. A row opens the creator's details in
 * the 480px drawer on the right; the drawer replaces the old detail pages,
 * which are now redirects:
 *
 *   /admin/creators/[id]          → /admin/creators?open=<id>
 *   /admin/creators/pending/[id]  → /admin/creators?view=pending&open=<id>
 *   /admin/pending-approvals      → /admin/creators?view=pending
 *   /admin/rejected-creators      → /admin/creators?view=rejected
 *
 * THE URL IS THE STATE: `?view=` is the tab (the values the old redirects
 * already use: pending, all, rejected) and `?open=` the drawer, so a link
 * from Discord, an email or another admin screen lands on the same view, and
 * Back and refresh keep it. Both are written with router.replace, never
 * push: a drawer is not a page. With `?open=` and no `?view=` (the old
 * detail route's redirect) the tab underneath is All creators.
 *
 * Guards are unchanged: nothing renders for anyone but an admin, and the
 * admin-only queries are skipped until the role is known (listPendingApproval
 * and listRejected THROW for anyone else rather than returning nothing).
 */

import { useUser } from "@clerk/nextjs"
import { useConvexAuth, useQuery } from "convex/react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useCallback, useState } from "react"
import { toast } from "sonner"

import { Loading, PageHeader, Skeleton, SkeletonRows, Tabs } from "@/components/r1"
import { api } from "@/convex/_generated/api"

import AdminLayout from "../components/AdminLayout"
import { CreatorDrawer } from "./_components/CreatorDrawer"
import { parseView, type View } from "./_lib/creators"
import AllCreatorsView from "./_views/AllCreatorsView"
import PendingApprovalsView from "./_views/PendingApprovalsView"
import RejectedCreatorsView from "./_views/RejectedCreatorsView"

const TITLE = "Creators"
const SUB = "Who is waiting to be let in?"

// useSearchParams() below needs a Suspense boundary, or Next bails out of
// the static pre-render and the production build fails.
export default function CreatorsPage() {
    return (
        <Suspense
            fallback={
                <AdminLayout>
                    <CreatorsLoading />
                </AdminLayout>
            }
        >
            <CreatorsBoard />
        </Suspense>
    )
}

/** The page's own shape while Clerk and the admin's own row load: header, tabs, rows. */
function CreatorsLoading() {
    return (
        <>
            <PageHeader title={TITLE} sub={SUB} />
            <Loading label="Loading creators" className="flex flex-col gap-4">
                <div className="flex gap-6">
                    {[150, 104, 80].map((w) => (
                        <Skeleton key={w} width={w} height={20} />
                    ))}
                </div>
                <SkeletonRows count={5} avatar />
            </Loading>
        </>
    )
}

function CreatorsBoard() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const { user, isLoaded } = useUser()
    const { isAuthenticated } = useConvexAuth()
    // One reading of the clock per visit: "Sep 27" against "Sep 27, 2025", days waited.
    const [now] = useState(() => Date.now())

    const me = useQuery(api.creators.getByClerkId, user ? { clerkId: user.id } : "skip")
    const isAdmin = me?.role === "admin" && isAuthenticated

    // The three lists behind the tabs; each tab's count is its list's length.
    const pending = useQuery(api.creators.listPendingApproval, isAdmin ? {} : "skip")
    const rejected = useQuery(api.creators.listRejected, isAdmin ? {} : "skip")
    const all = useQuery(api.creators.getAllWithStats, isAdmin ? {} : "skip")

    const openId = searchParams.get("open") || null
    const view: View = parseView(searchParams.get("view")) ?? (openId ? "all" : "pending")

    /**
     * Set the tab and/or the drawer, keeping any other parameter. Reads the
     * live URL rather than this render's searchParams, because a toast's
     * action calls it seconds later. The tab is always written out unless it
     * is the default with no drawer, so closing a drawer that was opened by
     * `?open=` alone does not flip the tab under it.
     */
    const setParams = useCallback(
        (changes: { view?: View; open?: string | null }) => {
            const next = new URLSearchParams(window.location.search)
            const current = parseView(next.get("view")) ?? (next.get("open") ? "all" : "pending")
            const nextView = changes.view ?? current
            if (changes.open !== undefined) {
                if (changes.open === null) next.delete("open")
                else next.set("open", changes.open)
            }
            if (nextView === "pending" && !next.get("open")) next.delete("view")
            else next.set("view", nextView)
            const query = next.toString()
            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
        },
        [pathname, router],
    )

    // Same <AdminLayout> element as the loaded page below, so the frame stays
    // mounted when the content arrives instead of being built twice.
    if (!isLoaded || (user && (me === undefined || !isAuthenticated))) {
        return (
            <AdminLayout>
                <CreatorsLoading />
            </AdminLayout>
        )
    }

    if (!isAdmin) return null

    const open = (id: string) => setParams({ open: id })

    return (
        <AdminLayout>
            <PageHeader title={TITLE} sub={SUB} />

            <Tabs
                label="Creator lists"
                value={view}
                // Switching tabs closes the drawer, as the board does.
                onChange={(v) => setParams({ view: v, open: null })}
                tabs={[
                    { value: "pending", label: "Waiting for approval", count: pending?.length ?? null },
                    { value: "all", label: "All creators", count: all?.length ?? null },
                    { value: "rejected", label: "Rejected", count: rejected?.length ?? null },
                ]}
            >
                {view === "pending" && (
                    <PendingApprovalsView rows={pending} openId={openId} now={now} onOpen={open} onSeeAll={() => setParams({ view: "all", open: null })} />
                )}
                {view === "all" && <AllCreatorsView rows={all} openId={openId} onOpen={open} />}
                {view === "rejected" && <RejectedCreatorsView rows={rejected} openId={openId} now={now} onOpen={open} />}
            </Tabs>

            <CreatorDrawer
                id={openId}
                meId={me?._id ?? null}
                now={now}
                onClose={() => setParams({ open: null })}
                onOpenCreator={open}
                onApproved={(target) => {
                    setParams({ open: null })
                    toast.success(`${target.name} approved — they’re now a certified creator.`, {
                        action: { label: "Show in All creators", onClick: () => setParams({ view: "all", open: target.id }) },
                    })
                }}
                onRejected={({ displayName }) => {
                    setParams({ open: null })
                    toast.success(`${displayName} rejected — they’ll see the rejection screen on next app open.`, {
                        action: { label: "Show in Rejected", onClick: () => setParams({ view: "rejected", open: null }) },
                    })
                }}
                onDeleted={(target) => {
                    setParams({ open: null })
                    toast.success(`${target.name} was deleted.`)
                }}
            />
        </AdminLayout>
    )
}
