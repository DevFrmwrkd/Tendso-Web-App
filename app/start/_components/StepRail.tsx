"use client";

import { Check } from "lucide-react";
import Link from "next/link";

import { Icon, cx } from "@/components/r1";
import { formatPHP } from "@/lib/pricing";

import type { Quote } from "../quote";

/** What each step is called. Index 0 is step 1. draft.ts still owns
 *  TOTAL_STEPS, and this array has to stay the same length as that bound. */
export const STEP_LABELS = [
    { title: "Your business", note: "Name, address, how to reach you" },
    { title: "A few questions", note: "In your own words" },
    { title: "Photos", note: "Straight from your phone is fine" },
    { title: "Last look", note: "Check it, then send it in" },
] as const;

export const GIVEAWAY_STEP_LABELS = [
    ...STEP_LABELS.slice(0, 3),
    { title: "Poster photo", note: "Show the poster in your business" },
    STEP_LABELS[3],
];

/**
 * "Nothing to pay now", with the price. The rail carries it on a desk; on a
 * phone the first step shows it under the form, beside the Continue button, so
 * someone who scanned the OTR code sees their discount landed before they go
 * on — without a price card standing between the title and the first field.
 *
 * The figure is what lib/pricing charges for this owner's campaign and tier.
 * A list price is struck beside it only when it is the list price of exactly
 * that figure (see Quote.struckTotal); with no campaign there is nothing struck.
 */
export function PriceNote({ quote, className }: { quote: Quote; className?: string }) {
    return (
        <div className={cx("flex flex-col gap-2 rounded-r1-card border border-r1-line bg-r1-fill-2 p-4", className)}>
            <p className="t-label">{quote.giveaway ? "Your giveaway website" : "Nothing to pay now"}</p>
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                {quote.struckTotal !== null ? (
                    <span className="text-sm tabular-nums text-r1-ink-3 line-through decoration-r1-ink-3">
                        <span className="sr-only">Was </span>
                        {formatPHP(quote.struckTotal)}
                    </span>
                ) : null}
                <span className="text-xl font-semibold leading-6 tabular-nums">
                    {quote.struckTotal !== null ? <span className="sr-only">Now </span> : null}
                    {quote.giveaway ? "Free" : formatPHP(quote.total)}
                </span>
                {quote.discounted && quote.code ? <span className="t-meta">with {quote.code}</span> : null}
            </p>
            <p className="t-meta">
                {quote.giveaway ? "A free website with a Tendso web address, if your application qualifies. We review your poster photo before building it." : <>
                    We build the site first and email it to you. You only pay once it&apos;s live —{" "}
                    {quote.tier === "with_custom_domain" ? `${formatPHP(quote.total)} with your own .com.` : "one time."}
                </>}
            </p>
        </div>
    );
}

/** The refresh-safety promise (see draft.ts), and the one way out to the pitch. */
export function SavedNote({ className }: { className?: string }) {
    return (
        <p className={cx("t-meta", className)}>
            Everything you type is saved on this device as you go.{" "}
            {/* Deep-links to the explanation itself rather than the top of `/`:
                an owner who stalls mid-form wants the answer, not the pitch
                again. `#how` is the section id the Round 1 landing and the
                shared site header use. */}
            <Link href="/#how" className="t-link">
                How it works
            </Link>
        </p>
    );
}

/**
 * The desk rail. Rendered only from `lg` up; a phone gets the kit Stepper above
 * the form instead (see page.tsx).
 *
 * It exists because a desk screen has the room to answer, permanently, the two
 * questions a phone form can only answer one at a time: where am I in this, and
 * what is this going to cost me. Done steps are buttons back to themselves —
 * the same move as the Edit buttons on the last step.
 *
 * `self-start` is load-bearing: a stretched flex item is full-height, and a
 * full-height element can never stick.
 */
export function StepRail({
    step,
    quote,
    onJump,
    disabled,
}: {
    step: number;
    quote: Quote;
    onJump: (step: number) => void;
    /** While the intake is being sent, nothing navigates away from it. */
    disabled?: boolean;
}) {
    return (
        <aside className="hidden lg:sticky lg:top-10 lg:flex lg:w-64 lg:flex-none lg:flex-col lg:gap-6 lg:self-start" aria-label="Your progress">
            <div className="flex flex-col gap-1 px-3">
                <p className="t-h2">Tell us about your business</p>
                <p className="t-meta">{quote.giveaway ? "Five" : "Four"} short steps, about eight minutes.</p>
            </div>

            <ol className="flex flex-col gap-0.5">
                {(quote.giveaway ? GIVEAWAY_STEP_LABELS : STEP_LABELS).map((entry, index) => {
                    const number = index + 1;
                    if (number < step) {
                        return (
                            <li key={entry.title}>
                                <button
                                    type="button"
                                    onClick={() => onJump(number)}
                                    disabled={disabled}
                                    aria-label={`Go back to step ${number}, ${entry.title}`}
                                    className="flex min-h-11 w-full items-start gap-3 rounded-r1 px-3 py-2.5 text-left hover:bg-r1-fill disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
                                >
                                    <span className="inline-flex size-6 flex-none items-center justify-center rounded-full bg-r1-ink text-r1-paper">
                                        <Icon icon={Check} size={14} />
                                    </span>
                                    <span className="flex flex-col gap-0.5 pt-0.5">
                                        <span className="font-medium">{entry.title}</span>
                                        <span className="t-meta">Done · edit</span>
                                    </span>
                                </button>
                            </li>
                        );
                    }
                    if (number === step) {
                        return (
                            <li key={entry.title}>
                                <div aria-current="step" className="flex min-h-11 items-start gap-3 rounded-r1 bg-r1-fill px-3 py-2.5">
                                    <span className="inline-flex size-6 flex-none items-center justify-center rounded-full bg-r1-ink text-xs font-semibold tabular-nums text-r1-paper">
                                        {number}
                                    </span>
                                    <span className="flex flex-col gap-0.5 pt-0.5">
                                        <span className="font-semibold">{entry.title}</span>
                                        <span className="t-meta">{entry.note}</span>
                                    </span>
                                </div>
                            </li>
                        );
                    }
                    return (
                        <li key={entry.title}>
                            <div className="flex min-h-11 items-start gap-3 px-3 py-2.5">
                                <span className="inline-flex size-6 flex-none items-center justify-center rounded-full text-xs font-semibold tabular-nums text-r1-ink-3 ring-[1.5px] ring-inset ring-r1-line-2">
                                    {number}
                                </span>
                                <span className="pt-0.5 text-r1-ink-3">{entry.title}</span>
                            </div>
                        </li>
                    );
                })}
            </ol>

            <PriceNote quote={quote} />
            <SavedNote className="px-3" />
        </aside>
    );
}
