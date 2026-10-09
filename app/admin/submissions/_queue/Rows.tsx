"use client"

import { cx, Loading, RowButton, Skeleton, Status, TableHead } from "@/components/r1"
import { affiliateAttribution } from "@/lib/submissionAttribution"

import {
    businessName,
    creatorName,
    daysText,
    isOwnerSubmitted,
    joinDot,
    ownerPrice,
    placeLine,
    priceNote,
    shortDate,
    statusNotes,
    statusOf,
    waitingDays,
    type QueueRow,
} from "./model"
import { GiveawaySummary } from "./GiveawaySummary"

/*
 * The queue table (ComponentKit "Table header and rows"): a header and rows
 * that are each ONE button, opening the details drawer.
 *
 * A five-column table is unreadable on a phone, and admins do triage from
 * one, so below the desk width every row collapses into a stacked row: the
 * business, a meta line (city · creator), the status; the price and the wait
 * (or the date) on the right. Never a table that scrolls sideways. The desk
 * columns appear at `lg`, where the sidebar also does.
 */

/** Column widths, shared by the header, the rows and the skeleton so they line up. */
const COL = {
    biz: "flex min-w-0 flex-1 flex-col lg:flex-[1.7_1_0%]",
    creator: "hidden min-w-0 flex-col lg:flex lg:flex-[1.1_1_0%]",
    status: "hidden min-w-0 flex-col lg:flex lg:flex-[1.4_1_0%]",
    pay: "flex max-w-[40%] flex-none flex-col items-end text-right lg:w-28 lg:max-w-none",
    wait: "hidden flex-none flex-col lg:flex lg:w-30",
}

export function QueueHead() {
    return (
        <TableHead className="hidden lg:flex">
            <span className={COL.biz}>Business</span>
            <span className={COL.creator}>Submitted by</span>
            <span className={COL.status}>Status</span>
            <span className={COL.pay}>Owner pays</span>
            <span className={COL.wait}>Waiting since</span>
        </TableHead>
    )
}

export function QueueRowButton({
    row,
    now,
    selected,
    onOpen,
}: {
    row: QueueRow
    now: number
    selected: boolean
    onOpen: () => void
}) {
    const name = businessName(row)
    const status = statusOf(row)
    // A row has room for one line under the status: the most urgent (a failed domain first).
    const note = statusNotes(row)[0] ?? null
    const owner = isOwnerSubmitted(row)
    const affiliate = affiliateAttribution(row)
    const creator = affiliate?.name ?? creatorName(row.creator)
    const why = priceNote(row)
    const wait = waitingDays(row, now)
    const date = shortDate(row._creationTime, now)
    return (
        <RowButton
            selected={selected}
            onClick={onOpen}
            // One name for the whole row, as the board gives it: business, city, status.
            aria-label={[name, row.city.trim(), status.word, row.giveawayApplication === true ? "Giveaway" : null].filter(Boolean).join(", ")}
            className="items-start lg:items-center"
        >
            <span className={COL.biz}>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="t-row-title">{name}</span>
                    {row.giveawayApplication === true && (
                        <span className="rounded-full border border-r1-line bg-r1-fill px-2 py-0.5 text-[11px] font-medium text-r1-ink-2">
                            Giveaway
                        </span>
                    )}
                    {affiliate && <span className="rounded-full border border-r1-line bg-r1-fill px-2 py-0.5 text-[11px] font-medium text-r1-ink-2">Affiliate</span>}
                </span>
                <span className="t-meta hidden truncate lg:block">{placeLine(row)}</span>
                {/* Phone: the creator column folds into the meta line. */}
                <span className="t-meta truncate lg:hidden">{joinDot(row.city, affiliate ? `${affiliate.name} · ${affiliate.label}` : owner ? "Owner-submitted" : creator)}</span>
                <span className="mt-1 flex min-w-0 items-center gap-1.5 lg:hidden">
                    <Status {...status} />
                    {note && <span className={cx("t-meta min-w-0 truncate", note.problem && "text-r1-red")}>· {note.text}</span>}
                </span>
            </span>
            <span className={COL.creator}>
                <span className="t-body truncate">{creator}</span>
                {(affiliate || owner) && <span className="t-meta truncate">{affiliate?.label ?? "Owner-submitted"}</span>}
            </span>
            <span className={COL.status}>
                <Status {...status} />
                {note && <span className={cx("t-meta truncate pl-3.5", note.problem && "text-r1-red")}>{note.text}</span>}
            </span>
            <span className={COL.pay}>
                <span className="t-body t-num max-w-full truncate text-r1-ink">{ownerPrice(row)}</span>
                {why && <span className="t-meta hidden max-w-full truncate lg:block">{why}</span>}
                {/* Phone: the waiting column folds in under the price. */}
                <span className="t-meta t-num max-w-full truncate lg:hidden">{wait !== null ? daysText(wait) : date}</span>
            </span>
            <span className={COL.wait}>
                <span className="t-body t-num truncate">{date}</span>
                {wait !== null && <span className="t-meta t-num truncate">{daysText(wait)}</span>}
            </span>
        </RowButton>
    )
}

function SkeletonRow() {
    return (
        <div className="t-row items-start lg:items-center">
            <span className={cx(COL.biz, "gap-2")}>
                <Skeleton width="60%" height={12} />
                <Skeleton width="40%" height={10} />
                <Skeleton width="45%" height={10} className="lg:hidden" />
            </span>
            <span className={COL.creator}>
                <Skeleton width="70%" height={12} />
            </span>
            <span className={COL.status}>
                <Skeleton width="60%" height={12} />
            </span>
            <span className={cx(COL.pay, "gap-2")}>
                <Skeleton width={56} height={12} />
                <Skeleton width={40} height={10} className="lg:hidden" />
            </span>
            <span className={COL.wait}>
                <Skeleton width={48} height={12} />
            </span>
        </div>
    )
}

/** The queue while it loads: tabs, toolbar and a page of rows, the same shape as the real thing. */
export function QueueSkeleton() {
    return (
        <Loading label="Loading submissions" className="flex flex-col gap-4">
            <GiveawaySummary />
            <div className="flex h-10 items-center gap-6 overflow-hidden border-b border-r1-line">
                {[28, 104, 52, 84, 40, 72, 92].map((width, i) => (
                    <Skeleton key={i} width={width} height={12} className="flex-none" />
                ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <Skeleton height={40} className="w-full lg:w-[380px]" />
                <Skeleton width={118} height={32} round />
                <Skeleton width={132} height={32} round />
                <Skeleton width={92} height={32} round />
                <Skeleton height={40} className="ml-auto w-10 sm:w-[180px]" />
            </div>
            <div className="t-card overflow-hidden" aria-hidden="true">
                <QueueHead />
                {Array.from({ length: 10 }, (_, i) => (
                    <SkeletonRow key={i} />
                ))}
            </div>
        </Loading>
    )
}
