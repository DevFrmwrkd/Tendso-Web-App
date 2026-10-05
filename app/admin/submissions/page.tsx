"use client"

import { Suspense } from "react"

import { EmptyState, PageHeader } from "@/components/r1"
import { useAdminAuth } from "@/hooks/useAdmin"

import AdminLayout from "../components/AdminLayout"
import { Queue } from "./_queue/Queue"
import { QueueBoundary } from "./_queue/QueueBoundary"
import { QueueSkeleton } from "./_queue/Rows"

// ─────────────────────────────────────────────────────────────────────────────
// /admin/submissions: "Which submission do I review next?" (Round 1, board
// Queue).
//
// This page is the submissions list that used to sit at the bottom of /admin,
// squeezed under the revenue chart at five rows a page. Moving it here was not
// a copy: the dashboard's version is gone, and this is the only one. What the
// room buys is what a dashboard widget could never fit — the status tabs with
// their counts, search, the custom-domain and owner-submitted filters, sort,
// and the money and domain state that were already on the wire.
//
// Round 1 makes it a queue. It opens on Needs review, oldest first, so the top
// row is the one that has waited longest. A row opens a details drawer (the
// facts and a quality checklist), and from there "Open review" goes to the
// review workspace at /admin/submissions/[id], where the work happens. Delete
// moved from every row into the drawer's More menu, behind one confirmation
// that names the business and everything that goes with it; its result is a
// toast instead of a banner at the top of the page.
//
// Auth is unchanged: useAdminAuth sends a signed-out visitor to /login and a
// visitor without a profile to /onboarding; anyone who is not an admin sees
// "Admin access required" and the list's query is never made for them.
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminSubmissionsPage() {
    const { isAdmin, loading } = useAdminAuth()

    return (
        <AdminLayout>
            <PageHeader title="Submissions" sub="Which submission do I review next?" />
            {!loading && !isAdmin ? (
                <EmptyState title="Admin access required" />
            ) : (
                <QueueBoundary>
                    {/* The queue reads ?status= and ?open= with useSearchParams(),
                        which forces a client bailout unless the tree is suspended;
                        the Next 16 production build fails without this boundary. */}
                    <Suspense fallback={<QueueSkeleton />}>
                        {/* Mounted while the role is still loading, so one skeleton
                            covers both waits (the role, then the list) instead of
                            two that each start their own delay. The list's query
                            is skipped until the role says admin. */}
                        <Queue isAdmin={isAdmin} />
                    </Suspense>
                </QueueBoundary>
            )}
        </AdminLayout>
    )
}
