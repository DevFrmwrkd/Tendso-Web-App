"use client";

/**
 * Prospects view — Outscraper-discovered Google Maps businesses.
 *
 * Lives inside /admin/leads as a tab alongside the customer leads. Was
 * previously a standalone /admin/lead-prospects route — folded in here so
 * admins have one consolidated leads surface.
 *
 * Reads api.outscraper.listScrapedLeads (fetched by the page with `{}`: the
 * query takes only `{ limit? }` per the 2026-05-29 spec, so status + search
 * filtering happen here, client-side) and changes a prospect's status with
 * api.leads.updateStatus, as the old card's select did. Round 1 (board
 * AdminLeads): one-button rows in a table, the same status chips and search,
 * the going-cold answer for claims about to lapse, and the details (score
 * breakdown, phone, website, Google Maps) in the 480px drawer.
 */
import { useMutation } from "convex/react";
import { ChevronRight, ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
    Button,
    Card,
    Chips,
    cx,
    DefList,
    DefRow,
    Dot,
    Drawer,
    EmptyState,
    ErrorState,
    Fold,
    Highlight,
    Icon,
    leadStatus,
    List,
    RowButton,
    Segmented,
    Status,
    TableHead,
} from "@/components/r1";
import { api } from "@/convex/_generated/api";

import { ListFoot, ListLoading, WaitingCell } from "./ListParts";
import { StatusSelect } from "./StatusSelect";
import {
    claimerName,
    claimLeft,
    countByStatus,
    errorText,
    isClosed,
    isColdProspect,
    lapseLabel,
    lapsePhrase,
    LEAD_STATUSES,
    listNames,
    mapsHref,
    matches,
    pageOf,
    pageText,
    pointsText,
    prospectName,
    prospectPlace,
    prospectScore,
    prospectWaiting,
    ratingLine,
    requestRef,
    shortDate,
    telHref,
    websiteHref,
    websiteText,
    type LeadStatusValue,
    type Prospect,
    type StatusFilter,
} from "./leadUtils";

type Sort = "waiting" | "score";

const SORT_WORDS: Record<Sort, string> = { waiting: "Waiting longest first", score: "Best score first" };

export default function ProspectsView({
    rows,
    error,
    search,
    now,
    openId,
    onOpen,
    onClose,
    onClearSearch,
}: {
    rows: Prospect[] | undefined;
    error: Error | null;
    search: string;
    now: number;
    openId: string | null;
    onOpen: (id: string) => void;
    onClose: () => void;
    onClearSearch: () => void;
}) {
    const [filter, setFilter] = useState<StatusFilter>("all");
    const [coldOnly, setColdOnly] = useState(false);
    const [sort, setSort] = useState<Sort>("waiting");
    // One page per combination of search, filter and sort; any change starts again at page 1.
    const signature = `${search}|${filter}|${coldOnly}|${sort}`;
    const [paging, setPaging] = useState({ signature, page: 1 });
    const page = paging.signature === signature ? paging.page : 1;

    if (error) return <ErrorState what="Prospects" reference={requestRef(error)} />;
    if (rows === undefined) return <ListLoading label="Loading prospects" />;

    // Stat rollup runs against the UNFILTERED feed so the chip counts stay
    // accurate (how many prospects exist in each bucket overall, not how many
    // are currently visible).
    const counts = countByStatus(rows);
    const scores = new Map(rows.map((p) => [p._id, prospectScore(p).total] as const));
    const cold = rows.filter((p) => isColdProspect(p, now)).sort((a, b) => (a.claimedAt ?? 0) - (b.claimedAt ?? 0));
    const visible = rows.filter(
        (p) =>
            (filter === "all" || p.status === filter) &&
            (!coldOnly || isColdProspect(p, now)) &&
            matches([p.businessName, p.businessCity, p.businessCategory, p.businessAddress, p.phone], search),
    );
    // Waiting longest: running claims first, the oldest (closest to lapsing)
    // on top; then unclaimed ones in the order they were found; converted
    // and lost last.
    const rank = (p: Prospect) => (isClosed(p.status) ? 2 : p.claimedAt ? 0 : 1);
    const sorted = [...visible].sort((a, b) => {
        if (sort === "score") return (scores.get(b._id) ?? 0) - (scores.get(a._id) ?? 0);
        const byRank = rank(a) - rank(b);
        if (byRank !== 0) return byRank;
        return rank(a) === 0 ? (a.claimedAt ?? 0) - (b.claimedAt ?? 0) : 0;
    });
    const paged = pageOf(sorted, page);
    const openProspect = openId ? rows.find((p) => p._id === openId) : undefined;

    const clearFilters = () => {
        setFilter("all");
        setColdOnly(false);
        onClearSearch();
    };

    const coldText = cold.length
        ? `${cold.length} ${cold.length === 1 ? "prospect is" : "prospects are"} going cold: ${listNames(
              cold.map((p) => `${prospectName(p)} (${claimerName(p)}’s claim ${lapsePhrase(claimLeft(p, now) ?? 0)})`),
          )}.`
        : "Nothing is going cold. No claim lapses in the next 6 hours.";

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
                        { value: "score", label: "Best score" },
                    ]}
                />
            </div>

            <Card className="overflow-hidden">
                <TableHead className="hidden xl:flex">
                    <span className="flex-1">Business</span>
                    <span className="w-20 flex-none">Score</span>
                    <span className="w-[110px] flex-none">Google rating</span>
                    <span className="w-[120px] flex-none">Status</span>
                    <span className="w-[180px] flex-none">Claimed by</span>
                    <span className="w-28 flex-none text-right">Waiting</span>
                    <span className="w-4 flex-none" />
                </TableHead>
                {paged.rows.length > 0 ? (
                    <List>
                        {paged.rows.map((p) => (
                            <ProspectRowButton
                                key={p._id}
                                prospect={p}
                                score={scores.get(p._id) ?? 0}
                                now={now}
                                selected={p._id === openId}
                                onOpen={() => onOpen(p._id)}
                            />
                        ))}
                    </List>
                ) : rows.length === 0 ? (
                    <EmptyState
                        title="No prospects yet"
                        body="They come from Google Maps when a creator taps Find a local business on their Leads page or in the mobile app."
                    />
                ) : (
                    <EmptyState
                        title="No prospects match"
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
                onPage={(p) => setPaging({ signature, page: p })}
                note="Prospects come from Google Maps when a creator taps Find a local business. A claim lasts 24 hours; once a creator interviews the business it leaves this list."
            />

            {openProspect && <ProspectDrawer key={openProspect._id} prospect={openProspect} now={now} onClose={onClose} />}
        </div>
    );
}

