"use client"

import { Avatar, cx, formatMoney, RowButton, RowChevron, Skeleton, Status, TableHead } from "@/components/r1"

import { displayName, longDate, rowNote, shortDate, statusOf, type Withdrawal } from "../_lib/model"

/*
 * The payouts table (ComponentKit "Table header and rows"): a header and rows
 * that are each ONE button, opening the payout drawer.
 *
 * A five-column table does not fit a phone, and a sideways-scrolling one is
 * worse, so below the desk width each row stacks: the creator, their status
 * and its note on the left; the amount and the date on the right. The desk
 * columns appear at `lg`, where the sidebar does.
 */

/** Column widths, shared by the header, the rows and the skeleton so they line up. */
const COL = {
    creator: "flex min-w-0 flex-1 items-start gap-3 lg:items-center",
    amount: "flex flex-none flex-col items-end text-right lg:w-[120px]",
    status: "hidden min-w-0 flex-none flex-col gap-0.5 lg:flex lg:w-[240px]",
    date: "hidden flex-none lg:block lg:w-[128px]",
    go: "hidden flex-none justify-end lg:flex lg:w-6",
}

export function PayoutHead() {
    return (
        <TableHead className="hidden lg:flex">
            <span className={COL.creator}>Creator</span>
            <span className={COL.amount}>Amount</span>
            <span className={COL.status}>Status</span>
            <span className={COL.date}>Requested</span>
            <span className={COL.go} />
        </TableHead>
    )
}

export function PayoutRow({ w, now, selected, onOpen }: { w: Withdrawal; now: number; selected: boolean; onOpen: () => void }) {
    const name = displayName(w)
    const status = statusOf(w)
    const note = rowNote(w)
    const amount = formatMoney(w.amount)
    const date = shortDate(w.createdAt, now)
    return (
        <RowButton
            selected={selected}
            onClick={onOpen}
            // One name for the whole row, as the board gives it, plus the note
            // the row shows under the status (it is often the point).
            aria-label={`Open ${amount} to ${name}, ${status.word}${note ? ` (${note})` : ""}, ${date}`}
            className="items-start lg:items-center"
        >
            <span className={COL.creator}>
                <Avatar name={name} />
                <span className="flex min-w-0 flex-col">
                    <span className="t-row-title">{name}</span>
                    {/* Phone: the status column folds in under the name. */}
                    <span className="mt-1 flex min-w-0 flex-col gap-0.5 lg:hidden">
                        <Status {...status} />
                        {note && <span className="t-meta">{note}</span>}
                    </span>
                </span>
            </span>
            <span className={COL.amount}>
                <span className="t-body t-num font-medium text-r1-ink">{amount}</span>
                {/* Phone: the date folds in under the amount. */}
                <span className="t-meta t-num lg:hidden">{date}</span>
            </span>
            <span className={COL.status}>
                <Status {...status} />
                {note && <span className="t-meta">{note}</span>}
            </span>
            <span className={cx(COL.date, "t-body t-num")}>{longDate(w.createdAt)}</span>
            <span className={COL.go}>
                <RowChevron />
            </span>
        </RowButton>
    )
}

export function PayoutSkeletonRow() {
    return (
        <div className="t-row items-start lg:items-center">
            <span className={COL.creator}>
                <Skeleton width={32} height={32} round className="flex-none" />
                <span className="flex min-w-0 flex-1 flex-col gap-2 pt-1 lg:pt-0">
                    <Skeleton width="55%" height={12} />
                    <Skeleton width="35%" height={10} className="lg:hidden" />
                </span>
            </span>
            <span className={cx(COL.amount, "gap-2 pt-1 lg:pt-0")}>
                <Skeleton width={48} height={12} />
                <Skeleton width={40} height={10} className="lg:hidden" />
            </span>
            <span className={COL.status}>
                <Skeleton width="45%" height={12} />
            </span>
            <span className={COL.date}>
                <Skeleton width={88} height={12} />
            </span>
            <span className={COL.go} />
        </div>
    )
}
