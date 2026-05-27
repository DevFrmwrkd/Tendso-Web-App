"use client";

/**
 * /leads — Creator-side Lead CRM feed.
 *
 * Mirrors the mobile app's leads index (`ndm/app/(app)/leads/index.tsx`).
 * Reads the team-wide social feed via `api.leads.listForMobileCRM` and
 * renders it as scrollable cards with submitter attribution + status pill.
 *
 * URL state (per spec):
 *   ?tab=prospects   — Outscraper-discovered businesses not yet interviewed
 *   (default)        — All interviewed leads ("See Live Business" map is
 *                      its own route at /leads/near?live=true)
 *
 * Spec: docs/changes/WEB-BUILD-CRM.md (Creators platform integration).
 */
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { BottomNav } from "@/components/BottomNav";
import {
    ArrowLeft, Search, Map as MapIcon, Compass, Building2, Loader2, ChevronRight, Star,
    MapPin, Hand, X as XIcon, UserCheck, ArrowRight,
} from "lucide-react";
import FindLocalBusinessModal from "@/components/leads/FindLocalBusinessModal";

// ── Types + constants ─────────────────────────────────────────────────────
type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "lost";
const STATUS_OPTIONS: LeadStatus[] = ["new", "contacted", "qualified", "converted", "lost"];
type StatusFilter = "all" | LeadStatus;

const STATUS_PILL_STYLES: Record<string, { bg: string; ink: string }> = {
    new:       { bg: "var(--ed-status-new-bg, #E4E9F0)",       ink: "var(--ed-status-new-ink, #1F3654)" },
    contacted: { bg: "var(--ed-status-contacted-bg, #FBE9C4)", ink: "var(--ed-status-contacted-ink, #C68A12)" },
    qualified: { bg: "var(--ed-status-qualified-bg, #EDE9FE)", ink: "var(--ed-status-qualified-ink, #6D28D9)" },
    converted: { bg: "var(--ed-status-converted-bg, #D1FAE5)", ink: "var(--ed-status-converted-ink, #064E3B)" },
    lost:      { bg: "var(--ed-status-lost-bg, #F3D7CF)",      ink: "var(--ed-status-lost-ink, #B43A1F)" },
};

