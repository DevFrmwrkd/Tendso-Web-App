"use client";

/**
 * /v2/pay/[token]: the page every payment email links to (pages/pay.html).
 *
 * It reads the same token-scoped receipt as /pay/[token]: `paymentTokens.getByToken`
 * and `paymentTokens.getSubmissionByToken`, and decides which of the four states to show with the
 * same `payView` (pending, paid, expired, not found), live through Convex.
 *
 * The facts it states follow the brief:
 *  - the amount is the token's own amount; its `kind` says what it is: the whole order
 *    ('full' / legacy), a down payment ('deposit') or what is left after one ('balance');
 *  - a down payment (from ₱500, docs/v2-api-owners.md §5) is offered for real to a signed-in
 *    payer (the owner, their field agent or an admin) whose order allows it: it makes a
 *    deposit pay link and opens it. Anyone else sees the line with "Ask us how";
 *  - Wise works for every kind (same email, account name and the token's reference code);
 *  - GCash, Maya and Card open Xendit (api.xendit.createCheckout, ./xendit.ts) behind
 *    NEXT_PUBLIC_XENDIT_ENABLED, and read "Coming soon" until it is "true";
 *  - "Your site is live. Pay to keep it live." is said only for a field-agent sale (payRules.ts).
 *    For every other sale the page does not claim the site is up.
 */

import { useConvex, useConvexAuth, useMutation, useQuery } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import { ConvexError } from "convex/values";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import {
    checkoutExpiryAt,
    hostOf,
    longDate,
    paymentDetailsText,
    payView,
    shortDate,
    transferAmount,
    transferAmountShown,
} from "@/app/pay/[token]/_components/payState";
import { useNow } from "@/app/pay/[token]/_components/useNow";
import { pendingPaymentSummary, receiptSummary, safePaymentUrl } from "@/app/pay/[token]/_components/paymentPresentation";
import LiveSitePreview from "@/components/landing/LiveSitePreview";
import { ExpiredPaymentAction } from '@/components/payments/ExpiredPaymentAction';
import { Button } from "@/components/v2";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import type { PaymentSubmissionSummary } from "@/convex/paymentTokens";
import { useOwnerAuth } from "@/hooks/useOwnerAuth";
import { OPERATOR, SUPPORT_EMAIL } from "@/lib/contact";
import { getPaymentConfig } from "@/lib/payment/config";
import { formatPHP, isComped } from "@/lib/pricing";

import { isFieldAgentSale, pendingCopy } from "./payRules";
import { CheckIcon, PbBrand, PlusIcon, copyWithToast, usePbToast } from "./shared";
import { XENDIT_ENABLED, useXenditCheckout, xenditErrorMessage, type XenditMethod } from "./xendit";

type Token = Doc<"paymentTokens">;
type Submission = PaymentSubmissionSummary | null;

const paymentConfig = getPaymentConfig();

/** The smallest down payment (packages/shared/pricing.ts MIN_DOWN_PAYMENT). The agent keeps their whole cut upfront. */
const DOWN_PAYMENT = 500;

export function PayPage() {
    const params = useParams();
    const token = params.token as string;
    const now = useNow();
    const { isOwner } = useOwnerAuth();

    const paymentToken = useQuery(api.paymentTokens.getByToken, { token });
    const submission = useQuery(api.paymentTokens.getSubmissionByToken, paymentToken ? { token } : "skip");
    const publication = useQuery(api.paymentTokens.getPublicationByToken, paymentToken ? { token } : "skip");
    const wiseEmail = paymentConfig.wiseEmail || "";
    // Wait for the submission too: its status decides "paid" when an admin matched the transfer by hand.
    const loading = paymentToken === undefined || (paymentToken !== null && (submission === undefined || publication === undefined));

    return <PayView loading={loading} token={paymentToken ?? null} submission={submission ?? null} publishedUrl={publication?.liveUrl ?? null} now={now} wiseEmail={wiseEmail} ownerHome={isOwner} />;
}

