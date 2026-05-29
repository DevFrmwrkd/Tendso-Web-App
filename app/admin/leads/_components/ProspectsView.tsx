"use client";

/**
 * Prospects view — Outscraper-discovered Google Maps businesses.
 *
 * Lives inside /admin/leads as a tab alongside the customer-lead table.
 * Was previously a standalone /admin/lead-prospects route — folded in here
 * so admins have one consolidated leads surface.
 *
 * Reads api.outscraper.listScrapedLeads. The card grid + status filter +
 * search + per-card status select are unchanged from the original
 * standalone page; only the page chrome (header, container) is removed
 * since the parent admin/leads page provides those.
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
    Search, Loader2, MapPin, Phone, Star, ExternalLink, Globe, Building2,
} from "lucide-react";

type ScrapedLead = {
    _id: Id<"leads">;
    status: string;
    phone: string | null;
    businessName: string | null;
    businessAddress: string | null;
    businessCity: string | null;
    businessCategory: string | null;
    businessWebsite: string | null;
    businessLatitude: number | null;
    businessLongitude: number | null;
    businessRating: number | null;
    businessReviewCount: number | null;
    businessGooglePlaceId: string | null;
    scrapedAt: number | null;
    createdAt: number;
    claimedAt?: number | null;
    claimedBy?: {
        creatorId: string;
        displayName: string;
        profileImage: string | null;
        isMine: boolean;
    } | null;
};

const STATUS_OPTIONS = ["new", "contacted", "qualified", "converted", "lost"] as const;
type StatusFilter = "all" | typeof STATUS_OPTIONS[number];

const STATUS_COLORS: Record<string, string> = {
    new:       "bg-blue-50 text-blue-700 border-blue-200",
    contacted: "bg-amber-50 text-amber-700 border-amber-200",
    qualified: "bg-purple-50 text-purple-700 border-purple-200",
    converted: "bg-emerald-50 text-emerald-700 border-emerald-200",
    lost:      "bg-rose-50 text-rose-700 border-rose-200",
};

function timeAgo(ts: number | null): string {
    if (!ts) return "—";
    const diffMs = Date.now() - ts;
    const min = Math.floor(diffMs / 60_000);
    if (min < 1) return "just now";
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const days = Math.floor(hr / 24);
    return `${days}d ago`;
}

export default function ProspectsView() {
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [search, setSearch] = useState("");

    const prospects = useQuery(api.outscraper.listScrapedLeads, {
        statusFilter,
        search,
    }) as ScrapedLead[] | undefined;

    const updateStatus = useMutation(api.leads.updateStatus);

    const stats = useMemo(() => {
        const counts = { all: prospects?.length ?? 0, new: 0, contacted: 0, qualified: 0, converted: 0, lost: 0 };
        for (const p of prospects ?? []) {
            const k = p.status as keyof typeof counts;
            if (counts[k] !== undefined) counts[k]++;
        }
        return counts;
    }, [prospects]);

    return (
        <div className="space-y-5">
            {/* Status filter chips */}
            <div className="flex flex-wrap gap-2">
                {(["all", ...STATUS_OPTIONS] as const).map((s) => {
                    const active = statusFilter === s;
                    const count = (stats as any)[s] ?? 0;
                    return (
                        <button
                            key={s}
                            type="button"
                            onClick={() => setStatusFilter(s)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors border ${
                                active
                                    ? "bg-[var(--ed-ink)] text-[var(--ed-paper-3)] border-[var(--ed-ink)]"
                                    : "bg-white border-[var(--ed-rule)] text-[var(--ed-ink-2)] hover:border-[var(--ed-ink-2)]"
                            }`}
                        >
                            {s}
                            {count > 0 && (
                                <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] ${
                                    active ? "bg-[var(--ed-paper-3)] text-[var(--ed-ink)]" : "bg-[var(--ed-paper-2)] text-[var(--ed-ink-2)]"
                                }`}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Search */}
            <div className="relative">
                <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                    style={{ color: "var(--ed-ink-3)" }}
                />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, city, category, phone…"
                    className="w-full pl-10 pr-4 py-3 text-sm focus:outline-none transition-colors"
                    style={{
                        background: "var(--ed-paper-3)",
                        border: "1px solid var(--ed-rule)",
                        borderRadius: "var(--ed-radius-sm)",
                        fontFamily: "var(--ed-sans)",
                        color: "var(--ed-ink)",
                    }}
                />
            </div>

            {/* Results */}
            {prospects === undefined ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--ed-ink-3)" }} />
                </div>
            ) : prospects.length === 0 ? (
                <div className="ed-card-xl text-center">
                    <Building2 className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--ed-accent)" }} />
                    <h3 className="ed-display-sm" style={{ color: "var(--ed-ink)" }}>
                        {search || statusFilter !== "all" ? (
                            <>No <em style={{ color: "var(--ed-accent)" }}>matches</em>.</>
                        ) : (
                            <>The prospect list is <em style={{ color: "var(--ed-accent)" }}>empty</em>.</>
                        )}
                    </h3>
                    <p className="ed-body-sm mt-2" style={{ color: "var(--ed-ink-2)" }}>
                        {search || statusFilter !== "all"
                            ? "Try a different filter or search term."
                            : "Creators populate this by tapping Find Local Business on their /leads page or in the mobile app."}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {prospects.map((p) => (
                        <article
                            key={String(p._id)}
                            className="ed-card"
                            style={{ display: "flex", flexDirection: "column", gap: 10 }}
                        >
                            <div className="flex items-start justify-between gap-3">
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
                                    {p.businessName ?? "(unnamed)"}
                                </h3>
                                <span
                                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_COLORS[p.status] ?? ""}`}
                                >
                                    {p.status}
                                </span>
                            </div>

                            <div className="flex items-center flex-wrap gap-2 text-[12px]" style={{ color: "var(--ed-ink-2)" }}>
                                {p.businessCategory && <span>{p.businessCategory}</span>}
                                {p.businessCategory && p.businessCity && <span>·</span>}
                                {p.businessCity && <span>{p.businessCity}</span>}
                            </div>

                            {(p.businessRating !== null || p.businessReviewCount) && (
                                <div className="inline-flex items-center gap-1.5 text-sm" style={{ color: "var(--ed-ink)" }}>
                                    <Star className="w-3.5 h-3.5 fill-current" style={{ color: "var(--ed-warn)" }} />
                                    <span>{p.businessRating?.toFixed(1) ?? "—"}</span>
                                    {p.businessReviewCount ? (
                                        <span className="text-[12px]" style={{ color: "var(--ed-ink-3)" }}>
                                            · {p.businessReviewCount.toLocaleString()} reviews
                                        </span>
                                    ) : null}
                                </div>
                            )}

                            {p.businessAddress && (
                                <div className="flex items-start gap-2 text-[13px]" style={{ color: "var(--ed-ink-2)" }}>
                                    <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "var(--ed-ink-3)" }} />
                                    <span>{p.businessAddress}</span>
                                </div>
                            )}

                            <div className="flex flex-wrap gap-2 mt-1">
                                {p.phone && (
                                    <a
                                        href={`tel:${p.phone.replace(/[^0-9+]/g, "")}`}
                                        className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-md transition-colors"
                                        style={{
                                            background: "var(--ed-paper-2)",
                                            color: "var(--ed-ink)",
                                            border: "1px solid var(--ed-rule)",
                                        }}
                                    >
                                        <Phone className="w-3 h-3" /> {p.phone}
                                    </a>
                                )}
                                {p.businessWebsite && (
                                    <a
                                        href={p.businessWebsite}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-md transition-colors"
                                        style={{
                                            background: "var(--ed-paper-2)",
                                            color: "var(--ed-ink)",
                                            border: "1px solid var(--ed-rule)",
                                        }}
                                    >
                                        <Globe className="w-3 h-3" /> Website
                                    </a>
                                )}
                                {(p.businessLatitude !== null && p.businessLongitude !== null) && (
                                    <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${p.businessLatitude},${p.businessLongitude}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-md transition-colors"
                                        style={{
                                            background: "var(--ed-paper-2)",
                                            color: "var(--ed-ink)",
                                            border: "1px solid var(--ed-rule)",
                                        }}
                                    >
                                        <ExternalLink className="w-3 h-3" /> Maps
                                    </a>
                                )}
                            </div>

                            {/* Claim coordination signal — visible to admins so they can see
                                which creator is on it before reassigning or deleting. */}
                            {p.claimedBy && (
                                <div
                                    className="text-[11px] flex items-center gap-1.5"
                                    style={{
                                        fontFamily: "var(--ed-mono)",
                                        color: "var(--ed-ink-3)",
                                        letterSpacing: "0.04em",
                                    }}
                                >
                                    <span
                                        className="inline-block w-1.5 h-1.5 rounded-full"
                                        style={{ background: "var(--ed-accent-solid, #10B981)" }}
                                    />
                                    Claimed by {p.claimedBy.displayName} · {timeAgo(p.claimedAt ?? null)}
                                </div>
                            )}

                            <div
                                className="flex items-center justify-between gap-2 pt-2 mt-auto"
                                style={{ borderTop: "1px solid var(--ed-rule)" }}
                            >
                                <span className="ed-label" style={{ color: "var(--ed-ink-3)" }}>
                                    Scraped {timeAgo(p.scrapedAt ?? p.createdAt)}
                                </span>
                                <select
                                    value={p.status}
                                    onChange={(e) => {
                                        updateStatus({ id: p._id, status: e.target.value as any }).catch((err: any) => {
                                            console.error(err);
                                        });
                                    }}
                                    className="text-xs px-2 py-1 rounded-md border bg-white"
                                    style={{
                                        borderColor: "var(--ed-rule)",
                                        color: "var(--ed-ink)",
                                        fontFamily: "var(--ed-sans)",
                                    }}
                                >
                                    {STATUS_OPTIONS.map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
}
