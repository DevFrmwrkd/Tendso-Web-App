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
 * instead of breaking.
 */

import { useSyncExternalStore } from "react";
import Link from "next/link";

import { formatPHP } from "@/lib/pricing";
import { readSubmitted } from "../draft";

/** sessionStorage is written once, on the page before this one, and never
 *  changes underneath us — so there is nothing to subscribe to. */
const noSubscription = () => () => {};
/** Rendered on the server and during hydration, where sessionStorage does not
 *  exist; useSyncExternalStore then swaps in the real value without the
 *  mismatch a plain read during render would cause. */
const noServerValue = () => null;

export default function StartThanksPage() {
    const receipt = useSyncExternalStore(noSubscription, readSubmitted, noServerValue);
    const email = receipt?.email ?? null;
    // What the form actually quoted, campaign and domain included. Null only for
    // a receipt written before amounts were kept — and saying the wrong number to
    // somebody who was just promised a discount is worse than saying none, so the
    // sentence drops the figure rather than guessing it.
    const amount = receipt?.amount ?? null;

    return (
        <main className="flex min-h-screen flex-col bg-khaki text-ink">
            <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-5 py-16">
                <div
                    className="flex h-14 w-14 items-center justify-center rounded-full"
                    style={{ background: "var(--rust)" }}
                    aria-hidden
                >
                    <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M20 6 9 17l-5-5" />
                    </svg>
                </div>

                <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.14em] text-rust">Got it</p>
                <h1
                    className="mt-2.5 font-fraunces text-[clamp(1.9rem,7vw,2.6rem)] leading-[1.1] tracking-[-0.015em] text-ink"
                    style={{ fontWeight: 560, fontOpticalSizing: "auto" }}
                >
                    Salamat — we have everything we need.
                </h1>

                <p className="mt-5 text-[17px] leading-relaxed text-ink-soft">
                    We&apos;ll build it and email you at{" "}
                    <strong className="font-semibold text-ink">{email ?? "the address you gave us"}</strong> within
                    48–72 hours with your site{amount === null ? " and how to pay" : ` and how to pay ${formatPHP(amount)}`}.
                </p>

                <div className="mt-8 rounded-2xl border border-ink/10 bg-khaki-deep p-5">
                    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                        Nothing to do now
                    </p>
                    <ul className="mt-3 flex flex-col gap-2.5 text-sm leading-relaxed text-ink">
                        <li>You don&apos;t pay anything until your site is live.</li>
                        <li>There&apos;s no account to make and nothing to install.</li>
                        <li>
                            Keep an eye on that inbox — check spam too, in case our email lands there.
                        </li>
                    </ul>
                </div>

                <p className="mt-8 text-[13px] leading-relaxed text-ink-soft">
                    Something wrong with what you sent?{" "}
                    <Link href="/contact" className="font-semibold text-ink underline underline-offset-2">
                        Message us
                    </Link>{" "}
                    and we&apos;ll fix it before we build.
                </p>

                <Link
                    href="/"
                    className="mt-10 inline-flex h-14 items-center justify-center rounded-xl border border-ink/15 bg-white px-6 text-[15px] font-semibold text-ink transition-colors hover:border-ink/35"
                >
                    Back to Tendso
                </Link>
            </div>
        </main>
    );
}
