"use client";

/**
 * /start form primitives, in the brand-gold language.
 *
 * Deliberately NOT the creator funnel's `.editorial` shell (app/submit/*) and
 * NOT components/ui/*. /start is linked from the landing surface, so it has to
 * look like the page that sent the owner here: warm paper (--khaki), near-black ink,
 * one gold accent (--rust), Fraunces for display type, mono for the eyebrows.
 * Straddling the two design systems would read as two different companies
 * between the price and the form.
 *
 * TWO SHELLS, ONE SET OF PRIMITIVES. Below `lg` (1024px) this is the phone form
 * it was written as: one column, sticky progress bar on top, the way forward
 * pinned under the thumb. From `lg` up it becomes a desk form — a standing
 * StepRail on the left carrying progress and the reassurance, a wider column on
 * the right, and the action bar unpinned and set inline after the last field,
 * because on a 1440px monitor a bar welded to the bottom of the viewport is a
 * phone affordance wearing a suit.
 *
 * Every desktop rule is an `lg:` addition. Nothing below `lg` changed, so the
 * phone path — still where most of these owners are — is untouched.
 */

import type { ReactNode } from "react";

/** Inputs are h-14 on a phone because this form is filled with a thumb; h-12 on
 *  a desk, where the pointer is precise and a column of 56px boxes reads as a
 *  blown-up mobile page rather than a form. */
export const INPUT_CLASS =
    "h-14 w-full rounded-xl border border-ink/15 bg-white px-4 text-base text-ink placeholder:text-ink-soft/45 transition-colors focus:border-rust focus:outline-none lg:h-12 lg:text-[15px]";

export const SELECT_CLASS = `${INPUT_CLASS} appearance-none pr-10`;

export const TEXTAREA_CLASS =
    "min-h-[9.5rem] w-full rounded-xl border border-ink/15 bg-white p-4 text-base leading-relaxed text-ink placeholder:text-ink-soft/45 transition-colors focus:border-rust focus:outline-none lg:min-h-[8rem] lg:text-[15px]";

/** What each step is called, for the desktop rail. Index 0 is step 1. Lives
 *  beside the rail that renders it; draft.ts still owns TOTAL_STEPS, and this
 *  array has to stay the same length as that bound. */
export const STEP_LABELS = [
    { title: "Your business", note: "Name, address, how to reach you" },
    { title: "A few questions", note: "In your own words" },
    { title: "Photos", note: "Straight from your phone is fine" },
    { title: "Last look", note: "Check it, then send it in" },
] as const;

/**
 * The phone progress header. Hidden from `lg` up, where StepRail says the same
 * thing with more room and without stealing a band off the top of the screen.
 */
export function ProgressHeader({
    step,
    totalSteps,
    onBack,
    backLabel,
}: {
    step: number;
    totalSteps: number;
    onBack: () => void;
    backLabel: string;
}) {
    return (
        <header className="sticky top-0 z-20 border-b border-ink/10 bg-khaki/90 backdrop-blur-md lg:hidden">
            <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-5 py-3">
                <button
                    type="button"
                    onClick={onBack}
                    aria-label={backLabel}
                    className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5"
                >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                    Step {step} of {totalSteps}
                </span>
            </div>
            <div className="mx-auto max-w-xl px-5 pb-3">
                <div
                    className="h-1.5 overflow-hidden rounded-full bg-ink/10"
                    role="progressbar"
                    aria-valuenow={step}
                    aria-valuemin={1}
                    aria-valuemax={totalSteps}
                >
                    <div
                        className="h-full rounded-full transition-[width] duration-300"
                        style={{ width: `${(step / totalSteps) * 100}%`, background: "var(--rust)" }}
                    />
                </div>
            </div>
        </header>
    );
}

