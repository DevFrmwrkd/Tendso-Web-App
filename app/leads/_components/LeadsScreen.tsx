"use client";

/**
 * /leads, the creator's Leads (board: Leads). It answers one question: which
 * shop should I visit next?
 *
 * Two feeds, as before, now as tabs over one ranked list:
 *  - prospects: businesses Find a local business pulled from Google Maps
 *    (Outscraper) that nobody on the team has interviewed yet, with their
 *    claims (api.outscraper.listScrapedLeads). For you hides the ones another
 *    creator claimed; Claimed by me and All shops are what they say.
 *  - Interviewed: the team-wide social feed of leads, every interview and the
 *    customers who asked about them (api.leads.listForMobileCRM, with its
 *    search, status and only-mine arguments). It mirrors the mobile app's leads
 *    index (`ndm/app/(app)/leads/index.tsx`); spec docs/changes/WEB-BUILD-CRM.md.
 *
 * Any lead opens in the right drawer (?lead=<id>), which is what
 * /leads/[leadId] became, and ?find=1 opens Find a local business. The maps
 * are one click away in the header: /leads/discover (businesses to visit) and
 * /leads/live (live Tendso sites).
 */
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { ArrowRight, ChevronDown, Globe, MapPin, Plus, Search, Store } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";

import FindLocalBusinessModal from "@/components/leads/FindLocalBusinessModal";
import {
    Button,
    ButtonLink,
    Drawer,
    EmptyState,
    ErrorState,
    Highlight,
    Icon,
    Loading,
    MoreMenu,
    PageHeader,
    SkeletonRows,
    Tabs,
    leadStatus,
    type ChipItem,
    type TabItem,
} from "@/components/r1";
import { api } from "@/convex/_generated/api";
import { creatorRedirect } from "@/lib/creatorGate";

import { LeadDrawer, type DrawerHint } from "./LeadDrawer";
import { InterviewedTable, PAGE, ProspectTable } from "./LeadRows";
import { LeadsErrorBoundary } from "./LeadsErrorBoundary";
import { LeadsFilters, NO_FILTERS, type Filters } from "./LeadsFilters";
import {
    FIND_PARAM,
    LEAD_PARAM,
    RATING_OPTIONS,
    SORT_LABELS,
    TAB_PARAM,
    categoryKey,
    distanceTo,
    formatKm,
    parseTab,
    prospectMatches,
    sortProspects,
    tabParam,
    type LeadsTab,
    type Prospect,
    type SortKey,
} from "./leadUtils";
import { useMyLocation } from "./useMyLocation";

const TITLE = "Leads";
const SUB = "Which shop should I visit next?";

/** The page while the account, the guards and the first data load. */
export function LeadsLoading() {
    return (
        <>
            <PageHeader title={TITLE} sub={SUB} />
            <Loading label="Loading leads">
                <SkeletonRows count={5} />
            </Loading>
        </>
    );
}

