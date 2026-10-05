"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button, Dot, Fold, Loading, PageHeader, Skeleton, SkeletonCard, SkeletonRows, formatMoney } from "@/components/r1";
import { CreatorShell } from "@/components/shells/CreatorShell";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { COMMISSION_RATE } from "@/lib/pricing";

import { Ledger } from "./_components/Ledger";
import { PayoutDialog, type PayoutStep } from "./_components/PayoutDialog";
import {
    amountInput,
    awaitingOwners,
    balanceLine,
    buildLedger,
    inFlight,
    joinNames,
    shortDate,
    type Retry,
    type Withdrawal,
} from "./_lib/ledger";

/**
 * Wallet (board: Wallet). One question: how much can I take out, and when?
 *
 * The answer comes first: the balance, one line that explains it, and the one
 * primary action. Then every peso in and out, newest first. Beside it on a
 * desk (under it on a phone): where payouts go, the totals so far, and the
 * rules in a fold that stays closed.
 *
 * THE MONEY BEHAVIOUR IS THE OLD WALLET'S. The same queries; the same two
 * mutations (creators.update for the Wise email, withdrawals.create with
 * payoutMethod "wise_email") and their arguments; the same amount rules as the
 * server (more than zero, no more than the balance, and no minimum, see
 * _lib/ledger.ts); the same order of steps (no Wise email on file → set it up,
 * then continue to the amount). What is new is how it reads.
 */

const TITLE = "Wallet";
const SUB = "How much can I take out, and when?";

export default function WalletPage() {
    const router = useRouter();
    const { user, isLoaded, isSignedIn } = useUser();

    const creator = useQuery(api.creators.getByClerkId, user ? { clerkId: user.id } : "skip");

    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            router.push("/login");
        }
    }, [isLoaded, isSignedIn, router]);

    useEffect(() => {
        if (isLoaded && isSignedIn && creator === null) {
            router.push("/onboarding");
        }
    }, [isLoaded, isSignedIn, creator, router]);

    // Still loading, signed out, or on the way to onboarding: the page's own
    // shape stays on screen until the redirect or the data arrives.
    if (!isLoaded || !isSignedIn || creator === undefined || creator === null) {
        return (
            <CreatorShell>
                <PageHeader title={TITLE} sub={SUB} />
                <WalletSkeleton />
            </CreatorShell>
        );
    }

    return <Wallet creator={creator} />;
}

