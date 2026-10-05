"use client"

import { useQuery } from "convex/react"
import { Check, ChevronDown, User } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

import { Button, Chips, cx, EmptyState, Icon, List, Loading, MoreMenu, RowButton, RowChevron, SearchInput, Skeleton, SkeletonRows } from "@/components/r1"
import { api } from "@/convex/_generated/api"

import { ActorBadge } from "./ActorBadge"
import { AuditDrawer } from "./AuditDrawer"
import { CHIPS, dayHeading, dayKey, describe, exactTime, shortWhen, sinceText, type ChipKey, type EventView } from "./model"

/** The window the page has always read: the 200 most recent events. "Load older" asks for 200 more once it is used up. */
const WINDOW = 200
/** Rows shown per step (admin tables: 8–10 a page). */
const PAGE = 10

/** The clock for "2h ago", read once and then once a minute, never during render. */
function useNow(stepMs = 60_000): number {
    const [now, setNow] = useState(() => Date.now())
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), stepMs)
        return () => clearInterval(t)
    }, [stepMs])
    return now
}

type Person = { key: string; label: string; hint: string | null }

/**
 * The audit log (board Audit): "Who changed what?"
 *
 * READING. The query is the one this page always made, auditLogs.getRecent,
 * skipped until the role says admin, over the 200 most recent events. The
 * chips, the person menu and the search filter that window on this side,
 * as the old tabs did (the backend has no filtered or counted query). The
 * list shows ten matches at a time, grouped by day; "Load older" shows ten
 * more, and once the window is used up it asks the server for 200 more.
 * While a bigger window loads, the rows already on screen stay.
 *
 * A row opens the event in the drawer. The drawer is in the URL
 * (`?open=<event id>`, router.replace: a drawer is not a page), so an event
 * can be linked to while it is inside the loaded window.
 */
