"use client"

import { useAction, useQuery } from "convex/react"
import { ChevronLeft, ChevronRight, ExternalLink, RefreshCw, Wallet } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { Button, ButtonLink, Card, Chips, Dot, EmptyState, formatMoney, Icon, List, Loading, PageHeader, Skeleton, Status } from "@/components/r1"
import { api } from "@/convex/_generated/api"
import { needsFunding } from "@/lib/payouts/fundingState"
import { WISE_ACTIVITY_URL } from "@/lib/payouts/wiseLinks"

import {
    ago,
    countsOf,
    defaultFilter,
    describeOne,
    disagreeSentence,
    errorText,
    FILTERS,
    filterOf,
    fundingSentence,
    isSyncable,
    lastCheckOf,
    ledgerSummary,
    listRows,
    oneCheckSaid,
    pageText,
    parseFilter,
    syncSaid,
    wiseOverride,
    type Checked,
    type Filter,
    type Said,
    type Withdrawal,
} from "../_lib/model"
import { MoneyFold } from "./MoneyFold"
import { PayoutDrawer } from "./PayoutDrawer"
import { PayoutHead, PayoutRow, PayoutSkeletonRow } from "./Rows"
import { TellCreatorDialog } from "./TellCreatorDialog"

/** Admin tables show 8–10 rows a page. */
const PAGE_SIZE = 10

const TITLE = "Payouts"
const SUB = "Which creator payouts need me?"

/** The status line's figures: the board's 15px ink line. */
const LINE = "text-[15px] leading-[22px] text-r1-ink"

/** The clock for "checked 12m ago" and "the last 7 days", read on mount and then twice a minute, never during render. */
function useNow(stepMs = 30_000): number {
    const [now, setNow] = useState(() => Date.now())
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), stepMs)
        return () => clearInterval(t)
    }, [stepMs])
    return now
}

function say(s: Said) {
    if (s.kind === "success") toast.success(s.text)
    else if (s.kind === "error") toast.error(s.text)
    else toast(s.text)
}

/** The filter that shows these rows: theirs when they share one, else All. */
function filterForRows(rows: Withdrawal[]): Filter {
    const keys = new Set(rows.map(filterOf))
    return keys.size === 1 ? [...keys][0] : "all"
}

function emptyFor(filter: Filter, rows: Withdrawal[], disagreeing: Withdrawal[], now: number): { title: string; body: string; action?: { label: string; filter: Filter } } {
    if (rows.length === 0) {
        return { title: "No withdrawals yet", body: "When a creator withdraws from their Wallet, it shows up here." }
    }
    if (filter === "failed") {
        return { title: "No failed payouts", body: "Every withdrawal has been paid out or is still with Wise.", action: { label: "Show all", filter: "all" } }
    }
    if (filter === "processing") {
        return { title: "Nothing in flight", body: "No withdrawal is waiting on Wise right now.", action: { label: "Show all", filter: "all" } }
    }
    if (filter === "completed" && disagreeing.length > 0) {
        // The board's empty state: the ledger has paid some, Wise has not confirmed them.
        const target = filterForRows(disagreeing)
        const one = describeOne(disagreeing[0], now)
        return {
            title: "Wise hasn’t confirmed a payout yet",
            body:
                disagreeing.length === 1
                    ? `${one.charAt(0).toUpperCase()}${one.slice(1)} is marked paid in our ledger, but Wise has not sent it. It lands here once Wise says the money went out.`
                    : `${disagreeing.length} withdrawals are marked paid in our ledger, but Wise has not sent them. They land here once Wise says the money went out.`,
            action: { label: `Show ${FILTERS.find((f) => f.key === target)?.label ?? "all"}`, filter: target },
        }
    }
    if (filter === "completed") {
        return { title: "Nothing paid out yet", body: "A withdrawal lands here once Wise has sent the money.", action: { label: "Show all", filter: "all" } }
    }
    return { title: "No withdrawals yet", body: "When a creator withdraws from their Wallet, it shows up here." }
}

/** The page's own header, also shown while loading and above an error. */
export function PayoutsHeader() {
    return <PageHeader title={TITLE} sub={SUB} />
}

