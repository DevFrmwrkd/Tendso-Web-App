"use client";

import { useId, useState } from "react";
import { toast } from "sonner";

import { PayoutDialog, type PayoutStep } from "@/app/wallet/_components/PayoutDialog";
import { amountInput } from "@/app/wallet/_lib/ledger";
import { Button, formatMoney } from "@/components/r1";
import type { Doc } from "@/convex/_generated/dataModel";

export function AffiliatePayouts({ account, preview = false }: { account: Doc<"creators">; preview?: boolean }) {
    const headingId = useId();
    const [step, setStep] = useState<PayoutStep | null>(null);
    const [amount, setAmount] = useState("");
    const balance = account.balance ?? 0;
    const payoutEmail = account.wiseEmail?.trim() || null;

    function startWithdraw() {
        if (preview) return;
        setAmount(amountInput(balance));
        setStep(payoutEmail
            ? { mode: "withdraw" }
            : { mode: "setup", afterSave: "withdraw", afterCancel: null });
    }

    return (
        <>
            <section className="t-card t-card-pad flex flex-col gap-5" aria-labelledby={headingId}>
                <h2 id={headingId} className="t-h2">Getting paid</h2>
                <div className="flex flex-col gap-1">
                    <p className="t-label">Available to withdraw</p>
                    <p className="t-hero-fig">{formatMoney(balance)}</p>
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                    <p className="t-label">Payouts go to</p>
                    {payoutEmail ? (
                        <p className="t-body break-all">{payoutEmail} on Wise</p>
                    ) : (
                        <p className="t-body">Set up your Wise email to receive payouts.</p>
                    )}
                    <Button
                        variant="ghost"
                        className="self-start"
                        disabled={preview}
                        onClick={() => { if (!preview) setStep({ mode: "setup", afterSave: null, afterCancel: null }); }}
                    >
                        {payoutEmail ? "Change Wise email" : "Set up Wise"}
                    </Button>
                </div>
                <div className="flex flex-col items-start gap-2">
                    <Button variant="secondary" onClick={startWithdraw} disabled={preview || balance <= 0}>
                        Withdraw
                    </Button>
                    {balance <= 0 && <p className="t-meta">Your commissions will be available here after shop owners pay.</p>}
                    {preview && <p className="t-meta">Payout changes and withdrawals are disabled in this preview.</p>}
                    {account.status === "suspended" && (
                        <p className="t-meta">You can still withdraw money you already earned.</p>
                    )}
                </div>
            </section>
            {!preview && <PayoutDialog
                step={step}
                onStep={setStep}
                creator={account}
                payoutEmail={payoutEmail}
                balance={balance}
                amount={amount}
                onAmount={setAmount}
                retry={null}
                onWithdrawn={(value, email) => {
                    setAmount("");
                    toast.success(`${formatMoney(value)} withdrawal requested. Watch ${email} for an email from Wise.`);
                }}
                onEmailSaved={(email) => {
                    toast.success(`Saved. Payouts now go to ${email} on Wise.`);
                }}
            />}
        </>
    );
}
