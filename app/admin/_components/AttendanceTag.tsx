"use client"

import { useState } from "react"
import { useMutation } from "convex/react"
import { Check, X } from "lucide-react"
import { toast } from "sonner"

import { Button, Icon } from "@/components/r1"
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
 *
 * ONLY THE ASKING LIVES HERE. The row says the answer, through bookingStatus()
 * in its status column (Came, No-show, Not answered yet); this is the kit's
 * small row buttons: Came / No-show while there is no answer, Change once
 * there is one.
 *
 * NO UNDO ON THE TOAST. setAttendance writes "attended" or "no_show" and
 * nothing else, so it cannot put a call back to "not answered": an Undo could
 * not do what it says. A mis-tap is fixed the way it always was, Change and
 * the other answer.
 */
export default function AttendanceTag({
    bookingId,
    attendance,
    name,
    onMarked,
}: {
    /** Null for a call that exists only on the calendar: no row to write to. */
    bookingId: Id<"native_bookings"> | null
    attendance?: "attended" | "no_show"
    /** Who the call was with, for the toast and the buttons' accessible names. */
    name: string
    /** Told when an answer is given, so a list that empties as calls are answered can keep the row in view. */
    onMarked?: (id: Id<"native_bookings">) => void
}) {
    const setAttendance = useMutation(api.nativeBookings.setAttendance)
    const [saving, setSaving] = useState<null | "attended" | "no_show">(null)
    const [changing, setChanging] = useState(false)

    if (!bookingId) return null

    async function tag(value: "attended" | "no_show") {
        if (!bookingId) return
        setSaving(value)
        // Told before the save, not after: the reactive query can drop an
        // answered call from an unanswered-only list before this promise
        // settles, and the row would blink out and back.
        onMarked?.(bookingId)
        try {
            await setAttendance({ id: bookingId, attendance: value })
            // The query behind this is reactive, so the new value arrives as a
            // prop — there is nothing to set here but the way back out.
            setChanging(false)
            toast(value === "attended" ? `Marked ${name} as came` : `Marked ${name} as a no-show`)
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not save that.")
        } finally {
            setSaving(null)
        }
    }

    if (attendance && !changing) {
        return (
            <Button variant="ghost" size="sm" onClick={() => setChanging(true)} aria-label={`Change the answer for ${name}`}>
                Change
            </Button>
        )
    }

    return (
        <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => tag("attended")} disabled={saving !== null} aria-label={`Mark ${name} as came`}>
                <Icon icon={Check} />
                {saving === "attended" ? "Saving…" : "Came"}
            </Button>
            <Button size="sm" onClick={() => tag("no_show")} disabled={saving !== null} aria-label={`Mark ${name} as a no-show`}>
                <Icon icon={X} />
                {saving === "no_show" ? "Saving…" : "No-show"}
            </Button>
            {changing && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setChanging(false)}
                    disabled={saving !== null}
                    aria-label={`Keep the answer for ${name}`}
                >
                    Keep
                </Button>
            )}
        </div>
    )
}
