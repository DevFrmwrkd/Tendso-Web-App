"use client";

/**
 * /admin/leads: "Which leads are going cold?" (Round 1, board AdminLeads).
 *
 * Two tabs with counts: Customer leads (people who messaged a live site,
 * scanned its QR code, or came in directly) and Prospects (Google Maps
 * businesses a creator pulled with Find a local business; formerly the
 * standalone /admin/lead-prospects page). A row opens its details in the
 * 480px drawer, where the status, notes, edit form, delete and the lead's
 * social card live; Add lead opens the same drawer as a form.
 *
 * WHY THIS PAGE CRASHED IN PRODUCTION. The old page declared two useState
 * hooks (the add and edit forms' errors) AFTER its `if (isLoading) return`
 * and `if (!isAdmin) return`. On a fresh load (a refresh, a new tab, a link)
 * Clerk and the admin's own creator row are still loading, so the first
 * render returned early with two hooks fewer; the render after them called
 * the two extra hooks and React threw "Rendered more hooks than during the
 * previous render" (minified error #310). Arriving by a client-side click
 * from another admin page usually skipped the loading render, which is why
 * it hid. Now every hook in this file runs before the one decision below,
 * and everything the loaded page needs lives in the component it renders.
 *
 * Two quieter ways to fail are closed as well: the lists wait for Convex's
 * own auth (outscraper.listScrapedLeads throws "Not authenticated" when it
 * runs before Clerk's token reaches Convex), and they are read through
 * useQueries, so a failing list shows the kit's error state in its own tab
 * while the other tab keeps working. A render error is caught by
 * LeadsBoundary inside the admin frame instead of blanking the page.
 */
import { useConvexAuth } from "convex/react";
import type { ReactNode } from "react";

import { EmptyState, Loading, PageHeader, Skeleton, SkeletonRows } from "@/components/r1";
import { useAdminAuth } from "@/hooks/useAdmin";

import AdminLayout from "../components/AdminLayout";
import { LeadsBoundary } from "./_components/LeadsBoundary";
import { LeadsWorkspace } from "./_components/LeadsWorkspace";
import { PAGE_SUB, PAGE_TITLE } from "./_components/leadUtils";

export default function AdminLeadsPage() {
    // useAdminAuth keeps its redirects: signed out → /login, no profile → /onboarding.
    const { isAdmin, loading, creator } = useAdminAuth();
    const convexAuth = useConvexAuth();

    // The same <AdminLayout> element in every branch, so the frame stays
    // mounted when the content arrives instead of being built twice.
    let body: ReactNode;
    if (loading || (isAdmin && convexAuth.isLoading)) {
        body = <LeadsLoading />;
    } else if (!isAdmin) {
        body = (
            <>
                <PageHeader title={PAGE_TITLE} sub={PAGE_SUB} />
                <EmptyState title="Admin access required" body="Leads are for admins. Ask an admin if you need access." />
            </>
        );
    } else {
        body = (
            <LeadsBoundary what="Leads" withHeader>
                <LeadsWorkspace meId={creator?._id ?? null} />
            </LeadsBoundary>
        );
    }

    return <AdminLayout>{body}</AdminLayout>;
}

/** The page's own shape while Clerk and the admin's row load: header, tabs, the gold card, rows. */
function LeadsLoading() {
    return (
        <>
            <PageHeader title={PAGE_TITLE} sub={PAGE_SUB} />
            <Loading label="Loading leads" className="flex flex-col gap-5">
                <div className="flex gap-6">
                    {[136, 96].map((w) => (
                        <Skeleton key={w} width={w} height={20} />
                    ))}
                </div>
                <Skeleton height={52} className="w-full" />
                <SkeletonRows count={6} />
            </Loading>
        </>
    );
}
