"use client"

import { Suspense } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { ButtonLink, Loading, PageHeader, Skeleton, Tabs } from "@/components/r1"
import { useAdminAuth } from "@/hooks/useAdmin"
import { useCallSchedule } from "@/hooks/useCallSchedule"

import AdminLayout from "../components/AdminLayout"
import PanelBoundary from "../_components/PanelBoundary"
import CallsTab, { CallsTabShapes } from "./_components/CallsTab"
import StatsTab from "./_components/StatsTab"

/**
 * Calls (board Calls): "Who is calling today, and did they show?" The admin
 * and staff side of /field-agent/book, the 10-minute Field Agent call. Events
 * live on the tendso.hr Google Calendar.
 *
 * TWO TABS. Calls is the day's work: today's calls with their Join and their
 * outcome, the finished calls nobody has marked, what is booked later, the
 * archive and the bookable hours. Stats is what used to be /admin/call-stats
 * (that route now redirects here with ?tab=stats). The tab lives in the URL so
 * the redirect, a bookmark or a shared link land on it; switching tabs
 * replaces the URL rather than stacking history.
 *
 * WHO SEES WHAT. Admins and the internal staff role both reach this page, and
 * the server enforces every check independently — this only hides controls.
 * Staff see and answer the calls and may edit the bookable hours (they sit the
 * calls, so the hours are their own availability); the calendar Sync stays
 * admin-only.
 */
export default function CallsPage() {
    // useSearchParams needs a Suspense boundary above it, or the Next build
    // fails on this route.
    return (
        <Suspense fallback={<CallsFallback />}>
            <Calls />
        </Suspense>
    )
}

type Tab = "calls" | "stats"

function Calls() {
    const { isAdmin, loading: authLoading, creator } = useAdminAuth()
    const isStaff = creator?.role === "staff"
    const canView = isAdmin || isStaff

    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    const tab: Tab = searchParams.get("tab") === "stats" ? "stats" : "calls"

    const setTab = (next: Tab) => {
        const params = new URLSearchParams(searchParams.toString())
        if (next === "stats") params.set("tab", "stats")
        else params.delete("tab")
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }

    if (authLoading) return <CallsFallback />
    if (!canView) return null

    return (
        <AdminLayout>
            <PageHeader
                title="Calls"
                sub="Who is calling today, and did they show?"
                actions={<ButtonLink href="/field-agent/book">See the booking page</ButtonLink>}
            />
            {/* A failing query keeps the frame and the header; only the body says so. */}
            <PanelBoundary what="Calls">
                <CallsBody tab={tab} setTab={setTab} isAdmin={isAdmin} />
            </PanelBoundary>
        </AdminLayout>
    )
}

/** The tabs and the open tab. Only ever mounted for an admin or staff account. */
function CallsBody({ tab, setTab, isAdmin }: { tab: Tab; setTab: (next: Tab) => void; isAdmin: boolean }) {
    // Merged with the calendar by the same hook the staff Today uses, so the
    // two views can never disagree about what is booked. Read here, above the
    // tabs, because the Calls tab's count is the number booked.
    const schedule = useCallSchedule(true)

    return (
        <Tabs
            label="Calls views"
            value={tab}
            onChange={setTab}
            tabs={[
                {
                    value: "calls",
                    label: (
                        <>
                            Calls
                            {!schedule.loading && <span className="t-count">{schedule.upcoming.length} booked</span>}
                        </>
                    ),
                },
                { value: "stats", label: "Stats" },
            ]}
        >
            <div className="pt-2 lg:pt-4">
                {/* Keyed by tab, so a failure in one tab clears when the other is opened. */}
                <PanelBoundary key={tab} what={tab === "stats" ? "Call stats" : "Calls"}>
                    {tab === "calls" ? (
                        <CallsTab schedule={schedule} isAdmin={isAdmin} />
                    ) : (
                        // Mounted only while open, so the stats rows are never read for the Calls tab.
                        <StatsTab onMarkCalls={() => setTab("calls")} />
                    )}
                </PanelBoundary>
            </div>
        </Tabs>
    )
}

/** The page in shape while the auth check (or the URL) is not ready yet. */
function CallsFallback() {
    return (
        <AdminLayout>
            <Loading label="Loading calls" className="flex flex-col gap-6 lg:gap-8">
                <div className="flex flex-col gap-3" aria-hidden="true">
                    <Skeleton width={120} height={36} />
                    <Skeleton width={260} height={16} />
                </div>
                <Skeleton height={40} />
                <CallsTabShapes />
            </Loading>
        </AdminLayout>
    )
}