/**
 * One prospect, one button. On a desk (xl) it is a table row: Business,
 * Score, Google rating, Status, Claimed by, Waiting. Below that it stacks:
 * name, place and claim on the left; status and score on the right.
 */
function ProspectRowButton({
    prospect: p,
    score,
    now,
    selected,
    onOpen,
}: {
    prospect: Prospect;
    score: number;
    now: number;
    selected: boolean;
    onOpen: () => void;
}) {
    const claimed = p.claimedAt != null;
    const left = claimLeft(p, now) ?? 0;
    const claimSub = !claimed ? null : isClosed(p.status) ? `Since ${shortDate(p.claimedAt ?? 0, now)}` : lapseLabel(left);
    const reviews = p.businessReviewCount ?? 0;
    return (
        <RowButton className="min-h-16 items-start xl:items-center" selected={selected} onClick={onOpen}>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium leading-5 text-r1-ink">{prospectName(p)}</span>
                <span className="t-meta truncate">{prospectPlace(p)}</span>
                <span className="t-meta truncate xl:hidden">
                    {claimed ? `Claimed by ${claimerName(p)}${claimSub ? ` · ${claimSub.toLowerCase()}` : ""}` : "Not claimed"}
                </span>
            </span>
            <span className="hidden w-20 flex-none items-baseline gap-0.5 xl:flex">
                <span className="t-num text-sm font-medium leading-5 text-r1-ink">{score}</span>
                <span className="t-meta">/100</span>
            </span>
            <span className="hidden w-[110px] flex-none flex-col gap-0.5 xl:flex">
                <span className="t-num text-sm leading-5 text-r1-ink">{p.businessRating != null ? p.businessRating.toFixed(1) : "No rating"}</span>
                <span className="t-meta t-num">
                    {reviews.toLocaleString("en-US")} {reviews === 1 ? "review" : "reviews"}
                </span>
            </span>
            <span className="flex flex-none flex-col items-end gap-1 xl:contents">
                <span className="xl:w-[120px] xl:flex-none">
                    <Status {...leadStatus(p.status)} />
                </span>
                <span className="t-num text-[13px] leading-[18px] text-r1-ink-2 xl:hidden">Score {score}</span>
            </span>
            <span className="hidden w-[180px] min-w-0 flex-none flex-col gap-0.5 xl:flex">
                <span className={cx("truncate text-sm leading-5", claimed ? "text-r1-ink" : "text-r1-ink-3")}>{claimed ? claimerName(p) : "Nobody yet"}</span>
                {claimSub && <span className="t-meta truncate">{claimSub}</span>}
            </span>
            <span className="hidden w-28 flex-none xl:block">
                <WaitingCell waiting={prospectWaiting(p, now)} />
            </span>
            <span className="t-row-chev hidden xl:flex">
                <Icon icon={ChevronRight} />
            </span>
        </RowButton>
    );
}

