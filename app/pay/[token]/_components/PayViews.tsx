"use client";

import type { LucideIcon } from "lucide-react";
import { Check, Clock, Copy, ExternalLink, Lock, Receipt, RotateCw, Shield } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { toast } from "sonner";

import LiveSitePreview from "@/components/landing/LiveSitePreview";
import {
    Button,
    ButtonLink,
    Dot,
    Fold,
    Folds,
    Highlight,
    Icon,
    Loading,
    MoneyLine,
    MoneyLines,
    PageHeader,
    Skeleton,
    SkeletonText,
    Status,
    Timeline,
    domainStatus,
    formatMoney,
    submissionStatus,
    type StatusWord,
} from "@/components/r1";
import type { Doc } from "@/convex/_generated/dataModel";
import { OPERATOR, PHONE_DISPLAY, PHONE_TEL, SUPPORT_EMAIL } from "@/lib/contact";
import { domainAddOnFor } from "@/lib/pricing";

import {
    hostOf,
    linkDays,
    liveUrlOf,
    longDate,
    newLinkMailto,
    paidOnOf,
    paymentDetailsText,
    shortDate,
    transferAmount,
    transferAmountShown,
} from "./payState";

/*
 * The four states of the payment page (board Pay): pending, paid, expired,
 * not found. Every amount is the token's own (`paymentTokens.amount`), every
 * date one the backend recorded; nothing is shown that the data does not hold.
 *
 * Where these differ from the board, on purpose:
 *  - No "receipt by email" promises. An admin's Mark as paid emails a
 *    confirmation, but a transfer the Wise webhook matches on its own sends the
 *    owner nothing (payments.processDeposit), so the page itself is the receipt.
 *  - Expired: "Ask for a new link" opens an email to Tendso (no function records
 *    the request), and the board's "a person has to match it by hand" and "your
 *    site stays live" are gone: the webhook still matches an expired code on its
 *    own, and an unpaid site is taken offline three days after the payment email
 *    (convex/crons.ts, auto-unpublish).
 *  - "Email it again" is left out: there is no public way to resend the receipt.
 */

type Token = Doc<"paymentTokens">;
type Submission = Doc<"submissions"> | null;
type ViewProps = { token: Token; submission: Submission; now: number };

async function copyText(text: string, done: string) {
    try {
        await navigator.clipboard.writeText(text);
        toast.success(done);
    } catch {
        toast.error("Couldn't copy. Select the text and copy it instead.");
    }
}

/* ── Pieces ────────────────────────────────────────────────────────── */

/** Main column and the status card; on a phone the card follows the instructions. */
function Columns({ children, aside }: { children: ReactNode; aside: ReactNode }) {
    return (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-12">
            <div className="flex min-w-0 flex-col gap-8">{children}</div>
            {aside}
        </div>
    );
}

/** One line to copy into the transfer: what it is, the value, and Copy. */
function CopyRow({ label, copy, shown, copyLabel, done }: { label: string; copy: string; shown?: ReactNode; copyLabel: string; done: string }) {
    return (
        <div className="flex min-h-[52px] items-center gap-3 rounded-r1 border border-r1-line bg-r1-paper py-2 pl-3.5 pr-2">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="t-label">{label}</span>
                <span className="text-[15px] font-medium leading-5 text-r1-ink [overflow-wrap:anywhere]">{shown ?? copy}</span>
            </div>
            <Button size="sm" aria-label={copyLabel} onClick={() => void copyText(copy, done)}>
                <Icon icon={Copy} />
                Copy
            </Button>
        </div>
    );
}

/** "Live at <address>", the address opening the site. Wraps on a phone instead of running off the card. */
function LiveLine({ url }: { url: string }) {
    return (
        <span className="t-status items-start whitespace-normal">
            <Dot tone="done" className="mt-[5px]" />
            <span className="min-w-0 [overflow-wrap:anywhere]">
                Live at{" "}
                <a className="t-link" href={url} target="_blank" rel="noopener noreferrer">
                    {hostOf(url)}
                </a>
            </span>
        </span>
    );
}

