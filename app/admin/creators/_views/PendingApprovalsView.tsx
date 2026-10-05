"use client";

import { useMemo, useState } from "react";

import { Avatar, Button, EmptyState, List, RowButton, RowChevron, SearchInput, Status, TableHead, creatorStatus } from "@/components/r1";

import { Lede, Pager, TableLoading } from "../_components/TableParts";
import { PAGE_ROWS, avatarName, formatPhone, fullName, matchesSearch, pageOf, pageText, shortDate, type PendingRow } from "../_lib/creators";

/**
 * The "Waiting for approval" tab (board Creators): everyone who passed the
 * quiz and is waiting for an admin. Rows come from `listPendingApproval` in
 * its own order, oldest first, so the top row has waited longest.
 *
 * Approve and Reject are no longer buttons on the row: a row opens the
 * creator's drawer, which carries both (and shows what the admin is deciding
 * on). The old queue's search stays for when the queue runs past one page.
 */
export default function PendingApprovalsView({
    rows,
    openId,
    now,
    onOpen,
    onSeeAll,
}: {
    rows: PendingRow[] | undefined;
    openId: string | null;
    now: number;
    onOpen: (id: string) => void;
    onSeeAll: () => void;
}) {
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);

    const filtered = useMemo(
        () => (rows ?? []).filter((c) => matchesSearch(search, [fullName(c), c.email, c.phone])),
        [rows, search],
    );

    if (rows === undefined) return <TableLoading label="Loading the creators waiting for approval" />;

    if (rows.length === 0) {
        return (
            <div className="t-card">
                <EmptyState
                    title="Nobody is waiting"
                    body="When someone passes the 5-question quiz, they show up here for you to approve."
                    action={<Button onClick={onSeeAll}>See all creators</Button>}
                />
            </div>
        );
    }

    const shown = pageOf(filtered, page);

    return (
        <div className="flex flex-col gap-3">
            <Lede>They passed the quiz. Approve them to let them submit, or reject with a reason they will see.</Lede>

            {/* A short queue needs no search box; one that runs past a page does. */}
            {rows.length > PAGE_ROWS || search ? (
                <SearchInput
                    label="Search the creators waiting, by name, email or phone"
                    placeholder="Search by name, email or phone"
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
                    <span className="w-[200px] flex-none">Status</span>
                    <span className="w-[110px] flex-none">Applied</span>
                    <span className="w-4 flex-none" />
                </TableHead>
                {shown.rows.length > 0 ? (
                    <List>
                        {shown.rows.map((c) => {
                            const name = fullName(c);
                            const applied = shortDate(c.quizPassedAt, now);
                            const contact = c.phone ? formatPhone(c.phone) : c.email;
                            // Every row here has passed the quiz and has no decision yet: "Waiting for approval".
                            const status = creatorStatus(c, "admin");
                            return (
                                <RowButton
                                    key={c._id}
                                    selected={openId === c._id}
                                    aria-label={`Open ${name}, waiting for approval`}
                                    onClick={() => onOpen(c._id)}
                                >
                                    <Avatar name={avatarName(c)} />
                                    <span className="flex min-w-0 flex-1 flex-col">
                                        <span className="t-row-title">{name}</span>
                                        <span className="t-meta truncate">
                                            <span className="lg:hidden">Applied {applied} · </span>
                                            {contact}
                                        </span>
                                        <Status {...status} className="mt-1 lg:hidden" />
                                    </span>
                                    <span className="hidden w-[200px] flex-none lg:block">
                                        <Status {...status} />
                                    </span>
                                    <span className="t-num hidden w-[110px] flex-none text-r1-ink-2 lg:block">{applied}</span>
                                    <RowChevron />
                                </RowButton>
                            );
                        })}
                    </List>
                ) : (
                    <EmptyState
                        title={`No one waiting matches “${search.trim()}”`}
                        body="Check the spelling, or clear the search."
                        action={<Button onClick={() => setSearch("")}>Clear search</Button>}
                    />
                )}
            </div>

            <Pager
                text={pageText("Oldest first", shown.rows.length, filtered.length, shown.page, shown.pages)}
                page={shown.page}
                pages={shown.pages}
                onPage={setPage}
            />
        </div>
    );
}
