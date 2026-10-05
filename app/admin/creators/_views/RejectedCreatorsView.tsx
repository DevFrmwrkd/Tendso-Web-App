"use client";

import { useMemo, useState } from "react";

import { Avatar, Button, EmptyState, List, RowButton, RowChevron, SearchInput, Status, TableHead } from "@/components/r1";

import { Lede, Pager, TableLoading } from "../_components/TableParts";
import { PAGE_ROWS, avatarName, fullName, matchesSearch, pageOf, pageText, shortDate, type RejectedRow } from "../_lib/creators";

/**
 * The "Rejected" tab (board Creators): creators an admin rejected who have
 * not retaken the quiz yet, newest first (`listRejected`'s order). Retaking
 * the quiz clears the rejection, so they leave this list on their own and,
 * if they pass again, come back to Waiting for approval.
 *
 * A row opens the drawer with the reason they see. Search (name, email,
 * phone or reason, as the old view had) shows once the list runs past a page.
 */
export default function RejectedCreatorsView({
    rows,
    openId,
    now,
    onOpen,
}: {
    rows: RejectedRow[] | undefined;
    openId: string | null;
    now: number;
    onOpen: (id: string) => void;
}) {
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);

    const filtered = useMemo(
        () => (rows ?? []).filter((c) => matchesSearch(search, [fullName(c), c.email, c.phone, c.rejectionReason])),
        [rows, search],
    );

    if (rows === undefined) return <TableLoading label="Loading the rejected creators" />;

    if (rows.length === 0) {
        return (
            <div className="t-card">
                <EmptyState
                    title="Nobody is rejected"
                    body="Creators you reject show up here with the reason they see. Anyone who retakes the quiz leaves this list."
                />
            </div>
        );
    }

    const shown = pageOf(filtered, page);

    return (
        <div className="flex flex-col gap-3">
            <Lede>They see the reason on their rejection screen and can retake the quiz or contact support.</Lede>

            {/* A short list needs no search box; one that runs past a page does. */}
            {rows.length > PAGE_ROWS || search ? (
                <SearchInput
                    label="Search the rejected creators, by name, email, phone or reason"
                    placeholder="Search by name, email, phone or reason"
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                    }}
                    className="w-full sm:w-[360px]"
                />
            ) : null}

            <div className="t-card overflow-hidden">
                <TableHead className="hidden lg:flex">
                    <span className="flex-1">Creator</span>
                    <span className="w-[110px] flex-none">Rejected</span>
                    <span className="w-[260px] flex-none xl:w-[420px]">Reason</span>
                    <span className="w-4 flex-none" />
                </TableHead>
                {shown.rows.length > 0 ? (
                    <List>
                        {shown.rows.map((c) => {
                            const name = fullName(c);
                            const date = shortDate(c.rejectedAt, now);
                            return (
                                <RowButton key={c._id} selected={openId === c._id} aria-label={`Open ${name}, rejected`} onClick={() => onOpen(c._id)}>
                                    <Avatar name={avatarName(c)} />
                                    <span className="flex min-w-0 flex-1 flex-col">
                                        <span className="t-row-title">{name}</span>
                                        <Status tone="bad" word="Rejected" />
                                        {/* On a phone the date and the reason fold under the name. */}
                                        <span className="t-meta mt-1 line-clamp-2 lg:hidden">
                                            {date} · {c.rejectionReason ?? "No reason given"}
                                        </span>
                                    </span>
                                    <span className="t-num hidden w-[110px] flex-none text-r1-ink-2 lg:block">{date}</span>
                                    <span className="hidden w-[260px] flex-none lg:block xl:w-[420px]">
                                        <span className={c.rejectionReason ? "line-clamp-2 text-r1-ink-2" : "text-r1-ink-3"}>
                                            {c.rejectionReason ?? "No reason given"}
                                        </span>
                                    </span>
                                    <RowChevron />
                                </RowButton>
                            );
                        })}
                    </List>
                ) : (
                    <EmptyState
                        title={`No rejected creator matches “${search.trim()}”`}
                        body="Check the spelling, or clear the search."
                        action={<Button onClick={() => setSearch("")}>Clear search</Button>}
                    />
                )}
            </div>

            <Pager
                text={pageText("Newest first", shown.rows.length, filtered.length, shown.page, shown.pages)}
                page={shown.page}
                pages={shown.pages}
                onPage={setPage}
            />
        </div>
    );
}
