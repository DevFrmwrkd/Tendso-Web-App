"use client"

import { Suspense } from "react"

import { EmptyState, PageHeader } from "@/components/r1"
import { useAdminAuth } from "@/hooks/useAdmin"

import AdminLayout from "../components/AdminLayout"
import { AuditBoundary } from "./_components/AuditBoundary"
import { AuditLog, AuditSkeleton } from "./_components/AuditLog"

/**
 * /admin/audit: the audit log (Round 1, board Audit), "Who changed what?"
 *
 * Every admin action and system event, newest first, as one sentence a row
 * ("Theo VA approved Neighborhood"), grouped by day, filtered by type, by who
 * did it and by business. A row opens the event in the right drawer, which
 * replaces the old detail modal; its raw fields sit in a fold there. The old
 * page's four count cards are gone with the board (they counted only the
 * loaded window, never the whole log).
 *
 * Auth is unchanged: useAdminAuth sends a signed-out visitor to /login and a
 * visitor without a profile to /onboarding, and the log's query is skipped
 * for anyone but an admin (who now sees "Admin access required" rather than
 * a blank page).
 */
export default function AuditLogPage() {
    const { isAdmin, loading } = useAdminAuth()

    return (
        <AdminLayout>
            <PageHeader title="Audit log" sub="Who changed what?" />
            {!loading && !isAdmin ? (
                <EmptyState title="Admin access required" />
            ) : (
                <AuditBoundary>
                    {/* useSearchParams() (the open drawer) needs a Suspense boundary,
                        or the Next 16 production build fails on this route. Mounted
                        while the role loads too, so one skeleton covers both waits. */}
                    <Suspense fallback={<AuditSkeleton />}>
                        <AuditLog isAdmin={isAdmin} />
                    </Suspense>
                </AuditBoundary>
            )}
        </AdminLayout>
    )
}