/** The page itself, from data. Split from PayPage so every state can be rendered without a backend. */
export function PayView({
    loading,
    token,
    submission,
    now,
    wiseEmail,
    ownerHome,
    publishedUrl,
}: {
    loading: boolean;
    token: Token | null;
    submission: Submission;
    now: number;
    wiseEmail: string;
    ownerHome: boolean;
    publishedUrl?: string | null;
}) {
    const { node: toast, show } = usePbToast();
    const view = loading ? "loading" : !token ? "notfound" : payView(token, submission, now);

    return (
        <div className="pb-py">
            <header className="pb-py-bar">
                <div className="v2-wrap pb-py-bar-in">
                    <PbBrand />
                    <Button href="/help" variant="ghost" size="sm">
                        Help
                    </Button>
                </div>
            </header>
            <main className="pb-py-main">
                {view === "loading" && <Loading />}
                {view === "notfound" && <NotFound />}
                {token && view === "pending" && <Pending token={token} submission={submission} now={now} wiseEmail={wiseEmail} show={show} publishedUrl={publishedUrl} />}
                {token && view === "paid" && <Paid token={token} submission={submission} ownerHome={ownerHome} publishedUrl={publishedUrl} />}
                {token && view === "expired" && <Expired token={token} submission={submission} now={now} />}
            </main>
            {toast}
        </div>
    );
}

/* ---- hero ------------------------------------------------------------------ */

function Hero({
    name,
    state,
    dot,
    title,
    sub,
    ctas,
    url,
    preview,
    noPreviewText = "Private until you pay. We send your link the moment it is live.",
}: {
    name: string | null;
    state: string;
    dot?: "live" | "off";
    title: string;
    sub: string;
    ctas?: ReactNode;
    url: string | null;
    preview: string;
    noPreviewText?: string;
}) {
    return (
        <section className="v2-wrap pb-py-hero" aria-labelledby="py-h">
            <div className="pb-py-hero-text">
                <p className="pb-py-biz">
                    <span className={`pb-py-dot ${dot === "live" ? "is-live" : dot === "off" ? "is-off" : ""}`} />
                    <span>{state}</span>
                    {name && <b>{name}</b>}
                </p>
                <h1 className="pb-py-h" id="py-h">
                    {title}
                </h1>
                <p className="pb-py-sub">{sub}</p>
                {ctas && <div className="pb-py-hero-cta">{ctas}</div>}
            </div>
            <div className="pb-py-stage">
                {url ? (
                    <div className="pb-browser pb-py-browser">
                        <div className="pb-browser-bar" aria-hidden="true">
                            <div className="pb-browser-dots">
                                <i />
                                <i />
                                <i />
                            </div>
                            <div className="pb-browser-url">{hostOf(url)}</div>
                            <div className="pb-browser-dots" style={{ visibility: "hidden" }}>
                                <i />
                                <i />
                                <i />
                            </div>
                        </div>
                        <LiveSitePreview url={url} name={name ?? "Your website"} />
                    </div>
                ) : (
                    <div className="pb-py-nopreview">
                        <p className="pb-py-nopreview-name">{name ?? "Your website"}</p>
                        <p className="pb-py-nopreview-p">{noPreviewText}</p>
                    </div>
                )}
                <span className="pb-py-preview">{preview}</span>
            </div>
        </section>
    );
}

/* ---- pending ----------------------------------------------------------------- */