export function AuditLog({ isAdmin }: { isAdmin: boolean }) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const now = useNow()

    const [limit, setLimit] = useState(WINDOW)
    const fresh = useQuery(api.auditLogs.getRecent, isAdmin ? { limit } : "skip")
    // Keep the last window on screen while a bigger one loads (the query
    // reads as undefined between the two). Convex hands back the same object
    // until the result changes, so this settles after one pass.
    const [kept, setKept] = useState<{ logs: NonNullable<typeof fresh>; limit: number } | null>(null)
    if (fresh !== undefined && kept?.logs !== fresh) setKept({ logs: fresh, limit })
    const logs = fresh ?? kept?.logs
    const loadedLimit = fresh !== undefined ? limit : (kept?.limit ?? limit)
    const loadingMore = fresh === undefined && kept !== null

    // Payout events store the amount and the withdrawal id, not the creator.
    // withdrawals.getAll has the name; it is read only while the window holds
    // a payout event.
    const hasPayouts = !!logs?.some((l) => l.targetType === "withdrawal")
    const withdrawals = useQuery(api.withdrawals.getAll, isAdmin && hasPayouts ? {} : "skip")
    const payoutNames = useMemo(() => {
        const names = new Map<string, string>()
        for (const w of withdrawals ?? []) {
            // getAll writes "First Last", or "Unknown" without a profile.
            const name = (w.creatorName ?? "").replace(/\bundefined\b/g, "").trim()
            if (name && name !== "Unknown") names.set(String(w._id), name)
        }
        return names
    }, [withdrawals])

    const views = useMemo(() => (logs ?? []).map((l) => describe(l, (id) => payoutNames.get(id) ?? null)), [logs, payoutNames])

    // ── Filters ─────────────────────────────────────────────────────────
    const [chip, setChip] = useState<ChipKey>("all")
    const [person, setPerson] = useState("anyone")
    const [q, setQ] = useState("")
    const [shown, setShown] = useState(PAGE)

    // Changing what is filtered starts again at the top ten.
    const changeChip = (next: ChipKey) => {
        setChip(next)
        setShown(PAGE)
    }
    const changePerson = (next: string) => {
        setPerson(next)
        setShown(PAGE)
    }
    const changeQuery = (next: string) => {
        setQ(next)
        setShown(PAGE)
    }
    const clearFilters = () => {
        setChip("all")
        setPerson("anyone")
        setQ("")
        setShown(PAGE)
    }

    // The people in the window, in order of their latest event, then the
    // automations and owners, each as one entry.
    const people = useMemo<Person[]>(() => {
        const seen = new Map<string, Person>()
        for (const v of views) {
            if (seen.has(v.actor.key)) continue
            const a = v.actor
            seen.set(a.key, {
                key: a.key,
                label: a.kind === "person" ? a.name : a.kind === "system" ? "System" : "Business owners",
                hint: a.kind === "system" ? "Automatic" : null,
            })
        }
        const rank = (k: string) => (k === "system" ? 1 : k === "owner" ? 2 : 0)
        return [{ key: "anyone", label: "Anyone", hint: null }, ...[...seen.values()].sort((a, b) => rank(a.key) - rank(b.key))]
    }, [views])
    const personLabel = people.find((p) => p.key === person)?.label ?? "Anyone"

    const query = q.trim().toLowerCase()
    const matches = views.filter(
        (v) => (chip === "all" || v.chip === chip) && (person === "anyone" || v.actor.key === person) && (!query || v.haystack.includes(query)),
    )
    const visible = matches.slice(0, shown)
    const total = logs?.length ?? 0
    // Fewer rows than asked for means the window holds the whole log.
    const allLoaded = total < loadedLimit
    const canLoadOlder = matches.length > shown || !allLoaded

    const loadOlder = () => {
        if (matches.length > shown) {
            setShown((s) => s + PAGE)
        } else if (!allLoaded && !loadingMore) {
            setLimit((l) => l + WINDOW)
            setShown((s) => s + PAGE)
        }
    }

    // ── Drawer, in the URL ──────────────────────────────────────────────
    const urlOpen = searchParams.get("open") || null
    const [openId, setOpenId] = useState<string | null>(urlOpen)
    const [seenOpen, setSeenOpen] = useState(urlOpen)
    if (seenOpen !== urlOpen) {
        setSeenOpen(urlOpen)
        if (urlOpen !== openId) setOpenId(urlOpen)
    }
    const writeOpen = (id: string | null) => {
        const sp = new URLSearchParams(searchParams.toString())
        if (id) sp.set("open", id)
        else sp.delete("open")
        const qs = sp.toString()
        router.replace(qs ? `/admin/audit?${qs}` : "/admin/audit", { scroll: false })
    }
    const openEvent = (id: string) => {
        setOpenId(id)
        writeOpen(id)
    }
    const closeEvent = () => {
        setOpenId(null)
        writeOpen(null)
    }
    // An id outside the loaded window has nothing to show (there is no query for one event).
    const selected = openId ? (views.find((v) => v.id === openId) ?? null) : null

    if (logs === undefined) return <AuditSkeleton />

    // ── Lines ───────────────────────────────────────────────────────────
    const filtered = chip !== "all" || person !== "anyone" || query !== ""
    const scope = allLoaded ? `all ${total} events` : `the ${total} most recent`
    const countLine = filtered
        ? `${matches.length} ${matches.length === 1 ? "event matches" : "events match"} in ${scope}${matches.length > visible.length ? ` · showing ${visible.length}` : ""}`
        : allLoaded
          ? `Showing ${visible.length} of ${total} events · newest first`
          : `Showing ${visible.length} of the ${total} most recent events · newest first`
    const topLine = total > 0 ? `${allLoaded ? total : `${total}+`} ${total === 1 ? "event" : "events"} · last ${sinceText(logs[0].timestamp, now)}` : null

    // Ten rows, grouped by their day (the window is newest first).
    const groups: { key: string; label: string; sub: string | null; rows: EventView[] }[] = []
    for (const v of visible) {
        const key = dayKey(v.log.timestamp)
        const last = groups[groups.length - 1]
        if (last && last.key === key) last.rows.push(v)
        else groups.push({ key, ...dayHeading(v.log.timestamp, now), rows: [v] })
    }

    const loadOlderButton = canLoadOlder && (
        <button type="button" className="t-showall" onClick={loadOlder} disabled={loadingMore} aria-busy={loadingMore}>
            {loadingMore ? "Loading older events…" : "Load older"}
        </button>
    )

    return (
        <section className="flex flex-col gap-4" aria-label="Events">
            {topLine && <p className="t-meta">{topLine}</p>}

            {/* One row only from xl: the five chips, the person button and a
                280px search need about 870px, more than a 1024 screen leaves. */}
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between xl:gap-4">
                <Chips label="Type of change" options={CHIPS} value={chip} onChange={changeChip} />
                <div className="flex min-w-0 items-center gap-2">
                    {/* Opens rightwards: on a phone the button sits at the left edge. */}
                    <MoreMenu
                        label={`Who made the change: ${personLabel}`}
                        align="start"
                        className="flex-none [&>.t-menu]:min-w-[240px]"
                        trigger={(props) => (
                            <Button {...props}>
                                <Icon icon={User} />
                                <span className="max-w-[96px] truncate sm:max-w-[160px]">{personLabel}</span>
                                <Icon icon={ChevronDown} />
                            </Button>
                        )}
                        items={people.map((p) => ({
                            label: (
                                <>
                                    <span className="inline-flex w-4 flex-none">{p.key === person && <Icon icon={Check} />}</span>
                                    <span className="min-w-0 flex-1 truncate">
                                        {p.label}
                                        {p.key === person && <span className="sr-only"> (selected)</span>}
                                    </span>
                                    {p.hint && <span className="t-meta">{p.hint}</span>}
                                </>
                            ),
                            onSelect: () => changePerson(p.key),
                        }))}
                    />
                    <SearchInput
                        label="Search by business"
                        placeholder="Search by business"
                        autoComplete="off"
                        value={q}
                        onChange={(e) => changeQuery(e.target.value)}
                        className="min-w-0 flex-1 xl:w-[280px] xl:flex-none"
                    />
                </div>
            </div>

            <div className="t-card overflow-hidden">
                {total === 0 ? (
                    <EmptyState title="No events yet" body="Approvals, deployments, payments and other admin actions show up here as they happen." />
                ) : visible.length === 0 ? (
                    <>
                        <NoMatches
                            chip={chip}
                            person={person}
                            query={query}
                            allLoaded={allLoaded}
                            total={total}
                            approvals={views.filter((v) => v.chip === "approvals").length}
                            onClear={clearFilters}
                        />
                        {loadOlderButton}
                    </>
                ) : (
                    <>
                        {groups.map((g, i) => (
                            <div key={g.key}>
                                <h2
                                    className={cx(
                                        "flex h-8 items-center gap-2 border-b border-r1-line bg-r1-fill-2 px-4 text-[12px] font-medium leading-4 text-r1-ink-2",
                                        i > 0 && "border-t",
                                    )}
                                >
                                    <span>{g.label}</span>
                                    {g.sub && <span className="font-normal text-r1-ink-3">{g.sub}</span>}
                                </h2>
                                <List>
                                    {g.rows.map((v) => (
                                        <EventRow key={v.id} event={v} now={now} selected={v.id === openId} onOpen={() => openEvent(v.id)} />
                                    ))}
                                </List>
                            </div>
                        ))}
                        {loadOlderButton}
                    </>
                )}
            </div>
            {total > 0 && <p className="t-meta">{countLine}</p>}

            <AuditDrawer event={selected} now={now} onClose={closeEvent} />
        </section>
    )
}