/** Payouts while it loads: the status line, the chips and a page of rows, the same shape as the real thing. */
export function PayoutsSkeleton() {
    return (
        <>
            <PayoutsHeader />
            <Loading label="Loading payouts" className="flex flex-col gap-6 lg:gap-8">
                <Skeleton width={340} height={16} className="max-w-full" />
                <div className="flex flex-col gap-4">
                    <div className="t-chips">
                        {[76, 116, 96, 56].map((width, i) => (
                            <Skeleton key={i} width={width} height={32} round className="flex-none" />
                        ))}
                    </div>
                    <div className="t-card overflow-hidden" aria-hidden="true">
                        <PayoutHead />
                        {Array.from({ length: 8 }, (_, i) => (
                            <PayoutSkeletonRow key={i} />
                        ))}
                    </div>
                    <Skeleton width={260} height={12} className="max-w-full" />
                </div>
            </Loading>
        </>
    )
}

/**
 * The screen: header with the Wise sync, the status line, the filter chips,
 * a table page of ten, the payout drawer, and the money fold. page.tsx mounts
 * it for an admin (and while the role loads, when it shows its skeleton),
 * inside a Suspense boundary (useSearchParams) and an error boundary (the
 * queries can throw).
 *
 * THE URL CARRIES THE FILTER AND THE DRAWER: `?status=` (failed, processing,
 * completed, all) and `?open=<withdrawal id>`, so a link, a refresh and Back
 * show what the URL says. The Audit log's payout events link here with
 * ?open=<id>; /admin/withdrawals redirects here with ?status=all (and any
 * ?open= it was given). Clicks update local state at once and then write the
 * URL with router.replace(…, { scroll: false }): replace, not push, because a
 * filter or a drawer is not a page. When the URL moves on its own (Back,
 * Forward, a link), the state follows it.
 */
