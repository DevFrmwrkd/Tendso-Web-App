"use client";

/**
 * /start/thanks — the end of the owner funnel.
 *
 * WHY THIS IS A SEPARATE URL and not a fifth step on /start: the intake is one
 * mutation call, and the browser must not be able to repeat it. On its own route
 * a refresh, a bookmark, or a back-then-forward re-renders this page and nothing
 * else — there is no submit handler here to fire a second time.
 *
 * The draft is already gone by the time this renders (page.tsx clears it before
 * navigating), so a back-swipe onto /start finds an empty form rather than a
 * filled one inviting a second submission.
 *
 * The email address is read from sessionStorage, not the query string: it is the
 * one thing the owner needs to check for a typo, and it has no business sitting
 * in a URL, in browser history, or in a referrer header. If it isn't there —
 * someone opened this URL directly — the copy degrades to the generic phrasing
 * instead of breaking, and every line it would have filled is left out.
 *
 * THE LOOK IS ROUND 1 (board Start, the thanks state): the funnel frame with
 * "Back to site", one highlighted card repeating back what was sent, then what
 * happens in the next 48–72 hours.
 */

import { useSyncExternalStore, type ReactNode } from "react";
import { Check } from "lucide-react";
import Link from "next/link";

import { ButtonLink, Card, FunnelHeader, Highlight, Icon, PublicPage } from "@/components/r1";
import { formatPHP } from "@/lib/pricing";

import { HEADER_ALIGN } from "../_components/frame";
import { readSubmitted, type SubmittedReceipt } from "../draft";
import { quoteFor } from "../quote";

/** sessionStorage is written once, on the page before this one, and never
 *  changes underneath us — so there is nothing to subscribe to. */
const noSubscription = () => () => {};
/** Rendered on the server and during hydration, where sessionStorage does not
 *  exist; useSyncExternalStore then swaps in the real value without the
 *  mismatch a plain read during render would cause. */
const noServerValue = () => null;

/**
 * The struck-through list price and the line under the figure, from the
 * campaign and tier the form quoted under — the same Quote the form showed, so
 * the strike appears exactly where it did there (see Quote.struckTotal). Only
 * when they reproduce the amount that was actually promised: a receipt from an
 * older build carries neither, and a breakdown that does not add up to the
 * figure beside it is worse than none.
 */
function priceDetail(receipt: SubmittedReceipt, amount: number): { was: number | null; note: string | null } {
    if (receipt.customDomain === null) return { was: null, note: null };
    const quote = quoteFor(receipt.campaign, receipt.customDomain);
    if (quote.total !== amount) return { was: null, note: null };
    const domainLine = `${formatPHP(quote.sellPrice)} website + ${formatPHP(quote.addOn)} for your .com`;
    if (quote.discounted) {
        return {
            was: quote.struckTotal,
            note: quote.tier === "with_custom_domain" ? `with ${quote.code} · ${domainLine}` : `with ${quote.code} · ${quote.percentOff}% off the website`,
        };
    }
    return { was: null, note: quote.tier === "with_custom_domain" ? domainLine : null };
}

