"use client";

import { Filter } from "lucide-react";
import { useMemo, useState } from "react";

import { Avatar, Button, EmptyState, List, RowButton, RowChevron, SearchInput, Status, TableHead, formatMoney } from "@/components/r1";

import { ChoiceMenu, Pager, TableLoading } from "../_components/TableParts";
import {
    SORTS,
    accountStatus,
    avatarName,
    fullName,
    matchesSearch,
    pageOf,
    pageText,
    roleLabel,
    roleOf,
    sortCreators,
    type CreatorRow,
    type SortKey,
} from "../_lib/creators";

type RoleFilter = "all" | "creator" | "staff" | "admin";

const ROLE_FILTERS: ReadonlyArray<{ value: RoleFilter; label: string }> = [
    { value: "all", label: "All" },
    { value: "creator", label: "Creators" },
    { value: "staff", label: "Staff" },
    { value: "admin", label: "Admins" },
];

/**
 * The "All creators" tab (board Creators): everyone with an account, ten to a
 * page. Search (name, email or phone), the role filter (now with Staff, which
 * the old one lacked) and the old list's eight sort orders. The old stat
 * cards are gone: the tab counts say how many wait and how many were
 * rejected, and "Sort: Status" groups the suspended and deleted ones.
 *
 * A row opens the creator's drawer; everything the old detail page did
 * (role, suspend, delete, history, pricing) lives there now.
 *
 * Phone first: below 1024px a row is name, a meta line and the status.
 * The status and balance columns come in at 1024px, submissions and earned
 * at 1280px, where the sidebar leaves room for them.
 */
export default function AllCreatorsView({
    rows,
    openId,
    onOpen,
}: {
    rows: CreatorRow[] | undefined;
    openId: string | null;
    onOpen: (id: string) => void;
}) {
    const [search, setSearch] = useState("");
    const [role, setRole] = useState<RoleFilter>("all");
    const [sort, setSort] = useState<SortKey>("newest");
    const [page, setPage] = useState(1);

    const visible = useMemo(() => {
        const matching = (rows ?? []).filter(
            (c) => (role === "all" || roleOf(c) === role) && matchesSearch(search, [fullName(c), c.email, c.phone]),
        );
        return sortCreators(matching, sort);
    }, [rows, role, search, sort]);

    const filtered = search.trim() !== "" || role !== "all";
    const sortOption = SORTS.find((o) => o.value === sort) ?? SORTS[0];
    const roleText = ROLE_FILTERS.find((o) => o.value === role)?.label ?? "All";
    const shown = pageOf(visible, page);

    const clearFilters = () => {
        setSearch("");
        setRole("all");
        setPage(1);
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
                <SearchInput
                    label="Search creators by name, email or phone"
                    placeholder="Search by name, email or phone"
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                    }}
                    className="w-full sm:w-[360px]"
                />
                <ChoiceMenu
                    text={`Role: ${roleText}`}
                    icon={Filter}
                    options={ROLE_FILTERS}
                    value={role}
                    onChange={(v) => {
                        setRole(v);
                        setPage(1);
                    }}
                />
                <ChoiceMenu
                    text={`Sort: ${sortOption.label}`}
                    options={SORTS}
                    value={sort}
                    onChange={(v) => {
                        setSort(v);
                        setPage(1);
                    }}
                    align="end"
                    className="sm:ml-auto"
                />
            </div>

            {rows === undefined ? (
                <TableLoading label="Loading all creators" />
            ) : (
                <>
                    <div className="t-card overflow-hidden">
                        <TableHead className="hidden lg:flex">
                            <span className="flex-1">Creator</span>
                            <span className="w-40 flex-none">Status</span>
                            <span className="hidden w-[110px] flex-none text-right xl:block">Submissions</span>
                            <span className="hidden w-[110px] flex-none text-right xl:block">Earned</span>
                            <span className="w-[110px] flex-none text-right">Balance</span>
                            <span className="w-4 flex-none" />
                        </TableHead>
                        {shown.rows.length > 0 ? (
                            <List>
                                {shown.rows.map((c) => {
                                    const name = fullName(c);
                                    const status = accountStatus(c);
                                    const subs = c.submissionCount ?? 0;
                                    const subsText = `${subs} submission${subs === 1 ? "" : "s"}`;
                                    const balance = formatMoney(c.balance ?? 0);
                                    return (
                                        <RowButton key={c._id} selected={openId === c._id} aria-label={`Open ${name}, ${status.word}`} onClick={() => onOpen(c._id)}>
                                            <Avatar name={avatarName(c)} />
                                            <span className="flex min-w-0 flex-1 flex-col">
                                                <span className="t-row-title">{name}</span>
                                                <span className="t-meta truncate">
                                                    {roleLabel(roleOf(c))}
                                                    {/* The numbers whose columns are not on screen yet ride in the meta line. */}
                                                    <span className="xl:hidden"> · {subsText}</span>
                                                    <span className="lg:hidden"> · {balance} balance</span>
                                                </span>
                                                <Status {...status} className="mt-1 lg:hidden" />
                                            </span>
                                            <span className="hidden w-40 flex-none lg:block">
                                                <Status {...status} />
                                            </span>
                                            <span className="t-num hidden w-[110px] flex-none text-right text-r1-ink-2 xl:block">{subs}</span>
                                            <span className="t-num hidden w-[110px] flex-none text-right text-r1-ink-2 xl:block">{formatMoney(c.totalEarnings ?? 0)}</span>
                                            <span className="t-num hidden w-[110px] flex-none text-right text-r1-ink-2 lg:block">{balance}</span>
                                            <RowChevron />
                                        </RowButton>
                                    );
                                })}
                            </List>
                        ) : filtered ? (
                            <EmptyState
                                title={search.trim() ? `No creator matches “${search.trim()}”` : `No ${roleText.toLowerCase()} here`}
                                body="Check the spelling, or clear the search and role filter."
                                action={<Button onClick={clearFilters}>Clear search and filter</Button>}
                            />
                        ) : (
                            <EmptyState title="No creators yet" body="Everyone who signs up in the app shows up here." />
                        )}
                    </div>
                    <Pager
                        text={pageText(sortOption.phrase, shown.rows.length, visible.length, shown.page, shown.pages)}
                        page={shown.page}
                        pages={shown.pages}
                        onPage={setPage}
                    />
                </>
            )}
        </div>
    );
}