/**
 * What is being paid for: the site's live page (the board draws a
 * screenshot; this is the page itself, desk only, since on a phone it would
 * load a whole website for a thumbnail), its name, whether it is up, and the
 * aside (the amount, or the way to the site once paid).
 */
function SiteSummary({ submission, label, note, aside, footer }: { submission: Submission; label: string; note?: ReactNode; aside?: ReactNode; footer?: ReactNode }) {
    const name = submission?.businessName ?? "Your website";
    const url = liveUrlOf(submission?.websiteUrl);
    // Taken offline for want of payment (convex/unpublish.ts): it is not live.
    const offline = submission?.status === "unpublished";
    return (
        <section className="t-card flex flex-col gap-4 p-5" aria-label={label}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
                {url && !offline && (
                    <div className="hidden w-[152px] shrink-0 overflow-hidden rounded-r1 border border-r1-line sm:block">
                        <LiveSitePreview url={url} name={name} />
                    </div>
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <p className="t-h2 [overflow-wrap:anywhere]">{name}</p>
                    {offline ? <Status {...submissionStatus("unpublished", "owner")} /> : url ? <LiveLine url={url} /> : null}
                    {note && <p className="t-meta">{note}</p>}
                </div>
                {aside}
            </div>
            {footer && (
                <>
                    <hr className="t-divider" />
                    {footer}
                </>
            )}
        </section>
    );
}

/** The status card beside the instructions (sticky on a desk). */
function StatusCard({ status, title, meta, children }: { status: StatusWord; title: ReactNode; meta: ReactNode; children: ReactNode }) {
    return (
        <aside className="t-card flex flex-col gap-5 p-5 sm:p-6 lg:sticky lg:top-6" aria-label="Payment status">
            <div className="flex flex-col gap-2">
                <Status {...status} />
                <h2 className="t-h2">{title}</h2>
                <p className="t-meta">{meta}</p>
            </div>
            <hr className="t-divider" />
            {children}
        </aside>
    );
}

function Step({ n, title, meta, children }: { n: number; title: ReactNode; meta: ReactNode; children: ReactNode }) {
    return (
        <li className="flex gap-4 border-t border-r1-line p-4 first:border-t-0 sm:p-6">
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border-[1.5px] border-r1-ink text-[13px] font-semibold tabular-nums text-r1-ink">
                {n}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                    <h3 className="text-[15px] font-semibold leading-[22px] text-r1-ink">{title}</h3>
                    <p className="t-meta">{meta}</p>
                </div>
                {children}
            </div>
        </li>
    );
}

function AfterItem({ icon, title, children }: { icon: LucideIcon; title: ReactNode; children: ReactNode }) {
    return (
        <li className="flex items-start gap-3">
            <Icon icon={icon} className="mt-0.5 shrink-0 text-r1-ink-3" />
            <div className="flex flex-col gap-0.5">
                <p className="t-body font-medium text-r1-ink">{title}</p>
                <p className="t-meta">{children}</p>
            </div>
        </li>
    );
}

/** Email and phone, each with Copy. */
function ReachUs({ id, title, note }: { id: string; title: string; note: ReactNode }) {
    return (
        <section className="flex flex-col gap-3" aria-labelledby={id}>
            <h2 className="t-h2" id={id}>
                {title}
            </h2>
            <CopyRow label="Email" copy={SUPPORT_EMAIL} copyLabel="Copy support email" done="Support email copied" />
            <CopyRow label="Phone" copy={PHONE_DISPLAY} shown={<span className="t-num">{PHONE_DISPLAY}</span>} copyLabel="Copy phone number" done="Phone number copied" />
            <p className="t-meta">{note}</p>
        </section>
    );
}

function ReceiptRow({ term, children }: { term: string; children: ReactNode }) {
    return (
        <div className="t-row justify-between sm:px-6">
            <dt className="t-meta shrink-0">{term}</dt>
            <dd className="m-0 min-w-0 text-right text-sm leading-5 text-r1-ink">{children}</dd>
        </div>
    );
}

/* ── Pending ───────────────────────────────────────────────────────── */

export function PendingView({ token, submission, now, wiseEmail }: ViewProps & { wiseEmail: string }) {
    const name = submission?.businessName ?? null;
    const money = formatMoney(token.amount);
    const url = liveUrlOf(submission?.websiteUrl);
    const offline = submission?.status === "unpublished";

    // A custom domain rides on the same transfer. Split it out the way the
    // payment email does (lib/email/templates.ts): the domain's real price,
    // else the flat add-on, and the website is the rest.
    const domain = submission?.requestedDomain || null;
    const addOn = domain ? domainAddOnFor("with_custom_domain", submission?.domainCostPHP) : 0;
    const websiteLine = token.amount - addOn;

    const copyAll = () =>
        void copyText(
            paymentDetailsText({ wiseEmail, accountName: OPERATOR, amount: token.amount, referenceCode: token.referenceCode }),
            "All payment details copied",
        );

    return (
        <Columns
            aside={
                <StatusCard status={{ tone: "attn", word: "Needs you" }} title="Waiting for your transfer" meta={`This page updates on its own once we receive ${money}.`}>
                    <Timeline
                        items={[
                            // The board dates this step; nothing the page can read records when the site went live.
                            { tone: "done", label: "Website went live" },
                            { tone: "done", label: "Payment link sent to you", date: shortDate(token.emailSentAt ?? token.createdAt, now) },
                            { tone: "attn", label: <span className="font-medium text-r1-ink">You send {money} by Wise</span>, date: "Waiting" },
                            { tone: "off", label: <span className="text-r1-ink-3">Receipt on this page</span>, date: "After we match it" },
                        ]}
                    />
                    <hr className="t-divider" />
                    <p className="flex items-center gap-2 text-[13px] leading-[18px] text-r1-ink-2">
                        <Icon icon={Clock} className="shrink-0 text-r1-ink-3" />
                        <span>
                            Link works until <strong className="font-medium text-r1-ink">{shortDate(token.expiresAt, now)}</strong>, {linkDays(token)} days after it was sent.
                        </span>
                    </p>
                    <Button variant="primary" block onClick={copyAll}>
                        <Icon icon={Copy} />
                        Copy all payment details
                    </Button>
                    <p className="t-meta flex items-center gap-2">
                        <Icon icon={Lock} className="shrink-0" />
                        <span>This link is only for {name ?? "your business"}. Please do not share it.</span>
                    </p>
                </StatusCard>
            }
        >
            <PageHeader title="Pay for your website" sub="How do I pay for my website?" />

            <SiteSummary
                submission={submission}
                label="What you are paying for"
                note={url && !offline ? "Your site is already up. Pay once to keep it." : null}
                aside={
                    <div className="flex shrink-0 flex-col gap-1 border-t border-r1-line pt-4 sm:items-end sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                        <span className="t-label">You pay</span>
                        <span className="t-figure">{money}</span>
                        <span className="t-meta">One time. No monthly fee.</span>
                    </div>
                }
                footer={
                    domain && websiteLine > 0 ? (
                        <MoneyLines>
                            <MoneyLine label="Website, paid once" amount={formatMoney(websiteLine)} />
                            <MoneyLine label={<span className="[overflow-wrap:anywhere]">Custom domain · {domain}</span>} amount={formatMoney(addOn, "credit")} />
                            <MoneyLine label="You pay" amount={money} total />
                        </MoneyLines>
                    ) : null
                }
            />

            <section className="flex flex-col gap-4" aria-labelledby="py-steps-title">
                <div className="flex flex-col gap-1">
                    <h2 className="t-h2" id="py-steps-title">
                        Send it by Wise in 3 steps
                    </h2>
                    <p className="t-meta">Copy each line straight into the Wise app.</p>
                </div>
                <ol className="t-card m-0 list-none p-0">
                    <Step n={1} title="Open Wise and send to Tendso" meta="Pick “Send money”, then search for our Wise email.">
                        <CopyRow label="Wise email" copy={wiseEmail} copyLabel="Copy Wise email" done="Wise email copied" />
                        <CopyRow label="Account name (check it matches)" copy={OPERATOR} copyLabel="Copy account name" done="Account name copied" />
                        <div>
                            {/* Wise's own send screen with our email filled in (the old page's "Open Wise App to Send"). */}
                            <ButtonLink size="sm" href={`https://wise.com/send?recipient=${encodeURIComponent(wiseEmail)}`} target="_blank" rel="noopener noreferrer">
                                <Icon icon={ExternalLink} />
                                Open Wise
                            </ButtonLink>
                        </div>
                    </Step>
                    <Step n={2} title={`Send exactly ${money}, in Philippine pesos`} meta="The exact amount helps us match your transfer. Currency: PHP.">
                        <CopyRow
                            label="Amount"
                            copy={transferAmount(token.amount)}
                            shown={<span className="t-num">{transferAmountShown(token.amount)} PHP</span>}
                            copyLabel="Copy amount"
                            done={`Amount copied: ${transferAmount(token.amount)}`}
                        />
                    </Step>
                    <Step n={3} title="Paste this code in the note, then send" meta="Wise calls it “Reference” or “Note to recipient”.">
                        <Highlight className="flex flex-col gap-3 p-4">
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <span className="t-label t-hl-label">Your reference code</span>
                                    <span className="font-r1-mono text-[22px] font-medium leading-7 tracking-[0.04em] text-r1-ink [overflow-wrap:anywhere]">
                                        {token.referenceCode}
                                    </span>
                                </div>
                                <Button aria-label="Copy reference code" onClick={() => void copyText(token.referenceCode, "Reference code copied. Paste it in the Wise note.")}>
                                    <Icon icon={Copy} />
                                    Copy code
                                </Button>
                            </div>
                            <p className="flex items-start gap-2 text-[13px] leading-[18px] text-r1-gold-ink">
                                <Icon icon={Shield} className="mt-px shrink-0" />
                                <span>Always include this code. It is how we know the money is from you. Without it, a person has to match your payment by hand, which takes longer.</span>
                            </p>
                        </Highlight>
                    </Step>
                </ol>
            </section>

            <section className="flex flex-col gap-4" aria-labelledby="py-after-title">
                <h2 className="t-h2" id="py-after-title">
                    What happens after you pay
                </h2>
                <ul className="m-0 flex list-none flex-col gap-4 p-0">
                    <AfterItem icon={RotateCw} title="We match it automatically">
                        When Wise tells us the money arrived, the code links it to your site. You do not need to send a screenshot.
                    </AfterItem>
                    <AfterItem icon={Receipt} title="This page turns into your receipt">
                        It changes to “Paid” on its own once we match your money, so you can check it any time.
                    </AfterItem>
                    {/* An offline site does not come back by itself when the money arrives, so this one would not be true. */}
                    {!offline && (
                        <AfterItem icon={Check} title="Nothing else to do">
                            Your site stays live. Changes are free for the first year: ask for them through Help.
                        </AfterItem>
                    )}
                </ul>
            </section>

            <Folds>
                <Fold title="Paying from abroad, or no Wise account?">
                    <div className="flex flex-col gap-2">
                        <p className="t-body">Wise works from most countries. Send to the same email, choose PHP as the currency the recipient gets, and keep the code in the note.</p>
                        <p className="t-body">
                            No Wise account and no way to open one? Email{" "}
                            <a className="t-link font-medium" href={`mailto:${SUPPORT_EMAIL}`}>
                                {SUPPORT_EMAIL}
                            </a>{" "}
                            or call{" "}
                            <a className="t-link t-num font-medium" href={PHONE_TEL}>
                                {PHONE_DISPLAY}
                            </a>{" "}
                            with your code, and we will sort out another way to pay.
                        </p>
                    </div>
                </Fold>
            </Folds>
        </Columns>
    );
}

/* ── Paid ──────────────────────────────────────────────────────────── */

export function PaidView({ token, submission, now, ownerHome }: ViewProps & { ownerHome: boolean }) {
    const name = submission?.businessName ?? null;
    const money = formatMoney(token.amount);
    const paidAt = paidOnOf(token, submission);
    const url = liveUrlOf(submission?.websiteUrl);
    const domain = submission?.requestedDomain || null;
    // Only the Wise webhook writes a transaction id: then the method is known.
    const byWise = Boolean(token.wiseTransactionId);

    // "See my website": a signed-in owner goes to My website, as the board
    // draws it. Everyone else (most payers have no account) gets the live site.
    const see = ownerHome ? (
        <ButtonLink variant="primary" href="/my-business">
            See my website
        </ButtonLink>
    ) : url ? (
        <ButtonLink variant="primary" href={url} target="_blank" rel="noopener noreferrer">
            See my website
        </ButtonLink>
    ) : null;

    return (
        <Columns
            aside={
                <StatusCard
                    status={{ tone: "done", word: "Paid" }}
                    title="All done"
                    meta={`We received ${money}${paidAt ? ` on ${shortDate(paidAt, now)}` : ""} and matched it to your website.`}
                >
                    <Timeline
                        items={[
                            { tone: "done", label: "Website went live" },
                            { tone: "done", label: "Payment link sent to you", date: shortDate(token.emailSentAt ?? token.createdAt, now) },
                            { tone: "done", label: byWise ? `${money} received by Wise` : `${money} received`, date: paidAt ? shortDate(paidAt, now) : undefined },
                        ]}
                    />
                </StatusCard>
            }
        >
            <PageHeader title={paidAt ? `Thank you — paid ${shortDate(paidAt, now)}` : "Thank you — paid"} sub="Your website is yours. Keep this page as your receipt." />

            <SiteSummary submission={submission} label="Your website" note="Paid in full. Nothing more to pay." aside={see ? <div className="shrink-0">{see}</div> : null} />

            <section className="flex flex-col gap-4" aria-labelledby="py-receipt-title">
                <h2 className="t-h2" id="py-receipt-title">
                    Receipt
                </h2>
                <dl className="t-card m-0">
                    <ReceiptRow term="Amount paid">
                        <span className="t-num text-[15px] font-semibold">{money}</span>
                    </ReceiptRow>
                    {paidAt && <ReceiptRow term="Paid on">{longDate(paidAt)}</ReceiptRow>}
                    {byWise && <ReceiptRow term="Method">Wise transfer</ReceiptRow>}
                    <ReceiptRow term="Reference code">
                        <span className="t-mono text-r1-ink">{token.referenceCode}</span>
                    </ReceiptRow>
                    {domain && (
                        <ReceiptRow term="Custom domain">
                            <span className="inline-flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                                <span className="[overflow-wrap:anywhere]">{domain}</span>
                                <Status {...domainStatus(submission?.domainStatus)} />
                            </span>
                        </ReceiptRow>
                    )}
                    <ReceiptRow term="For">{name ? `${name} website, one-time` : "Your website, one-time"}</ReceiptRow>
                </dl>
            </section>

            <p className="t-meta">
                Want a change on your site? Changes are free for the first year.{" "}
                <Link className="t-link" href="/contact">
                    Ask through Help
                </Link>
                .
            </p>
        </Columns>
    );
}

/* ── Expired ───────────────────────────────────────────────────────── */

export function ExpiredView({ token, submission, now }: ViewProps) {
    const name = submission?.businessName ?? null;
    const money = formatMoney(token.amount);
    const ended = shortDate(token.expiresAt, now);

    return (
        <Columns
            aside={
                <StatusCard status={{ tone: "attn", word: "Needs a new link" }} title={`Link expired ${ended}`} meta={`No payment arrived before the link ended. You still owe ${money}.`}>
                    <Timeline
                        items={[
                            { tone: "done", label: "Website went live" },
                            { tone: "done", label: "Payment link sent to you", date: shortDate(token.emailSentAt ?? token.createdAt, now) },
                            { tone: "off", label: <span className="text-r1-ink-3">Link expired</span>, date: ended },
                            // The board tracks "asked / not asked"; nothing records the request, so no date here.
                            { tone: "attn", label: <span className="font-medium text-r1-ink">New link from Tendso</span> },
                        ]}
                    />
                </StatusCard>
            }
        >
            <PageHeader title="This link expired — ask for a new one" sub={`Payment links last ${linkDays(token)} days. This one ended on ${ended}.`} />

            <section className="t-card t-card-pad flex flex-col gap-4" aria-labelledby="py-exp-title">
                <div className="flex flex-col gap-1">
                    <h2 className="t-h2" id="py-exp-title">
                        Please wait for a new link before you send money
                    </h2>
                    <p className="t-body">If you already sent money with the old code, it still reaches us.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <ButtonLink variant="primary" href={newLinkMailto(name, token.referenceCode)}>
                        Ask for a new link
                    </ButtonLink>
                    <ButtonLink href="/knowledge">Other questions</ButtonLink>
                </div>
            </section>

            <ReachUs
                id="py-exp-contact"
                title="Or reach us directly"
                note={
                    <>
                        Mention your old code, <span className="t-mono text-r1-ink-2">{token.referenceCode}</span>, so we find you fast.
                    </>
                }
            />
        </Columns>
    );
}

/* ── Not found ─────────────────────────────────────────────────────── */

export function NotFoundView() {
    return (
        <div className="flex w-full max-w-[600px] flex-col gap-8">
            <PageHeader title="We can't find this payment link" sub="The link may be missing a few letters, or it was replaced by a newer one." />
            <section className="t-card t-card-pad flex flex-col gap-4" aria-labelledby="py-nf-title">
                <div className="flex flex-col gap-1">
                    <h2 className="t-h2" id="py-nf-title">
                        Try this first
                    </h2>
                    <p className="t-body">
                        Open the payment email or text again and tap the link there, instead of typing it. If it still does not open, tell us the name of your business and we will send the right link.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <ButtonLink variant="primary" href="/contact">
                        Contact Tendso
                    </ButtonLink>
                    <ButtonLink variant="ghost" href="/">
                        Go to tendso.com
                    </ButtonLink>
                </div>
            </section>
            <ReachUs id="py-nf-contact" title="Reach us directly" note="Please do not send money until you have a working link." />
        </div>
    );
}

/* ── Loading ───────────────────────────────────────────────────────── */

/** The pending page's shape: title, summary, steps, and the status card. */
export function PayLoading() {
    return (
        <Loading label="Loading your payment details">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-12" aria-hidden="true">
                <div className="flex flex-col gap-8">
                    <div className="flex flex-col gap-3">
                        <Skeleton width="60%" height={36} />
                        <Skeleton width="40%" height={14} />
                    </div>
                    <div className="t-card flex flex-col gap-3 p-5">
                        <Skeleton width="40%" height={16} />
                        <Skeleton width="70%" height={12} />
                        <Skeleton width={96} height={32} />
                    </div>
                    <div className="t-card flex flex-col gap-4 p-5 sm:p-6">
                        <SkeletonText lines={3} />
                        <Skeleton height={52} />
                        <Skeleton height={52} />
                    </div>
                </div>
                <div className="t-card flex flex-col gap-4 p-5 sm:p-6">
                    <Skeleton width="35%" height={12} />
                    <Skeleton width="70%" height={16} />
                    <SkeletonText lines={4} />
                    <Skeleton height={40} />
                </div>
            </div>
        </Loading>
    );
}
