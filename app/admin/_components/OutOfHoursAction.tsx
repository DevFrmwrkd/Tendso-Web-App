"use client"

import { useState } from "react"
import { useAction } from "convex/react"
import { toast } from "sonner"

import { ConfirmDialog, MoreMenu } from "@/components/r1"
import { api } from "@/convex/_generated/api"
import { formatCallTime, type ScheduledCall } from "@/hooks/useCallSchedule"

/**
 * The action on a call the old booking link sold at a time we do not work.
 *
 * It does two irreversible things at once — deletes the calendar event and
 * emails the person — so it asks first. Round 1 puts a destructive action in
 * the row's More menu and asks through the one ConfirmDialog (title names the
 * call, the body says what goes with it); the outcome is a toast.
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
    const [confirming, setConfirming] = useState(false)
    const [working, setWorking] = useState(false)
    const [done, setDone] = useState(false)

    async function run() {
        if (!call.eventId) return
        setWorking(true)
        try {
            // Only the event id. The server reads the person off the event
            // itself — this page's idea of a name falls back to the event title
            // when the calendar carries no person, and an apology addressed to
            // "10-Minute-Meetings" is not one.
            const res = await cancelOutOfHours({ eventId: call.eventId })
            if (res.ok) {
                setDone(true)
                // ok with an error: the call is off, but the email half did not
                // happen (no address on the event, or the send failed).
                if (res.error) toast.warning(res.error)
                // The address the server actually used, not the one this row shows.
                else toast.success(res.emailedTo ? `Cancelled. The booking link went to ${res.emailedTo}.` : "Cancelled. The apology is on its way.")
                // Not immediate: Google can take a moment to stop returning a
                // just-deleted event, and refreshing into a stale read would put
                // the row straight back.
                setTimeout(onDone, 1200)
            } else {
                toast.error(res.error ?? "That didn't work.")
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "That didn't work.")
        } finally {
            setWorking(false)
            setConfirming(false)
        }
    }

    if (done) return <span className="t-meta">Cancelled</span>

    return (
        <>
            <MoreMenu
                size="sm"
                label={`More actions for ${call.name}'s call`}
                items={[
                    call.eventId
                        ? { label: "Cancel and send the booking link", danger: true, onSelect: () => setConfirming(true) }
                        : // A booking with no calendar event has nothing to cancel.
                          { label: "No calendar event to cancel", disabled: true },
                ]}
            />
            <ConfirmDialog
                open={confirming}
                onCancel={() => setConfirming(false)}
                onConfirm={run}
                busy={working}
                title={`Cancel ${call.name}'s call?`}
                confirmLabel={working ? "Cancelling…" : call.email ? "Cancel and email" : "Cancel the call"}
            >
                <p>{formatCallTime(call.startMs)} falls outside your bookable hours, so nobody would be there to take it.</p>
                <p>
                    {call.email
                        ? `This deletes the event from the tendso.hr calendar and emails ${call.email} the booking page, which only offers hours someone works.`
                        : "This deletes the event from the tendso.hr calendar. There is no email address on it, so nobody can be told."}{" "}
                    It cannot be undone.
                </p>
            </ConfirmDialog>
        </>
    )
}