function Pending({ token, submission, now, wiseEmail, show, publishedUrl }: { token: Token; submission: Submission; now: number; wiseEmail: string; show: (m: string) => void; publishedUrl?: string | null }) {
    const name = submission?.businessName ?? null;
    const money = formatPHP(token.amount);
    const url = safePaymentUrl(publishedUrl === undefined ? submission?.status === "unpublished" || submission?.unpublishedAt ? null : submission?.websiteUrl : publishedUrl);
    const live = !!url;
    const agentSale = isFieldAgentSale(submission);
    const text = pendingCopy({ agentSale, live });
    const details = pendingPaymentSummary(token, submission);
    const { domain, addOn, websiteLine, discount, kind } = details;
    const struckTotal = kind === "full" && discount && !domain ? discount.listPrice : null;
    const copy = (value: string, done: string) => void copyWithToast(value, done, show);
    const balanceAfter = kind === "deposit" && details.balance !== null ? Math.max(0, details.balance - token.amount) : null;
    const priceLabel = kind === "deposit" ? "Down payment" : kind === "balance" ? "The rest of your payment" : text.priceLabel;
    const payCta = kind === "full" ? `Pay ${money} once` : `Pay ${money} now`;

    // A current token is not necessarily a current payment request: another
    // receipt, a price update, or an unfinished hosted checkout can supersede it.
    const processing = !!token.xenditCheckoutState;
    const hostedOpen = !!token.xenditInvoiceId && (token.xenditExpiresAt === undefined || token.xenditExpiresAt > now);
    if (details.stale || processing || hostedOpen || (!wiseEmail.trim() && !XENDIT_ENABLED)) {
        return <PendingUnavailable token={token} submission={submission} processing={processing} hostedOpen={hostedOpen} stale={details.stale} />;
    }
    // Card/e-wallet checkout is configured separately from Wise. A missing Wise
    // recipient must hide transfer instructions without disabling that provider.
    if (!wiseEmail.trim()) {
        return <>
            <Hero name={name} state="Awaiting payment" title="Your website payment." sub="Check the amount, then choose a card or e-wallet checkout." url={live ? url : null} preview={live ? `Live · ${hostOf(url!)}` : "Your website payment"} noPreviewText="Your private website and payment request stay connected to this business." />
            <section className="v2-wrap pb-py-pay" aria-labelledby="checkout-method-h">
                <div className="pb-py-price">
                    <p className="pb-label">{kind === "deposit" ? "Down payment" : kind === "balance" ? "Balance payment" : "Website payment"}</p>
                    <h2 className="pb-py-amt" id="checkout-method-h">{money}<small>Philippine pesos · PHP</small></h2>
                    <dl className="pb-py-split">
                        {details.total !== null && <div><dt>Order total</dt><dd>{formatPHP(details.total)}</dd></div>}
                        {details.paid !== null && details.paid > 0 && <div><dt>Paid so far</dt><dd>{formatPHP(details.paid)}</dd></div>}
                        {balanceAfter !== null && <div><dt>After this payment</dt><dd>{formatPHP(balanceAfter)} remaining</dd></div>}
                    </dl>
                    <MethodArea token={token.token} label="Card and e-wallets" />
                    <p className="pb-py-methods-msg">This page updates after your payment is confirmed. Already paid? Check its status before starting another checkout.</p>
                    <Button href="/help#contact" variant="ghost">Need help with a payment?</Button>
                </div>
            </section>
        </>;
    }

    return (
        <>
            <Hero
                name={name}
                state={text.state}
                title={text.title}
                sub={text.sub}
                url={live ? url : null}
                preview={text.preview}
                ctas={
                    <>
                        {live && (
                            <Button href={url!} variant="ghost" size="lg" target="_blank" rel="noopener noreferrer">
                                See your site
                            </Button>
                        )}
                        <Button href="#pay" variant="primary" size="lg">
                            {payCta}
                        </Button>
                    </>
                }
            />

            <section className="v2-wrap pb-py-pay" id="pay" aria-labelledby="pay-h">
                <div className="pb-py-price">
                    <p className="pb-label">{priceLabel}</p>
                    <h2 className="pb-py-amt" id="pay-h">
                        {struckTotal !== null && (
                            <span className="pb-py-was">
                                <span className="sr-only">Was </span>
                                {formatPHP(struckTotal)}
                            </span>
                        )}
                        <span className="sr-only">{struckTotal !== null ? "Now " : ""}</span>
                        {money}.<small>{kind === "full" ? "Once. No monthly fee." : kind === "deposit" ? "Now. No monthly fee." : "Then it's paid. No monthly fee."}</small>
                    </h2>
                    {kind === "full" && domain && websiteLine !== null && websiteLine > 0 && addOn !== null && (
                        <dl className="pb-py-split">
                            <div>
                                <dt>Website, paid once</dt>
                                <dd>{formatPHP(websiteLine)}</dd>
                            </div>
                            <div>
                                <dt className="pb-py-wrap">Custom domain · {domain}</dt>
                                <dd>{formatPHP(addOn)}</dd>
                            </div>
                        </dl>
                    )}
                    {kind === "full" ? (
                        <DownPaymentOffer submissionId={token.submissionId} />
                    ) : kind === "deposit" ? (
                        <p className="pb-py-down">
                            <i />
                            <span>
                                Down payment. {balanceAfter ? <>The rest, <b>{formatPHP(balanceAfter)}</b>, later.</> : "The rest later."}
                            </span>
                        </p>
                    ) : null}
                    <MethodArea token={token.token} />
                </div>

                <ol className="pb-py-steps">
                    <li className="pb-py-step">
                        <span className="pb-py-n">1</span>
                        <div className="pb-py-step-in">
                            <h3>Open Wise. Send to Tendso.</h3>
                            <CopyRow label="Wise email" value={wiseEmail} done="Wise email copied" onCopy={copy} />
                            <CopyRow label="Name" value={OPERATOR} done="Name copied" onCopy={copy} />
                            <p className="pb-py-wise-link">
                                <a className="pb-link-arr" href={`https://wise.com/send?recipient=${encodeURIComponent(wiseEmail)}`} target="_blank" rel="noopener noreferrer">
                                    Open Wise
                                    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                                        <path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </a>
                            </p>
                        </div>
                    </li>
                    <li className="pb-py-step">
                        <span className="pb-py-n">2</span>
                        <div className="pb-py-step-in">
                            <h3>Send this exact amount.</h3>
                            <CopyRow label="Amount" value={`${transferAmountShown(token.amount)} PHP`} copyValue={transferAmount(token.amount)} done="Amount copied" onCopy={copy} />
                        </div>
                    </li>
                    <li className="pb-py-step pb-py-step--code">
                        <span className="pb-py-n">3</span>
                        <div className="pb-py-step-in">
                            <h3>Paste this code in the note.</h3>
                            <div className="pb-py-code">
                                <b>{token.referenceCode}</b>
                                <button type="button" className="v2-btn v2-btn--dark" onClick={() => copy(token.referenceCode, "Code copied. Paste it in the Wise note")}>
                                    Copy code
                                </button>
                            </div>
                            <p className="pb-py-note">
                                <i />
                                This code connects the transfer to your website. Transfers without it need team verification.
                            </p>
                        </div>
                    </li>
                </ol>

                <div className="v2-tile v2-tile--quiet pb-py-wait">
                    <div className="pb-py-wait-l">
                        <span className="pb-py-pulse" aria-hidden="true" />
                        <div>
                            <p className="pb-py-wait-h">Waiting for your transfer</p>
                            <p className="pb-py-wait-p">
                                This page updates when your payment is confirmed. If your transfer needs review, our team verifies it before it is recorded. Check its status before sending another payment.
                            </p>
                            <p className="pb-py-wait-p">
                                This checkout ends <b>{shortDate(checkoutExpiryAt(token), now)}</b>.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="v2-btn v2-btn--primary"
                        onClick={() => copy(paymentDetailsText({ wiseEmail, accountName: OPERATOR, amount: token.amount, referenceCode: token.referenceCode }), "All payment details copied")}
                    >
                        Copy all details
                    </button>
                </div>

                <details className="pb-qa pb-py-abroad">
                    <summary>
                        Paying from abroad, or no Wise account?
                        <span className="pb-qa-plus">
                            <PlusIcon />
                        </span>
                    </summary>
                    <div className="pb-qa-a">
                        <p>
                            Wise works from most countries. Send to the same email, pick PHP as what Tendso gets, and keep the code in the note. No Wise account and no way to open one? Email{" "}
                            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with your code and we will sort out another way to pay. Stuck? <Link href="/help#contact">Ask a person.</Link>
                        </p>
                    </div>
                </details>
            </section>
        </>
    );
}

