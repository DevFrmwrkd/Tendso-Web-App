"use client"

import { useState } from "react"
import { useMutation } from "convex/react"
import { Check, X } from "lucide-react"

import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"

/**
 * Did anyone turn up? Asked of the person who sat the call.
 *
 * WHY A HUMAN ANSWERS THIS AT ALL. We can read how long a conference ran in the
 * Meet room, and nothing else: attendance reports are a Google Workspace
 * feature and tendso.hr is a consumer account, so the participant list comes
 * back empty even for a full call. A duration cannot tell a real conversation
 * from an interviewer sitting alone in the room, so the duration informs this
 * control and never fills it in.
 *
 * The answer is overwritable on purpose — a mis-tap is the likeliest way this
 * gets the wrong value, and there is nothing here worth a confirmation step.
 */
export default function AttendanceTag({
    bookingId,
    attendance,
}: {
    /** Null for a call that exists only on the calendar: no row to write to. */
    bookingId: Id<"native_bookings"> | null
    attendance?: "attended" | "no_show"
}) {
    const setAttendance = useMutation(api.nativeBookings.setAttendance)
    const [saving, setSaving] = useState<null | "attended" | "no_show">(null)
    const [changing, setChanging] = useState(false)
    const [error, setError] = useState<string | null>(null)

    if (!bookingId) return null

    async function tag(value: "attended" | "no_show") {
        if (!bookingId) return
        setSaving(value)
        setError(null)
        try {
            await setAttendance({ id: bookingId, attendance: value })
            // The query behind this is reactive, so the new value arrives as a
            // prop — there is nothing to set here but the way back out.
            setChanging(false)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save that.")
        } finally {
            setSaving(null)
        }
    }

    if (attendance && !changing) {
        const came = attendance === "attended"
        return (
            <div className="flex items-center gap-2">
                <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        came ? "bg-green-100 text-green-800" : "bg-zinc-200 text-zinc-700"
                    }`}
                >
                    {came ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    {came ? "Came" : "No-show"}
                </span>
                <button
                    onClick={() => setChanging(true)}
                    className="text-xs font-medium text-zinc-400 hover:text-zinc-900"
                >
                    Change
                </button>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5">
                <button
                    onClick={() => tag("attended")}
                    disabled={saving !== null}
                    className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:border-green-500 hover:text-green-800 disabled:opacity-50"
                >
                    {saving === "attended" ? "Saving…" : "Came"}
                </button>
                <button
                    onClick={() => tag("no_show")}
                    disabled={saving !== null}
                    className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:border-zinc-900 hover:text-zinc-900 disabled:opacity-50"
                >
                    {saving === "no_show" ? "Saving…" : "No-show"}
                </button>
                {changing && (
                    <button
                        onClick={() => setChanging(false)}
                        className="text-xs font-medium text-zinc-400 hover:text-zinc-900"
                    >
                        Keep
                    </button>
                )}
            </div>
            {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
    )
}
