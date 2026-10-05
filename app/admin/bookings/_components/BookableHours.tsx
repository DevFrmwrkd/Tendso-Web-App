"use client"

import { useId, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { Plus, X } from "lucide-react"
import { toast } from "sonner"

import { Button, Fold, Icon, Input, SkeletonText } from "@/components/r1"
import { api } from "@/convex/_generated/api"
import { minuteLabel } from "@/lib/callStats"

import { DAY_NAMES, daysSummary, plural } from "@/app/admin/_components/calls"
import FoldTitle from "@/app/admin/_components/FoldTitle"

/**
 * The bookable schedule (board Calls, the "Bookable hours" fold).
 *
 * The hours live in `settings` and are read by both the slot grid and the
 * server-side check in createBooking, so changing them here changes what the
 * booking page offers AND what it will accept.
 *
 * ADMINS AND STAFF. Staff can edit these — they sit the calls, so the hours
 * are their own availability (saveSlotConfig is staff-gated on the server for
 * that reason). The board draws this fold for admins only; the split is kept
 * as it was instead.
 *
 * NOT WIRED TO TIDYCAL. TidyCal is the fallback when our Google token dies and
 * it is configured in its own dashboard. Change the hours here and the two
 * drift — both still write to the one tendso.hr calendar, so they cannot
 * double-book, but the fallback will offer different times.
 */

type Draft = { days: number[]; windows: Array<[number, number]> }

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

export default function BookableHours() {
    const savedConfig = useQuery(api.nativeBookings.getSlotConfig, {})
    const saveSlotConfig = useMutation(api.nativeBookings.saveSlotConfig)
    const daysId = useId()
    const windowsId = useId()

    // The editor shows what is saved until somebody edits, and from then on
    // shows their draft: a reactive update arriving mid-edit must never throw
    // away what is being typed. Saving hands the screen back to the server.
    const [draft, setDraft] = useState<Draft | null>(null)
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)

    const saved: Draft | null = savedConfig
        ? { days: savedConfig.days, windows: savedConfig.windows.map((w) => [w[0], w[1]] as [number, number]) }
        : null
    const shown = draft ?? saved

    const edit = (change: (d: Draft) => Draft) => {
        if (!shown) return
        setDraft(change(shown))
        setSaveError(null)
    }

    async function handleSave() {
        if (!shown) return
        setSaving(true)
        setSaveError(null)
        try {
            await saveSlotConfig({ days: shown.days, windows: shown.windows.map((w) => [w[0], w[1]]) })
            setDraft(null)
            toast.success("Saved. The booking page now offers these hours.")
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : "Could not save.")
        } finally {
            setSaving(false)
        }
    }

    const summary = saved
        ? `${daysSummary(saved.days)} · ${saved.windows.length} ${plural(saved.windows.length, "window", "windows")}`
        : null

    return (
        <Fold title={<FoldTitle label="Bookable hours" meta={summary} />}>
            {!shown ? (
                <SkeletonText lines={3} className="pb-3" />
            ) : (
                <div className="flex flex-col gap-4 pb-2">
                    <p className="t-meta">
                        Philippine time, offered every 15 minutes. Calls are 10 minutes. The booking page offers and accepts only these hours.
                    </p>

                    <div className="flex flex-col gap-2" role="group" aria-labelledby={daysId}>
                        <span className="t-label" id={daysId}>
                            Days
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                            {DAY_NAMES.map((label, index) => {
                                const on = shown.days.includes(index)
                                return (
                                    <button
                                        key={label}
                                        type="button"
                                        className="t-chip"
                                        aria-pressed={on}
                                        onClick={() =>
                                            edit((d) => ({
                                                ...d,
                                                days: on ? d.days.filter((x) => x !== index) : [...d.days, index].sort((a, b) => a - b),
                                            }))
                                        }
                                    >
                                        {label}
                                    </button>
                                )
                            })}
                        </div>
                        {shown.days.length === 0 && <p className="t-error">No days: the booking page would offer no times at all.</p>}
                    </div>

                    <div className="flex flex-col gap-2" role="group" aria-labelledby={windowsId}>
                        <span className="t-label" id={windowsId}>
                            Time windows
                        </span>
                        {shown.windows.map((w, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <Input
                                    type="time"
                                    className="w-[124px]"
                                    aria-label={`Window ${i + 1} start`}
                                    value={toTimeInput(w[0])}
                                    onChange={(e) =>
                                        edit((d) => ({
                                            ...d,
                                            windows: d.windows.map((x, j): [number, number] => (j === i ? [fromTimeInput(e.target.value), x[1]] : x)),
                                        }))
                                    }
                                />
                                <span className="t-meta">to</span>
                                <Input
                                    type="time"
                                    className="w-[124px]"
                                    aria-label={`Window ${i + 1} end`}
                                    value={toTimeInput(w[1])}
                                    onChange={(e) =>
                                        edit((d) => ({
                                            ...d,
                                            windows: d.windows.map((x, j): [number, number] => (j === i ? [x[0], fromTimeInput(e.target.value)] : x)),
                                        }))
                                    }
                                />
                                <Button
                                    variant="ghost"
                                    icon
                                    aria-label={`Remove window ${minuteLabel(w[0])} to ${minuteLabel(w[1])}`}
                                    onClick={() => edit((d) => ({ ...d, windows: d.windows.filter((_, j) => j !== i) }))}
                                >
                                    <Icon icon={X} />
                                </Button>
                            </div>
                        ))}
                        {shown.windows.length === 0 && <p className="t-error">No windows: the booking page would offer no times at all.</p>}
                        <div>
                            <Button
                                variant="ghost"
                                className="px-2"
                                onClick={() => edit((d) => ({ ...d, windows: [...d.windows, [9 * 60, 12 * 60] as [number, number]] }))}
                            >
                                <Icon icon={Plus} />
                                Add a window
                            </Button>
                        </div>
                        <p className="t-help">An end of 11:59 PM means midnight.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <Button onClick={handleSave} disabled={saving} aria-busy={saving}>
                            {saving ? "Saving…" : "Save hours"}
                        </Button>
                        {saveError && (
                            <p className="t-error" role="alert">
                                {saveError}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </Fold>
    )
}
