"use client"

import { useState } from "react"
import { useAction } from "convex/react"
import { RefreshCw } from "lucide-react"

import { api } from "@/convex/_generated/api"

/**
 * Bring the finished-call list up to date, now rather than within the hour.
 *
 * TWO JOBS IN THE CRONS ORDER, because the second depends on the first. Adoption
 * gives a row to every Tendso call that finished on the calendar without one,
 * and almost every call needs that: three systems book onto the one tendso.hr
 * calendar and only ours starts with a row. Then the duration pass asks Google
 * how long each of those rooms was open.
 *
 * Both run hourly on their own. This button exists for the minutes right after a
 * call, when the person who sat it is still looking at the screen.
 */
export default function RefreshFinishedCalls() {
    const adopt = useAction(api.booking.adoptCalendarCalls)
    const durations = useAction(api.booking.syncConferenceDurations)
    const [busy, setBusy] = useState(false)
    const [result, setResult] = useState<string | null>(null)

    async function run() {
        setBusy(true)
        setResult(null)
        try {
            const added = await adopt({})
            const rooms = await durations({})

            const parts: string[] = []
            if (added.adopted > 0) {
                parts.push(
                    `Added ${added.adopted} finished call${added.adopted === 1 ? "" : "s"}.`,
                )
            }
            if (rooms.checked === 0) {
                if (!parts.length) parts.push("Nothing new to check.")
            } else if (rooms.unknown === rooms.checked) {
                // "Nobody came" and "Google would not tell us" look identical on
                // a row of empty durations, so they are said differently here.
                parts.push("Google would not answer for any of these rooms.")
            } else {
                parts.push(`${rooms.matched} of ${rooms.checked} rooms were opened.`)
            }
            setResult(parts.join(" "))
        } catch (err) {
            setResult(err instanceof Error ? err.message : "Could not reach Google.")
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="flex items-center gap-3">
            {result && <span className="text-xs text-zinc-500">{result}</span>}
            <button
                onClick={run}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-zinc-400 disabled:opacity-60"
            >
                <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
                {busy ? "Checking…" : "Refresh finished calls"}
            </button>
        </div>
    )
}
