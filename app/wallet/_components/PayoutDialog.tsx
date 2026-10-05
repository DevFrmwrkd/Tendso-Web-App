"use client";

import { useMutation } from "convex/react";
import { useId, useRef, useState } from "react";

import { Button, Dialog, Field, Input, formatMoney } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

import { EMAIL_REGEX, amountInput, checkAmount, checkEmails, errorText, shortDate, type Retry } from "../_lib/ledger";

/**
 * Tendso's Wise invite link, for a creator with no Wise account yet. Kept from
 * the old wallet: signing up through it is how Tendso's Wise referral counts.
 */
const WISE_REFERRAL_URL =
    "https://wise.com/invite/dic/theoimmorosalesv?utm_source=desktop-invite-tab-copylink&utm_medium=invite&utm_campaign=&utm_content=&referralCode=theoimmorosalesv";

/**
 * Which form the payout dialog shows. Setup remembers where to go next: after
 * Save, a first-time setup continues to the amount (the old "Save & Continue");
 * a Change opened from the withdraw form goes back to it either way.
 */
export type PayoutStep =
    | { mode: "withdraw" }
    | { mode: "setup"; afterSave: "withdraw" | null; afterCancel: "withdraw" | null };

type Creator = Pick<Doc<"creators">, "_id" | "wiseEmail">;

/**
 * Withdraw funds and Set up Wise payouts (board: Wallet), as ONE dialog whose
 * content switches. Two native dialogs handing over to each other would fight
 * over the top layer and over where focus returns; one keeps both simple.
 *
 * The money behaviour is the old wallet's, unchanged: the same two mutations
 * with the same arguments, the email normalised and saved before the
 * withdrawal when it changed, the same amount rules as the server.
 */
export function PayoutDialog({
    step,
    onStep,
    creator,
    payoutEmail,
    balance,
    amount,
    onAmount,
    retry,
    onWithdrawn,
    onEmailSaved,
}: {
    step: PayoutStep | null;
    onStep: (step: PayoutStep | null) => void;
    creator: Creator;
    /** The email payouts go to: the one just saved, or the one on file. */
    payoutEmail: string | null;
    balance: number;
    amount: string;
    onAmount: (value: string) => void;
    retry: Retry | null;
    onWithdrawn: (amount: number, email: string) => void;
    onEmailSaved: (email: string) => void;
}) {
    const [busy, setBusy] = useState(false);
    const withdrawFormId = useId();
    const setupFormId = useId();

    const setupStep = step?.mode === "setup" ? step : null;

    // Esc, the scrim and Cancel all land here. Nothing closes mid-request.
    const close = () => {
        if (busy) return;
        if (setupStep) onStep(setupStep.afterCancel ? { mode: setupStep.afterCancel } : null);
        else onStep(null);
    };

    const parsed = checkAmount(amount, balance, false).value;
    const setup = setupStep !== null;

    return (
        <Dialog
            open={step !== null}
            onClose={close}
            title={setup ? "Set up Wise payouts" : "Withdraw to Wise"}
            footer={
                <>
                    <Button onClick={close} disabled={busy}>
                        Cancel
                    </Button>
                    {setup ? (
                        <Button variant="primary" type="submit" form={setupFormId} disabled={busy} aria-busy={busy}>
                            {busy ? "Saving…" : "Save email"}
                        </Button>
                    ) : (
                        <Button variant="primary" type="submit" form={withdrawFormId} disabled={busy} aria-busy={busy}>
                            {busy ? "Sending…" : parsed !== null ? `Withdraw ${formatMoney(parsed)}` : "Withdraw"}
                        </Button>
                    )}
                </>
            }
        >
            {step?.mode === "withdraw" && (
                <WithdrawForm
                    id={withdrawFormId}
                    creator={creator}
                    payoutEmail={payoutEmail}
                    balance={balance}
                    amount={amount}
                    onAmount={onAmount}
                    retry={retry}
                    busy={busy}
                    setBusy={setBusy}
                    onChangeEmail={() => onStep({ mode: "setup", afterSave: "withdraw", afterCancel: "withdraw" })}
                    onWithdrawn={(value, email) => {
                        onStep(null);
                        onWithdrawn(value, email);
                    }}
                />
            )}
            {setupStep && (
                <SetupForm
                    id={setupFormId}
                    creator={creator}
                    busy={busy}
                    setBusy={setBusy}
                    onSaved={(email) => {
                        onStep(setupStep.afterSave ? { mode: setupStep.afterSave } : null);
                        onEmailSaved(email);
                    }}
                />
            )}
        </Dialog>
    );
}

