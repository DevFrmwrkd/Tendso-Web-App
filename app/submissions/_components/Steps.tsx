import { Dot, cx, type Tone } from "@/components/r1";

import type { CheckItem, Step } from "../_lib/derive";

/*
 * The drawer's "Progress" rail and a draft's "Still to do" list (board:
 * Submissions, `.sb-tl` and `.sb-check`). The kit's <Timeline> is one line per
 * step with the date on the right; these steps carry a second line ("Waiting
 * for Raflyn · ₱999", "0 of 3 minimum · storefront, inside, products"), so
 * the board draws them as a rail, and so do we.
 */

/** The dot says it to the eye; this says it to a screen reader. */
const TONE_WORD: Record<Tone, string> = {
    done: "Done",
    progress: "In progress",
    attn: "Needs you",
    bad: "Problem",
    off: "Not yet",
};

function StepText({ tone, name, meta, todo }: { tone: Tone; name: string; meta?: string | null; todo?: boolean }) {
    return (
        <span className="flex min-w-0 flex-col gap-0.5">
            <span className={cx("text-sm leading-5", todo ? "text-r1-ink-3" : "font-medium text-r1-ink")}>
                <span className="sr-only">{TONE_WORD[tone]}: </span>
                {name}
            </span>
            {meta && <span className="t-meta">{meta}</span>}
        </span>
    );
}

export function Steps({ steps }: { steps: Step[] }) {
    return (
        <ol className="m-0 flex list-none flex-col p-0">
            {steps.map((step, i) => {
                const last = i === steps.length - 1;
                return (
                    <li key={step.name} className="flex gap-3.5">
                        <span className="flex w-2.5 flex-none flex-col items-center pt-1.5" aria-hidden="true">
                            <Dot tone={step.tone} />
                            {!last && <span className="mt-1.5 min-h-[26px] w-px flex-1 bg-r1-line" />}
                        </span>
                        <span className={cx("min-w-0", !last && "pb-4")}>
                            <StepText {...step} />
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}

export function Checklist({ items }: { items: CheckItem[] }) {
    return (
        <ul className="m-0 flex list-none flex-col p-0">
            {items.map((item) => (
                <li key={item.name} className="flex items-start gap-3 border-b border-r1-line-3 py-3 last:border-b-0">
                    <Dot tone={item.tone} className="mt-1.5" />
                    <StepText {...item} />
                </li>
            ))}
        </ul>
    );
}
