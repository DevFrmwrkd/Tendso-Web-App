"use client";

import { useMutation } from "convex/react";
import { useId, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button, Drawer, Field, Input } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

import { EMAIL_RE, NowBlock, maskEmail } from "./parts";

/**
 * Change payout method (board Account, drawer). The Wise email is the same
 * field the Wallet saves before a withdrawal (creators.wiseEmail, through
 * api.creators.update), trimmed and lower-cased the same way, so the two
 * screens can never disagree about where money goes.
 */
export function PayoutDrawer({ open, onClose, creator }: { open: boolean; onClose: () => void; creator: Doc<"creators"> }) {
    const updateCreator = useMutation(api.creators.update);
    const formId = useId();
    const inputRef = useRef<HTMLInputElement>(null);

    const [draft, setDraft] = useState("");
    const [error, setError] = useState<string>();
    const [saving, setSaving] = useState(false);

    const [openedFor, setOpenedFor] = useState(false);
    if (open !== openedFor) {
        setOpenedFor(open);
        if (open) {
            setDraft("");
            setError(undefined);
        }
    }

    const current = creator.wiseEmail;

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (saving) return;
        const normalized = draft.trim().toLowerCase();
        if (!EMAIL_RE.test(normalized)) {
            setError("Enter the email your Wise account uses, like name@gmail.com");
            inputRef.current?.focus();
            return;
        }
        setSaving(true);
        try {
            await updateCreator({ id: creator._id, wiseEmail: normalized });
            toast.success("Payout email saved. Your next withdrawal goes there.");
            onClose();
        } catch (err) {
            setError(err instanceof Error && err.message ? err.message : "Failed to save Wise email. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Drawer
            open={open}
            onClose={onClose}
            title={current ? "Change payout method" : "Set up payouts"}
            meta="Payouts are sent through Wise to an email address."
            closeLabel="Close payout method"
            footer={
                <>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button variant="primary" type="submit" form={formId} disabled={saving} aria-busy={saving}>
                        {saving ? "Saving…" : "Save payout email"}
                    </Button>
                </>
            }
        >
            <form id={formId} onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
                {current && <NowBlock label="Now paying to">Wise · {maskEmail(current)}</NowBlock>}
                <Field
                    label="Wise email"
                    required
                    error={error}
                    help="Use the email your Wise account is registered with. No Wise account yet? Wise sends a claim link to this email on your first payout."
                >
                    <Input
                        ref={inputRef}
                        type="email"
                        autoComplete="email"
                        placeholder="name@gmail.com"
                        value={draft}
                        onChange={(e) => {
                            setDraft(e.target.value);
                            setError(undefined);
                        }}
                    />
                </Field>
                {current && <p className="t-meta">The change applies from your next withdrawal. Anything already processing still goes to the old email.</p>}
            </form>
        </Drawer>
    );
}