/**
 * A prospect's details (board AdminLeads, prospect drawer): status, who has
 * claimed it, the quality score with its breakdown in a fold, and the
 * listing's contact facts. Mounted per open prospect (keyed by id).
 */
function ProspectDrawer({ prospect: p, now, onClose }: { prospect: Prospect; now: number; onClose: () => void }) {
    const updateStatus = useMutation(api.leads.updateStatus);
    // The status just picked, shown until the query catches up.
    const [pendingStatus, setPendingStatus] = useState<LeadStatusValue | null>(null);
    const status = pendingStatus ?? p.status;
    const score = prospectScore(p);

    const claimLine = !p.claimedAt
        ? "Nobody has claimed it yet. Creators see it in their Leads and on the map."
        : `Claimed by ${claimerName(p)} on ${shortDate(p.claimedAt, now)}.${isClosed(status) ? "" : ` The claim ${lapsePhrase(claimLeft(p, now) ?? 0)}.`}`;

    const changeStatus = async (next: LeadStatusValue) => {
        if (next === status) return;
        setPendingStatus(next);
        try {
            await updateStatus({ id: p._id, status: next });
            toast.success(`Status changed to ${leadStatus(next).word}`);
        } catch (err) {
            toast.error(errorText(err, "Could not change the status"));
        } finally {
            setPendingStatus(null);
        }
    };

    return (
        <Drawer
            open
            onClose={onClose}
            title={prospectName(p)}
            meta={prospectPlace(p)}
            closeLabel="Close prospect details"
            footer={<Button onClick={onClose}>Close</Button>}
        >
            <StatusSelect label="Status" value={status} help={claimLine} onChange={(next) => void changeStatus(next)} />

            <div className="flex items-baseline gap-2">
                <span className="t-figure">{score.total}</span>
                <span className="t-meta">of 100 quality score</span>
            </div>

            <DefList>
                <DefRow term="Address">{p.businessAddress || "Not listed"}</DefRow>
                <DefRow term="Phone">
                    {p.phone ? (
                        <a className="t-link t-num" href={telHref(p.phone)}>
                            {p.phone}
                        </a>
                    ) : (
                        "None found"
                    )}
                </DefRow>
                <DefRow term="Website">
                    {p.businessWebsite ? (
                        <a className="t-link" href={websiteHref(p.businessWebsite)} target="_blank" rel="noopener noreferrer">
                            {websiteText(p.businessWebsite)}
                        </a>
                    ) : (
                        "None found"
                    )}
                </DefRow>
                <DefRow term="Google rating">{ratingLine(p)}</DefRow>
                <DefRow term="Found">{`${shortDate(p.scrapedAt ?? p.createdAt, now)}, from Google Maps`}</DefRow>
                {p.businessLatitude != null && p.businessLongitude != null && (
                    <DefRow term="Map">
                        <a
                            className="t-link inline-flex items-center gap-1"
                            href={mapsHref(p.businessLatitude, p.businessLongitude)}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Open in Google Maps
                            <Icon icon={ExternalLink} size={14} />
                        </a>
                    </DefRow>
                )}
            </DefList>

            <Fold title="How the score is made">
                <div className="flex flex-col gap-2.5">
                    {score.rows.map((r) => (
                        <div key={r.label} className="flex justify-between gap-3 text-[13px] leading-[18px] text-r1-ink-2">
                            <span>{r.label}</span>
                            <span className="t-num text-r1-ink">{pointsText(r.points)}</span>
                        </div>
                    ))}
                    <hr className="t-divider" />
                    <div className="flex justify-between gap-3 text-[13px] font-medium leading-[18px] text-r1-ink">
                        <span>Total, rounded, out of 100</span>
                        <span className="t-num">{score.total}</span>
                    </div>
                </div>
            </Fold>
        </Drawer>
    );
}
