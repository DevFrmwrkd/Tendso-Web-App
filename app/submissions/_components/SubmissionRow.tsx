"use client";

import { ChevronRight } from "lucide-react";

import { Icon, RowButton, Status, TableHead, formatMoney, submissionStatus } from "@/components/r1";

import { draftNote, formatDay, metaOf, rowShareNote, shareOf, stageOf, type Submission } from "../_lib/derive";

/*
 * One submission in the list (board: Submissions): business, status, what the
 * creator earns, the date, and a chevron, the whole row one button that opens
 * the drawer. The board's table columns start at lg, where the sidebar is; on
 * a phone or a tablet the row stacks: name, place and date, then the status,
 * with the amount on the right.
 *
 * The column widths live here once, shared by the header and every row.
 */
const COL_STATUS = "flex-none lg:w-[200px] xl:w-[240px]";
const COL_EARN = "flex-none lg:w-[120px] xl:w-[140px]";
const COL_DATE = "flex-none lg:w-[72px] xl:w-[88px]";

export function SubmissionTableHead() {
    return (
        <TableHead className="hidden lg:flex">
            <span className="min-w-0 flex-1">Business</span>
            <span className={COL_STATUS}>Status</span>
            <span className={`${COL_EARN} text-right`}>You earn</span>
            <span className={`${COL_DATE} text-right`}>Date</span>
            <span className="w-4 flex-none" />
        </TableHead>
    );
}

export function SubmissionRow({ s, now, selected, onOpen }: { s: Submission; now: number; selected: boolean; onOpen: () => void }) {
    const stage = stageOf(s.status);
    const status = submissionStatus(s.status, "creator");
    // A draft says what it still needs: "Draft · photos missing".
    const statusText = stage === "draft" ? `${status.word} · ${draftNote(s)}` : status.word;
    const share = shareOf(s);
    const note = rowShareNote(stage);
    const meta = metaOf(s);
    const date = formatDay(s._creationTime, now);

    return (
        <RowButton
            selected={selected}
            aria-current={selected ? "true" : undefined}
            aria-haspopup="dialog"
            onClick={onOpen}
            className="items-start lg:items-center"
        >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="t-row-title">{s.businessName}</span>
                <span className="t-meta truncate">
                    {meta}
                    <span className="t-num lg:hidden">{`${meta ? " · " : ""}${date}`}</span>
                </span>
                <Status tone={status.tone} className="mt-1 whitespace-normal lg:hidden">
                    {statusText}
                </Status>
            </span>
            <span className={`hidden lg:block ${COL_STATUS}`}>
                <Status tone={status.tone}>{statusText}</Status>
            </span>
            <span className={`flex flex-col items-end gap-0.5 text-right ${COL_EARN}`}>
                {share !== null && note !== null && (
                    <>
                        <span className="t-num text-sm font-semibold leading-5 text-r1-ink">{formatMoney(share)}</span>
                        <span className="t-meta hidden lg:block">{note}</span>
                    </>
                )}
            </span>
            <span className={`t-meta t-num hidden text-right lg:block ${COL_DATE}`}>{date}</span>
            <span className="t-row-chev self-center">
                <Icon icon={ChevronRight} />
            </span>
        </RowButton>
    );
}
