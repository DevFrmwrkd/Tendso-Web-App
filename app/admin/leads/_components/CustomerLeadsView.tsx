"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";

import { Button, Card, Chips, cx, Dot, EmptyState, ErrorState, Highlight, Icon, leadStatus, List, RowButton, Segmented, Status, TableHead } from "@/components/r1";
import type { Id } from "@/convex/_generated/dataModel";

import { LeadDrawer } from "./LeadDrawer";
import { ListFoot, ListLoading, WaitingCell } from "./ListParts";
import {
    ageText,
    countByStatus,
    creatorOf,
    isClosed,
    isColdLead,
    LEAD_STATUSES,
    leadName,
    leadWaiting,
    listNames,
    matches,
    pageOf,
    pageText,
    requestRef,
    siteOf,
    sourceWord,
    type LeadRow,
    type StatusFilter,
} from "./leadUtils";

type Sort = "waiting" | "newest";

const SORT_WORDS: Record<Sort, string> = { waiting: "Waiting longest first", newest: "Newest first" };

/**
 * The Customer leads tab (board AdminLeads): people who messaged a live site,
 * scanned its QR code, or came in directly. The gold card answers the page's
 * question for this tab; the chips filter by status; a row opens the lead in
 * the drawer. Filters, sort and page live here, so switching tabs and back
 * keeps them (the parent keeps both tabs mounted).
 */
export function CustomerLeadsView({
    rows,
    error,
    capped,
    cityOf,
    search,
    now,
    meId,
    openId,
    initialSort,
    onOpen,
    onClose,
    onDeleted,
    onClearSearch,
}: {
    rows: LeadRow[] | undefined;
    error: Error | null;
    /** getAll stops at 500 rows; there may be older leads it did not return. */
    capped: boolean;
    cityOf: (lead: LeadRow) => string | null;
    search: string;
    now: number;
    meId: Id<"creators"> | null;
    openId: string | null;
    initialSort: Sort;
    onOpen: (id: string) => void;
    onClose: () => void;
    onDeleted: (name: string) => void;
    onClearSearch: () => void;
}) {
    const [filter, setFilter] = useState<StatusFilter>("all");
    const [coldOnly, setColdOnly] = useState(false);
    const [sort, setSort] = useState<Sort>(initialSort);
    // The page belongs to one combination of search, filter and sort: change
    // any of them and the list starts again at page 1, with no effect needed.
    const signature = `${search}|${filter}|${coldOnly}|${sort}`;
    const [paging, setPaging] = useState({ signature, page: 1 });
    const page = paging.signature === signature ? paging.page : 1;

    if (error) return <ErrorState what="Customer leads" reference={requestRef(error)} />;
    if (rows === undefined) return <ListLoading label="Loading customer leads" />;

    const counts = countByStatus(rows);
    const cold = rows.filter((l) => isColdLead(l, now)).sort((a, b) => a.createdAt - b.createdAt);
    const visible = rows.filter(
        (l) =>
            (filter === "all" || l.status === filter) &&
            (!coldOnly || isColdLead(l, now)) &&
            matches([leadName(l), l.phone, l.email, siteOf(l), l.message, creatorOf(l), cityOf(l)], search),
    );
    const sorted = [...visible].sort((a, b) => {
        if (sort === "newest") return b.createdAt - a.createdAt;
        // Waiting longest: open leads first, oldest first; converted and lost at the bottom, newest first.
        const closedA = isClosed(a.status);
        const closedB = isClosed(b.status);
        if (closedA !== closedB) return closedA ? 1 : -1;
        return closedA ? b.createdAt - a.createdAt : a.createdAt - b.createdAt;
    });
    const paged = pageOf(sorted, page);
    const goTo = (p: number) => setPaging({ signature, page: p });
    // Looked up in every row, not just this page: a re-sort must not close the drawer.
    const openLead = openId ? rows.find((l) => l._id === openId) : undefined;

    const clearFilters = () => {
        setFilter("all");
        setColdOnly(false);
        onClearSearch();
    };

    const coldText = cold.length
        ? `${cold.length} new ${cold.length === 1 ? "lead has" : "leads have"} had no reply for 3 days or more: ${listNames(
              cold.map((l) => {
                  const site = siteOf(l);
                  return `${leadName(l)}${site ? ` at ${site}` : ""} (${ageText(now - l.createdAt)})`;
              }),
          )}.`
        : "Nothing is going cold. No new lead has waited 3 days or more for a reply.";

    return (
        <div className="flex flex-col gap-5">
            <Highlight className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:px-5 sm:py-3.5">
                <div className="flex flex-1 items-start gap-3">
                    <Dot tone={cold.length ? "attn" : "done"} className="mt-1.5" />
                    <p className="t-body text-r1-ink">{coldText}</p>
                </div>
                {(cold.length > 0 || coldOnly) && (
                    <Button size="sm" className="self-start sm:self-auto" aria-pressed={coldOnly} onClick={() => setColdOnly((c) => !c)}>
                        {coldOnly ? "Show all" : "Show only these"}
                    </Button>
                )}
            </Highlight>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <Chips
                    label="Filter by status"
                    value={filter}
                    onChange={setFilter}
                    options={[
                        { value: "all" as StatusFilter, label: "All", count: rows.length },
                        ...LEAD_STATUSES.map((s) => ({ value: s as StatusFilter, label: leadStatus(s).word, count: counts[s] ?? 0 })),
                    ]}
                />
                <Segmented
                    label="Sort"
                    className="self-start lg:self-auto"
                    value={sort}
                    onChange={setSort}
                    options={[
                        { value: "waiting", label: "Waiting longest" },
                        { value: "newest", label: "Newest" },
                    ]}
                />
            </div>

            <Card className="overflow-hidden">
                <TableHead className="hidden xl:flex">
                    <span className="flex-1">Lead</span>
                    <span className="w-[220px] flex-none">Site</span>
                    <span className="w-24 flex-none">Source</span>
                    <span className="w-[120px] flex-none">Status</span>
                    <span className="w-28 flex-none text-right">Waiting</span>
                    <span className="w-4 flex-none" />
                </TableHead>
                {paged.rows.length > 0 ? (
                    <List>
                        {paged.rows.map((l) => (
                            <LeadRowButton key={l._id} lead={l} city={cityOf(l)} now={now} selected={l._id === openId} onOpen={() => onOpen(l._id)} />
                        ))}
                    </List>
                ) : rows.length === 0 ? (
                    <EmptyState
                        title="No customer leads yet"
                        body="They arrive when someone messages a live site or scans its QR code, when a creator submits an interview, or when you add one."
                    />
                ) : (
                    <EmptyState
                        title="No leads match"
                        body="Try another status or search word."
                        action={
                            <Button size="sm" onClick={clearFilters}>
                                Clear filters
                            </Button>
                        }
                    />
                )}
            </Card>

            <ListFoot
                text={sorted.length > 0 ? pageText(SORT_WORDS[sort], paged.rows.length, sorted.length, paged.page, paged.pages) : null}
                page={paged.page}
                pages={paged.pages}
                onPage={goTo}
                note={[
                    "Customer leads are people who messaged a live site, scanned its QR code, or came in directly: a creator’s interview, the owner’s own sign-up, or added here. Waiting counts from when a lead came in.",
                    sort === "waiting" ? "Converted and lost leads sit at the bottom." : null,
                    capped ? "Only the newest 500 leads load, so older ones are not listed." : null,
                ]
                    .filter(Boolean)
                    .join(" ")}
            />

            {openLead && (
                <LeadDrawer key={openLead._id} lead={openLead} city={cityOf(openLead)} now={now} meId={meId} onClose={onClose} onDeleted={onDeleted} />
            )}
        </div>
    );
}