function PendingUnavailable({ token, submission, processing, hostedOpen, stale }: { token: Token; submission: Submission; processing: boolean; hostedOpen: boolean; stale: boolean }) {
    const covered = isComped(submission);
    const checkout = !processing && hostedOpen && !stale ? safePaymentUrl(token.xenditInvoiceUrl) : null;
    const title = processing ? "We’re checking an earlier checkout." : covered ? "No payment is needed." : hostedOpen ? "Continue your existing checkout." : stale ? "Let’s check your latest balance." : "Payment details aren’t ready.";
    const description = processing ? "An earlier checkout may still be open. Contact our team before starting another payment."
        : covered ? "Your order is covered. This old payment request no longer applies."
        : hostedOpen ? "Use the checkout already opened for this request. If you have already paid, wait for confirmation before paying again."
        : stale ? "Your order or recorded payments have changed. Check your business workspace for the current amount."
        : "Contact Tendso for verified payment instructions before sending money.";
    return <>
        <Hero name={submission?.businessName ?? null} state={covered ? "Order covered" : "Payment update"} title={title} sub={description} url={null} preview="Your payment request" noPreviewText="Your business and any confirmed payments are saved." />
        <section className="v2-wrap pb-py-done" aria-labelledby="payment-check-h">
            <h2 className="pb-py-done-h" id="payment-check-h">Check before you pay.</h2>
            <p className="pb-py-done-p">This link’s reference: <b className="pb-mono">{token.referenceCode}</b>. Already sent a transfer? Ask our team to check it before sending money again.</p>
            <div className="pb-py-done-cta">
                {checkout ? <Button href={checkout} variant="primary">Continue checkout</Button> : <Button href={`/my-business/${encodeURIComponent(token.submissionId)}`} variant="primary">View business payment</Button>}
                <Button href="/help#contact" variant="ghost">Contact Tendso</Button>
            </div>
        </section>
    </>;
}