function Wallet({ creator }: { creator: Doc<"creators"> }) {
    const earnings = useQuery(api.earnings.getByCreator, { creatorId: creator._id });
    const earningsSummary = useQuery(api.earnings.getSummary, { creatorId: creator._id });
    const withdrawals = useQuery(api.withdrawals.getByCreator, { creatorId: creator._id });
    // What is live and waiting for its owner to pay. The creator frame holds
    // this same subscription already, so Convex serves both from one.
    const submissions = useQuery(api.submissions.getByCreatorId, { creatorId: creator._id });

    const [step, setStep] = useState<PayoutStep | null>(null);
    const [amount, setAmount] = useState("");
    const [retry, setRetry] = useState<Retry | null>(null);
    // The email just saved, used until the creator row catches up with it.
    const [savedEmail, setSavedEmail] = useState<string | null>(null);

    const balance = creator.balance || 0;
    const totalEarned = earningsSummary?.total || creator.totalEarnings || 0;
    const totalWithdrawn = earningsSummary?.withdrawn || creator.totalWithdrawn || 0;
    const payoutEmail = savedEmail ?? (creator.wiseEmail || null);

    const canWithdraw = balance > 0;
    const moving = withdrawals ? inFlight(withdrawals) : null;
    const waiting = submissions ? awaitingOwners(submissions) : null;
    const line = moving && waiting ? balanceLine({ balance, moving, waiting }) : null;
    const rows = earnings && withdrawals ? buildLedger(earnings, withdrawals, submissions) : undefined;

    const startWithdraw = (prefill: number, retryOf: Retry | null) => {
        setAmount(amountInput(prefill));
        setRetry(retryOf);
        // As before: with a Wise email on file, straight to the amount; without
        // one, set it up first and continue to the amount once it is saved.
        setStep(payoutEmail ? { mode: "withdraw" } : { mode: "setup", afterSave: "withdraw", afterCancel: null });
    };

    const availId = useId();
    const reasonId = useId();
    const destId = useId();

    return (
        <CreatorShell>
            <PageHeader title={TITLE} sub={SUB} />

            <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
                {/* The answer, then the ledger */}
                <div className="flex min-w-0 flex-1 flex-col gap-6">
                    <section className="t-card flex flex-col gap-5 p-5 sm:p-8" aria-labelledby={availId}>
                        <div className="flex flex-col gap-3">
                            <span id={availId} className="t-label">
                                Available to withdraw
                            </span>
                            <span className="t-hero-fig">{formatMoney(balance)}</span>
                            {line ? (
                                <span className="t-status items-start whitespace-normal text-sm leading-5 wrap-anywhere">
                                    <Dot tone={line.tone} className="mt-1.5" />
                                    {line.text}
                                </span>
                            ) : (
                                <Skeleton width="60%" height={14} />
                            )}
                        </div>
                        <hr className="t-divider" />
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                            {canWithdraw ? (
                                <>
                                    <Button variant="primary" size="lg" className="w-full sm:w-auto" onClick={() => startWithdraw(balance, null)}>
                                        Withdraw
                                    </Button>
                                    <span className="t-meta wrap-anywhere">
                                        {payoutEmail
                                            ? `To Wise · ${payoutEmail} · you get the full amount`
                                            : "To Wise · add your Wise email first · you get the full amount"}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <Button variant="primary" size="lg" className="w-full sm:w-auto" disabled aria-describedby={reasonId}>
                                        Withdraw
                                    </Button>
                                    <span id={reasonId} className="t-meta">
                                        {moving && moving.total > 0 ? "Nothing left to take out right now." : "Nothing to take out yet."}
                                    </span>
                                </>
                            )}
                        </div>
                    </section>

                    <Ledger
                        rows={rows}
                        canRetry={canWithdraw}
                        onRetry={(row) => {
                            if (row.retry) startWithdraw(Math.min(row.retry.amount, balance), row.retry);
                        }}
                    />
                </div>

                {/* Where it goes, the totals, the rules */}
                <div className="flex flex-col gap-6 xl:w-[352px] xl:flex-none">
                    <section className="t-card t-card-pad flex flex-col gap-4" aria-labelledby={destId}>
                        <h2 id={destId} className="t-h2">
                            Payouts go to
                        </h2>
                        <div className="flex items-center justify-between gap-3">
                            <span className="flex min-w-0 flex-col gap-0.5">
                                <span className="text-sm font-medium text-r1-ink wrap-anywhere">
                                    {payoutEmail ? `Wise · ${payoutEmail}` : "No Wise email yet"}
                                </span>
                                <span className="t-meta">{payoutEmail ? "Your Wise email" : "Add the email you use on Wise"}</span>
                            </span>
                            <Button onClick={() => setStep({ mode: "setup", afterSave: null, afterCancel: null })}>
                                {payoutEmail ? "Change" : "Set up"}
                            </Button>
                        </div>
                        <p className="t-meta">Wise emails you about each payout. Transfer fees are on us.</p>
                    </section>

                    <SoFar
                        waiting={waiting}
                        totalEarned={totalEarned}
                        earnedFrom={rows ? joinNames(rows.filter((r) => r.kind === "earning").map((r) => r.title)) : ""}
                        totalWithdrawn={totalWithdrawn}
                        withdrawals={withdrawals}
                    />

                    <Fold title="How payouts work">
                        <ul className="m-0 flex list-disc flex-col gap-2 pl-[18px] text-[13px] leading-[18px] text-r1-ink-2">
                            <li>
                                You keep {Math.round(COMMISSION_RATE * 100)}% of each website&apos;s price. It lands in your wallet when the owner
                                pays, and free promo sites pay you too.
                            </li>
                            <li>Withdraw any amount up to what is available.</li>
                            <li>
                                Tendso approves each payout in Wise, then Wise emails you. If that email has no Wise account yet, use the claim
                                link within 7 days.
                            </li>
                            <li>An unclaimed link expires and the money comes back to your wallet. Nothing is lost.</li>
                            <li>Use the same email as your Wise account. No account yet? Wise is free to join.</li>
                        </ul>
                        <Link href="/knowledge" className="t-link mt-3 self-start text-[13px]">
                            More in Learn
                        </Link>
                    </Fold>
                </div>
            </div>

            <PayoutDialog
                step={step}
                onStep={setStep}
                creator={creator}
                payoutEmail={payoutEmail}
                balance={balance}
                amount={amount}
                onAmount={setAmount}
                retry={retry}
                onWithdrawn={(value, email) => {
                    setAmount("");
                    setRetry(null);
                    toast.success(`${formatMoney(value)} is on its way. Watch ${email} for an email from Wise.`);
                }}
                onEmailSaved={(email) => {
                    setSavedEmail(email);
                    toast.success(`Saved. Payouts now go to ${email} on Wise.`);
                }}
            />
        </CreatorShell>
    );
}

