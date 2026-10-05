"use client";

import { ArrowLeftRight } from "lucide-react";
import { useId, useState } from "react";

import { Button, EmptyState, Icon, Loading, Skeleton, Status, TableHead } from "@/components/r1";

import type { LedgerRow } from "../_lib/ledger";

/** Rows shown before "Show all" (the board caps this card at three). */
const CAP = 3;

/**
 * "Money in and out": earnings and withdrawals in one list, newest first.
 *
 * On a desk it is a table (date, what, status, amount). On a phone each row
 * stacks: what and the amount on top, the date in the meta line, the status
 * under it. Nothing scrolls sideways.
 */
export function Ledger({
    rows,
    canRetry,
    onRetry,
}: {
    /** undefined while either query is still loading. */
    rows: LedgerRow[] | undefined;
    /** False when there is nothing in the wallet to send again. */
    canRetry: boolean;
    onRetry: (row: LedgerRow) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const titleId = useId();

    const visible = rows ? (expanded ? rows : rows.slice(0, CAP)) : [];
    // The action column only takes room when a visible row has an action.
    const hasAction = visible.some((r) => r.retry);

    return (
        <section className="t-card overflow-hidden" aria-labelledby={titleId}>
            <div className="flex items-baseline justify-between gap-4 px-5 pb-4 pt-5 sm:px-6">
                <h2 id={titleId} className="t-h2">
                    Money in and out
                </h2>
                {rows && rows.length > 0 && <span className="t-meta">Newest first</span>}
            </div>

            {rows === undefined ? (
                <Loading label="Loading your money in and out">
                    <div aria-hidden="true">
                        {Array.from({ length: CAP }, (_, i) => (
                            <div key={i} className="t-row">
                                <span className="flex flex-1 flex-col gap-1.5">
                                    <Skeleton width="45%" height={12} />
                                    <Skeleton width="70%" height={10} />
                                </span>
                                <Skeleton width={56} height={12} />
                            </div>
                        ))}
                    </div>
                </Loading>
            ) : rows.length === 0 ? (
                <div className="border-t border-r1-line-3">
                    <EmptyState
                        icon={<Icon icon={ArrowLeftRight} size={18} />}
                        title="Nothing here yet"
                        body="When an owner pays for a site you made, your share shows up here. So does every withdrawal."
                    />
                </div>
            ) : (
                <>
                    <TableHead className="hidden sm:flex">
                        <span className="w-16 flex-none">Date</span>
                        <span className="min-w-0 flex-1">What</span>
                        <span className="w-28 flex-none">Status</span>
                        {hasAction && <span className="w-[104px] flex-none" />}
                        <span className="min-w-20 flex-none text-right">Amount</span>
                    </TableHead>
                    <div className="t-list">
                        {visible.map((row) => (
                            <LedgerItem key={row.key} row={row} actionColumn={hasAction} canRetry={canRetry} onRetry={onRetry} />
                        ))}
                    </div>
                    {rows.length > CAP && (
                        <button type="button" className="t-showall" aria-expanded={expanded} onClick={() => setExpanded((e) => !e)}>
                            {expanded ? "Show less" : `Show all ${rows.length}`}
                        </button>
                    )}
                </>
            )}
        </section>
    );
}

function LedgerItem({
    row,
    actionColumn,
    canRetry,
    onRetry,
}: {
    row: LedgerRow;
    actionColumn: boolean;
    canRetry: boolean;
    onRetry: (row: LedgerRow) => void;
}) {
    const action = row.retry ? (
        <Button disabled={!canRetry} onClick={() => onRetry(row)}>
            Try again
        </Button>
    ) : null;

    return (
        <div className="t-row items-start sm:items-center">
            <span className="t-meta t-num hidden w-16 flex-none sm:block">{row.date}</span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="t-row-title">{row.title}</span>
                <span className="t-meta wrap-anywhere">
                    <span className="sm:hidden">{row.date} · </span>
                    {row.sub}
                </span>
                <span className="mt-1.5 sm:hidden">
                    <Status {...row.status} />
                </span>
                {action && <span className="mt-2 sm:hidden">{action}</span>}
            </span>
            <span className="hidden w-28 flex-none sm:block">
                <Status {...row.status} />
            </span>
            {actionColumn && <span className="hidden w-[104px] flex-none justify-end sm:flex">{action}</span>}
            <span className="t-num min-w-20 flex-none whitespace-nowrap text-right text-sm font-medium text-r1-ink">{row.amount}</span>
        </div>
    );
}