function timeAgo(ts: number | null | undefined): string {
    if (!ts) return "—";
    const diff = Date.now() - ts;
    const min = Math.floor(diff / 60_000);
    if (min < 1) return "just now";
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.floor(hr / 24)}d ago`;
}

function formatDateShort(ts: number | null | undefined): string {
    if (!ts) return "—";
    const d = new Date(ts);
    return d.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
}

// ── Page entry — wraps inner content in Suspense for useSearchParams ──────
export default function CreatorLeadsPage() {
    return (
        <Suspense
            fallback={
                <div
                    className="min-h-screen flex items-center justify-center"
                    style={{ background: "var(--ed-paper)" }}
                >
                    <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--ed-accent)" }} />
                </div>
            }
        >
            <CreatorLeadsInner />
        </Suspense>
    );
}

function CreatorLeadsInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const tab: "all" | "prospects" = searchParams.get("tab") === "prospects" ? "prospects" : "all";
    const { user, isLoaded, isSignedIn } = useUser();
    const [findModalOpen, setFindModalOpen] = useState(false);

    const creator = useQuery(
        api.creators.getByClerkId,
        user ? { clerkId: user.id } : "skip",
    );

    // Same redirect guards as /dashboard so users land in the right place.
    useEffect(() => {
        if (isLoaded && !isSignedIn) router.push("/login");
    }, [isLoaded, isSignedIn, router]);
    useEffect(() => {
        if (isLoaded && isSignedIn && creator === null) router.push("/onboarding");
    }, [isLoaded, isSignedIn, creator, router]);
    useEffect(() => {
        if (isLoaded && isSignedIn && creator && creator.role === "admin") router.push("/admin");
    }, [isLoaded, isSignedIn, creator, router]);
    useEffect(() => {
        if (isLoaded && isSignedIn && creator && creator.role !== "admin" && !creator.certifiedAt) {
            router.replace("/training");
        }
    }, [isLoaded, isSignedIn, creator, router]);

    // UI state
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [onlyMine, setOnlyMine] = useState(false);
    const [searchInput, setSearchInput] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    // 300ms debounce — matches the spec.
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    const feed = useQuery(
        api.leads.listForMobileCRM,
        isSignedIn && creator
            ? {
                  search: debouncedSearch || undefined,
                  statusFilter,
                  onlyMine,
              }
            : "skip",
    );

    // Prospects feed — separate query so we have claim metadata (claimedBy etc.)
    // alongside the Outscraper business fields. Only subscribe when the
    // Prospects tab is active.
    const prospectsFeed = useQuery(
        api.outscraper.listScrapedLeads,
        isSignedIn && creator && tab === "prospects" ? {} : "skip",
    ) as any[] | undefined;

    // Claim filter for the Prospects tab — defaults to "unclaimed" per spec
    // so creators see what's available first.
    const [claimFilter, setClaimFilter] = useState<"all" | "unclaimed" | "mine">("unclaimed");

    const ready =
        isLoaded &&
        isSignedIn &&
        creator !== undefined &&
        !!creator &&
        creator.role !== "admin" &&
        !!creator.certifiedAt;

    if (!ready) {
        return (
            <div
                className="min-h-screen flex items-center justify-center"
                style={{ background: "var(--ed-paper)" }}
            >
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--ed-accent)" }} />
            </div>
        );
    }

    const stats = feed?.stats;
    const allLeads = feed?.leads ?? [];

    // Interviewed feed — exclude Outscraper-source leads so the two tabs
    // don't double-count.
    const interviewedLeads = useMemo(
        () => allLeads.filter((l: any) => l.source !== "outscraper"),
        [allLeads],
    );

    // Apply claim filter + search to the Prospects feed.
    const filteredProspects = useMemo(() => {
        if (!prospectsFeed) return undefined;
        const q = debouncedSearch.toLowerCase();
        return prospectsFeed.filter((p: any) => {
            if (claimFilter === "unclaimed" && p.claimedBy) return false;
            if (claimFilter === "mine" && !(p.claimedBy && p.claimedBy.isMine)) return false;
            if (
                q &&
                !(p.businessName ?? "").toLowerCase().includes(q) &&
                !(p.businessAddress ?? "").toLowerCase().includes(q) &&
                !(p.businessCity ?? "").toLowerCase().includes(q) &&
                !(p.phone ?? "").toLowerCase().includes(q)
            ) {
                return false;
            }
            return true;
        });
    }, [prospectsFeed, claimFilter, debouncedSearch]);

    const hotCount = useMemo(() => interviewedLeads.filter((l: any) => l.isHot).length, [interviewedLeads]);
    const prospectCount = prospectsFeed?.length ?? 0;
    const interviewedCount = interviewedLeads.length;

    return (
        <div
            className="editorial min-h-screen pb-28 overflow-x-hidden"
            style={{ background: "var(--ed-paper)", color: "var(--ed-ink)", fontFamily: "var(--ed-sans)" }}
        >
            <div className="max-w-2xl mx-auto px-4 pt-6 sm:pt-8 sm:px-6">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <Link
                        href="/dashboard"
                        className="w-9 h-9 rounded-full inline-flex items-center justify-center transition-colors"
                        style={{ background: "var(--ed-paper-3)", border: "1px solid var(--ed-rule)" }}
                    >
                        <ArrowLeft className="w-4 h-4" style={{ color: "var(--ed-ink-2)" }} />
                    </Link>
                    <div className="flex items-center gap-2 text-[11px]" style={{
                        fontFamily: "var(--ed-mono)",
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "var(--ed-ink-3)",
                    }}>
                        <span>03 / Team Leads</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1.5" style={{ color: "var(--ed-accent)" }}>
                            <span className="ed-live-dot" /> Live
                        </span>
                    </div>
                </div>

                {/* Editorial display — copy swaps per active tab */}
                {tab === "prospects" ? (
                    <>
                        <h1
                            className="text-[40px] sm:text-[52px] leading-[1.05] tracking-[-0.02em] mb-3"
                            style={{ fontFamily: "var(--ed-serif)", color: "var(--ed-ink)" }}
                        >
                            Find your{" "}
                            <em style={{ fontStyle: "italic", color: "var(--ed-accent)" }}>
                                next interview.
                            </em>
                        </h1>
                        <p className="text-[15px] mb-6" style={{ color: "var(--ed-ink-2)", lineHeight: 1.5 }}>
                            {prospectCount} prospect{prospectCount === 1 ? "" : "s"} pulled in from
                            Outscraper — businesses nobody on the team has interviewed yet.
                        </p>
                    </>
                ) : (
                    <>
                        <h1
                            className="text-[40px] sm:text-[52px] leading-[1.05] tracking-[-0.02em] mb-3"
                            style={{ fontFamily: "var(--ed-serif)", color: "var(--ed-ink)" }}
                        >
                            All leads,{" "}
                            <em style={{ fontStyle: "italic", color: "var(--ed-accent)" }}>every interview.</em>
                        </h1>
                        <p className="text-[15px] mb-6" style={{ color: "var(--ed-ink-2)", lineHeight: 1.5 }}>
                            The whole team&apos;s hunt — including yours. {interviewedCount} lead{interviewedCount === 1 ? "" : "s"} · {hotCount} hot.
                        </p>
                    </>
                )}

                {/* Stats cards (TOTAL · YOURS · HOT LEADS) */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5">
                    <StatCard
                        label="Total"
                        value={stats?.total ?? 0}
                        dotColor="var(--ed-ink)"
                    />
                    <StatCard
                        label="Yours"
                        value={stats?.mine ?? 0}
                        dotColor="var(--ed-ink)"
                    />
                    <StatCard
                        label="Hot Leads"
                        sublabel="3+ interviews"
                        value={hotCount}
                        dotColor="var(--ed-danger)"
                    />
                </div>

                {/* Search */}
                <div className="relative mb-4">
                    <Search
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4"
                        style={{ color: "var(--ed-ink-3)" }}
                    />
                    <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Search lead, business, or creator…"
                        className="w-full pl-11 pr-4 py-3.5 text-[15px] focus:outline-none transition-colors"
                        style={{
                            background: "var(--ed-paper-3)",
                            border: "1px solid var(--ed-rule)",
                            borderRadius: 16,
                            fontFamily: "var(--ed-sans)",
                            color: "var(--ed-ink)",
                        }}
                    />
                </div>

                {/* Two action doors — See Live Business + Find Local Business.
                    Per spec: "Don't merge these into one button. Don't swap their
                    semantics. The labels are exact." */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-5">
                    <Link
                        href="/leads/near?live=true"
                        className="rounded-2xl px-5 py-4 flex items-center justify-between transition-opacity hover:opacity-95"
                        style={{ background: "var(--ed-accent-solid, #10B981)", color: "#fff" }}
                    >
                        <div>
                            <div
                                className="text-[10px] mb-1"
                                style={{
                                    fontFamily: "var(--ed-mono)",
                                    letterSpacing: "0.14em",
                                    textTransform: "uppercase",
                                    opacity: 0.75,
                                }}
                            >
                                On the map
                            </div>
                            <div className="text-[16px] font-semibold">See Live Business</div>
                        </div>
                        <MapIcon className="w-5 h-5" />
                    </Link>
                    <button
                        type="button"
                        onClick={() => setFindModalOpen(true)}
                        className="text-left rounded-2xl px-5 py-4 flex items-center justify-between transition-colors hover:bg-white"
                        style={{
                            background: "var(--ed-paper-3)",
                            color: "var(--ed-ink)",
                            border: "1px solid var(--ed-rule)",
                        }}
                    >
                        <div>
                            <div
                                className="text-[10px] mb-1"
                                style={{
                                    fontFamily: "var(--ed-mono)",
                                    letterSpacing: "0.14em",
                                    textTransform: "uppercase",
                                    color: "var(--ed-ink-3)",
                                }}
                            >
                                Discover
                            </div>
                            <div className="text-[16px] font-semibold">Find Local Business</div>
                        </div>
                        <Compass className="w-5 h-5" style={{ color: "var(--ed-ink-2)" }} />
                    </button>
                </div>

                {/* All / Prospects tab switcher */}
                <div className="grid grid-cols-2 mb-5" style={{ borderBottom: "1px solid var(--ed-rule)" }}>
                    <TabButton
                        label="All Leads"
                        count={interviewedCount}
                        active={tab === "all"}
                        onClick={() => router.replace("/leads", { scroll: false })}
                    />
                    <TabButton
                        label="Prospects"
                        count={prospectCount}
                        active={tab === "prospects"}
                        onClick={() => router.replace("/leads?tab=prospects", { scroll: false })}
                    />
                </div>

                {/* Filter pills row — branches by tab */}
                <div className="-mx-4 sm:mx-0 mb-5">
                    <div className="flex items-center gap-2 overflow-x-auto px-4 sm:px-0 pb-1 no-scrollbar">
                        {tab === "all" ? (
                            <>
                                <FilterPill
                                    label="Only mine"
                                    active={onlyMine}
                                    onClick={() => setOnlyMine((v) => !v)}
                                />
                                {(["all", ...STATUS_OPTIONS] as const).map((s) => {
                                    const active = !onlyMine && statusFilter === s;
                                    return (
                                        <FilterPill
                                            key={s}
                                            label={s}
                                            active={active}
                                            onClick={() => setStatusFilter(s)}
                                        />
                                    );
                                })}
                            </>
                        ) : (
                            <>
                                <FilterPill
                                    label="Unclaimed"
                                    active={claimFilter === "unclaimed"}
                                    onClick={() => setClaimFilter("unclaimed")}
                                />
                                <FilterPill
                                    label="Mine"
                                    active={claimFilter === "mine"}
                                    onClick={() => setClaimFilter("mine")}
                                />
                                <FilterPill
                                    label="All"
                                    active={claimFilter === "all"}
                                    onClick={() => setClaimFilter("all")}
                                />
                            </>
                        )}
                    </div>
                </div>

                {/* Feed — branches by tab */}
                {tab === "all" ? (
                    feed === undefined ? (
                        <FeedSkeleton />
                    ) : interviewedLeads.length === 0 ? (
                        <EmptyState
                            title={debouncedSearch || statusFilter !== "all" || onlyMine ? "No matches." : "Nothing yet."}
                            body={
                                debouncedSearch || statusFilter !== "all" || onlyMine
                                    ? "Try a different filter or clear the search."
                                    : "The team's leads will appear here as soon as someone submits a business."
                            }
                            cta={
                                debouncedSearch || statusFilter !== "all" || onlyMine
                                    ? null
                                    : { label: "Submit a business", href: "/submit/info" }
                            }
                        />
                    ) : (
                        <div className="space-y-3">
                            {interviewedLeads.map((lead: any) => (
                                <LeadCard key={String(lead._id)} lead={lead} />
                            ))}
                        </div>
                    )
                ) : (
                    filteredProspects === undefined ? (
                        <FeedSkeleton />
                    ) : filteredProspects.length === 0 ? (
                        <EmptyState
                            title={debouncedSearch || claimFilter !== "unclaimed" ? "No matches." : "Nothing to interview yet."}
                            body={
                                debouncedSearch || claimFilter !== "unclaimed"
                                    ? "Try a different filter or clear the search."
                                    : "Tap Find Local Business above — it'll scan your current location and add prospects here within seconds."
                            }
                            cta={null}
                        />
                    ) : (
                        <div className="space-y-3">
                            {filteredProspects.map((p: any) => (
                                <ProspectCard key={String(p._id)} prospect={p} />
                            ))}
                        </div>
                    )
                )}
            </div>

            <BottomNav active="home" />

            <FindLocalBusinessModal open={findModalOpen} onClose={() => setFindModalOpen(false)} />
        </div>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────
function StatCard({
    label, sublabel, value, dotColor,
}: {
    label: string;
    sublabel?: string;
    value: number;
    dotColor: string;
}) {
    return (
        <div
            className="rounded-2xl px-3 py-3"
            style={{
                background: "var(--ed-paper-3)",
                border: "1px solid var(--ed-rule)",
            }}
        >
            <div className="flex items-center gap-1.5 mb-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: dotColor }} />
                <span
                    className="text-[10px]"
                    style={{
                        fontFamily: "var(--ed-mono)",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "var(--ed-ink-3)",
                    }}
                >
                    {label}
                </span>
            </div>
            <div
                style={{
                    fontFamily: "var(--ed-serif)",
                    fontSize: 28,
                    lineHeight: 1.05,
                    color: "var(--ed-ink)",
                    fontVariantNumeric: "tabular-nums",
                }}
            >
                {value}
            </div>
            {sublabel && (
                <div
                    className="text-[10px] mt-0.5"
                    style={{
                        fontFamily: "var(--ed-mono)",
                        color: "var(--ed-ink-3)",
                        letterSpacing: "0.08em",
                    }}
                >
                    {sublabel}
                </div>
            )}
        </div>
    );
}

function TabButton({
    label, count, active, onClick,
}: { label: string; count: number; active: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex items-center justify-center gap-2 py-3 transition-colors text-[11px]"
            style={{
                fontFamily: "var(--ed-mono)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: active ? "var(--ed-ink)" : "var(--ed-ink-3)",
                borderBottom: active ? "2px solid var(--ed-ink)" : "2px solid transparent",
                marginBottom: -1,
                fontWeight: active ? 600 : 500,
            }}
        >
            {label}
            <span
                className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-[10px]"
                style={{
                    background: active ? "var(--ed-ink)" : "var(--ed-paper-2)",
                    color: active ? "var(--ed-paper-3)" : "var(--ed-ink-2)",
                    fontFamily: "var(--ed-mono)",
                }}
            >
                {count}
            </span>
        </button>
    );
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] flex-shrink-0 transition-colors"
            style={{
                background: active ? "var(--ed-ink)" : "transparent",
                color: active ? "var(--ed-paper-3)" : "var(--ed-ink-2)",
                border: `1px solid ${active ? "var(--ed-ink)" : "var(--ed-rule)"}`,
                fontFamily: "var(--ed-mono)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontWeight: 600,
            }}
        >
            {label}
        </button>
    );
}

function LeadCard({ lead }: { lead: any }) {
    return (
        <Link
            href={`/leads/${lead._id}`}
            className="block rounded-2xl p-4 transition-colors hover:bg-white"
            style={{
                background: "var(--ed-paper-3)",
                border: "1px solid var(--ed-rule)",
                textDecoration: "none",
                color: "inherit",
            }}
        >
            {/* Submitter strip */}
            {lead.submittedBy && (
                <div className="flex items-center gap-2.5 mb-3">
                    {lead.submittedBy.profileImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={lead.submittedBy.profileImage}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                        />
                    ) : (
                        <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] flex-shrink-0"
                            style={{
                                background: "var(--ed-paper-2)",
                                color: "var(--ed-ink)",
                                fontFamily: "var(--ed-serif)",
                                fontWeight: 500,
                            }}
                        >
                            {(lead.submittedBy.displayName ?? "?").slice(0, 1).toUpperCase()}
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-semibold truncate" style={{ color: "var(--ed-ink)" }}>
                            {lead.submittedBy.displayName}
                        </div>
                        <div
                            className="text-[11px]"
                            style={{
                                fontFamily: "var(--ed-mono)",
                                color: "var(--ed-ink-3)",
                                letterSpacing: "0.04em",
                            }}
                        >
                            submitted this · {formatDateShort(lead._creationTime)}
                        </div>
                    </div>
                    {lead.isHot && (
                        <span
                            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{
                                background: "var(--ed-status-lost-bg, #F3D7CF)",
                                color: "var(--ed-danger)",
                            }}
                        >
                            <Star className="w-2.5 h-2.5 fill-current" /> Hot
                        </span>
                    )}
                </div>
            )}

            {/* Lead inquired-by row */}
            {(lead.name || lead.phone || lead.email) && (
                <div className="flex items-start gap-2.5 mb-3">
                    <div
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                            background: "var(--ed-paper-2)",
                            color: "var(--ed-ink)",
                            fontFamily: "var(--ed-serif)",
                            fontWeight: 500,
                            fontSize: 13,
                        }}
                    >
                        {(lead.name ?? "?").slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                        {lead.name && (
                            <div className="text-[14px]" style={{ color: "var(--ed-ink)" }}>
                                <span className="font-semibold">{lead.name}</span>
                                <span style={{ color: "var(--ed-ink-3)" }}> · inquired</span>
                            </div>
                        )}
                        <div
                            className="text-[11px] flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5"
                            style={{
                                fontFamily: "var(--ed-mono)",
                                color: "var(--ed-ink-3)",
                            }}
                        >
                            {lead.phone && <span>{lead.phone}</span>}
                            {lead.phone && lead.email && <span>·</span>}
                            {lead.email && <span className="truncate max-w-[200px]">{lead.email}</span>}
                        </div>
                    </div>
                </div>
            )}

            {/* Divider */}
            <hr className="border-t" style={{ borderColor: "var(--ed-rule)" }} />

            {/* Business + status */}
            <div className="flex items-center justify-between gap-3 mt-3">
                <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="w-4 h-4 flex-shrink-0" style={{ color: "var(--ed-ink-3)" }} />
                    <div className="text-[14px] truncate" style={{ color: "var(--ed-ink)" }}>
                        {lead.businessName}
                        {lead.businessCity && (
                            <span style={{ color: "var(--ed-ink-3)" }}> · {lead.businessCity}</span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusPill status={lead.status} />
                    <ChevronRight className="w-4 h-4" style={{ color: "var(--ed-ink-3)" }} />
                </div>
            </div>

            {/* Interviewer count + admin-curated indicator */}
            {(lead.interviewerCount > 1 || lead.hasEnrichedContent) && (
                <div
                    className="mt-2 flex items-center gap-2 text-[11px]"
                    style={{
                        fontFamily: "var(--ed-mono)",
                        color: "var(--ed-ink-3)",
                        letterSpacing: "0.04em",
                    }}
                >
                    {lead.interviewerCount > 1 && (
                        <span>{lead.interviewerCount} interviewers</span>
                    )}
                    {lead.hasEnrichedContent && lead.interviewerCount > 1 && <span>·</span>}
                    {lead.hasEnrichedContent && <span style={{ color: "var(--ed-accent)" }}>Curated</span>}
                </div>
            )}
        </Link>
    );
}

function FeedSkeleton() {
    return (
        <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
                <div
                    key={i}
                    className="animate-pulse rounded-2xl"
                    style={{ background: "var(--ed-paper-2)", height: 160 }}
                />
            ))}
        </div>
    );
}

function ProspectCard({ prospect: p }: { prospect: any }) {
    const claim = useMutation(api.outscraper.claimProspect);
    const release = useMutation(api.outscraper.releaseProspect);
    const [busy, setBusy] = useState(false);

    const claimedByOther = p.claimedBy && !p.claimedBy.isMine;
    const claimedByMe = p.claimedBy && p.claimedBy.isMine;

    const directionsHref =
        p.businessLatitude != null && p.businessLongitude != null
            ? `https://www.google.com/maps/search/?api=1&query=${p.businessLatitude},${p.businessLongitude}`
            : p.businessAddress
                ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.businessAddress)}`
                : null;

    const startInterviewHref =
        `/submit/info?prospectLeadId=${encodeURIComponent(String(p._id))}` +
        (p.businessName ? `&businessName=${encodeURIComponent(p.businessName)}` : "") +
        (p.phone ? `&phone=${encodeURIComponent(p.phone)}` : "") +
        (p.businessAddress ? `&address=${encodeURIComponent(p.businessAddress)}` : "") +
        (p.businessCity ? `&city=${encodeURIComponent(p.businessCity)}` : "") +
        (p.businessCategory ? `&category=${encodeURIComponent(p.businessCategory)}` : "");

    const onClaim = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (busy) return;
        setBusy(true);
        try {
            await claim({ leadId: p._id });
        } catch (err: any) {
            toast.error(err?.message ?? "Couldn't claim — try again.");
        } finally {
            setBusy(false);
        }
    };

    const onRelease = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (busy) return;
        setBusy(true);
        try {
            await release({ leadId: p._id });
        } catch (err: any) {
            toast.error(err?.message ?? "Couldn't release — try again.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <Link
            href={`/leads/${p._id}`}
            className="block rounded-2xl p-4 transition-colors hover:bg-white"
            style={{
                background: "var(--ed-paper-3)",
                border: "1px solid var(--ed-rule)",
                textDecoration: "none",
                color: "inherit",
            }}
        >
            {/* Top row — icon left, rating right */}
            <div className="flex items-start justify-between gap-3 mb-2">
                <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "var(--ed-paper-2)" }}
                >
                    <MapPin className="w-4 h-4" style={{ color: "var(--ed-ink-2)" }} />
                </div>
                {p.businessRating != null && (
                    <div className="flex items-center gap-1 text-[12px]" style={{ color: "var(--ed-ink)" }}>
                        <Star className="w-3 h-3 fill-current" style={{ color: "var(--ed-warn)" }} />
                        <span>{p.businessRating.toFixed(1)}</span>
                        {p.businessReviewCount ? (
                            <span style={{ color: "var(--ed-ink-3)" }}> · {p.businessReviewCount}</span>
                        ) : null}
                    </div>
                )}
            </div>

            {/* Headline */}
            <h3
                style={{
                    fontFamily: "var(--ed-serif)",
                    fontSize: 22,
                    lineHeight: 1.15,
                    color: "var(--ed-ink)",
                    margin: 0,
                    fontWeight: 500,
                }}
            >
                {p.businessName ?? "(unnamed business)"}
            </h3>
            <div className="text-[12px] mb-3" style={{ color: "var(--ed-ink-2)" }}>
                {[p.businessCategory, p.businessCity].filter(Boolean).join(" · ") || "—"}
            </div>

            {/* Address + phone */}
            {(p.businessAddress || p.phone) && (
                <div className="text-[13px] space-y-0.5 mb-3" style={{ color: "var(--ed-ink-2)" }}>
                    {p.businessAddress && <div>{p.businessAddress}</div>}
                    {p.phone && (
                        <div className="text-[12px]" style={{ color: "var(--ed-ink-3)" }}>
                            {p.phone}{p.businessWebsite ? ` · ${p.businessWebsite}` : ""}
                        </div>
                    )}
                </div>
            )}

            <div
                className="flex items-center justify-between gap-2 pt-3 mt-1"
                style={{ borderTop: "1px solid var(--ed-rule)" }}
            >
                {/* Left side: claim state */}
                <div className="text-[11px] min-w-0" style={{ color: "var(--ed-ink-3)", fontFamily: "var(--ed-mono)", letterSpacing: "0.04em" }}>
                    {claimedByMe ? (
                        <span className="inline-flex items-center gap-1" style={{ color: "var(--ed-accent)" }}>
                            <UserCheck className="w-3 h-3" />
                            YOU claimed this · {timeAgoShort(p.claimedAt)}
                        </span>
                    ) : claimedByOther ? (
                        <span className="inline-flex items-center gap-1">
                            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "var(--ed-warn)" }} />
                            Claimed by {p.claimedBy.displayName} · {timeAgoShort(p.claimedAt)}
                        </span>
                    ) : (
                        <span>Scraped {timeAgoShort(p.scrapedAt ?? p.createdAt)}</span>
                    )}
                </div>

                {/* Right side: actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    {claimedByMe && (
                        <>
                            <button
                                type="button"
                                onClick={onRelease}
                                disabled={busy}
                                title="Release claim"
                                className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md disabled:opacity-50"
                                style={{
                                    background: "transparent",
                                    color: "var(--ed-ink-3)",
                                    border: "1px solid var(--ed-rule)",
                                }}
                            >
                                <XIcon className="w-3 h-3" /> Release
                            </button>
                            <Link
                                href={startInterviewHref}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md"
                                style={{ background: "var(--ed-accent-solid, #10B981)", color: "#fff" }}
                            >
                                Start interview <ArrowRight className="w-3 h-3" />
                            </Link>
                        </>
                    )}
                    {!p.claimedBy && (
                        <>
                            {directionsHref && (
                                <a
                                    href={directionsHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md"
                                    style={{
                                        background: "var(--ed-paper-2)",
                                        color: "var(--ed-ink)",
                                        border: "1px solid var(--ed-rule)",
                                    }}
                                >
                                    <MapPin className="w-3 h-3" /> Directions
                                </a>
                            )}
                            <button
                                type="button"
                                onClick={onClaim}
                                disabled={busy}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md disabled:opacity-50"
                                style={{ background: "var(--ed-ink)", color: "var(--ed-paper-3)" }}
                            >
                                <Hand className="w-3 h-3" /> I&apos;ll interview this
                            </button>
                        </>
                    )}
                    {claimedByOther && directionsHref && (
                        <a
                            href={directionsHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md"
                            style={{
                                background: "var(--ed-paper-2)",
                                color: "var(--ed-ink)",
                                border: "1px solid var(--ed-rule)",
                            }}
                        >
                            <MapPin className="w-3 h-3" /> Directions
                        </a>
                    )}
                </div>
            </div>
        </Link>
    );
}

function timeAgoShort(ts: number | null | undefined): string {
    if (!ts) return "—";
    const diff = Date.now() - ts;
    const min = Math.floor(diff / 60_000);
    if (min < 1) return "just now";
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.floor(hr / 24)}d ago`;
}

