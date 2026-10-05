"use client"

import { Suspense } from "react"

import { EmptyState, PageHeader } from "@/components/r1"
import { useAdminAuth } from "@/hooks/useAdmin"

import AdminLayout from "../components/AdminLayout"
import { SettingsBoundary } from "./_components/SettingsBoundary"
import { SettingsSkeleton, SiteSettings } from "./_components/SiteSettings"

/**
 * /admin/featured-sites: Site settings (Round 1, board SiteSettings).
 *
 * This was the Featured Sites curation screen for the landing's "Real Sites"
 * proof grid; it is now the first of two tabs. The landing reads the Convex
 * setting `featured_sites` (an array of {name, category, city, url}) and falls
 * back to the hardcoded SHOWCASE_SITES when it is unset or empty, so an admin
 * hand-picks that list here (add, edit, reorder, remove) without touching
 * code or redeploying. Each card on the landing renders a LIVE preview of the
 * site at its URL.
 *
 * The second tab, App links, is what /admin/app-release used to be (that
 * route now redirects to `?tab=app`): the Google Play and App Store links,
 * and the one-time clean-up of the old APK.
 *
 * Auth is unchanged: useAdminAuth sends a signed-out visitor to /login and a
 * visitor without a profile to /onboarding; anyone who is not an admin sees
 * "Admin access required", and no setting is read for them.
 */
export default function SiteSettingsPage() {
    const { isAdmin, loading, creator } = useAdminAuth()
    // Recorded as `updatedBy` on every setting this page writes, as before.
    const adminId = creator?._id ? String(creator._id) : undefined

    return (
        <AdminLayout>
            <PageHeader title="Site settings" sub="What does the public site show?" />
            {!loading && !isAdmin ? (
                <EmptyState title="Admin access required" />
            ) : (
                <SettingsBoundary what="Site settings">
                    {/* useSearchParams() (the tab) needs a Suspense boundary, or the
                        Next 16 production build fails on this route. Mounted while
                        the role loads too, so one skeleton covers both waits; every
                        query inside is skipped until the role says admin. */}
                    <Suspense fallback={<SettingsSkeleton />}>
                        <SiteSettings isAdmin={isAdmin} adminId={adminId} />
                    </Suspense>
                </SettingsBoundary>
            )}
        </AdminLayout>
    )
}
