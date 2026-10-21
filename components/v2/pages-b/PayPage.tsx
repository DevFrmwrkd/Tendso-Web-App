"use client";

/**
 * /v2/pay/[token]: the page every payment email links to (pages/pay.html).
 *
 * It reads the same things /pay/[token] reads, unchanged: `paymentTokens.getByToken`
 * and `submissions.getById`, and decides which of the four states to show with the
 * same `payView` (pending, paid, expired, not found), live through Convex.
 *
 * The facts it states follow the brief:
 *  - the full price is the token's own amount;
 *  - "Start with ₱500. The rest later." is a display line only: no backend path takes a
 *    down payment yet, so nothing here pretends to;
 *  - Wise is how it is paid today (same email, account name and reference code);
 *  - GCash, Maya and Card sit behind NEXT_PUBLIC_XENDIT_ENABLED and read "Coming soon" until
 *    the Xendit checkout is connected;
 *  - "Your site is live. Pay to keep it live." is said only for a field-agent sale (payRules.ts).
 *    For every other sale the page does not claim the site is up.
 */

import { useQuery } from "convex/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type ReactNode } from "react";

import {
    hostOf,
    linkDays,
    liveUrlOf,
    longDate,
    newLinkMailto,
    paidOnOf,
    paymentDetailsText,
    payView,
    priceSplit,
    shortDate,
    transferAmount,
    transferAmountShown,
} from "@/app/pay/[token]/_components/payState";
import { useNow } from "@/app/pay/[token]/_components/useNow";
import LiveSitePreview from "@/components/landing/LiveSitePreview";
import { Button } from "@/components/v2";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useOwnerAuth } from "@/hooks/useOwnerAuth";
import { OPERATOR, SUPPORT_EMAIL } from "@/lib/contact";
import { getPaymentConfig } from "@/lib/payment/config";
import { formatPHP } from "@/lib/pricing";

import { isFieldAgentSale, pendingCopy } from "./payRules";
import { CheckIcon, PbBrand, PlusIcon, copyWithToast, usePbToast } from "./shared";
import { startXenditCheckout, type XenditMethod } from "./xendit";

type Token = Doc<"paymentTokens">;
type Submission = Doc<"submissions"> | null;

const paymentConfig = getPaymentConfig();

/** Down payment shown as an offer line only. Minimum ₱500; the agent keeps their whole cut upfront. */
const DOWN_PAYMENT = 500;

/** Xendit methods are on only when the flag says so. Until then the buttons read "Coming soon". */
const XENDIT_ENABLED = process.env.NEXT_PUBLIC_XENDIT_ENABLED === "true";

export function PayPage() {
    const params = useParams();
    const token = params.token as string;
    const now = useNow();
    const { isOwner } = useOwnerAuth();

    const paymentToken = useQuery(api.paymentTokens.getByToken, { token });
    const submission = useQuery(api.submissions.getById, paymentToken?.submissionId ? { id: paymentToken.submissionId } : "skip");
    const wiseEmail = paymentConfig.wiseEmail || "support@negosyo.digital";
    // Wait for the submission too: its status decides "paid" when an admin matched the transfer by hand.
    const loading = paymentToken === undefined || (paymentToken !== null && submission === undefined);

    return <PayView loading={loading} token={paymentToken ?? null} submission={submission ?? null} now={now} wiseEmail={wiseEmail} ownerHome={isOwner} />;
}

/** The page itself, from data. Split from PayPage so every state can be rendered without a backend. */
export function PayView({
    loading,
    token,
    submission,
    now,
    wiseEmail,
    ownerHome,
}: {
    loading: boolean;
    token: Token | null;
    submission: Submission;
    now: number;
    wiseEmail: string;
    ownerHome: boolean;
}) {
    const { node: toast, show } = usePbToast();
    const view = loading ? "loading" : !token ? "notfound" : payView(token, submission, now);

    return (
        <div className="pb-py">
            <header className="pb-py-bar">
                <div className="v2-wrap pb-py-bar-in">
                    <PbBrand />
                    <Button href="/v2/help" variant="ghost" size="sm">
                        Help
                    </Button>
                </div>
            </header>
            <main className="pb-py-main">
                {view === "loading" && <Loading />}
                {view === "notfound" && <NotFound />}
                {token && view === "pending" && <Pending token={token} submission={submission} now={now} wiseEmail={wiseEmail} show={show} />}
                {token && view === "paid" && <Paid token={token} submission={submission} ownerHome={ownerHome} />}
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
}: {
    name: string | null;
    state: string;
    dot?: "live" | "off";
    title: string;
    sub: string;
    ctas?: ReactNode;
    url: string | null;
    preview: string;
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
                        <p className="pb-py-nopreview-p">Private until you pay. We send your link the moment it is live.</p>
                    </div>
                )}
                <span className="pb-py-preview">{preview}</span>
            </div>
        </section>
    );
}

/* ---- pending ----------------------------------------------------------------- */

