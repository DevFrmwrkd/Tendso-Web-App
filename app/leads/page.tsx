"use client";

/**
 * /leads — Creator-side Lead CRM feed.
 *
 * Mirrors the mobile app's leads index (`ndm/app/(app)/leads/index.tsx`).
 * Reads the team-wide social feed via `api.leads.listForMobileCRM` and
 * renders it as scrollable cards with submitter attribution + status pill.
 * Linked to the dashboard's "STEP 02 / TEAM LEADS" card.
 *
 * Spec: docs/changes/WEB-BUILD-CRM.md (Creators platform integration).
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { BottomNav } from "@/components/BottomNav";
import {
    ArrowLeft, Search, Map as MapIcon, Building2, Loader2, ChevronRight, Star,
} from "lucide-react";

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

// ── Page ──────────────────────────────────────────────────────────────────
export default function CreatorLeadsPage() {
    const router = useRouter();
    const { user, isLoaded, isSignedIn } = useUser();

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
    const leads = feed?.leads ?? [];
    const hotCount = useMemo(() => leads.filter((l: any) => l.isHot).length, [leads]);

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

                {/* Editorial display */}
                <h1
                    className="text-[40px] sm:text-[52px] leading-[1.05] tracking-[-0.02em] mb-3"
                    style={{ fontFamily: "var(--ed-serif)", color: "var(--ed-ink)" }}
                >
                    All leads,{" "}
                    <em style={{ fontStyle: "italic", color: "var(--ed-accent)" }}>every interview.</em>
                </h1>
                <p className="text-[15px] mb-6" style={{ color: "var(--ed-ink-2)", lineHeight: 1.5 }}>
                    The whole team&apos;s hunt — including yours. {stats?.total ?? 0} lead{(stats?.total ?? 0) === 1 ? "" : "s"} · {hotCount} hot.
                </p>

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

                {/* Primary CTA — Businesses near me (map view) */}
                <Link
                    href="/leads/near"
                    className="block mb-3 rounded-2xl px-5 py-4 flex items-center justify-between transition-opacity hover:opacity-95"
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
                        <div className="text-[18px] font-semibold">Businesses near me</div>
                    </div>
                    <MapIcon className="w-6 h-6" />
                </Link>

                {/* Filter pills row */}
                <div className="-mx-4 sm:mx-0 mb-5">
                    <div className="flex items-center gap-2 overflow-x-auto px-4 sm:px-0 pb-1 no-scrollbar">
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
                                    onClick={() => {
                                        setStatusFilter(s);
                                    }}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Feed */}
                {feed === undefined ? (
                    <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div
                                key={i}
                                className="animate-pulse rounded-2xl"
                                style={{ background: "var(--ed-paper-2)", height: 160 }}
                            />
                        ))}
                    </div>
                ) : leads.length === 0 ? (
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
                        {leads.map((lead: any) => (
                            <LeadCard key={String(lead._id)} lead={lead} />
                        ))}
                    </div>
                )}
            </div>

            <BottomNav active="home" />
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