function WithdrawForm({
    id,
    creator,
    payoutEmail,
    balance,
    amount,
    onAmount,
    retry,
    busy,
    setBusy,
    onChangeEmail,
    onWithdrawn,
}: {
    id: string;
    creator: Creator;
    payoutEmail: string | null;
    balance: number;
    amount: string;
    onAmount: (value: string) => void;
    retry: Retry | null;
    busy: boolean;
    setBusy: (busy: boolean) => void;
    onChangeEmail: () => void;
    onWithdrawn: (amount: number, email: string) => void;
}) {
    const createWithdrawal = useMutation(api.withdrawals.create);
    const updateCreator = useMutation(api.creators.update);
    const [blurred, setBlurred] = useState(false);
    const [tried, setTried] = useState(false);
    const [error, setError] = useState("");
    const amountRef = useRef<HTMLInputElement>(null);

    const amountError = checkAmount(amount, balance, tried || blurred).error;

    const handleWithdraw = async () => {
        if (busy) return;
        setError("");

        const checked = checkAmount(amount, balance, true);
        if (checked.value === null) {
            setTried(true);
            amountRef.current?.focus();
            return;
        }
        const normalizedEmail = (payoutEmail ?? "").trim().toLowerCase();
        if (!EMAIL_REGEX.test(normalizedEmail)) {
            setError("Add the email you use on Wise first: choose Change.");
            return;
        }

        try {
            setBusy(true);
            // Persist an updated Wise email on the creator profile so it's remembered next time.
            if (normalizedEmail !== creator.wiseEmail) {
                await updateCreator({ id: creator._id, wiseEmail: normalizedEmail });
            }
            await createWithdrawal({
                creatorId: creator._id,
                amount: checked.value,
                payoutMethod: "wise_email",
                accountDetails: normalizedEmail,
            });
            onWithdrawn(checked.value, normalizedEmail);
        } catch (err) {
            // A rejected mutation rolled back: nothing left the balance.
            setError(
                errorText(err, "The withdrawal didn't go through, and your balance is unchanged. Try again in a moment.", {
                    "Insufficient balance": `You have ${formatMoney(balance)} available.`,
                    "greater than zero": "Enter an amount above zero.",
                }),
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <form
            id={id}
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(e) => {
                e.preventDefault();
                void handleWithdraw();
            }}
        >
            <p className="t-meta">{formatMoney(balance)} available</p>

            {retry && (
                <p className="rounded-r1 bg-r1-fill-2 px-4 py-3 text-[13px] leading-[18px] text-r1-ink-2">
                    Sending again the {formatMoney(retry.amount)} that didn&apos;t go through on {shortDate(retry.at)}. Check that the email
                    below is the one on your Wise account.
                </p>
            )}

            <Field label="Amount" required help={`Up to ${formatMoney(balance)}.`} error={amountError || undefined}>
                <div className="flex gap-2">
                    <div className="relative min-w-0 flex-1">
                        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-r1-ink-3" aria-hidden="true">
                            ₱
                        </span>
                        <Input
                            ref={amountRef}
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            className="t-num pl-7"
                            value={amount}
                            onChange={(e) => onAmount(e.target.value)}
                            onBlur={() => setBlurred(true)}
                        />
                    </div>
                    <Button
                        disabled={busy}
                        onClick={() => {
                            onAmount(amountInput(balance));
                            setBlurred(false);
                        }}
                    >
                        Max
                    </Button>
                </div>
            </Field>

            <div className="t-field">
                <span className="t-field-label">To</span>
                <div className="flex items-center justify-between gap-3 rounded-r1 border border-r1-line bg-r1-fill-2 py-3 pl-4 pr-3">
                    <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-sm font-medium text-r1-ink wrap-anywhere">{payoutEmail ? `Wise · ${payoutEmail}` : "No Wise email yet"}</span>
                        <span className="t-meta">Must match your Wise account email</span>
                    </span>
                    <Button variant="ghost" disabled={busy} onClick={onChangeEmail}>
                        Change
                    </Button>
                </div>
            </div>

            <p className="t-meta">
                Tendso approves it in Wise, then Wise emails you. If that email has no Wise account yet, use the claim link within 7 days.
                You get the full amount: transfer fees are on us.
            </p>

            {error && (
                <p className="t-error" role="alert">
                    {error}
                </p>
            )}
        </form>
    );
}

function SetupForm({
    id,
    creator,
    busy,
    setBusy,
    onSaved,
}: {
    id: string;
    creator: Creator;
    busy: boolean;
    setBusy: (busy: boolean) => void;
    onSaved: (email: string) => void;
}) {
    const updateCreator = useMutation(api.creators.update);
    const [first, setFirst] = useState("");
    const [second, setSecond] = useState("");
    const [tried, setTried] = useState(false);
    const [error, setError] = useState("");
    const firstRef = useRef<HTMLInputElement>(null);
    const secondRef = useRef<HTMLInputElement>(null);

    const checked = checkEmails(first, second);
    const firstError = tried ? checked.error : "";
    const secondError = tried ? checked.againError : "";

    const handleSave = async () => {
        if (busy) return;
        setError("");
        const c = checkEmails(first, second);
        if (c.error || c.againError) {
            setTried(true);
            (c.error ? firstRef : secondRef).current?.focus();
            return;
        }
        try {
            setBusy(true);
            await updateCreator({ id: creator._id, wiseEmail: c.email });
            onSaved(c.email);
        } catch (err) {
            setError(errorText(err, "We couldn't save that email. Try again in a moment."));
        } finally {
            setBusy(false);
        }
    };

    return (
        <form
            id={id}
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(e) => {
                e.preventDefault();
                void handleSave();
            }}
        >
            <p className="t-meta">Every payout goes to this email on Wise. We remember it.</p>

            <Field label="Wise email" required help="The email you use on Wise, or will sign up with." error={firstError || undefined}>
                {/* autoFocus: arriving from the withdraw form's Change, the button
                    that had focus is gone; start the person in the first field. */}
                <Input
                    ref={firstRef}
                    autoFocus
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@gmail.com"
                    value={first}
                    onChange={(e) => setFirst(e.target.value)}
                />
            </Field>

            <Field label="Confirm email" required help="A typo sends your money nowhere, so we ask twice." error={secondError || undefined}>
                <Input
                    ref={secondRef}
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    placeholder="Type it again"
                    value={second}
                    onChange={(e) => setSecond(e.target.value)}
                />
            </Field>

            <p className="rounded-r1 bg-r1-fill-2 px-4 py-3 text-[13px] leading-[18px] text-r1-ink-2">
                No Wise account yet? It&apos;s free.{" "}
                <a className="t-link" href={WISE_REFERRAL_URL} target="_blank" rel="noopener noreferrer">
                    Sign up on Wise
                </a>{" "}
                with this same email, or claim with it when Wise emails you.
            </p>

            {error && (
                <p className="t-error" role="alert">
                    {error}
                </p>
            )}
        </form>
    );
}
