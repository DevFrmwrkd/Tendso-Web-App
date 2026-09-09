"use client"

import { useEffect, useState } from "react"
import { useAction, useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useAdminAuth } from "@/hooks/useAdmin"
import AdminLayout from "../components/AdminLayout"
import { formatCallTime, useCallSchedule } from "@/hooks/useCallSchedule"
import CallList from "../_components/CallList"

/**
 * Field Agent call bookings — the admin side of /field-agent/book.
 *
 * TWO JOBS.
 *
 * 1. SYNC. Deleting a booking in Google Calendar frees the calendar but not the
 *    page: availability blocks a slot if EITHER the calendar or our own row says
 *    taken, and a confirmed row counts forever. Sync reconciles the two and
 *    releases anything cancelled there. An hourly cron runs the same job; this
 *    button is for when you have just cancelled something and want the slot back
 *    now rather than within the hour.
 *
 * 2. HOURS. The bookable schedule lives in `settings` and is read by both the
 *    grid and the server-side check in createBooking, so changing it here
 *    changes what the page offers AND what it will accept. Staff can edit these
 *    — they sit the calls, so the hours are their own availability — while Sync
 *    stays admin-only.
 *
 * NOT WIRED TO TIDYCAL. TidyCal is the fallback when our Google token dies and
 * it is configured in its own dashboard. Change the hours here and the two
 * drift — both still write to the one tendso.hr calendar, so they cannot
 * double-book, but the fallback will offer different times.
 */

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/** 615 -> "10:15". Minutes from midnight is what the config stores. */
function toTimeInput(minutes: number): string {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    // 1440 is a valid END (midnight, exclusive) but not a valid <input type=time>.
    const shown = h === 24 ? 23 : h
    const shownM = h === 24 ? 59 : m
    return `${String(shown).padStart(2, "0")}:${String(shownM).padStart(2, "0")}`
}

/** "10:15" -> 615, and 23:59 back to the 1440 it stands for. */
function fromTimeInput(value: string): number {
    const [h, m] = value.split(":").map(Number)
    if (!Number.isFinite(h) || !Number.isFinite(m)) return 0
    if (h === 23 && m === 59) return 1440
    return h * 60 + m
}

