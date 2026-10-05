"use client"

import { useAdminAuth } from "@/hooks/useAdmin"

import AdminLayout from "./components/AdminLayout"
import AdminToday, { TodaySkeleton } from "./_components/AdminToday"
import PanelBoundary from "./_components/PanelBoundary"
import StaffDashboard from "./_components/StaffDashboard"

/**
 * /admin: Today (board AdminHome). "What needs me today?", for the admin and,
 * in its own shape, for the internal staff role.
 *
 * The page only decides who is looking. Each view holds its own queries, so
 * nothing admin-only is ever asked for on a staff account and nothing about
 * calls is fetched twice.
 *
 * The revenue chart that used to live here moved to the money summary on
 * Payouts (scope: "Revenue chart, moved elsewhere").
 */
export default function AdminHomePage() {
    const { isAdmin, loading, creator } = useAdminAuth()

    // The internal 'staff' role lands here like everyone else, and gets the
    // one view its job needs instead of an empty admin dashboard.
    if (!loading && creator?.role === "staff") {
        return (
            <AdminLayout>
                <PanelBoundary what="Today">
                    <StaffDashboard />
                </PanelBoundary>
            </AdminLayout>
        )
    }

    if (loading) {
        return (
            <AdminLayout>
                <TodaySkeleton />
            </AdminLayout>
        )
    }

    if (!isAdmin) return null

    return (
        <AdminLayout>
            <PanelBoundary what="Today">
                <AdminToday />
            </PanelBoundary>
        </AdminLayout>
    )
}