/**
 * One event as one button. On a desk: who, the sentence, the kind and the
 * time in columns. On a phone the columns fold under the sentence (two lines
 * at most) as one meta line, so nothing scrolls sideways.
 */
function EventRow({ event, now, selected, onOpen }: { event: EventView; now: number; selected: boolean; onOpen: () => void }) {
    const ts = event.log.timestamp
    const when = shortWhen(ts, now)
    const exact = exactTime(ts)
    const iso = new Date(ts).toISOString()
    return (
        <RowButton selected={selected} onClick={onOpen} className="items-start lg:items-center">
            <ActorBadge actor={event.actor} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5 lg:flex-row lg:items-center lg:gap-4">
                <span className="line-clamp-2 min-w-0 text-[14px] leading-5 text-r1-ink-2 lg:line-clamp-1 lg:flex-1">
                    <span className="font-medium text-r1-ink">{event.actor.name}</span> {event.verb}{" "}
                    <span className="font-medium text-r1-ink">{event.target}</span>
                    {event.tail}
                </span>
                <span className="t-meta lg:hidden">
                    {event.kind} ·{" "}
                    <time dateTime={iso} title={exact}>
                        {when}
                    </time>
                </span>
                <span className="t-meta hidden w-[88px] flex-none lg:block">{event.kind}</span>
                <time className="t-meta t-num hidden w-[72px] flex-none text-right lg:block" dateTime={iso} title={exact}>
                    {when}
                </time>
            </span>
            <RowChevron />
        </RowButton>
    )
}

/** Nothing in the window matches the filters: say so, and offer the way back. */
function NoMatches({
    chip,
    person,
    query,
    allLoaded,
    total,
    approvals,
    onClear,
}: {
    chip: ChipKey
    person: string
    query: string
    allLoaded: boolean
    total: number
    approvals: number
    onClear: () => void
}) {
    // Rejections on their own get the board's kinder line: it is good news.
    if (chip === "rejections" && person === "anyone" && !query) {
        const scope = allLoaded ? "the log so far" : `the ${total} most recent events`
        return (
            <EmptyState
                title={allLoaded ? "No rejections yet" : "No rejections in the recent events"}
                body={`${approvals > 0 ? `Every review in ${scope} was an approval (${approvals} of them). ` : ""}When someone rejects a submission, it shows up here with the reason.`}
                action={<Button onClick={onClear}>Show all events</Button>}
            />
        )
    }
    return (
        <EmptyState
            title="Nothing matches"
            body={
                allLoaded
                    ? "None of these events match. Try another name or clear the filters."
                    : "None of the recent events match. Clear the filters, or load older events and try again."
            }
            action={<Button onClick={onClear}>Clear filters</Button>}
        />
    )
}

/** The meta line, the chips and a card of rows: the page's shape while the log loads. */
export function AuditSkeleton() {
    return (
        <Loading label="Loading the audit log" className="flex flex-col gap-4">
            <Skeleton width={180} height={12} />
            <div className="flex flex-wrap gap-2">
                {[44, 88, 92, 108, 84].map((w, i) => (
                    <Skeleton key={i} width={w} height={32} round />
                ))}
            </div>
            <SkeletonRows count={8} avatar />
        </Loading>
    )
}