export default function AdminBookingsPage() {
    const { isAdmin, loading: authLoading, creator } = useAdminAuth()
    // Staff are read-only. Everything that changes something stays admin-only,
    // and the server enforces that independently — this only hides the controls.
    const isStaff = creator?.role === "staff"
    const canView = isAdmin || isStaff

    const savedConfig = useQuery(api.nativeBookings.getSlotConfig, canView ? {} : "skip")
    const syncCancelled = useAction(api.booking.syncCancelledBookings)
    const saveSlotConfig = useMutation(api.nativeBookings.saveSlotConfig)

    // Merged with the calendar by the same hook the staff dashboard uses, so
    // the two views can never disagree about what is booked.
    const { upcoming, past, calendarError, loading: scheduleLoading } = useCallSchedule(canView)

    const [syncing, setSyncing] = useState(false)
    const [syncResult, setSyncResult] = useState<string | null>(null)

    const [days, setDays] = useState<number[]>([])
    const [windows, setWindows] = useState<Array<[number, number]>>([])
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [saved, setSaved] = useState(false)

    // Seed the editor once the saved config arrives, and never again — otherwise
    // a re-render mid-edit would throw away what the admin is typing.
    const [seeded, setSeeded] = useState(false)
    useEffect(() => {
        if (seeded || !savedConfig) return
        setDays(savedConfig.days)
        setWindows(savedConfig.windows.map((w) => [w[0], w[1]] as [number, number]))
        setSeeded(true)
    }, [savedConfig, seeded])

    async function handleSync() {
        setSyncing(true)
        setSyncResult(null)
        try {
            const res = await syncCancelled({})
            setSyncResult(
                res.released === 0
                    ? `Checked ${res.checked} booking${res.checked === 1 ? "" : "s"}. Nothing to release.`
                    : `Released ${res.released} of ${res.checked} — those slots are open again.`,
            )
        } catch (err) {
            setSyncResult(err instanceof Error ? err.message : "Sync failed.")
        } finally {
            setSyncing(false)
        }
    }

    async function handleSave() {
        setSaving(true)
        setSaveError(null)
        try {
            await saveSlotConfig({ days, windows: windows.map((w) => [w[0], w[1]]) })
            setSaved(true)
            setTimeout(() => setSaved(false), 2500)
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : "Could not save.")
        } finally {
            setSaving(false)
        }
    }

    if (authLoading) {
        return (
            <AdminLayout>
                <p className="text-sm text-zinc-500">Loading…</p>
            </AdminLayout>
        )
    }
    if (!canView) return null

    return (
        <AdminLayout>
            <div className="max-w-6xl space-y-8">
                <header className="space-y-1">
                    <h1 className="text-2xl font-bold text-zinc-900">Call bookings</h1>
                    <p className="text-sm text-zinc-500">
                        The 10-minute Field Agent call at /field-agent/book. Events live on the
                        tendso.hr Google Calendar.
                    </p>
                </header>

                {/* ── Sync (admin only) ──────────────────────────────────── */}
                {isAdmin && <section className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
                    <div className="space-y-1">
                        <h2 className="font-semibold text-zinc-900">Sync with the calendar</h2>
                        <p className="text-sm text-zinc-500">
                            Cancel a call by deleting its event in Google Calendar, then sync. That
                            frees the slot here — deleting the event alone does not, because the
                            booking row still holds the time. This runs hourly on its own.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <button
                            onClick={handleSync}
                            disabled={syncing}
                            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                        >
                            {syncing ? "Syncing…" : "Sync now"}
                        </button>
                        {syncResult && <span className="text-sm text-zinc-600">{syncResult}</span>}
                    </div>
                </section>}

                {/* ── Hours (admin + staff) ──────────────────────────────── */}
                <section className="rounded-xl border border-zinc-200 bg-white p-6 space-y-5">
                    <div className="space-y-1">
                        <h2 className="font-semibold text-zinc-900">Bookable hours</h2>
                        <p className="text-sm text-zinc-500">
                            Philippine time. Calls are 10 minutes, offered every 15. Changing this
                            changes both what the page offers and what it will accept.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                            Days
                        </span>
                        <div className="flex gap-2 flex-wrap">
                            {DAY_NAMES.map((label, index) => {
                                const on = days.includes(index)
                                return (
                                    <button
                                        key={label}
                                        onClick={() =>
                                            setDays((cur) =>
                                                on
                                                    ? cur.filter((d) => d !== index)
                                                    : [...cur, index].sort(),
                                            )
                                        }
                                        className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                                            on
                                                ? "border-zinc-900 bg-zinc-900 text-white"
                                                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"
                                        }`}
                                    >
                                        {label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                            Time windows
                        </span>
                        <div className="space-y-2">
                            {windows.map((w, i) => (
                                <div key={i} className="flex items-center gap-2 flex-wrap">
                                    <input
                                        type="time"
                                        value={toTimeInput(w[0])}
                                        onChange={(e) =>
                                            setWindows((cur) =>
                                                cur.map((x, j) =>
                                                    j === i
                                                        ? [fromTimeInput(e.target.value), x[1]]
                                                        : x,
                                                ),
                                            )
                                        }
                                        className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                                    />
                                    <span className="text-sm text-zinc-400">to</span>
                                    <input
                                        type="time"
                                        value={toTimeInput(w[1])}
                                        onChange={(e) =>
                                            setWindows((cur) =>
                                                cur.map((x, j) =>
                                                    j === i
                                                        ? [x[0], fromTimeInput(e.target.value)]
                                                        : x,
                                                ),
                                            )
                                        }
                                        className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                                    />
                                    <button
                                        onClick={() =>
                                            setWindows((cur) => cur.filter((_, j) => j !== i))
                                        }
                                        className="text-sm text-zinc-400 hover:text-zinc-900"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={() => setWindows((cur) => [...cur, [9 * 60, 12 * 60]])}
                            className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
                        >
                            + Add a window
                        </button>
                        <p className="text-xs text-zinc-400">
                            Set an end of 23:59 to mean midnight.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                        >
                            {saving ? "Saving…" : "Save hours"}
                        </button>
                        {saved && <span className="text-sm text-green-700">Saved.</span>}
                        {saveError && <span className="text-sm text-red-600">{saveError}</span>}
                    </div>
                </section>

                {/* ── The bookings ───────────────────────────────────────── */}
                {calendarError && (
                    <p className="text-sm text-amber-700">
                        Showing bookings from this app only — {calendarError}
                    </p>
                )}

                <CallList
                    title={`Upcoming${upcoming.length ? ` (${upcoming.length})` : ""}`}
                    calls={upcoming}
                    empty="No calls booked."
                    loading={scheduleLoading}
                />

                <section className="rounded-xl border border-zinc-200 bg-white p-6">
                    {past.length > 0 && (
                        <details>
                            <summary className="cursor-pointer text-sm text-zinc-500">
                                Past and cancelled ({past.length})
                            </summary>
                            <ul className="divide-y divide-zinc-100 pt-2">
                                {past.map((b) => (
                                    <li
                                        key={b._id}
                                        className="py-3 flex items-baseline justify-between gap-4"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-sm text-zinc-700 truncate">
                                                {b.name}
                                                {b.status === "cancelled" && (
                                                    <span className="ml-2 text-xs text-zinc-400">
                                                        cancelled
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-xs text-zinc-400 truncate">
                                                {b.email}
                                            </p>
                                        </div>
                                        <span className="text-sm text-zinc-400 whitespace-nowrap">
                                            {formatCallTime(b.startMs)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </details>
                    )}
                </section>
            </div>
        </AdminLayout>
    )
}