export function Payouts({ adminId }: { adminId: string | null }) {
    const router = useRouter()
    const searchParams = useSearchParams()

    // Single source of truth: every withdrawal, every status, newest first.
    const withdrawals = useQuery(api.withdrawals.getAll, adminId ? {} : "skip")

    // On-demand Wise poll. wiseDetailedState is otherwise only written by the
    // hourly cron, so without this an admin who funds a transfer and comes
    // straight back sees the same "waiting for funding" note and concludes the
    // payment failed — the one conclusion that ends in paying a creator twice.
    const refreshFromWise = useAction(api.withdrawals.refreshFromWise)
    const now = useNow()

    const urlFilter = parseFilter(searchParams.get("status"))
    const urlOpen = searchParams.get("open") || null

    const [filter, setFilter] = useState<Filter | null>(urlFilter)
    const [openId, setOpenId] = useState<string | null>(urlOpen)
    const [page, setPage] = useState(1)
    const [checking, setChecking] = useState(false)
    const [tellId, setTellId] = useState<string | null>(null)
    const tableRef = useRef<HTMLDivElement>(null)

    // Follow the URL when it moves on its own. Our own router.replace lands
    // here too once it commits, but by then the state already matches it.
    const [seenUrl, setSeenUrl] = useState({ filter: urlFilter, open: urlOpen })
    if (seenUrl.filter !== urlFilter || seenUrl.open !== urlOpen) {
        setSeenUrl({ filter: urlFilter, open: urlOpen })
        if (seenUrl.filter !== urlFilter && urlFilter !== null && urlFilter !== filter) {
            setFilter(urlFilter)
            setPage(1)
        }
        if (seenUrl.open !== urlOpen && urlOpen !== openId) setOpenId(urlOpen)
    }

    const rows = useMemo(() => withdrawals ?? [], [withdrawals])

    // First load, once the rows are in. The filter is the URL's, else the
    // filter of the withdrawal the URL opens (the Audit log links here with
    // ?open=<id> alone), else the default; and it is kept, so a payout failing
    // while the admin reads All does not swap the list under them. A linked
    // withdrawal also gets its page, so its row is in view behind the drawer.
    const [placed, setPlaced] = useState(false)
    if (!placed && withdrawals !== undefined) {
        setPlaced(true)
        const target = urlOpen ? rows.find((w) => w._id === urlOpen) : undefined
        const first = filter ?? (target ? filterOf(target) : defaultFilter(rows))
        if (first !== filter) setFilter(first)
        const at = target ? listRows(rows, first).findIndex((w) => w._id === target._id) : -1
        if (at >= PAGE_SIZE) setPage(Math.floor(at / PAGE_SIZE) + 1)
    }
    const active: Filter = filter ?? "failed"

    const counts = useMemo(() => countsOf(rows), [rows])
    const listed = useMemo(() => listRows(rows, active), [rows, active])
    // Derived locally from the one query: no extra round-trip.
    const ledger = useMemo(() => ledgerSummary(rows, now), [rows, now])
    // The work queue: every creator whose money is sitting unreleased in Wise.
    // Oldest first — the person who has waited longest gets paid first.
    const funding = useMemo(() => rows.filter(needsFunding).sort((a, b) => a.createdAt - b.createdAt), [rows])
    const disagreeing = useMemo(() => rows.filter((w) => wiseOverride(w) !== null), [rows])
    const syncable = useMemo(() => rows.filter(isSyncable), [rows])

    /** Rewrite the query string in place; any other parameter on it is kept. */
    const replaceParams = (edit: (sp: URLSearchParams) => void) => {
        const sp = new URLSearchParams(searchParams.toString())
        edit(sp)
        const q = sp.toString()
        router.replace(q ? `/admin/payouts?${q}` : "/admin/payouts", { scroll: false })
    }

    const changeFilter = (next: Filter) => {
        setFilter(next)
        setPage(1)
        replaceParams((sp) => sp.set("status", next))
    }
    const openRow = (id: string) => {
        setOpenId(id)
        replaceParams((sp) => sp.set("open", id))
    }
    const closeDrawer = () => {
        setOpenId(null)
        setTellId(null)
        replaceParams((sp) => sp.delete("open"))
    }

    const goToPage = (next: number) => {
        setPage(next)
        // Paging from the foot of a long phone list: bring the top of the table back into view.
        const table = tableRef.current
        if (table && table.getBoundingClientRect().top < 0) table.scrollIntoView({ block: "start" })
    }

    const check = async (targets: Withdrawal[], scope: "sync" | "one") => {
        if (!adminId) return
        if (targets.length === 0) {
            // Say so rather than doing nothing. A button that appears to ignore
            // the click is indistinguishable from one that is broken.
            toast("Nothing in flight to check. Every transfer is settled.")
            return
        }
        setChecking(true)
        try {
            const results: Checked[] = await Promise.all(
                targets.map((w) =>
                    refreshFromWise({ withdrawalId: w._id, adminId })
                        .then((r) => ({ r, error: null }))
                        .catch((e: unknown) => ({ r: null, error: errorText(e, "Wise lookup failed") })),
                ),
            )
            // The reactive query re-renders the rows by itself; the toast only
            // says what the check found, including "nothing changed", which is
            // the answer an admin most needs to trust the list.
            say(scope === "one" ? oneCheckSaid(results[0]) : syncSaid(results))
        } finally {
            setChecking(false)
        }
    }

    if (withdrawals === undefined) return <PayoutsSkeleton />

    const totalPages = Math.max(1, Math.ceil(listed.length / PAGE_SIZE))
    // The list also shrinks on its own (a payout settling over the Convex
    // subscription). safePage keeps the render honest; the state follows it so
    // a later growth does not jump the admin back to a page that was gone.
    if (page > totalPages) setPage(totalPages)
    const safePage = Math.min(page, totalPages)
    const start = (safePage - 1) * PAGE_SIZE
    const shown = listed.slice(start, start + PAGE_SIZE)

    // The drawer shows any withdrawal the URL names, whatever filter is on; one
    // that does not exist (a bad link) simply opens nothing.
    const opened = openId ? (rows.find((w) => w._id === openId) ?? null) : null
    const tellRow = tellId ? (rows.find((w) => w._id === tellId) ?? null) : null

    const lastSynced = lastCheckOf(rows)
    const empty = emptyFor(active, rows, disagreeing, now)
    const emptyAction = empty.action

    return (
        <>
            {/* The always-available Wise sync lives in the header, not beside the
                funding note: that note only shows while something needs funding,
                so a sync button there vanished the moment the queue emptied, and
                could only ever refresh rows that needed funding, never an
                in-flight transfer an admin wants to check for completion.
                Reconciling with Wise is a thing you do at any time. */}
            <PageHeader
                title={TITLE}
                sub={SUB}
                actions={
                    <>
                        <span className="t-meta">{lastSynced ? `Last synced ${ago(lastSynced, now)}` : "Not synced with Wise yet"}</span>
                        <Button onClick={() => check(syncable, "sync")} disabled={checking} aria-busy={checking}>
                            <Icon icon={RefreshCw} className={checking ? "motion-safe:animate-spin" : undefined} />
                            {checking ? "Checking Wise…" : "Sync with Wise"}
                        </Button>
                    </>
                }
            />

            <section aria-label="Payout status" className="flex flex-col gap-2.5">
                {/* Our ledger's count, as the board says it. */}
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Status tone="bad" className={LINE}>
                        {ledger.failed} failed
                    </Status>
                    <span className="text-r1-ink-4" aria-hidden="true">
                        ·
                    </span>
                    <Status tone="progress" className={LINE}>
                        {ledger.inFlight} in flight
                    </Status>
                    <span className="text-r1-ink-4" aria-hidden="true">
                        ·
                    </span>
                    <Status tone="done" className={LINE}>
                        {formatMoney(ledger.paidTotal)} paid out all-time
                    </Status>
                </p>
                {disagreeing.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <p className="t-meta min-w-0 flex-[1_1_320px]">Our ledger’s count. {disagreeSentence(disagreeing, now)}</p>
                        <Button size="sm" onClick={() => changeFilter(filterForRows(disagreeing))}>
                            {disagreeing.length === 1 ? "Show it" : "Show them"}
                        </Button>
                    </div>
                )}
                {/* The old "waiting for you to release in Wise" banner, as one line.
                    Without it the only signal was a status that read as "already
                    handling it". */}
                {funding.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <p className="t-meta flex min-w-0 flex-[1_1_320px] items-start gap-2">
                            <Dot tone="attn" className="mt-[5px]" />
                            <span className="min-w-0">{fundingSentence(funding)}</span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Button size="sm" onClick={() => changeFilter("processing")}>
                                {funding.length === 1 ? "Show it" : "Show them"}
                            </Button>
                            <ButtonLink size="sm" href={WISE_ACTIVITY_URL} target="_blank" rel="noopener noreferrer">
                                Open Wise
                                <Icon icon={ExternalLink} />
                            </ButtonLink>
                        </div>
                    </div>
                )}
            </section>

            <section aria-label="Withdrawals" className="flex flex-col gap-4">
                <Chips
                    label="Filter by status"
                    options={FILTERS.map((f) => ({
                        value: f.key,
                        label: (
                            <>
                                <Dot tone={f.tone} />
                                {f.label}
                            </>
                        ),
                        count: counts[f.key],
                    }))}
                    value={active}
                    onChange={changeFilter}
                />

                <Card ref={tableRef} className="scroll-mt-20 overflow-hidden">
                    <PayoutHead />
                    {listed.length > 0 ? (
                        <List>
                            {shown.map((w) => (
                                <PayoutRow key={w._id} w={w} now={now} selected={w._id === openId} onOpen={() => openRow(w._id)} />
                            ))}
                        </List>
                    ) : (
                        <EmptyState
                            icon={<Icon icon={Wallet} size={18} />}
                            title={empty.title}
                            body={empty.body}
                            action={emptyAction && <Button onClick={() => changeFilter(emptyAction.filter)}>{emptyAction.label}</Button>}
                        />
                    )}
                </Card>

                <div className="flex min-h-8 flex-wrap items-center justify-between gap-3">
                    <p className="t-meta t-num" aria-live="polite">
                        {pageText(active, { start: start + 1, end: start + shown.length, page: safePage, pages: totalPages }, listed.length, rows.length)}
                    </p>
                    {totalPages > 1 && (
                        <div className="flex gap-2">
                            <Button size="sm" icon aria-label="Previous page" disabled={safePage <= 1} onClick={() => goToPage(safePage - 1)}>
                                <Icon icon={ChevronLeft} />
                            </Button>
                            <Button size="sm" icon aria-label="Next page" disabled={safePage >= totalPages} onClick={() => goToPage(safePage + 1)}>
                                <Icon icon={ChevronRight} />
                            </Button>
                        </div>
                    )}
                </div>
            </section>

            <MoneyFold adminId={adminId} rows={rows} now={now} />

            <PayoutDrawer
                row={opened}
                now={now}
                checking={checking}
                onCheck={(w) => check([w], "one")}
                onClose={closeDrawer}
                onTell={(w) => setTellId(w._id)}
            />
            <TellCreatorDialog row={tellRow} adminId={adminId} onClose={() => setTellId(null)} />
        </>
    )
}
