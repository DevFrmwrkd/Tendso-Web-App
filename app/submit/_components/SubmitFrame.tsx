"use client"

import { ArrowLeft } from "lucide-react"
import { useId, type ReactNode } from "react"

import { ButtonLink, Dot, EmptyState, Icon, Loading, PageHeader, Skeleton, Stepper, cx } from "@/components/r1"

import { STEP_NAMES, type NeedRow } from "./flow"

/*
 * The frame every step of New submission wears (board: NewSubmission). It
 * sits inside <CreatorShell> (app/submit/layout.tsx), so the sidebar's New
 * submission button shows as current throughout.
 *
 *   title + the one question the flow answers
 *   the stepper across the four steps
 *   the step itself, with the rail beside it on a wide screen
 *   the action bar: Back, where things stand, Save draft, the one primary
 *
 * Phone first: everything stacks in reading order (step, rail, bar) and the
 * bar ends the page. From 1024px the bar sticks to the bottom of the window,
 * as the board draws it; from 1280px the rail moves beside the step (below
 * that, sidebar plus rail would squeeze the form to ~320px).
 */

export function SubmitFrame({
    step,
    children,
    rail,
    railLabel,
    after,
    bar,
}: {
    /** 0-based: 0 Business, 1 Photos, 2 Interview, 3 Review. */
    step: number
    children: ReactNode
    /** The right rail: what is still needed (steps 1–3) or the price (step 4). */
    rail?: ReactNode
    railLabel?: string
    /** Main-column content that follows the rail on a phone (the review's confirmation, which names the price). */
    after?: ReactNode
    bar?: ReactNode
}) {
    return (
        <>
            <PageHeader title="New submission" sub="What do I still need from this shop?" />
            <Stepper steps={STEP_NAMES} current={step} label="Submission steps" className="w-full" />
            <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start xl:gap-x-12">
                <div className="flex min-w-0 flex-col gap-8 xl:col-start-1 xl:row-start-1 xl:max-w-[700px]">{children}</div>
                {rail && (
                    <aside className={cx("flex min-w-0 flex-col gap-4 xl:col-start-2 xl:row-start-1", after ? "xl:row-span-2" : undefined)} aria-label={railLabel}>
                        {rail}
                    </aside>
                )}
                {after && <div className="flex min-w-0 flex-col gap-6 xl:col-start-1 xl:row-start-2 xl:max-w-[700px]">{after}</div>}
            </div>
            {bar}
        </>
    )
}

/**
 * The bar under the step: Back on the left with a line on where things stand
 * (or what blocks Continue, in red), Save draft and the one primary on the
 * right.
 */
export function ActionBar({ back, message, error = false, children }: { back?: string; message?: ReactNode; error?: boolean; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-3 border-t border-r1-line pt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 lg:sticky lg:bottom-0 lg:z-20 lg:-mx-12 lg:min-h-[72px] lg:bg-r1-paper lg:px-12 lg:py-3">
            <div className="flex min-w-0 items-center gap-4">
                {back && (
                    <ButtonLink variant="ghost" href={back} className="flex-none">
                        <Icon icon={ArrowLeft} />
                        Back
                    </ButtonLink>
                )}
                {message &&
                    (error ? (
                        <p className="t-error text-[13px] leading-[18px]" role="alert">
                            {message}
                        </p>
                    ) : (
                        <p className="t-meta t-num">{message}</p>
                    ))}
            </div>
            <div className="flex flex-none flex-wrap items-center gap-2">{children}</div>
        </div>
    )
}

const NEED_TONE = { done: "done", now: "attn", todo: "off" } as const
const NEED_WORD = { done: "done", now: "this step", todo: "still to do" } as const

/** "Still needed from this shop": the four things to leave with (steps 1–3). */
export function NeedsCard({ rows }: { rows: NeedRow[] }) {
    const id = useId()
    return (
        <section className="t-card t-card-pad flex flex-col gap-1" aria-labelledby={id}>
            <h2 id={id} className="t-h2">
                Still needed from this shop
            </h2>
            <ul className="m-0 flex list-none flex-col p-0">
                {rows.map((r, i) => (
                    <li key={i} className="flex items-start gap-3 border-b border-r1-line-3 py-3 last:border-b-0">
                        <span className="flex pt-1.5">
                            <Dot tone={NEED_TONE[r.state]} />
                        </span>
                        <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="text-sm font-medium text-r1-ink">
                                {r.label}
                                <span className="sr-only"> ({NEED_WORD[r.state]})</span>
                            </span>
                            <span className="t-meta">{r.meta}</span>
                        </span>
                    </li>
                ))}
            </ul>
            <p className="t-meta pt-2">Get all of it before you leave. Coming back costs you another trip.</p>
        </section>
    )
}

/** A step loading: the same shape as what is coming (fields, photo tiles or review cards). */
export function StepLoading({ label, shape }: { label: string; shape: "form" | "tiles" | "cards" }) {
    return (
        <Loading label={label} className="flex flex-col gap-8">
            {shape === "form" &&
                [2, 3, 2].map((fields, s) => (
                    <div key={s} className="flex flex-col gap-4">
                        <Skeleton width={140} height={16} />
                        <div className="grid gap-4 sm:grid-cols-2 sm:gap-x-5">
                            {Array.from({ length: fields }, (_, f) => (
                                <div key={f} className="flex flex-col gap-2">
                                    <Skeleton width="45%" height={12} />
                                    <Skeleton height={40} />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            {shape === "tiles" && (
                <>
                    <div className="flex flex-col gap-2">
                        <Skeleton width={180} height={16} />
                        <Skeleton width="85%" height={12} />
                    </div>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5">
                        {[0, 1, 2].map((t) => (
                            <Skeleton key={t} height={132} className="rounded-[10px]" />
                        ))}
                    </div>
                </>
            )}
            {shape === "cards" &&
                [96, 120, 72].map((h, c) => (
                    <div key={c} className="t-card t-card-pad flex flex-col gap-3">
                        <Skeleton width={120} height={16} />
                        <Skeleton height={h - 40} />
                    </div>
                ))}
        </Loading>
    )
}

/** The draft in sessionStorage no longer exists (deleted elsewhere). */
export function DraftMissing() {
    return (
        <EmptyState
            className="t-card"
            title="This draft is not here any more"
            body="It may have been deleted. Start again from the business details."
            action={
                <ButtonLink variant="primary" href="/submit/info">
                    Start from step 1
                </ButtonLink>
            }
        />
    )
}