function CopyRow({ label, value, copyValue, done, onCopy }: { label: string; value: string; copyValue?: string; done: string; onCopy: (text: string, done: string) => void }) {
    return (
        <div className="pb-py-copy">
            <span className="pb-py-k">{label}</span>
            <b>{value}</b>
            <button type="button" className="v2-btn v2-btn--ghost v2-btn--sm" aria-label={`Copy ${label.toLowerCase()}`} onClick={() => onCopy(copyValue ?? value, done)}>
                Copy
            </button>
        </div>
    );
}

/**
 * "Start with ₱500. The rest later." For a signed-in payer whose order allows a down payment
 * (ownerPayments.getPaymentState), a real button: it makes a deposit pay link and opens it.
 * Everyone else (not signed in, or an order that cannot take one) keeps "Ask us how".
 */
function DownPaymentOffer({ submissionId }: { submissionId: Token["submissionId"] }) {
    const convex = useConvex();
    const router = useRouter();
    const { isAuthenticated } = useConvexAuth();
    const createPayToken = useMutation(api.ownerPayments.createPayToken);
    const [fetched, setFetched] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const minimum = isAuthenticated ? fetched : null;

    useEffect(() => {
        let alive = true;
        if (!isAuthenticated) return;
        // A one-off read, not a subscription: it throws for a signed-in person who is not
        // this order's payer, and that must not break the page.
        convex
            .query(api.ownerPayments.getPaymentState, { submissionId })
            .then((state) => {
                if (alive) setFetched(state.billable && state.canPayDeposit && !state.needsApproval ? state.minDownPayment : null);
            })
            .catch(() => alive && setFetched(null));
        return () => {
            alive = false;
        };
    }, [convex, isAuthenticated, submissionId]);

    const start = async () => {
        if (minimum === null) return;
        setBusy(true);
        setMessage(null);
        try {
            const deposit = await createPayToken({ submissionId, kind: "deposit", amount: minimum });
            router.push(`/pay/${encodeURIComponent(deposit.token)}`);
        } catch (e) {
            setMessage(xenditErrorMessage(e));
            setBusy(false);
        }
    };

    return (
        <>
            <p className="pb-py-down">
                <i />
                <span>
                    Start with <b>{formatPHP(minimum ?? DOWN_PAYMENT)}</b>. The rest later.{" "}
                    {minimum === null && <Link href="/help#contact">Ask us how</Link>}
                </span>
            </p>
            {minimum !== null && (
                <Button variant="ghost" onClick={() => void start()} disabled={busy}>
                    {busy ? "One moment…" : `Pay ${formatPHP(minimum)} now`}
                </Button>
            )}
            {message && (
                <p className="pb-py-methods-msg" role="status">
                    {message}
                </p>
            )}
        </>
    );
}