function Pending({ token, submission, now, wiseEmail, show }: { token: Token; submission: Submission; now: number; wiseEmail: string; show: (m: string) => void }) {
    const name = submission?.businessName ?? null;
    const money = formatPHP(token.amount);
    const url = liveUrlOf(submission?.websiteUrl);
    const offline = submission?.status === "unpublished";
    const live = !!url && !offline;
    const agentSale = isFieldAgentSale(submission);
    const text = pendingCopy({ agentSale, live });
    const { domain, addOn, websiteLine, discount } = priceSplit(token.amount, submission);
    const struckTotal = discount && !domain ? discount.listPrice : null;
    const copy = (value: string, done: string) => void copyWithToast(value, done, show);

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
                            Pay {money} once
                        </Button>
                    </>
                }
            />

            <section className="v2-wrap pb-py-pay" id="pay" aria-labelledby="pay-h">
                <div className="pb-py-price">
                    <p className="pb-label">{text.priceLabel}</p>
                    <h2 className="pb-py-amt" id="pay-h">
                        {struckTotal !== null && (
                            <span className="pb-py-was">
                                <span className="sr-only">Was </span>
                                {formatPHP(struckTotal)}
                            </span>
                        )}
                        <span className="sr-only">{struckTotal !== null ? "Now " : ""}</span>
                        {money}.<small>Once. No monthly fee.</small>
                    </h2>
                    {domain && websiteLine > 0 && (
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
                    <p className="pb-py-down">
                        <i />
                        <span>
                            Start with <b>{formatPHP(DOWN_PAYMENT)}</b>. The rest later. <Link href="/v2/help#contact">Ask us how</Link>
                        </span>
                    </p>
                    <MethodArea />
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
                                Always add the code. It&apos;s how we know the money is from you.
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
                                We match it by itself, so this page updates on its own once we receive {money}. {text.after}
                            </p>
                            <p className="pb-py-wait-p">
                                Link works until <b>{shortDate(token.expiresAt, now)}</b>, {linkDays(token)} days after it was sent.
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
                            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with your code and we will sort out another way to pay. Stuck? <Link href="/v2/help#contact">Ask a person.</Link>
                        </p>
                    </div>
                </details>
            </section>
        </>
    );
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

/** GCash, Maya and Card. Disabled with "Coming soon" until NEXT_PUBLIC_XENDIT_ENABLED is "true" (the Xendit checkout is built elsewhere). */
function MethodArea() {
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
            await startXenditCheckout(m);
        } catch (e) {
            setMessage(e instanceof Error ? e.message : "That isn't available yet. Pay with Wise for now.");
        } finally {
            setBusy(null);
        }
    };
    return (
        <div className="pb-py-methods" aria-label="Other ways to pay">
            <p className="pb-py-methods-k">
                More ways to pay
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

function Paid({ token, submission, ownerHome }: { token: Token; submission: Submission; ownerHome: boolean }) {
    const name = submission?.businessName ?? null;
    const money = formatPHP(token.amount);
    const paidAt = paidOnOf(token, submission);
    const url = liveUrlOf(submission?.websiteUrl);
    const { domain, discount } = priceSplit(token.amount, submission);
    const byWise = Boolean(token.wiseTransactionId);

    return (
        <>
            <Hero name={name} state="Live" dot="live" title="Your site is live." sub="Paid once. It's yours." url={url} preview={url ? `Live · ${hostOf(url)}` : "Live"} />
            <section className="v2-wrap pb-py-done" aria-labelledby="paid-h">
                <div className="pb-py-done-mark">
                    <CheckIcon size={34} />
                </div>
                <h2 className="pb-py-done-h" id="paid-h">
                    Your receipt.
                </h2>
                <p className="pb-py-done-p">Your website is yours. Keep this page as your proof of payment.</p>
                <dl className="pb-py-receipt">
                    <div>
                        <dt>Website, paid once</dt>
                        <dd>{discount ? formatPHP(discount.price) : money}</dd>
                    </div>
                    {discount && (
                        <div>
                            <dt>Discount</dt>
                            <dd>
                                {discount.percentOff}% off {formatPHP(discount.listPrice)}
                            </dd>
                        </div>
                    )}
                    {domain && (
                        <div>
                            <dt>Custom domain</dt>
                            <dd className="pb-py-wrap">{domain}</dd>
                        </div>
                    )}
                    {paidAt && (
                        <div>
                            <dt>Paid on</dt>
                            <dd>{longDate(paidAt)}</dd>
                        </div>
                    )}
                    {byWise && (
                        <div>
                            <dt>Paid with</dt>
                            <dd>Wise transfer</dd>
                        </div>
                    )}
                    <div>
                        <dt>Reference</dt>
                        <dd className="pb-mono">{token.referenceCode}</dd>
                    </div>
                    {url && (
                        <div>
                            <dt>Live at</dt>
                            <dd>
                                <a href={url} target="_blank" rel="noopener noreferrer">
                                    {hostOf(url)}
                                </a>
                            </dd>
                        </div>
                    )}
                </dl>
                <div className="pb-py-done-cta">
                    {ownerHome ? (
                        <Button href="/my-business" variant="primary">
                            Open my website
                        </Button>
                    ) : url ? (
                        <Button href={url} variant="primary" target="_blank" rel="noopener noreferrer">
                            Open my website
                        </Button>
                    ) : null}
                    <Button href="/v2/help#contact" variant="ghost">
                        Need a change?
                    </Button>
                </div>
            </section>
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
                sub={`Payment links last ${linkDays(token)} days. This one ended on ${shortDate(token.expiresAt, now)}.`}
                url={null}
                preview="Private until you pay"
            />
            <section className="v2-wrap pb-py-done" aria-labelledby="exp-h">
                <h2 className="pb-py-done-h" id="exp-h">
                    Ask us for a new one.
                </h2>
                <p className="pb-py-done-p">Already sent money with the old code? It still reaches us.</p>
                <div className="pb-py-done-cta">
                    <Button href={newLinkMailto(name, token.referenceCode)} variant="dark">
                        Ask for a new link
                    </Button>
                    <Button href="/v2/help#contact" variant="ghost">
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
                <Button href="/v2/help#contact" variant="dark">
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
