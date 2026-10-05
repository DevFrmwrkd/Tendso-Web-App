"use client"

import { useMutation, useQuery } from "convex/react"
import { ChevronLeft, ChevronRight, Inbox, Trash2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { Button, Card, ConfirmDialog, EmptyState, Icon, List, Tabs } from "@/components/r1"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"

import {
    businessName,
    DEFAULT_TAB,
    defaultSortFor,
    emptyCopy,
    listRows,
    pageText,
    parseTab,
    SORT_OPTIONS,
    STATUS_TABS,
    tabCounts,
    type QueueRow,
    type SortKey,
    type TabKey,
} from "./model"
import { QueueDrawer } from "./QueueDrawer"
import { QueueHead, QueueRowButton, QueueSkeleton } from "./Rows"
import { QueueSearch, SortMenu } from "./Toolbar"

/** A list page shows one table page of about ten rows (admin tables: 8–10 a page). */
const PAGE_SIZE = 10

/** The clock for "waiting N days", read once and then once a minute, never during render. */
function useNow(stepMs = 60_000): number {
    const [now, setNow] = useState(() => Date.now())
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), stepMs)
        return () => clearInterval(t)
    }, [stepMs])
    return now
}

/**
 * The queue itself: status tabs with counts, search, two filter chips, sort,
 * a table page of ten, and the details drawer. page.tsx mounts it while the
 * role loads and for an admin (anyone else gets "Admin access required"),
 * inside a Suspense boundary (useSearchParams) and an error boundary (the
 * query can throw).
 *
 * THE URL CARRIES THE TAB AND THE DRAWER: `?status=<tab>` (absent means Needs
 * review) and `?open=<submission id>`, so a link, a refresh and Back show
 * what the URL says. Clicks update local state at once and then write the
 * URL with router.replace(…, { scroll: false }); replace, not push, because a
 * tab or a drawer is not a page and Back should leave the queue. When the
 * URL changes on its own (Back, Forward, a link followed while the page is
 * open), the state follows it. Search, chips, sort and page stay local, as
 * they always were.
 */