/**
 * The desktop left rail. Rendered only from `lg` up.
 *
 * It exists because a desk screen has the room to answer, permanently, the two
 * questions a phone form can only answer one at a time: where am I in this, and
 * what is this going to cost me. Keeping both standing beside the form is the
 * whole reason the desktop layout is worth building — it is not a wider phone,
 * it is a form with its context next to it.
 *
 * `self-start` is load-bearing: a stretched flex item is full-height, and a
 * full-height element can never stick.
 */
export function StepRail({
    step,
    onBack,
    backLabel,
    priceNote,
}: {
    step: number;
    onBack: () => void;
    backLabel: string;
    priceNote: ReactNode;
}) {
    return (
        <aside className="hidden lg:sticky lg:top-14 lg:block lg:w-[17.5rem] lg:flex-shrink-0 lg:self-start">
            <button
                type="button"
                onClick={onBack}
                className="-ml-1 inline-flex items-center gap-2 rounded-lg px-1 py-1 text-[13px] font-semibold text-ink-soft transition-colors hover:text-ink"
            >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {backLabel}
            </button>

            <ol className="mt-8 flex flex-col gap-1">
                {STEP_LABELS.map((entry, index) => {
                    const number = index + 1;
                    const current = number === step;
                    const done = number < step;
                    return (
                        <li key={entry.title}>
                            <div
                                className={`flex gap-3.5 rounded-xl px-3 py-3 transition-colors ${
                                    current ? "bg-white" : ""
                                }`}
                                aria-current={current ? "step" : undefined}
                            >
                                <span
                                    aria-hidden
                                    className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border font-mono text-[11px] font-semibold ${
                                        done
                                            ? "border-transparent bg-ink text-white"
                                            : current
                                              ? "border-transparent text-white"
                                              : "border-ink/20 text-ink-soft/70"
                                    }`}
                                    style={current && !done ? { background: "var(--rust)" } : undefined}
                                >
                                    {done ? "✓" : number}
                                </span>
                                <span className="min-w-0">
                                    <span
                                        className={`block text-sm font-semibold ${
                                            current || done ? "text-ink" : "text-ink-soft/80"
                                        }`}
                                    >
                                        {entry.title}
                                    </span>
                                    {current ? (
                                        <span className="mt-0.5 block text-[13px] leading-snug text-ink-soft">
                                            {entry.note}
                                        </span>
                                    ) : null}
                                </span>
                            </div>
                        </li>
                    );
                })}
            </ol>

            <div className="mt-8 rounded-xl border border-ink/10 bg-khaki-deep p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                    Nothing to pay now
                </p>
                <p className="mt-2.5 text-[13px] leading-relaxed text-ink-soft">{priceNote}</p>
            </div>

            <p className="mt-6 text-[13px] leading-relaxed text-ink-soft">
                Everything you type is saved on this device as you go.{" "}
                {/* Plain anchor, matching the phone footer in page.tsx and the
                    navbar's home-anchored links: the hash has to survive the
                    navigation. Same deliberate choice, same rule to silence. */}
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a href="/#how-it-works" className="font-semibold text-ink underline underline-offset-2">
                    How it works
                </a>
            </p>
        </aside>
    );
}

export function StepTitle({ eyebrow, title, lede }: { eyebrow: string; title: string; lede?: string }) {
    return (
        <div className="mb-7 lg:mb-9">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-rust">{eyebrow}</p>
            <h1
                className="mt-2.5 font-fraunces text-[clamp(1.6rem,6vw,2.1rem)] leading-[1.15] tracking-[-0.015em] text-ink lg:text-[2.55rem] lg:leading-[1.08]"
                style={{ fontWeight: 560, fontOpticalSizing: "auto" }}
            >
                {title}
            </h1>
            {lede ? (
                <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-soft lg:mt-4 lg:text-base">
                    {lede}
                </p>
            ) : null}
        </div>
    );
}

/**
 * The `lg:order-*` run moves the hint from above the input to below it on the
 * desk layout. Not a style preference — it is what makes the two-column grid in
 * step 1 line up. With the hint above, a field that has one (Email) pushes its
 * input a line lower than the field beside it (Mobile), and the row reads as a
 * mistake. Below the input, every field is label-then-box, so every pair aligns
 * no matter which of them carries help text. The phone layout keeps the hint
 * above, where it is read before the keyboard covers the screen.
 */
export function Field({
    label,
    htmlFor,
    hint,
    optional,
    error,
    wide,
    children,
}: {
    label: string;
    htmlFor: string;
    hint?: string;
    optional?: boolean;
    error?: string;
    /** Span both columns of the desktop step-1 grid. For the fields that hold a
     *  whole line of prose — a business name, a street address — which look
     *  truncated at half width even when they are not. No effect on a phone,
     *  where the form is a plain flex column and col-span does nothing. */
    wide?: boolean;
    children: ReactNode;
}) {
    return (
        <div className={`flex flex-col gap-2${wide ? " lg:col-span-2" : ""}`}>
            <label htmlFor={htmlFor} className="text-sm font-semibold text-ink lg:order-1">
                {label}
                {optional ? <span className="ml-1.5 font-normal text-ink-soft/70">(optional)</span> : null}
            </label>
            {hint ? (
                <p className="-mt-1 text-[13px] leading-snug text-ink-soft lg:order-3 lg:mt-0">{hint}</p>
            ) : null}
            <div className="lg:order-2">{children}</div>
            {error ? <p className="text-[13px] font-medium text-[#B3261E] lg:order-4">{error}</p> : null}
        </div>
    );
}

/** Errors the owner has to act on. Red, but on paper — not a browser alert. */
export function Notice({ children }: { children: ReactNode }) {
    return (
        <div role="alert" className="rounded-xl border border-[#B3261E]/25 bg-[#B3261E]/[0.06] px-4 py-3">
            <p className="text-sm leading-snug text-[#B3261E]">{children}</p>
        </div>
    );
}

/**
 * The action bar.
 *
 * On a phone: sticky to the bottom of the viewport so the way forward is always
 * under the thumb, however long the step is — and above the iOS home indicator,
 * via env(safe-area-inset-bottom).
 *
 * On a desk (`lg`): unpinned. It loses its rule, its blur and its position and
 * simply follows the last field, aligned with the form above it. A pointer does
 * not need the button chased down to the bottom of the glass, and a floating bar
 * on a monitor reads as chrome borrowed from another device.
 */
export function ActionBar({ children }: { children: ReactNode }) {
    return (
        <div
            className="sticky bottom-0 z-20 border-t border-ink/10 bg-khaki/92 backdrop-blur-md lg:static lg:border-0 lg:bg-transparent lg:backdrop-blur-none"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
            <div className="mx-auto flex max-w-xl items-center gap-3 px-5 py-3.5 lg:mx-0 lg:max-w-none lg:px-0 lg:pb-24 lg:pt-10">
                {children}
            </div>
        </div>
    );
}

/** Full-width under the thumb; sized to its label on a desk, where a 640px-wide
 *  "Continue" button is a target nobody asked for. */
export function PrimaryButton({
    children,
    onClick,
    disabled,
    type = "button",
}: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    type?: "button" | "submit";
}) {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className="inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-ink px-6 text-[15px] font-semibold text-white transition-all hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-35 lg:h-12 lg:min-w-[12rem] lg:flex-none lg:px-8"
        >
            {children}
        </button>
    );
}

export function GhostButton({
    children,
    onClick,
    disabled,
}: {
    children: ReactNode;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="inline-flex h-14 items-center justify-center rounded-xl border border-ink/15 bg-white px-5 text-[15px] font-semibold text-ink transition-colors hover:border-ink/35 disabled:pointer-events-none disabled:opacity-35 lg:h-12"
        >
            {children}
        </button>
    );
}

export function Spinner() {
    return (
        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-90" d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
    );
}
