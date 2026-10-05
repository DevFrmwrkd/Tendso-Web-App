import type { ReactNode } from "react";

/**
 * The few layout pieces every /start screen shares (Round 1, board Start).
 *
 * The board is drawn at 1440px: a 1200px column with a 256px step rail, a 64px
 * gap and an 880px form. CONTAINER is that column, phone first — 16px gutters
 * on a phone, 24 on a tablet, 40 from `lg` — and the funnel header and the
 * action bar both line up with it, so the wordmark, the form and the buttons
 * share one left edge at every width.
 */
export const CONTAINER = "mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-10";

/** The header's own padding, matched to CONTAINER's inner edge (1200px). */
export const HEADER_ALIGN = "lg:px-[max(40px,calc((100%_-_1200px)/2))]";

/** Every step's title carries this id, so a step change can move focus to it
 *  (see the scroll effect in page.tsx). One title on screen at a time. */
export const STEP_TITLE_ID = "start-step-title";

export function StepHeader({ title, sub, eyebrow }: { title: ReactNode; sub?: ReactNode; eyebrow?: ReactNode }) {
    return (
        <header className="flex max-w-[680px] flex-col gap-2">
            {eyebrow ? <p className="t-label">{eyebrow}</p> : null}
            {/* Focused from script when the step changes, never tabbed to, so it
                carries no focus ring of its own. */}
            <h1 id={STEP_TITLE_ID} tabIndex={-1} className="t-h1 focus:outline-none focus-visible:outline-none">
                {title}
            </h1>
            {sub ? <p className="t-sub">{sub}</p> : null}
        </header>
    );
}

/** "(optional)" after a label, quieter than the label itself. */
export function OptionalMark() {
    return <span className="ml-1.5 font-normal text-r1-ink-3">(optional)</span>;
}

/** A small working indicator for inside a button. Takes the button's text
 *  colour, so it reads on the black primary button and the white ones alike. */
export function Spinner() {
    return (
        <span
            aria-hidden="true"
            className="inline-block size-4 flex-none animate-spin rounded-full border-2 border-current border-r-transparent opacity-80"
        />
    );
}

/**
 * Bring a field the owner has to fix into view and put the cursor in it.
 *
 * Centred, because the action bar is pinned to the bottom of the screen and a
 * field scrolled to the very bottom would sit underneath it. Smooth unless the
 * owner has asked the system for less motion.
 */
export function revealField(element: Element | null | undefined) {
    if (!(element instanceof HTMLElement)) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    element.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    element.focus({ preventScroll: true });
}