/** GCash, Maya and Card through Xendit. Disabled with "Coming soon" until NEXT_PUBLIC_XENDIT_ENABLED is "true". */
function MethodArea({ token, label = "More ways to pay" }: { token: string; label?: string }) {
    const startXenditCheckout = useXenditCheckout();
    const [message, setMessage] = useState<string | null>(null);
    const [busy, setBusy] = useState<XenditMethod | null>(null);
    const methods: { id: XenditMethod; label: string }[] = [
        { id: "gcash", label: "GCash" },
        { id: "maya", label: "Maya" },
        { id: "card", label: "Card" },
    ];
    const start = async (m: XenditMethod) => {
        setMessage(null);
        setBusy(m);
        try {
            await startXenditCheckout(token, m);
        } catch (e) {
            setMessage(xenditErrorMessage(e));
            setBusy(null);
        }
    };
    return (
        <div className="pb-py-methods" aria-label="Other ways to pay">
            <p className="pb-py-methods-k">
                {label}
                {!XENDIT_ENABLED && <span className="pb-py-soon">Coming soon</span>}
            </p>
            <div className="pb-py-methods-row">
                {methods.map((m) => (
                    <button key={m.id} type="button" className="v2-btn v2-btn--ghost" disabled={!XENDIT_ENABLED || busy !== null} onClick={() => void start(m.id)}>
                        {m.label}
                    </button>
                ))}
            </div>
            {message && (
                <p className="pb-py-methods-msg" role="status">
                    {message}
                </p>
            )}
        </div>
    );
}

/* ---- paid -------------------------------------------------------------------- */

function Paid({ token, submission, ownerHome, publishedUrl }: { token: Token; submission: Submission; ownerHome: boolean; publishedUrl?: string | null }) {
    const receipt = receiptSummary(token, submission);
    const order = pendingPaymentSummary(token, submission);
    const covered = isComped(submission);
    const url = safePaymentUrl(publishedUrl === undefined ? submission?.status === "unpublished" || submission?.unpublishedAt ? null : submission?.websiteUrl : publishedUrl);
    const settled = receipt.balance === 0;
    const title = !receipt.confirmed ? covered ? "No balance due." : "Your payment is recorded."
        : receipt.kind === "deposit" ? "Down payment received." : receipt.kind === "balance" ? "Balance payment received." : "Payment received.";
    const sub = covered ? "Your order is covered. No payment is needed."
        : settled ? url ? "Paid in full. Your website is live." : "Paid in full. Keep this page for your records."
        : receipt.balance !== null ? formatPHP(receipt.balance) + " remains on your order." : "Contact our team to check your remaining balance.";
    return <>
        <Hero name={submission?.businessName ?? null} state={url ? "Live" : "Payment update"} dot={url ? "live" : undefined} title={title} sub={sub} url={url} preview={url ? "Live · " + hostOf(url) : "Not public yet"} noPreviewText="Your website’s publication status is separate from this receipt. We’ll send your public link once it is published." />
        <section className="v2-wrap pb-py-done" aria-labelledby="paid-h">
            <div className="pb-py-done-mark"><CheckIcon size={34} /></div>
            <h2 className="pb-py-done-h" id="paid-h">{receipt.confirmed ? "Your receipt." : "Your order’s payment status."}</h2>
            <p className="pb-py-done-p">{receipt.confirmed ? "This is the confirmed payment for this reference. Keep it for your records."
                : covered ? "This order is covered. This link does not identify a confirmed cash payment."
                : "Your order has been settled. This older link does not identify a separate confirmed transfer."}</p>
            <dl className="pb-py-receipt">
                {receipt.receivedAmount !== null && <div><dt>{receipt.kind === "deposit" ? "Down payment received" : receipt.kind === "balance" ? "Balance payment received" : order.domain ? "Full payment received" : "Website, paid once"}</dt><dd>{formatPHP(receipt.receivedAmount)}</dd></div>}
                {receipt.confirmed && order.domain && order.websiteLine !== null && <div><dt>Website</dt><dd>{formatPHP(order.websiteLine)}</dd></div>}
                {order.discount && <div><dt>Discount</dt><dd>{order.discount.percentOff}% off {formatPHP(order.discount.listPrice)}</dd></div>}
                {order.domain && <div><dt>Custom domain</dt><dd className="pb-py-wrap">{order.domain}</dd></div>}
                {receipt.total !== null && <div><dt>Order total</dt><dd>{formatPHP(receipt.total)}</dd></div>}
                {receipt.paid !== null && <div><dt>Paid so far</dt><dd>{formatPHP(receipt.paid)}</dd></div>}
                {receipt.balance !== null && <div><dt>Balance due</dt><dd>{formatPHP(receipt.balance)}</dd></div>}
                {receipt.receivedAt !== null && <div><dt>Confirmed on</dt><dd>{longDate(receipt.receivedAt)}</dd></div>}
                {receipt.method && <div><dt>Paid with</dt><dd>{receipt.method}</dd></div>}
                <div><dt>{receipt.confirmed ? "Reference code" : "This link’s reference"}</dt><dd className="pb-mono">{token.referenceCode}</dd></div>
                {url && <div><dt>Live at</dt><dd><a href={url} target="_blank" rel="noopener noreferrer">{hostOf(url)}</a></dd></div>}
            </dl>
            <div className="pb-py-done-cta">
                {receipt.confirmed && !settled && <BalancePayment token={token} balance={receipt.balance} />}
                {ownerHome ? <Button href={"/my-business/" + encodeURIComponent(token.submissionId)} variant="primary">View my business</Button>
                    : url ? <Button href={url} variant="primary" target="_blank" rel="noopener noreferrer">Open my website</Button> : null}
                <Button href="/help#contact" variant="ghost">Need a change?</Button>
            </div>
        </section>
    </>;
}

