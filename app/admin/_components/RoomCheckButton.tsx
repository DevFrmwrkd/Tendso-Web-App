"use client"

import { useState } from "react"
import { useAction } from "convex/react"
import { RefreshCw } from "lucide-react"

import { api } from "@/convex/_generated/api"

/**
 * Ask Google how long each room was open, now rather than within the hour.
 *
 * An hourly cron does the same job, and has to: conference records expire after
 * 30 days, so a call nobody copies across before then leaves no trace of
 * whether it happened. This button is for right after a call, when the person
 * who sat it is still looking at the screen.
 */
export default function RoomCheckButton() {
    const sync = useAction(api.booking.syncConferenceDurations)
    const [busy, setBusy] = useState(false)
    const [result, setResult] = useState<string | null>(null)

    async function run() {
        setBusy(true)
        setResult(null)
        try {
            const res = await sync({})
            // "Nobody came" and "Google would not tell us" look identical on a
            // row of empty durations, so they are said differently here. Rooms
            // already settled are not re-asked about, hence "new".
            setResult(
                res.checked === 0
                    ? "Nothing new to check."
                    : res.unknown === res.checked
                      ? "Google would not answer for any of these rooms."
                      : `${res.matched} of ${res.checked} rooms were opened.`,
            )
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
                {busy ? "Checking…" : "Check Meet rooms"}
            </button>
        </div>
    )
}
