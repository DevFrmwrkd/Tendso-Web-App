"use client"

import { useUser } from "@clerk/nextjs"
import { useQuery } from "convex/react"
import { Suspense } from "react"

import { api } from "@/convex/_generated/api"

import AdminLayout from "../components/AdminLayout"
import { Boundary } from "./_components/Boundary"
import { Payouts, PayoutsHeader, PayoutsSkeleton } from "./_components/Payouts"

// ─────────────────────────────────────────────────────────────────────────────
// /admin/payouts: "Which creator payouts need me?" (Round 1, board Payouts).
//
// Payout management is a READ-ONLY view of creator withdrawals, as it has been
// since withdrawals went instant. The pipeline (the creator withdraws from the
// web or mobile Wallet → Convex `withdrawals.create` → a Wise transfer → the
// webhook, the hourly cron or a manual check moves its status) is untouched.
// Nothing here marks a payout paid, processes or approves one. What an admin
// does here: see which payouts failed or wait on Wise, release a transfer in
// the Wise dashboard (Open in Wise), check Wise right now instead of waiting an
// hour for the cron (Sync with Wise, or Check Wise now in the drawer), and tell
// a creator their withdrawal failed.
//
// Round 1 moved three things in:
//   - The old Transaction detail modal is the right drawer (?open=<id>).
//   - /admin/withdrawals redirects here, with ?status=all.
//   - The revenue chart from the old /admin dashboard is in the money fold.
//
// Auth is unchanged: the withdrawals query is skipped until the viewer is
// known to be an admin, and anyone who is not an admin gets nothing at all.
// The Convex functions check the role again server-side.
// ─────────────────────────────────────────────────────────────────────────────

export default function PayoutsPage() {
    const { user, isLoaded } = useUser()

    const currentCreator = useQuery(api.creators.getByClerkId, user ? { clerkId: user.id } : "skip")
    const isAdmin = currentCreator?.role === "admin"
    const roleLoading = !isLoaded || (!!user && currentCreator === undefined)

    if (!roleLoading && !isAdmin) return null

    return (
        <AdminLayout>
            <Boundary what="Payouts" before={<PayoutsHeader />}>
                {/* useSearchParams() forces a client bailout unless the tree is
                    suspended, and the Next 16 production build fails without it. */}
                <Suspense fallback={<PayoutsSkeleton />}>
                    {/* Mounted while the role is still loading, so one skeleton
                        covers both waits (the role, then the list). Its queries
                        are skipped until adminId is set, which is only for an admin. */}
                    <Payouts adminId={isAdmin && user ? user.id : null} />
                </Suspense>
            </Boundary>
        </AdminLayout>
    )
}