/** The same payer-authorized balance-token flow used by the owner app. */
function BalancePayment({ token, balance }: { token: Token; balance: number | null }) {
    const { isAuthenticated, isLoading } = useConvexAuth();
    const createPayToken = useMutation(api.ownerPayments.createPayToken);
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const start = async () => {
        setBusy(true);
        setMessage(null);
        try {
            // The server rechecks the payer, approval and the current balance.
            const next = await createPayToken({ submissionId: token.submissionId, kind: "balance" });
            router.push(`/pay/${encodeURIComponent(next.token)}`);
        } catch (error) {
            setMessage(error instanceof ConvexError && typeof error.data === "string" ? error.data : "We couldn't open your balance payment. Please try again or contact Tendso.");
            setBusy(false);
        }
    };
    if (isLoading) return <Button disabled>Loading payment options…</Button>;
    if (!isAuthenticated) return (
        <SignInButton mode="modal" forceRedirectUrl={`/pay/${encodeURIComponent(token.token)}`}>
            <Button>Sign in to pay the balance</Button>
        </SignInButton>
    );
    return (
        <>
            <Button disabled={busy} onClick={() => void start()}>{busy ? "One moment…" : balance === null ? "Pay the balance" : `Pay ${formatPHP(balance)} balance`}</Button>
            {message && <p className="pb-py-methods-msg" role="status">{message}</p>}
        </>
    );
}

/* ---- expired ------------------------------------------------------------------ */

function Expired({ token, submission, now }: { token: Token; submission: Submission; now: number }) {
    const name = submission?.businessName ?? null;
    return (
        <>
            <Hero
                name={name}
                state="Link expired"
                dot="off"
                title="This link expired."
                sub={`This checkout ended on ${shortDate(checkoutExpiryAt(token), now)}. You can open a fresh one below.`}
                url={null}
                preview="Payment link expired"
                noPreviewText="Open a fresh checkout to check the latest amount and payment status."
            />
            <section className="v2-wrap pb-py-done" aria-labelledby="exp-h">
                <h2 className="pb-py-done-h" id="exp-h">
                    Open a fresh checkout.
                </h2>
                <p className="pb-py-done-p">Your latest balance is checked first, including any confirmed down payment. Already transferred money? Check that payment before sending again.</p>
                <div className="pb-py-done-cta">
                    <ExpiredPaymentAction token={token} total={submission?.amount} version="v2" />
                    <Button href="/help#contact" variant="ghost">
                        Other questions
                    </Button>
                </div>
            </section>
        </>
    );
}

/* ---- not found + loading ---------------------------------------------------------- */

function NotFound() {
    return (
        <section className="v2-wrap pb-py-done">
            <h1 className="pb-py-done-h">We can&apos;t find this link.</h1>
            <p className="pb-py-done-p">The link may be missing a few letters, or a newer one replaced it. Open the payment email again and tap the link there.</p>
            <div className="pb-py-done-cta">
                <Button href="/help#contact" variant="dark">
                    Contact Tendso
                </Button>
                <Button href="/" variant="ghost">
                    Go to tendso.com
                </Button>
            </div>
            <p className="pb-py-done-fine">Please do not send money until you have a working link.</p>
        </section>
    );
}

function Loading() {
    return (
        <section className="v2-wrap pb-py-hero" aria-busy="true" aria-label="Loading your payment details">
            <div className="pb-py-hero-text">
                <div className="pb-st-skel pb-st-skel--h" />
                <div className="pb-st-skel" />
            </div>
            <div className="pb-py-stage" />
        </section>
    );
}