export function LeadsScreen() {
    const router = useRouter();
    const pathname = usePathname() ?? "/leads";
    const searchParams = useSearchParams();
    const tab = parseTab(searchParams.get(TAB_PARAM));
    const leadParam = searchParams.get(LEAD_PARAM);
    // Find a local business is open while the URL says ?find=1, so the Leads
    // map's "Find more businesses" can link straight to it, and a refresh
    // keeps it open.
    const findOpen = searchParams.get(FIND_PARAM) === "1";
    const { user, isLoaded, isSignedIn } = useUser();

    const creator = useQuery(api.creators.getByClerkId, user ? { clerkId: user.id } : "skip");

    // Same redirect guards as /dashboard so users land in the right place.
    useEffect(() => {
        if (isLoaded && !isSignedIn) router.push("/login");
    }, [isLoaded, isSignedIn, router]);
    useEffect(() => {
        if (isLoaded && isSignedIn && creator === null) router.push("/onboarding");
    }, [isLoaded, isSignedIn, creator, router]);
    // The feed is for creators: an admin goes to /admin, as before. One lead is
    // the exception. /leads/[leadId], which now redirects here with ?lead=,
    // always let admins in (with the status menu), and the map pages still
    // link admins to it; closing the drawer then carries on to /admin.
    useEffect(() => {
        if (isLoaded && isSignedIn && creator && creator.role === "admin" && !leadParam) router.push("/admin");
    }, [isLoaded, isSignedIn, creator, leadParam, router]);
    useEffect(() => {
        if (isLoaded && isSignedIn && creator) {
            const dest = creatorRedirect(creator);
            if (dest) router.replace(dest);
        }
    }, [isLoaded, isSignedIn, creator, router]);

    // ── UI state ───────────────────────────────────────────────────────────
    const [searchInput, setSearchInput] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    // 300ms debounce — matches the spec.
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
        return () => clearTimeout(t);
    }, [searchInput]);
    const [filters, setFilters] = useState<Filters>(NO_FILTERS);
    const { location, ask: askLocation } = useMyLocation();
    const pos = location.status === "ready" ? location.pos : null;

    // ── Data ───────────────────────────────────────────────────────────────
    // Convex runs signed-out until Clerk hands it a token. listScrapedLeads
    // throws without one, and listForMobileCRM answers an empty feed, so both
    // wait for Convex's own auth rather than only Clerk's.
    const { isAuthenticated: convexAuthed } = useConvexAuth();
    const signedInCreator = !!isSignedIn && !!creator && convexAuthed;
    const feed = useQuery(
        api.leads.listForMobileCRM,
        signedInCreator ? { search: debouncedSearch || undefined, statusFilter: filters.status, onlyMine: filters.onlyMine } : "skip",
    );
    // Prospects with their claim metadata (claimedBy, claimedAt) alongside the
    // Outscraper business fields. Every tab but Interviewed lists them, and
    // Visit next is picked from them.
    const prospects = useQuery(api.outscraper.listScrapedLeads, signedInCreator ? {} : "skip") as Prospect[] | undefined;

    // Interviewed feed — exclude Outscraper-source leads so the tabs don't
    // double-count. A CONVERTED prospect is the exception: it's been
    // interviewed, so it belongs here even though its source is outscraper.
    // Without that clause it drops out of the prospect tabs on conversion and
    // never appears anywhere else, and the creator loses sight of the business
    // they just interviewed. submissionStatus is non-null exactly when a
    // submission is linked, and listForMobileCRM already returns it.
    const interviewed = useMemo(
        () => feed?.leads.filter((l) => l.source !== "outscraper" || l.submissionStatus != null),
        [feed],
    );

    const withKm = useMemo(
        () => prospects?.map((p) => ({ p, km: distanceTo(pos, p.businessLatitude, p.businessLongitude) })),
        [prospects, pos],
    );
    const sort: SortKey = filters.sort === "auto" ? (pos ? "closest" : "newest") : filters.sort;
    const prospectLists = useMemo(() => {
        if (!withKm) return undefined;
        // Distance only filters once there is a position to measure from.
        const f = { ...filters, distance: pos ? filters.distance : ("any" as const) };
        const matched = sortProspects(
            withKm.filter((r) => prospectMatches(r, f, debouncedSearch)),
            sort,
        );
        return {
            "for-you": matched.filter((r) => !r.p.claimedBy || r.p.claimedBy.isMine),
            mine: matched.filter((r) => !!r.p.claimedBy?.isMine),
            all: matched,
        };
    }, [withKm, filters, pos, debouncedSearch, sort]);

    // Category chips come from the data: the 8 biggest, so the row stays short.
    const categories = useMemo<ChipItem<string>[]>(() => {
        if (!prospects) return [];
        const counts = new Map<string, number>();
        for (const p of prospects) {
            const k = categoryKey(p.businessCategory);
            counts.set(k, (counts.get(k) ?? 0) + 1);
        }
        const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
        return [{ value: "all", label: "All", count: prospects.length }, ...top.map(([value, count]) => ({ value, label: value, count }))];
    }, [prospects]);

    // The answer to the page's question: the nearest shop nobody has claimed
    // (the newest one while the creator's position is unknown). Taken from
    // every prospect, not the filtered list, as the board does.
    const best = useMemo(() => {
        if (!withKm) return null;
        const open = withKm.filter((r) => !r.p.claimedBy);
        return open.length ? sortProspects(open, pos ? "closest" : "newest")[0] : null;
    }, [withKm, pos]);

    // What the list already knows about the lead in ?lead=, for the drawer's
    // title while its own query loads (and the feed row's map pin).
    const hint = useMemo<DrawerHint | null>(() => {
        if (!leadParam) return null;
        const p = prospects?.find((x) => x._id === leadParam);
        if (p) {
            return {
                name: p.businessName ?? "(unnamed business)",
                meta: [p.businessCategory ? categoryKey(p.businessCategory) : null, p.businessCity].filter(Boolean).join(" · ") || undefined,
            };
        }
        const l = feed?.leads.find((x) => x._id === leadParam);
        if (l) return { name: l.businessName, meta: [l.businessType, l.businessCity].filter(Boolean).join(" · ") || undefined, row: l };
        return null;
    }, [leadParam, prospects, feed]);

    // "Show more" counts rows per list; a new tab, filter or sort starts over.
    const listKey = `${tab}|${debouncedSearch}|${JSON.stringify(filters)}|${pos ? 1 : 0}`;
    const [shown, setShown] = useState({ key: listKey, n: PAGE });
    const visible = shown.key === listKey ? shown.n : PAGE;

    // ── URL: the tab, the open lead, and Find a local business ─────────────
    const replaceParams = useCallback(
        (patch: Record<string, string | null>) => {
            const next = new URLSearchParams(searchParams.toString());
            for (const [key, value] of Object.entries(patch)) {
                if (value === null) next.delete(key);
                else next.set(key, value);
            }
            const qs = next.toString();
            router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
        },
        [router, pathname, searchParams],
    );
    const openLead = (id: string) => replaceParams({ [LEAD_PARAM]: id });
    const closeLead = () => replaceParams({ [LEAD_PARAM]: null });
    const setTab = (t: LeadsTab) => replaceParams({ [TAB_PARAM]: tabParam(t) });
    // Opening the search closes any lead, as the board does.
    const openFind = () => replaceParams({ [FIND_PARAM]: "1", [LEAD_PARAM]: null });
    const closeFind = () => replaceParams({ [FIND_PARAM]: null });

    const visitId = useId();

    // Certified creators only, as before; an admin only with a lead to open (see above).
    const ready = isLoaded && isSignedIn && !!creator && (creator.role === "admin" ? !!leadParam : !!creator.certifiedAt);

    if (!ready || !creator) return <LeadsLoading />;

    const isAdmin = creator.role === "admin";
    const me = {
        id: String(creator._id),
        name: [creator.firstName, creator.lastName].filter(Boolean).join(" ") || user?.fullName || "You",
    };

    // ── Filters: what is on, and clearing it ───────────────────────────────
    const typed = searchInput.trim();
    const summaryParts: string[] = typed ? [`“${typed}”`] : [];
    let hasFilters: boolean;
    if (tab === "interviewed") {
        if (filters.status !== "all") summaryParts.push(leadStatus(filters.status).word);
        if (filters.onlyMine) summaryParts.push("Only mine");
        hasFilters = !!typed || filters.status !== "all" || filters.onlyMine;
    } else {
        if (filters.category !== "all") summaryParts.push(filters.category);
        if (filters.rating !== "any") summaryParts.push(RATING_OPTIONS.find((o) => o.value === filters.rating)?.label ?? "");
        if (pos && filters.distance !== "any") summaryParts.push(`Under ${filters.distance} km`);
        if (filters.city.trim()) summaryParts.push(filters.city.trim());
        hasFilters = !!typed || filters.category !== "all" || filters.rating !== "any" || (!!pos && filters.distance !== "any") || !!filters.city.trim();
    }
    const clearFilters = () => {
        setSearchInput("");
        setDebouncedSearch("");
        setFilters((f) => ({ ...NO_FILTERS, sort: f.sort }));
    };

    const tabs: TabItem<LeadsTab>[] = [
        { value: "for-you", label: "For you", count: prospectLists?.["for-you"].length ?? null },
        { value: "mine", label: "Claimed by me", count: prospectLists?.mine.length ?? null },
        { value: "all", label: "All shops", count: prospectLists?.all.length ?? null },
        { value: "interviewed", label: "Interviewed", count: interviewed?.length ?? null },
    ];

    // ── The line above the list: how it is ranked, and where the rest are ──
    let rankLine: ReactNode;
    if (tab === "interviewed") {
        rankLine = "Newest first. The whole team's leads, yours included.";
    } else {
        const where =
            tab === "for-you"
                ? "Shops another creator claimed are in All shops."
                : tab === "mine"
                  ? "Claims expire after 24 hours without an interview."
                  : "Every shop the team has found, claimed or not.";
        const canOffer = !pos && (location.status === "unknown" || location.status === "asking");
        rankLine = (
            <>
                {SORT_LABELS[sort]}. {where}
                {canOffer && (
                    <>
                        {" "}
                        <button
                            type="button"
                            className="t-link"
                            onClick={() => {
                                // It promises closest first, so it also hands the sort back to "auto".
                                setFilters((f) => ({ ...f, sort: "auto" }));
                                askLocation();
                            }}
                            disabled={location.status === "asking"}
                        >
                            {location.status === "asking" ? "Finding you…" : "Use my location"}
                        </button>{" "}
                        to put the closest first.
                    </>
                )}
            </>
        );
    }

    // ── The list, its loading and its empty states ─────────────────────────
    let list: ReactNode;
    if (tab === "interviewed") {
        list =
            interviewed === undefined ? (
                <Loading label="Loading leads">
                    <SkeletonRows count={5} />
                </Loading>
            ) : (
                <InterviewedTable
                    rows={interviewed}
                    shown={visible}
                    onMore={() => setShown({ key: listKey, n: visible + PAGE })}
                    onOpen={openLead}
                    empty={
                        hasFilters ? (
                            <EmptyState
                                title="No leads match these filters"
                                body="Try a different filter, or clear the search."
                                action={<Button onClick={clearFilters}>Clear filters</Button>}
                            />
                        ) : (
                            <EmptyState
                                title="No interviewed businesses yet"
                                body="The team's leads appear here as soon as someone submits a business."
                                action={
                                    <ButtonLink variant="primary" href="/submit/info">
                                        <Icon icon={Plus} />
                                        New submission
                                    </ButtonLink>
                                }
                            />
                        )
                    }
                />
            );
    } else {
        const rows = prospectLists?.[tab];
        list =
            rows === undefined ? (
                <Loading label="Loading leads">
                    <SkeletonRows count={5} />
                </Loading>
            ) : (
                <ProspectTable
                    rows={rows}
                    shown={visible}
                    onMore={() => setShown({ key: listKey, n: visible + PAGE })}
                    onOpen={openLead}
                    empty={
                        hasFilters ? (
                            <EmptyState
                                title="No shops match these filters"
                                body="Loosen a filter, or search a new area with Find a local business."
                                action={<Button onClick={clearFilters}>Clear filters</Button>}
                            />
                        ) : tab === "mine" ? (
                            <EmptyState
                                title="You have not claimed a shop yet"
                                body="Open a shop in For you and tap “I'll interview this”. Your claim tells the team you are going, so nobody else knocks on the same door."
                                action={<Button onClick={() => setTab("for-you")}>See shops for you</Button>}
                            />
                        ) : (prospects?.length ?? 0) === 0 ? (
                            <EmptyState
                                title="No shops to visit yet"
                                body="Find a local business searches Google Maps around you and adds the shops nobody on the team has interviewed yet."
                                action={
                                    <Button onClick={openFind}>
                                        <Icon icon={Search} />
                                        Find a local business
                                    </Button>
                                }
                            />
                        ) : (
                            <EmptyState
                                title="Another creator claimed every shop here"
                                body="A claim is a heads-up, not a lock. See them in All shops, or find more with Find a local business."
                                action={<Button onClick={() => setTab("all")}>See all shops</Button>}
                            />
                        )
                    }
                />
            );
    }

    const bestSummary = best
        ? [
              best.p.businessCategory ? categoryKey(best.p.businessCategory) : null,
              best.p.businessCity,
              best.km != null ? `${formatKm(best.km)} from you` : null,
              best.p.businessRating != null ? `rated ${best.p.businessRating.toFixed(1)}` : null,
              "nobody has claimed it yet",
          ]
              .filter(Boolean)
              .join(" · ")
        : "";

    return (
        <>
            <PageHeader
                title={TITLE}
                sub={SUB}
                actions={
                    <>
                        {/* The two maps (board: LeadsMap): the businesses still to visit,
                            and the team's sites that are already live. */}
                        <MoreMenu
                            label="See on map"
                            align="start"
                            items={[
                                { label: "Businesses to visit", icon: <Icon icon={Store} />, href: "/leads/discover" },
                                { label: "Live Tendso sites", icon: <Icon icon={Globe} />, href: "/leads/live" },
                            ]}
                            trigger={(props) => (
                                <Button {...props}>
                                    <Icon icon={MapPin} />
                                    See on map
                                    <Icon icon={ChevronDown} />
                                </Button>
                            )}
                        />
                        <Button onClick={openFind}>
                            <Icon icon={Search} />
                            Find a local business
                        </Button>
                    </>
                }
            />

            {best && (
                <section aria-labelledby={visitId}>
                    <Highlight className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6">
                        <div className="flex min-w-0 flex-col gap-1">
                            <span id={visitId} className="t-label t-hl-label">
                                Visit next
                            </span>
                            <h2 className="t-h2">{best.p.businessName ?? "(unnamed business)"}</h2>
                            <p className="t-meta">{bestSummary}</p>
                        </div>
                        <Button className="flex-none" onClick={() => openLead(best.p._id)}>
                            Open
                            <Icon icon={ArrowRight} />
                        </Button>
                    </Highlight>
                </section>
            )}

            <Tabs label="Which leads" tabs={tabs} value={tab} onChange={setTab}>
                <div className="flex flex-col gap-4">
                    <LeadsFilters
                        tab={tab}
                        search={searchInput}
                        onSearch={setSearchInput}
                        filters={filters}
                        onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
                        categories={categories}
                        sort={sort}
                        location={location}
                        onAskLocation={askLocation}
                        summary={summaryParts.join(" · ") || "None"}
                        hasFilters={hasFilters}
                        onClear={clearFilters}
                    />
                    <p className="t-meta">{rankLine}</p>
                    {list}
                </div>
            </Tabs>

            <LeadsErrorBoundary
                resetKey={leadParam}
                fallback={(reference) => (
                    <Drawer open title="Lead" onClose={closeLead} closeLabel="Close lead details">
                        <ErrorState what="This lead" reference={reference} />
                    </Drawer>
                )}
            >
                <LeadDrawer leadId={leadParam} onClose={closeLead} me={me} isAdmin={isAdmin} hint={hint} pos={pos} />
            </LeadsErrorBoundary>

            <FindLocalBusinessModal open={findOpen} onClose={closeFind} />
        </>
    );
}
