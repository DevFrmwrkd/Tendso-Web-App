"use client"

import { useState } from "react"
import { useAction } from "convex/react"
import { AlertTriangle } from "lucide-react"

import { api } from "@/convex/_generated/api"
import type { ScheduledCall } from "@/hooks/useCallSchedule"

/**
 * The button on a call the old booking link sold at a time we do not work.
 *
 * It does two irreversible things at once — deletes the calendar event and
 * emails the person — so it asks first. The confirmation is inline rather than
 * a modal: these rows sit in a list and the question is short enough to answer
 * where it is asked.
 *
 * ORDER MATTERS on the server: the calendar event goes first, and nothing is
 * sent if that fails, because the email says the booking is already cleared.
 * See cancelOutOfHoursCall.
 */
export default function OutOfHoursAction({
    call,
    onDone,
}: {
    call: ScheduledCall
    /** Re-read the calendar, so the row disappears once the event is gone. */
    onDone: () => void
}) {
    const cancelOutOfHours = useAction(api.booking.cancelOutOfHoursCall)
    const [state, setState] = useState<"idle" | "confirming" | "working" | "done">("idle")
    const [error, setError] = useState<string | null>(null)
    const [sentTo, setSentTo] = useState<string | null>(null)

    async function run() {
        if (!call.eventId) return
        setState("working")
        setError(null)
        try {
            // Only the event id. The server reads the person off the event
            // itself — this page's idea of a name falls back to the event title
            // when the calendar carries no person, and an apology addressed to
            // "10-Minute-Meetings" is not one.
            const res = await cancelOutOfHours({ eventId: call.eventId })
            if (res.ok) {
                setState("done")
                setSentTo(res.emailedTo ?? null)
                // Not immediate: Google can take a moment to stop returning a
                // just-deleted event, and refreshing into a stale read would put
                // the row straight back.
                setTimeout(onDone, 1200)
                if (res.error) setError(res.error)
            } else {
                setState("idle")
                setError(res.error ?? "That didn't work.")
            }
        } catch (err) {
            setState("idle")
            setError(err instanceof Error ? err.message : "That didn't work.")
        }
    }

    if (state === "done") {
        return (
            <span className="text-xs font-medium text-amber-700">
                {error ? error : sentTo ? `Cancelled · sent to ${sentTo}` : "Cancelled · apology sent"}
            </span>
        )
    }

    if (state === "confirming" || state === "working") {
        return (
            <div className="flex flex-col items-end gap-1.5">
                <span className="text-xs text-zinc-600">
                    Cancel this call and email {call.email || "them"}?
                </span>
                <div className="flex items-center gap-2">
                    <button
                        onClick={run}
                        disabled={state === "working"}
                        className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800 disabled:opacity-60"
                    >
                        {state === "working" ? "Sending…" : "Yes, cancel & email"}
                    </button>
                    <button
                        onClick={() => setState("idle")}
                        disabled={state === "working"}
                        className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
                    >
                        Keep it
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-end gap-1">
            <button
                onClick={() => setState("confirming")}
                disabled={!call.eventId}
                title={
                    call.eventId
                        ? undefined
                        : "This booking has no calendar event, so there is nothing to cancel."
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:border-amber-500 disabled:opacity-50"
            >
                <AlertTriangle className="h-3.5 w-3.5" />
                Cancel &amp; send new link
            </button>
            {error && <span className="text-xs text-amber-700">{error}</span>}
            {!call.email && (
                <span className="text-xs text-zinc-400">No email on this event</span>
            )}
        </div>
    )
}
