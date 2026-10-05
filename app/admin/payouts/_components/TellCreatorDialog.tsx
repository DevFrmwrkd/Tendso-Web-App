"use client"

import { useAction } from "convex/react"
import { Send } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button, Dialog, Field, Icon, Textarea } from "@/components/r1"
import { api } from "@/convex/_generated/api"
import { SUPPORT_EMAIL } from "@/lib/contact"

import { displayName, errorText, messageDraft, messageTitle, referenceOf, type Withdrawal } from "../_lib/model"

/** announcements.send refuses a longer body. */
const MAX_BODY = 4000

/**
 * "Tell the creator" (board Payouts): a short, editable message about a failed
 * withdrawal, to their Notifications and their inbox.
 *
 * It goes through announcements.send with exactly this one creator picked,
 * the path the Announcements page uses to write to one person. So it is
 * admin-checked on the server (adminId resolves to a real admin row), the
 * in-app row and the email go out together, and the message is kept in the
 * Announcements history ("1 picked") like every other admin message.
 *
 * One instance stays mounted (so closing hands focus back to the button that
 * opened it); every opening starts from a fresh draft for that payout.
 */
export function TellCreatorDialog({ row, adminId, onClose }: { row: Withdrawal | null; adminId: string | null; onClose: () => void }) {
    const send = useAction(api.announcements.send)
    const [draftFor, setDraftFor] = useState<string | null>(null)
    const [msg, setMsg] = useState("")
    const [busy, setBusy] = useState(false)

    // A new opening (or another payout): start from its draft. Closing forgets
    // the draft, so the next opening starts clean too.
    if (row && row._id !== draftFor) {
        setDraftFor(row._id)
        setMsg(messageDraft(row, SUPPORT_EMAIL))
    } else if (!row && draftFor !== null) {
        setDraftFor(null)
    }

    const name = row ? displayName(row) : ""
    const email = row?.creatorEmail ?? null
    const body = msg.trim()
    const error = body.length === 0 ? "Write a message first." : body.length > MAX_BODY ? "Keep it under 4,000 characters." : null
    const ref = row ? referenceOf(row) : null

    const onSend = async () => {
        if (!row || !adminId || error || !email) return
        setBusy(true)
        try {
            await send({
                adminId,
                title: messageTitle(row),
                body,
                // Ignored while creatorIds is present. Deliberately not a real
                // audience key: if the picked id were ever lost, an unknown
                // audience sends to nobody, where a real one would broadcast.
                audience: "picked",
                creatorIds: [row.creatorId],
            })
            toast.success(`Message sent to ${name}.`)
            onClose()
        } catch (e) {
            // The dialog stays open with the text intact, so nothing is retyped.
            toast.error(errorText(e, "The message could not be sent. Try again."))
        } finally {
            setBusy(false)
        }
    }

    return (
        <Dialog
            open={row !== null}
            onClose={busy ? () => {} : onClose}
            title={`Tell ${name}`}
            footer={
                <>
                    <Button onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={onSend} disabled={busy || !!error || !email || !adminId} aria-busy={busy}>
                        <Icon icon={Send} />
                        {busy ? "Sending…" : "Send message"}
                    </Button>
                </>
            }
        >
            {row && (
                <>
                    <p className="t-meta">
                        {email
                            ? `Goes to their Notifications and to ${email}. Edit before you send.`
                            : "Their account has no email address, so this cannot be sent from here."}
                    </p>
                    {/* The draft is filled in, so the error only ever follows an edit. */}
                    <Field label="Message" error={error} help={`Subject: “${messageTitle(row)}”${ref ? ` · reference ${ref}` : ""}`}>
                        <Textarea rows={6} className="min-h-[148px]" value={msg} onChange={(e) => setMsg(e.target.value)} />
                    </Field>
                </>
            )}
        </Dialog>
    )
}
