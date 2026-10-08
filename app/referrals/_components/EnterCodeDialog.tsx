"use client";

import { useMutation } from "convex/react";
import { Check } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Button, Dialog, Field, Icon, Input } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { OWN_CODE_ERROR, referralErrorText } from "../_lib/referrals";

/**
 * Enter an invite code. MOVED HERE FROM PROFILE (README scope: "Enter referral
 * code · Moved from Profile to Referrals"): a creator who was invited looks for
 * it where invites live, not in their account settings.
 *
 * The behaviour is the Profile modal's: the same mutation
 * (creators.applyReferralCode) with the same arguments (the creator's id and
 * the code trimmed and upper-cased), Apply off until something is typed, and
 * the server's checks deciding the rest. The page offers it only while the
 * creator has no referredByCode, as Profile did.
 *
 * One check is repeated here before the round trip: your own code. The server
 * refuses it too, but in production Convex hides the server's words, so this
 * is the one refusal we can still explain precisely.
 */
export function EnterCodeDialog({
    open,
    onClose,
    creatorId,
    ownCode,
}: {
    open: boolean;
    onClose: () => void;
    creatorId: Id<"creators">;
    ownCode: string;
}) {
    const applyReferralCode = useMutation(api.creators.applyReferralCode);
    const [step, setStep] = useState<"form" | "done">("form");
    const [code, setCode] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const formId = useId();
    const inputRef = useRef<HTMLInputElement>(null);

    // Esc, the scrim, Cancel and Done all land here; the next opening starts clean.
    const close = () => {
        if (busy) return;
        setStep("form");
        setCode("");
        setError(null);
        onClose();
    };

    const apply = async () => {
        const value = code.trim().toUpperCase();
        if (!value || busy) return;
        if (ownCode && value === ownCode.trim().toUpperCase()) {
            setError(OWN_CODE_ERROR);
            inputRef.current?.focus();
            return;
        }
        setError(null);
        setBusy(true);
        try {
            await applyReferralCode({ id: creatorId, referredByCode: value });
            setStep("done");
        } catch (err) {
            setError(referralErrorText(err));
            inputRef.current?.focus();
        } finally {
            setBusy(false);
        }
    };

    // One dialog whose content switches, so it stays open from the form to the
    // confirmation. Done takes focus as the Apply button it replaces goes away.
    const done = step === "done";

    return (
        <Dialog
            open={open}
            onClose={close}
            title={
                done ? (
                    <span className="flex flex-col items-start gap-4">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-r1-ink text-r1-paper" aria-hidden="true">
                            <Icon icon={Check} size={18} />
                        </span>
                        Code applied
                    </span>
                ) : (
                    "Enter an invite code"
                )
            }
            footer={
                done ? (
                    <Button variant="primary" autoFocus onClick={close}>
                        Done
                    </Button>
                ) : (
                    <>
                        <Button onClick={close} disabled={busy}>
                            Cancel
                        </Button>
                        <Button variant="primary" type="submit" form={formId} disabled={!code.trim() || busy} aria-busy={busy}>
                            {busy ? "Applying…" : "Apply code"}
                        </Button>
                    </>
                )
            }
        >
            {done ? (
                <p>The person who invited you now gets the credit.</p>
            ) : (
                <form
                    id={formId}
                    noValidate
                    className="flex flex-col gap-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void apply();
                    }}
                >
                    <p>If a creator or affiliate invited you, add their code so they get the credit. You can add one code, once.</p>
                    <Field label="Invite code" help="Letters and numbers, as they sent it." error={error ?? undefined}>
                        <Input
                            ref={inputRef}
                            type="text"
                            autoComplete="off"
                            autoCapitalize="characters"
                            spellCheck={false}
                            placeholder="e.g. JUD8A3BK"
                            className="font-r1-mono uppercase tracking-[0.08em]"
                            value={code}
                            onChange={(e) => {
                                setCode(e.target.value.toUpperCase());
                                setError(null);
                            }}
                        />
                    </Field>
                </form>
            )}
        </Dialog>
    );
}