/**
 * One lead, one button. On a desk (xl) it is a table row: Lead, Site, Source,
 * Status, Waiting. Below that the columns stack: name, site line and message
 * on the left; status and waiting on the right. Never a sideways scroll.
 */
function LeadRowButton({ lead, city, now, selected, onOpen }: { lead: LeadRow; city: string | null; now: number; selected: boolean; onOpen: () => void }) {
    const site = siteOf(lead);
    const source = sourceWord(lead.source);
    const waiting = leadWaiting(lead, now);
    const message = lead.message?.trim() || "No message";
    return (
        <RowButton className="min-h-16 items-start xl:items-center" selected={selected} onClick={onOpen}>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium leading-5 text-r1-ink">{leadName(lead)}</span>
                <span className="t-meta truncate xl:hidden">{[site ?? "No site linked", city, source].filter(Boolean).join(" · ")}</span>
                <span className="t-meta truncate">{message}</span>
            </span>
            <span className="hidden w-[220px] min-w-0 flex-none flex-col gap-0.5 xl:flex">
                <span className={cx("truncate text-sm leading-5", site ? "text-r1-ink" : "text-r1-ink-3")}>{site ?? "No site linked"}</span>
                {city && <span className="t-meta truncate">{city}</span>}
            </span>
            <span className="hidden w-24 flex-none text-[13px] leading-[18px] text-r1-ink-2 xl:block">{source}</span>
            <span className="flex flex-none flex-col items-end gap-1 xl:contents">
                <span className="xl:w-[120px] xl:flex-none">
                    <Status {...leadStatus(lead.status)} />
                </span>
                <WaitingCell waiting={waiting} className="xl:w-28 xl:flex-none" />
            </span>
            <span className="t-row-chev hidden xl:flex">
                <Icon icon={ChevronRight} />
            </span>
        </RowButton>
    );
}