/**
 * "So far": pending, earned, withdrawn. Pending is what lands when owners pay;
 * the other two are the totals the old wallet showed, from the same sources.
 * A card that would read ₱0 three times is cut (ComponentKit, Cards).
 */
function SoFar({
    waiting,
    totalEarned,
    earnedFrom,
    totalWithdrawn,
    withdrawals,
}: {
    waiting: { total: number; names: string[] } | null;
    totalEarned: number;
    earnedFrom: string;
    totalWithdrawn: number;
    withdrawals: Withdrawal[] | undefined;
}) {
    const titleId = useId();
    if ((waiting?.total ?? 0) === 0 && totalEarned === 0 && totalWithdrawn === 0) return null;

    const lastPaid = withdrawals
        ?.filter((w) => w.status === "completed")
        .reduce<Withdrawal | null>((best, w) => (!best || (w.processedAt ?? w.createdAt) > (best.processedAt ?? best.createdAt) ? w : best), null);
    const many = (waiting?.names.length ?? 0) > 1;

    return (
        <section className="t-card px-5 pb-2 pt-5 sm:px-6" aria-labelledby={titleId}>
            <h2 id={titleId} className="t-h2 pb-1">
                So far
            </h2>
            <SoFarRow
                label="Pending"
                value={waiting ? formatMoney(waiting.total) : <Skeleton width={56} height={16} />}
                note={
                    waiting === null ? null : waiting.total > 0 ? (
                        <span className="t-status items-start whitespace-normal">
                            <Dot tone="progress" className="mt-[5px]" />
                            {joinNames(waiting.names)} · when the {many ? "owners pay" : "owner pays"}
                        </span>
                    ) : (
                        <span className="t-status">
                            <Dot tone="off" />
                            Nothing waiting
                        </span>
                    )
                }
            />
            <SoFarRow label="Earned" value={formatMoney(totalEarned)} note={earnedFrom ? <span className="t-meta">{earnedFrom}</span> : null} />
            <SoFarRow
                label="Withdrawn"
                value={formatMoney(totalWithdrawn)}
                note={
                    withdrawals === undefined ? null : (
                        <span className="t-meta">
                            {lastPaid ? `Last paid out ${shortDate(lastPaid.processedAt ?? lastPaid.createdAt)}` : "Nothing paid out yet"}
                        </span>
                    )
                }
            />
        </section>
    );
}

function SoFarRow({ label, value, note }: { label: string; value: ReactNode; note: ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-4 border-b border-r1-line-3 py-3.5 last:border-b-0">
            <span className="flex min-w-0 flex-col gap-0.5">
                <span className="t-body text-r1-ink">{label}</span>
                {note}
            </span>
            <span className="t-num whitespace-nowrap text-base font-semibold leading-6 text-r1-ink">{value}</span>
        </div>
    );
}

/** The page's shape while the creator row loads: balance card, three rows, two side cards. */
function WalletSkeleton() {
    return (
        <Loading label="Loading your wallet" className="flex flex-col gap-6 xl:flex-row xl:items-start">
            <div className="flex min-w-0 flex-1 flex-col gap-6" aria-hidden="true">
                <div className="t-card flex flex-col gap-4 p-5 sm:p-8">
                    <Skeleton width={140} height={12} />
                    <Skeleton width={180} height={48} />
                    <Skeleton width="60%" height={14} />
                    <hr className="t-divider" />
                    <Skeleton width={140} height={48} />
                </div>
                <SkeletonRows count={3} />
            </div>
            <div className="flex flex-col gap-6 xl:w-[352px] xl:flex-none">
                <SkeletonCard />
                <SkeletonCard />
            </div>
        </Loading>
    );
}
