"use client";

import { Star } from "lucide-react";
import type { ReactNode } from "react";

import { Icon, List, RowButton, RowChevron, Status, TableHead, leadStatus } from "@/components/r1";

import { categoryKey, claimLine, formatKm, timeAgo, type FeedLead, type ProspectWithKm } from "./leadUtils";

/*
 * The ranked lists on /leads (board: Leads). On a desk they are tables; on a
 * phone each row stacks its columns into the meta lines under the name. A row
 * is one button: it opens the lead drawer.
 */

/** Rows per step of "Show more" (kit: a list page shows 8–10 rows at a time). */
export const PAGE = 10;

function ShowMore({ shown, total, onMore }: { shown: number; total: number; onMore: () => void }) {
    if (total <= shown) return null;
    return (
        <button type="button" className="t-showall gap-1.5" onClick={onMore}>
            Show {Math.min(PAGE, total - shown)} more
            <span className="t-count">
                {shown} of {total}
            </span>
        </button>
    );
}

// ── Prospects: For you, Claimed by me, All shops ───────────────────────────

export function ProspectTable({
    rows,
    shown,
    onMore,
    onOpen,
    empty,
}: {
    rows: ProspectWithKm[];
    shown: number;
    onMore: () => void;
    onOpen: (id: string) => void;
    /** The empty state for this tab and these filters. */
    empty: ReactNode;
}) {
    return (
        <div className="t-card overflow-hidden">
            <TableHead className="hidden sm:flex" aria-hidden="true">
                <span className="w-6 flex-none">#</span>
                <span className="min-w-0 flex-1">Business</span>
                <span className="hidden w-[190px] flex-none xl:block">City</span>
                <span className="w-16 flex-none">Rating</span>
                <span className="w-20 flex-none">Distance</span>
                <span className="w-[116px] flex-none">Status</span>
                <span className="w-4 flex-none" />
            </TableHead>
            {rows.length === 0 ? (
                empty
            ) : (
                <List>
                    {rows.slice(0, shown).map((r, i) => (
                        <ProspectRow key={r.p._id} row={r} rank={i + 1} onOpen={onOpen} />
                    ))}
                </List>
            )}
            <ShowMore shown={shown} total={rows.length} onMore={onMore} />
        </div>
    );
}

function ProspectRow({ row, rank, onOpen }: { row: ProspectWithKm; rank: number; onOpen: (id: string) => void }) {
    const { p, km } = row;
    const name = p.businessName ?? "(unnamed business)";
    const status = leadStatus(p.status);
    const category = p.businessCategory ? categoryKey(p.businessCategory) : null;
    const claim = claimLine(p);
    const sub = [category, claim].filter(Boolean).join(" · ");
    const rating = p.businessRating != null ? p.businessRating.toFixed(1) : null;
    const distance = km != null ? formatKm(km) : null;
    // The board's row label ("Open X, 1.2 km, New"), with the claim and rating too.
    const label = [`Open ${name}`, category, claim, rating ? `rated ${rating}` : null, distance ? `${distance} away` : null, status.word]
        .filter(Boolean)
        .join(", ");

    return (
        <RowButton className="min-h-16" onClick={() => onOpen(p._id)} aria-label={label}>
            <span className="t-meta t-num hidden w-6 flex-none sm:block">{rank}</span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[14px] font-medium leading-5 text-r1-ink">{name}</span>
                <span className="t-meta truncate">{sub}</span>
                {/* Phone: the columns fold into one more line. */}
                <span className="t-meta flex flex-wrap items-center gap-x-2 gap-y-1 sm:hidden">
                    {p.businessCity && <span>{p.businessCity}</span>}
                    {rating && (
                        <span className="t-num inline-flex items-center gap-1">
                            <Icon icon={Star} size={12} />
                            {rating}
                        </span>
                    )}
                    {distance && <span className="t-num">{distance}</span>}
                    <Status {...status} />
                </span>
            </span>
            <span className="t-body hidden w-[190px] flex-none truncate xl:block">{p.businessCity ?? "—"}</span>
            <span className="t-body t-num hidden w-16 flex-none items-center gap-1.5 sm:flex">
                <Icon icon={Star} size={14} className="text-r1-ink-3" />
                {rating ?? "—"}
            </span>
            <span className="t-body t-num hidden w-20 flex-none sm:block">{distance ?? "—"}</span>
            <span className="hidden w-[116px] flex-none sm:block">
                <Status {...status} />
            </span>
            <RowChevron />
        </RowButton>
    );
}

// ── Interviewed: the team's leads ──────────────────────────────────────────

export function InterviewedTable({
    rows,
    shown,
    onMore,
    onOpen,
    empty,
}: {
    rows: FeedLead[];
    shown: number;
    onMore: () => void;
    onOpen: (id: string) => void;
    empty: ReactNode;
}) {
    return (
        <div className="t-card overflow-hidden">
            <TableHead className="hidden sm:flex" aria-hidden="true">
                <span className="min-w-0 flex-1">Business</span>
                <span className="hidden w-[190px] flex-none lg:block">City</span>
                <span className="w-[116px] flex-none">Status</span>
                <span className="w-4 flex-none" />
            </TableHead>
            {rows.length === 0 ? (
                empty
            ) : (
                <List>
                    {rows.slice(0, shown).map((l) => (
                        <InterviewedRow key={l._id} lead={l} onOpen={onOpen} />
                    ))}
                </List>
            )}
            <ShowMore shown={shown} total={rows.length} onMore={onMore} />
        </div>
    );
}

function InterviewedRow({ lead: l, onOpen }: { lead: FeedLead; onOpen: (id: string) => void }) {
    const status = leadStatus(l.status);
    // What the old feed card said around the business: who asked about it, how
    // many creators interviewed it ("hot" from 3), and whether an admin
    // curated a card for it.
    const facts = [
        l.name ? `${l.name} inquired` : null,
        l.interviewerCount > 1 ? `${l.interviewerCount} interviewers${l.isHot ? " · hot" : ""}` : null,
        l.hasEnrichedContent ? "Curated" : null,
    ]
        .filter(Boolean)
        .join(" · ");
    const when = timeAgo(l._creationTime);
    const by = l.submittedBy ? `${l.isMine ? "You" : l.submittedBy.displayName} submitted it${when ? ` · ${when}` : ""}` : when;

    return (
        <RowButton className="min-h-16" onClick={() => onOpen(l._id)}>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[14px] font-medium leading-5 text-r1-ink">{l.businessName}</span>
                {facts && <span className="t-meta truncate">{facts}</span>}
                {by && <span className="t-meta truncate">{by}</span>}
                <span className="t-meta flex flex-wrap items-center gap-x-2 gap-y-1 sm:hidden">
                    {l.businessCity && <span>{l.businessCity}</span>}
                    <Status {...status} />
                </span>
            </span>
            <span className="t-body hidden w-[190px] flex-none truncate lg:block">{l.businessCity ?? "—"}</span>
            <span className="hidden w-[116px] flex-none sm:block">
                <Status {...status} />
            </span>
            <RowChevron />
        </RowButton>
    );
}
