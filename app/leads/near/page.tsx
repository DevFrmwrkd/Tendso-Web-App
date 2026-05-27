"use client";

/**
 * /leads/near — map view of mappable leads.
 *
 * Two modes via URL state:
 *   (default)      — every lead with resolvable lat/lng
 *   ?live=true     — "See Live Business" — filter to leads with a live
 *                    deployed website (lead.hasLiveWebsite). This is the
 *                    "what's already working — and earning" view from the
 *                    spec's two action doors.
 *
 * Reads `api.leads.listForMap` for every lead with resolvable lat/lng, then
 * computes haversine distance from the user's browser geolocation and renders
 * a "nearest first" list. The map is a single iframe centered on the user's
 * location (or Philippines fallback) using the same Google Maps embed pattern
 * the Astro site uses — no API key required.
 */
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ArrowLeft, Loader2, MapPin, Building2, ExternalLink, Globe } from "lucide-react";

const PH_CENTER = { lat: 14.5995, lng: 120.9842 }; // Manila — used when geolocation unavailable

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6371; // Earth radius in km
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const sin1 = Math.sin(dLat / 2);
    const sin2 = Math.sin(dLng / 2);
    const h = sin1 * sin1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sin2 * sin2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function formatDistance(km: number): string {
    if (km < 1) return `${Math.round(km * 1000)} m`;
    if (km < 10) return `${km.toFixed(1)} km`;
    return `${Math.round(km)} km`;
}

export default function BusinessesNearYouPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ed-paper)" }}>
                    <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--ed-accent)" }} />
                </div>
            }
        >
            <NearInner />
        </Suspense>
    );
}

function NearInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const liveOnly = searchParams.get("live") === "true";
    const { user, isLoaded, isSignedIn } = useUser();

    const creator = useQuery(
        api.creators.getByClerkId,
        user ? { clerkId: user.id } : "skip",
    );

    useEffect(() => {
        if (isLoaded && !isSignedIn) router.push("/login");
    }, [isLoaded, isSignedIn, router]);
    useEffect(() => {
        if (isLoaded && isSignedIn && creator === null) router.push("/onboarding");
    }, [isLoaded, isSignedIn, creator, router]);
    useEffect(() => {
        if (isLoaded && isSignedIn && creator && creator.role !== "admin" && !creator.certifiedAt) {
            router.replace("/training");
        }
    }, [isLoaded, isSignedIn, creator, router]);

    const ready =
        isLoaded && isSignedIn && creator !== undefined && !!creator && (creator.role === "admin" || !!creator.certifiedAt);

    const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
    const [locError, setLocError] = useState<string | null>(null);
    const [locRequesting, setLocRequesting] = useState(false);

    // Ask for browser geolocation once on mount. We don't block rendering — if
    // the user denies, we fall back to PH center and show all leads unsorted.
    useEffect(() => {
        if (!ready) return;
        if (typeof window === "undefined" || !navigator.geolocation) {
            setLocError("Geolocation not available in this browser.");
            return;
        }
        setLocRequesting(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setLocRequesting(false);
            },
            (err) => {
                setLocError(err?.message ?? "Couldn't get your location.");
                setLocRequesting(false);
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60_000 },
        );
    }, [ready]);

    const mappable = useQuery(api.leads.listForMap, ready ? {} : "skip");

    const sorted = useMemo(() => {
        if (!mappable) return undefined;
        const origin = userLoc ?? PH_CENTER;
        const filtered = liveOnly
            ? mappable.filter((m: any) => m.hasLiveWebsite)
            : mappable;
        return filtered
            .map((m: any) => ({
                ...m,
                distanceKm: haversineKm(origin, { lat: m.lat, lng: m.lng }),
            }))
            .sort((a: any, b: any) => a.distanceKm - b.distanceKm);
    }, [mappable, userLoc, liveOnly]);

    const visibleCount = sorted?.length ?? 0;
    const totalMappable = mappable?.length ?? 0;

    if (!ready) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ed-paper)" }}>
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--ed-accent)" }} />
            </div>
        );
    }

    const mapCenter = userLoc ?? PH_CENTER;
    const mapQuery = userLoc
        ? `${mapCenter.lat},${mapCenter.lng}`
        : "Philippines";
    const mapEmbedSrc = `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=${userLoc ? 13 : 6}&hl=en&output=embed`;

    return (
        <div
            className="min-h-screen pb-24"
            style={{ background: "var(--ed-paper)", color: "var(--ed-ink)", fontFamily: "var(--ed-sans)" }}
        >
            <div className="max-w-2xl mx-auto px-4 pt-6 sm:pt-8 sm:px-6">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <Link
                        href="/leads"
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
                        <span>03 / Near You</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1.5" style={{ color: "var(--ed-accent)" }}>
                            <span className="ed-live-dot" /> Live
                        </span>
                    </div>
                </div>

                <h1
                    className="text-[40px] sm:text-[52px] leading-[1.05] tracking-[-0.02em] mb-3"
                    style={{ fontFamily: "var(--ed-serif)", color: "var(--ed-ink)" }}
                >
                    {liveOnly ? (
                        <>
                            Live businesses,{" "}
                            <em style={{ fontStyle: "italic", color: "var(--ed-accent)" }}>near you.</em>
                        </>
                    ) : (
                        <>
                            Businesses{" "}
                            <em style={{ fontStyle: "italic", color: "var(--ed-accent)" }}>near you.</em>
                        </>
                    )}
                </h1>
                <p className="text-[14px] mb-5" style={{ color: "var(--ed-ink-2)" }}>
                    {mappable === undefined
                        ? "Loading mappable leads…"
                        : liveOnly
                            ? `${visibleCount} of ${totalMappable} mappable leads have a live website.`
                            : `${totalMappable} mappable lead${totalMappable === 1 ? "" : "s"}.`}
                </p>

                {/* Mode toggle — switch between "all mappable" and "live only" */}
                <div className="flex gap-2 mb-4">
                    <Link
                        href="/leads/near"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px]"
                        style={{
                            background: liveOnly ? "transparent" : "var(--ed-ink)",
                            color: liveOnly ? "var(--ed-ink-2)" : "var(--ed-paper-3)",
                            border: `1px solid ${liveOnly ? "var(--ed-rule)" : "var(--ed-ink)"}`,
                            fontFamily: "var(--ed-mono)",
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            fontWeight: 600,
                            textDecoration: "none",
                        }}
                    >
                        <MapPin className="w-3 h-3" /> All mappable
                    </Link>
                    <Link
                        href="/leads/near?live=true"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px]"
                        style={{
                            background: liveOnly ? "var(--ed-accent-solid, #10B981)" : "transparent",
                            color: liveOnly ? "#fff" : "var(--ed-ink-2)",
                            border: `1px solid ${liveOnly ? "var(--ed-accent-solid, #10B981)" : "var(--ed-rule)"}`,
                            fontFamily: "var(--ed-mono)",
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            fontWeight: 600,
                            textDecoration: "none",
                        }}
                    >
                        <Globe className="w-3 h-3" /> Live websites only
                    </Link>
                </div>

                {/* Permission / fallback banner */}
                {locError && (
                    <div
                        className="rounded-2xl px-4 py-3 mb-4 text-[13px]"
                        style={{
                            background: "var(--ed-status-contacted-bg, #FBE9C4)",
                            color: "var(--ed-status-contacted-ink, #C68A12)",
                            border: "1px solid var(--ed-rule)",
                        }}
                    >
                        Showing distances from Manila (default) — enable location access in your browser for accurate &quot;nearest&quot; sorting.
                    </div>
                )}
                {locRequesting && !userLoc && (
                    <div
                        className="rounded-2xl px-4 py-3 mb-4 text-[13px] flex items-center gap-2"
                        style={{
                            background: "var(--ed-paper-3)",
                            color: "var(--ed-ink-2)",
                            border: "1px solid var(--ed-rule)",
                        }}
                    >
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Requesting your location…
                    </div>
                )}

                {/* Map */}
                <div
                    className="rounded-2xl overflow-hidden mb-5"
                    style={{ border: "1px solid var(--ed-rule)" }}
                >
                    <iframe
                        title="Map"
                        src={mapEmbedSrc}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        style={{ width: "100%", height: 320, border: 0 }}
                    />
                </div>

                {/* Nearest-first label */}
                <div className="flex items-center justify-between mb-3">
                    <div
                        className="text-[10px]"
                        style={{
                            fontFamily: "var(--ed-mono)",
                            letterSpacing: "0.14em",
                            textTransform: "uppercase",
                            color: "var(--ed-ink-3)",
                        }}
                    >
                        Nearest first
                    </div>
                    <div
                        className="text-[10px]"
                        style={{
                            fontFamily: "var(--ed-mono)",
                            letterSpacing: "0.14em",
                            textTransform: "uppercase",
                            color: "var(--ed-ink-3)",
                        }}
                    >
                        {sorted ? `${sorted.length} pinned` : "—"}
                    </div>
                </div>

                {/* List */}
                {sorted === undefined ? (
                    <div className="space-y-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div
                                key={i}
                                className="animate-pulse rounded-2xl"
                                style={{ background: "var(--ed-paper-2)", height: 90 }}
                            />
                        ))}
                    </div>
                ) : sorted.length === 0 ? (
                    <div
                        className="rounded-2xl py-10 px-6 text-center"
                        style={{ background: "var(--ed-paper-3)", border: "1px solid var(--ed-rule)" }}
                    >
                        <MapPin className="w-9 h-9 mx-auto mb-3" style={{ color: "var(--ed-accent)" }} />
                        <h3 style={{ fontFamily: "var(--ed-serif)", fontSize: 24, color: "var(--ed-ink)" }}>
                            Nothing to pin yet.
                        </h3>
                        <p className="text-[14px] mt-2" style={{ color: "var(--ed-ink-2)" }}>
                            Leads with location data will appear here once the team submits them with coordinates.
                        </p>
                    </div>
                ) : (
                    <ul className="space-y-3">
                        {sorted.map((row: any) => (
                            <li key={String(row._id)}>
                                <Link
                                    href={`/leads/${row._id}`}
                                    className="block rounded-2xl p-3.5 transition-colors hover:bg-white"
                                    style={{
                                        background: "var(--ed-paper-3)",
                                        border: "1px solid var(--ed-rule)",
                                        textDecoration: "none",
                                        color: "inherit",
                                    }}
                                >
                                    <div className="flex items-start gap-3">
                                        <div
                                            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                            style={{ background: "var(--ed-paper-2)" }}
                                        >
                                            <Building2 className="w-5 h-5" style={{ color: "var(--ed-ink-2)" }} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[15px] font-semibold truncate" style={{ color: "var(--ed-ink)" }}>
                                                {row.businessName}
                                            </div>
                                            {(row.businessAddress || row.businessCity) && (
                                                <div className="text-[12px] mt-0.5" style={{ color: "var(--ed-ink-3)", lineHeight: 1.4 }}>
                                                    {row.businessAddress ?? row.businessCity}
                                                </div>
                                            )}
                                            {row.submittedBy && (
                                                <div
                                                    className="flex items-center gap-1.5 mt-2 text-[10px]"
                                                    style={{
                                                        fontFamily: "var(--ed-mono)",
                                                        color: "var(--ed-ink-3)",
                                                        letterSpacing: "0.08em",
                                                        textTransform: "uppercase",
                                                    }}
                                                >
                                                    {row.submittedBy.profileImage ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img
                                                            src={row.submittedBy.profileImage}
                                                            alt=""
                                                            className="w-4 h-4 rounded-full object-cover"
                                                        />
                                                    ) : (
                                                        <span
                                                            className="w-4 h-4 rounded-full inline-flex items-center justify-center text-[8px]"
                                                            style={{ background: "var(--ed-paper-2)", color: "var(--ed-ink)" }}
                                                        >
                                                            {(row.submittedBy.displayName ?? "?").slice(0, 1).toUpperCase()}
                                                        </span>
                                                    )}
                                                    Submitted by {row.submittedBy.displayName}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <div
                                                style={{
                                                    fontFamily: "var(--ed-serif)",
                                                    fontSize: 18,
                                                    color: "var(--ed-ink)",
                                                    lineHeight: 1.1,
                                                    fontVariantNumeric: "tabular-nums",
                                                }}
                                            >
                                                {formatDistance(row.distanceKm)}
                                            </div>
                                            <a
                                                href={`https://www.google.com/maps/search/?api=1&query=${row.lat},${row.lng}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="inline-flex items-center gap-1 mt-1 text-[10px]"
                                                style={{ color: "var(--ed-accent)" }}
                                            >
                                                <ExternalLink className="w-2.5 h-2.5" /> Map
                                            </a>
                                        </div>
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
