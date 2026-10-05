"use client";

import { Button, cx, Loading, Skeleton, SkeletonRows } from "@/components/r1";

import type { Waiting } from "./leadUtils";

/** The Waiting cell: the time, in ink and bold when it is going cold, with a quiet line under it. */
export function WaitingCell({ waiting, className }: { waiting: Waiting; className?: string }) {
    return (
        <span className={cx("flex flex-col items-end gap-0.5 text-right text-[13px] leading-[18px] text-r1-ink-2", className)}>
            <span className={cx(waiting.cold && "font-semibold text-r1-ink")}>{waiting.text}</span>
            {waiting.sub && <span className="text-r1-ink-3">{waiting.sub}</span>}
        </span>
    );
}

/** A tab's own shape while it loads: the gold answer card, the chips, then rows. */
export function ListLoading({ label }: { label: string }) {
    return (
        <Loading label={label} className="flex flex-col gap-5">
            <Skeleton height={52} className="w-full" />
            <div className="flex flex-wrap gap-2">
                {[52, 64, 88, 84, 88, 56].map((w, i) => (
                    <Skeleton key={i} width={w} height={32} round />
                ))}
            </div>
            <SkeletonRows count={6} />
        </Loading>
    );
}

/** Under the table: the page text with Previous / Next, then one line on what the list is. */
export function ListFoot({
    text,
    page,
    pages,
    onPage,
    note,
}: {
    text: string | null;
    page: number;
    pages: number;
    onPage: (page: number) => void;
    note: string;
}) {
    return (
        <div className="flex flex-col gap-2">
            {(text || pages > 1) && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                    {text && <p className="t-meta">{text}</p>}
                    {pages > 1 && (
                        <div className="flex gap-2">
                            <Button size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
                                Previous
                            </Button>
                            <Button size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
                                Next
                            </Button>
                        </div>
                    )}
                </div>
            )}
            <p className="t-meta">{note}</p>
        </div>
    );
}
