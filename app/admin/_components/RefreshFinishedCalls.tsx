"use client"

import { useState } from "react"
import { useAction } from "convex/react"
import { RotateCw } from "lucide-react"
import { toast } from "sonner"

import { Button, Icon } from "@/components/r1"
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
 * call, when the person who sat it is still looking at the screen. What it found
 * is said in a toast (Round 1: results are toasts, not lines that linger).
 */
export default function RefreshFinishedCalls() {
    const adopt = useAction(api.booking.adoptCalendarCalls)
    const durations = useAction(api.booking.syncConferenceDurations)
    const [busy, setBusy] = useState(false)

    async function run() {
        setBusy(true)
        try {
            const added = await adopt({})
            const rooms = await durations({})

            const parts: string[] = []
            if (added.adopted > 0) {
                parts.push(`Added ${added.adopted} finished call${added.adopted === 1 ? "" : "s"}.`)
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
            toast(parts.join(" "))
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not reach Google.")
        } finally {
            setBusy(false)
        }
    }

    return (
        <Button variant="ghost" size="sm" onClick={run} disabled={busy} aria-busy={busy}>
            <Icon icon={RotateCw} />
            {busy ? "Checking…" : "Refresh finished calls"}
        </Button>
    )
}