export function Queue({ isAdmin }: { isAdmin: boolean }) {
    const router = useRouter()
    const searchParams = useSearchParams()

    // The raw query, not useSubmissions(): the hook flattens every row to eight
    // snake_case keys and drops the money, domain and owner-intake fields this
    // page shows. Convex shares one subscription per query+args, so reading the
    // same query the hook reads costs nothing extra.
    const submissions = useQuery(api.submissions.getAllWithCreator, isAdmin ? {} : "skip")
    const updateStatus = useMutation(api.submissions.updateStatus)
    const now = useNow()

    // ?status= makes the queue deep-linkable — the dashboard's "needs your
    // attention" banner links straight into the review tab.
    const urlTab = parseTab(searchParams.get("status"))
    const urlOpen = searchParams.get("open") || null

    const [tab, setTab] = useState<TabKey>(urlTab)
    const [sort, setSort] = useState<SortKey>(() => defaultSortFor(urlTab))
    const [openId, setOpenId] = useState<string | null>(urlOpen)
    const [query, setQuery] = useState("")
    const [domainOnly, setDomainOnly] = useState(false)
    const [ownerOnly, setOwnerOnly] = useState(false)
    const [page, setPage] = useState(1)

    // Delete: the API route cascades to Cloudflare Pages, Airtable, R2 and the
    // Convex records, so the confirmation names the business.
    const [confirm, setConfirm] = useState<{ id: Id<"submissions">; name: string } | null>(null)
    const [deleting, setDeleting] = useState(false)

    const tableRef = useRef<HTMLDivElement>(null)

    // Follow the URL when it moves on its own. Our own router.replace lands
    // here too once it commits, but by then the state already matches it.
    const [seenUrl, setSeenUrl] = useState({ tab: urlTab, open: urlOpen })
    if (seenUrl.tab !== urlTab || seenUrl.open !== urlOpen) {
        setSeenUrl({ tab: urlTab, open: urlOpen })
        if (seenUrl.tab !== urlTab && urlTab !== tab) {
            setTab(urlTab)
            setSort(defaultSortFor(urlTab))
            setPage(1)
        }
        if (seenUrl.open !== urlOpen && urlOpen !== openId) setOpenId(urlOpen)
    }

    const rows = useMemo(() => submissions ?? [], [submissions])
    const counts = useMemo(() => tabCounts(rows), [rows])
    const listed = useMemo(
        () => listRows(rows, { tab, query, domainOnly, ownerOnly, sort }),
        [rows, tab, query, domainOnly, ownerOnly, sort],
    )

    /** The URL for a tab and an open drawer; any other parameter on it is kept. */
    const writeUrl = (next: { tab: TabKey; open: string | null }) => {
        const sp = new URLSearchParams(searchParams.toString())
        if (next.tab === DEFAULT_TAB) sp.delete("status")
        else sp.set("status", next.tab)
        if (next.open) sp.set("open", next.open)
        else sp.delete("open")
        const q = sp.toString()
        router.replace(q ? `/admin/submissions?${q}` : "/admin/submissions", { scroll: false })
    }

    // Changing what is being listed starts you at the top of it. A tab also
    // brings its own order: Needs review oldest first, the rest newest first.
    const changeTab = (next: TabKey) => {
        setTab(next)
        setSort(defaultSortFor(next))
        setPage(1)
        writeUrl({ tab: next, open: openId })
    }
    const changeQuery = (value: string) => {
        setQuery(value)
        setPage(1)
    }
    const changeSort = (next: SortKey) => {
        setSort(next)
        setPage(1)
    }

    const openRow = (id: string) => {
        setOpenId(id)
        writeUrl({ tab, open: id })
    }
    const closeDrawer = () => {
        setOpenId(null)
        writeUrl({ tab, open: null })
    }

    const goToPage = (next: number) => {
        setPage(next)
        // Paging from the foot of a long phone list: bring the top of the table back into view.
        const table = tableRef.current
        if (table && table.getBoundingClientRect().top < 0) table.scrollIntoView({ block: "start" })
    }

    const markInReview = async (row: QueueRow) => {
        const name = businessName(row)
        try {
            await updateStatus({ id: row._id, status: "in_review" })
            toast.success(`${name} marked in review`)
        } catch {
            toast.error(`Could not mark ${name} in review. Try again.`)
        }
    }

    const handleDelete = async () => {
        if (!confirm) return
        const { id, name } = confirm
        setDeleting(true)
        try {
            const response = await fetch("/api/delete-submission", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ submissionId: id }),
            })
            const data = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(data?.error || "Failed to delete submission")
            // The route returns success even when Cloudflare/Airtable/R2 cleanup
            // partly failed. Say so — a silent success leaves orphaned assets
            // nobody knows to go clean up. That toast stays until it is dismissed.
            const failed: { asset: string; error?: string }[] = data?.failedAssets ?? []
            if (failed.length) {
                toast.warning(`${name} deleted, but these need manual cleanup`, {
                    description: failed.map((f) => (f.error ? `${f.asset} (${f.error})` : f.asset)).join("; "),
                    duration: Infinity,
                    action: { label: "Dismiss", onClick: () => {} },
                })
            } else {
                toast.success(`${name} deleted`)
            }
            if (openId === id) closeDrawer()
        } catch (error) {
            // The drawer stays open on a failure, so the admin can try again from it.
            const message = error instanceof Error ? error.message : ""
            toast.error(message || "Failed to delete submission.")
        } finally {
            setDeleting(false)
            setConfirm(null)
        }
    }

    if (submissions === undefined) return <QueueSkeleton />

    const totalPages = Math.max(1, Math.ceil(listed.length / PAGE_SIZE))
    // The list also shrinks on its own — a delete, or another admin's edit
    // arriving over the Convex subscription. `safePage` keeps the render honest,
    // but the state has to follow it: left stale at 3 while only 2 pages exist,
    // it would silently jump the admin back to page 3 the moment a new
    // submission pushed the count over the line again.
    if (page > totalPages) setPage(totalPages)
    const safePage = Math.min(page, totalPages)
    const start = (safePage - 1) * PAGE_SIZE
    const shown = listed.slice(start, start + PAGE_SIZE)

    // The drawer shows any submission the URL names, whatever tab is open; one
    // that no longer exists (deleted, or a bad link) simply opens nothing.
    const opened = openId ? (rows.find((s) => s._id === openId) ?? null) : null

    const empty = emptyCopy(tab, query, domainOnly || ownerOnly)
    const runEmptyAction = () => {
        if (empty.next.kind === "tab") {
            changeTab(empty.next.tab)
            return
        }
        setQuery("")
        setDomainOnly(false)
        setOwnerOnly(false)
        setPage(1)
    }

    const hint =
        tab === "review" && sort === "oldest" && listed.length > 0
            ? "Oldest first: the top row has waited longest, so start there."
            : null

    return (
        <>
            <Tabs
                label="Status"
                tabs={STATUS_TABS.map((t) => ({ value: t.key, label: t.label, count: counts[t.key] }))}
                value={tab}
                onChange={changeTab}
            >
                <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <QueueSearch
                            value={query}
                            onChange={changeQuery}
                            placeholder="Search business, owner, creator or city"
                            className="w-full lg:w-[380px]"
                        />
                        <button
                            type="button"
                            className="t-chip"
                            aria-pressed={domainOnly}
                            onClick={() => {
                                setDomainOnly((v) => !v)
                                setPage(1)
                            }}
                        >
                            Custom domain
                        </button>
                        <button
                            type="button"
                            className="t-chip"
                            aria-pressed={ownerOnly}
                            onClick={() => {
                                setOwnerOnly((v) => !v)
                                setPage(1)
                            }}
                        >
                            Owner-submitted
                        </button>
                        <SortMenu options={SORT_OPTIONS} value={sort} onChange={changeSort} className="ml-auto" />
                    </div>

                    {hint && <p className="t-meta">{hint}</p>}

                    <Card ref={tableRef} className="scroll-mt-20 overflow-hidden">
                        <QueueHead />
                        {listed.length > 0 ? (
                            <>
                                <List>
                                    {shown.map((row) => (
                                        <QueueRowButton
                                            key={row._id}
                                            row={row}
                                            now={now}
                                            selected={row._id === openId}
                                            onOpen={() => openRow(row._id)}
                                        />
                                    ))}
                                </List>
                                <div className="flex h-14 items-center justify-between gap-4 border-t border-r1-line-3 px-4">
                                    <span className="t-meta t-num" aria-live="polite">
                                        {pageText(start + 1, start + shown.length, listed.length, safePage, totalPages)}
                                    </span>
                                    <div className="flex gap-2">
                                        <Button icon aria-label="Previous page" disabled={safePage <= 1} onClick={() => goToPage(safePage - 1)}>
                                            <Icon icon={ChevronLeft} />
                                        </Button>
                                        <Button icon aria-label="Next page" disabled={safePage >= totalPages} onClick={() => goToPage(safePage + 1)}>
                                            <Icon icon={ChevronRight} />
                                        </Button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <EmptyState
                                icon={<Icon icon={Inbox} size={18} />}
                                title={empty.title}
                                body={empty.body}
                                action={<Button onClick={runEmptyAction}>{empty.action}</Button>}
                            />
                        )}
                    </Card>
                </div>
            </Tabs>

            <QueueDrawer
                row={opened}
                now={now}
                onClose={closeDrawer}
                onMarkInReview={markInReview}
                onDelete={(row) => setConfirm({ id: row._id, name: businessName(row) })}
            />

            <ConfirmDialog
                open={confirm !== null}
                onCancel={() => setConfirm(null)}
                onConfirm={handleDelete}
                title={`Delete ${confirm?.name ?? "this submission"}?`}
                cancelLabel="Cancel"
                confirmLabel={deleting ? "Deleting…" : "Delete permanently"}
                confirmIcon={<Icon icon={Trash2} />}
                busy={deleting}
            >
                <p>This removes it for good. It cannot be undone.</p>
                <ul className="flex list-disc flex-col gap-1.5 pl-[18px]">
                    <li>The submission record</li>
                    <li>The generated website and its content</li>
                    <li>All photos, audio and video</li>
                    <li>The Cloudflare Pages deployment and Airtable record</li>
                </ul>
            </ConfirmDialog>
        </>
    )
}
