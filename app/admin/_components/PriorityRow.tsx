import type { ReactNode } from "react"

import { ButtonLink, Dot, type Tone } from "@/components/r1"

export type Priority = {
    key: string
    /** The count. A row that would read 0 is not built at all (kit: cut, not shown). */
    figure: number
    tone: Tone
    /** What the count is of, read straight after it: "submissions need review". */
    reason: string
    meta?: ReactNode
    action: { label: string; href: string; primary?: boolean }
}

/**
 * One thing waiting on the person looking (board Today): the count, the
 * reason with its status dot, one line of context, and the one action that
 * deals with it. The figure is read as part of the sentence by a screen
 * reader ("6 submissions need review"), not as a stray number.
 *
 * On a phone the button drops under the sentence; on a desk it takes its own
 * column so the actions line up down the card.
 */
export default function PriorityRow({ figure, tone, reason, meta, action, headingId }: Omit<Priority, "key"> & { headingId?: string }) {
    return (
        <div className="t-row grid min-h-[88px] grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 px-4 py-4 sm:grid-cols-[64px_minmax(0,1fr)_176px] sm:gap-x-5 sm:px-6 sm:py-5">
            <span className="t-figure min-w-10 text-right" aria-hidden="true">
                {figure}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
                <p id={headingId} className="flex items-center gap-2 text-[16px] font-semibold leading-6 text-r1-ink">
                    <Dot tone={tone} />
                    <span>
                        <span className="sr-only">{figure} </span>
                        {reason}
                    </span>
                </p>
                {meta && <p className="t-meta">{meta}</p>}
            </div>
            <ButtonLink
                variant={action.primary ? "primary" : "secondary"}
                href={action.href}
                className="col-start-2 justify-self-start sm:col-start-auto sm:w-full sm:justify-self-stretch"
            >
                {action.label}
            </ButtonLink>
        </div>
    )
}
