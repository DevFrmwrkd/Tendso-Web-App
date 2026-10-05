"use client"

import { useUser } from "@clerk/nextjs"
import { useQuery } from "convex/react"

import { EmptyState, PageHeader } from "@/components/r1"
import { api } from "@/convex/_generated/api"

import AdminLayout from "../components/AdminLayout"
import AnnouncementsScreen, { AnnouncementsSkeleton } from "./_components/AnnouncementsScreen"
import PanelBoundary from "./_components/PanelBoundary"

/**
 * Admin broadcasts (board Announcements): "What do I want creators to know?"
 * An email plus an in-app notification to an audience of creators, or to
 * people picked by name. Every query and the send are admin-gated on the
 * server (convex/announcements.ts resolves the Clerk id to a creators row with
 * role 'admin'); the role check here only decides what to draw, so a
 * non-admin sees a plain note instead of a page of failing queries.
 */
export default function AnnouncementsPage() {
    const { user, isLoaded } = useUser()
    const adminId = user?.id
    // The same row the server checks. AdminLayout subscribes to this exact
    // query, so it costs nothing extra.
    const me = useQuery(api.creators.getByClerkId, adminId ? { clerkId: adminId } : "skip")

    const header = <PageHeader title="Announcements" sub="What do I want creators to know?" />

    if (!isLoaded || (adminId && me === undefined)) {
        return (
            <AdminLayout>
                {header}
                <AnnouncementsSkeleton />
            </AdminLayout>
        )
    }

    if (!adminId || me?.role !== "admin") {
        return (
            <AdminLayout>
                {header}
                <div className="t-card">
                    <EmptyState title="Admins only" body="Announcements reach every creator, so only an admin can write and send them." />
                </div>
            </AdminLayout>
        )
    }

    return (
        <AdminLayout>
            {header}
            {/* A failing query keeps the frame and the header; only the body says so. */}
            <PanelBoundary what="Announcements">
                <AnnouncementsScreen adminId={adminId} />
            </PanelBoundary>
        </AdminLayout>
    )
}