function StatusPill({ status }: { status: string }) {
    const colors = STATUS_PILL_STYLES[status] ?? { bg: "var(--ed-paper-2)", ink: "var(--ed-ink-2)" };
    return (
        <span
            className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ background: colors.bg, color: colors.ink }}
        >
            {status}
        </span>
    );
}

function EmptyState({
    title, body, cta,
}: {
    title: string;
    body: string;
    cta: { label: string; href: string } | null;
}) {
    return (
        <div
            className="rounded-2xl py-10 px-6 text-center"
            style={{ background: "var(--ed-paper-3)", border: "1px solid var(--ed-rule)" }}
        >
            <Building2 className="w-9 h-9 mx-auto mb-3" style={{ color: "var(--ed-accent)" }} />
            <h3
                style={{ fontFamily: "var(--ed-serif)", fontSize: 24, color: "var(--ed-ink)", lineHeight: 1.1 }}
            >
                {title}
            </h3>
            <p className="text-[14px] mt-2" style={{ color: "var(--ed-ink-2)", lineHeight: 1.5 }}>
                {body}
            </p>
            {cta && (
                <Link
                    href={cta.href}
                    className="inline-flex items-center gap-1.5 mt-4 text-[12px] px-4 py-2.5 rounded-full"
                    style={{
                        background: "var(--ed-ink)",
                        color: "var(--ed-paper-3)",
                        fontFamily: "var(--ed-mono)",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                    }}
                >
                    {cta.label}
                </Link>
            )}
        </div>
    );
}