export default function StartThanksPage() {
    const receipt = useSyncExternalStore(noSubscription, readSubmitted, noServerValue);
    const email = receipt?.email ?? null;
    // What the form actually quoted, campaign and domain included. Null only for
    // a receipt written before amounts were kept — and saying the wrong number to
    // somebody who was just promised a discount is worse than saying none, so the
    // sentence drops the figure rather than guessing it.
    const amount = receipt?.amount ?? null;
    const detail = receipt && amount !== null ? priceDetail(receipt, amount) : { was: null, note: null };
    const forLine = [receipt?.businessName, receipt?.city].filter(Boolean).join(" · ");
    const howToPay = amount === null ? "how to pay" : `how to pay ${formatPHP(amount)}`;

    return (
        <PublicPage header={<FunnelHeader exit={{ href: "/", label: "Back to site" }} className={HEADER_ALIGN} />}>
            <div className="mx-auto flex w-full max-w-[600px] flex-col gap-7 px-4 pb-16 pt-10 sm:px-6 lg:pb-20 lg:pt-14">
                <span className="flex size-12 items-center justify-center rounded-full bg-r1-gold text-r1-ink" aria-hidden="true">
                    <Icon icon={Check} size={24} />
                </span>

                <div className="flex flex-col gap-3">
                    <h1 className="t-h1">Salamat — we have everything we need.</h1>
                    <p className="t-sub">
                        We&apos;ll build it and email you at{" "}
                        <strong className="font-semibold text-r1-ink [overflow-wrap:anywhere]">{email ?? "the address you gave us"}</strong>{" "}
                        within 48–72 hours with your site and {howToPay}.
                    </p>
                </div>

                <Highlight className="p-5 sm:px-6" role="group" aria-label="What you sent">
                    <dl className="m-0 flex flex-col">
                        {email ? (
                            <Fact term="We'll write to">
                                <span className="font-semibold [overflow-wrap:anywhere]">{email}</span>
                            </Fact>
                        ) : null}
                        {amount !== null ? (
                            <Fact term="Your price">
                                <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                                    {detail.was !== null ? (
                                        <span className="tabular-nums text-r1-ink-3 line-through decoration-r1-ink-3">
                                            <span className="sr-only">Was </span>
                                            {formatPHP(detail.was)}
                                        </span>
                                    ) : null}
                                    <span className="text-xl font-semibold leading-6 tabular-nums">
                                        {detail.was !== null ? <span className="sr-only">Now </span> : null}
                                        {formatPHP(amount)}
                                    </span>
                                    {detail.note ? <span className="t-meta">{detail.note}</span> : null}
                                </span>
                            </Fact>
                        ) : null}
                        <Fact term="When you pay">Once, only after your site is live</Fact>
                        {forLine ? <Fact term="For">{forLine}</Fact> : null}
                    </dl>
                </Highlight>

                <section className="flex flex-col gap-4" aria-labelledby="start-next-hours">
                    <h2 id="start-next-hours" className="t-h2">
                        The next 48–72 hours
                    </h2>
                    <ol className="m-0 flex list-none flex-col gap-3.5 p-0">
                        {[
                            "Our team reads your answers and builds your site from them — your words, your photos.",
                            "We check it and put it live.",
                            `We email you the link and ${howToPay}. That email is the first time you see it.`,
                        ].map((line, index) => (
                            <li key={index} className="flex items-start gap-3">
                                <span className="inline-flex size-6 flex-none items-center justify-center rounded-full text-xs font-semibold tabular-nums text-r1-ink-3 ring-[1.5px] ring-inset ring-r1-line-2">
                                    {index + 1}
                                </span>
                                <span className="t-body pt-0.5">{line}</span>
                            </li>
                        ))}
                    </ol>
                </section>

                <Card className="flex flex-col gap-2.5 px-5 py-5 sm:px-6">
                    <h2 className="text-sm font-semibold leading-5">Nothing to do now</h2>
                    <ul className="t-body m-0 flex list-disc flex-col gap-1.5 pl-[18px]">
                        <li>You don&apos;t pay anything until your site is live.</li>
                        <li>There&apos;s no account to make and nothing to install.</li>
                        <li>Keep an eye on that inbox — check spam too, in case our email lands there.</li>
                    </ul>
                </Card>

                <p className="t-meta">
                    Something wrong with what you sent?{" "}
                    {/* Straight to the Help Center's "Ask a person" card, where
                        /contact now redirects — one hop fewer on mobile data. */}
                    <Link href="/knowledge#contact" className="t-link">
                        Message us
                    </Link>{" "}
                    and we&apos;ll fix it before we build.
                </p>

                <div>
                    <ButtonLink size="lg" href="/">
                        Back to Tendso
                    </ButtonLink>
                </div>
            </div>
        </PublicPage>
    );
}

/** One line of the highlighted card: the term above on a phone, beside on wider screens. */
function Fact({ term, children }: { term: string; children: ReactNode }) {
    return (
        <div className="grid grid-cols-1 gap-1 border-t border-r1-gold-line py-3.5 first:border-t-0 first:pt-0 last:pb-0 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-baseline sm:gap-3">
            <dt className="t-label">{term}</dt>
            <dd className="m-0 min-w-0 text-sm leading-5 text-r1-ink">{children}</dd>
        </div>
    );
}
