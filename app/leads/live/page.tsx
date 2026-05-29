"use client";

/**
 * /leads/live — Map A: See Live Business destination.
 *
 * Google Maps view of every business the team has already interviewed AND
 * whose generated site is live (deployed). Per WEB-BUILD-CRM.md Map A spec:
 *
 *   submissionId != null               // someone interviewed it
 *   && business.websiteUrl != null     // and the site is live
 *   && business.latitude  != null      // and we have coords
 *   && business.longitude != null
 *
 * Pin style: single accent-emerald droplet across the entire map. No
 * category variation here — visual consistency reinforces "these are all
 * our success stories." Tap a pin → popover with submitter strip + address
 * + Visit website / Directions / View detail.
 *
 * Uses Google Maps via @vis.gl/react-google-maps (not Leaflet — per spec,
 * the old Leaflet view at /leads/near was wrong).
 */
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
    APIProvider,
    Map,
    AdvancedMarker,
    InfoWindow,
    useMap,
} from "@vis.gl/react-google-maps";
import {
    ArrowLeft, Loader2, MapPin, Globe, ExternalLink, ArrowRight,
} from "lucide-react";

const PH_CENTER = { lat: 14.5995, lng: 120.9842 };
const MAPS_API_KEY =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    // Spec: reuse the mobile-side key (in ndm/app.json) — do not provision new
    "AIzaSyAt-knwNJgQ-Nx5ZY5aZUC-T8sj8D3QZ7U";

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

export default function LiveBusinessesPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ed-paper)" }}>
                    <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--ed-accent)" }} />
                </div>
            }
        >
            <LiveBusinessesInner />
        </Suspense>
    );
}

function LiveBusinessesInner() {
    const router = useRouter();
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
    useEffect(() => {
        if (!ready) return;
        if (typeof window === "undefined" || !navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => {},
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60_000 },
        );
    }, [ready]);

    const mappable = useQuery(api.leads.listForMap, ready ? {} : "skip");

    // Per Map A spec — interviewed AND live website.
    const livePins = useMemo(() => {
        if (!mappable) return [] as any[];
        return mappable.filter((m: any) => m.hasSubmission && m.hasLiveWebsite);
    }, [mappable]);

    if (!ready) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ed-paper)" }}>
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--ed-accent)" }} />
            </div>
        );
    }

    return (
        <div
            className="min-h-screen pb-24"
            style={{ background: "var(--ed-paper)", color: "var(--ed-ink)", fontFamily: "var(--ed-sans)" }}
        >
            <div className="max-w-3xl mx-auto px-4 pt-6 sm:pt-8 sm:px-6">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <Link
                        href="/leads"
                        className="w-9 h-9 rounded-full inline-flex items-center justify-center"
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
                        <span>Step 03 / Live Businesses</span>
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
                    Already-interviewed{" "}
                    <em style={{ fontStyle: "italic", color: "var(--ed-accent)" }}>and live.</em>
                </h1>
                <p className="text-[14px] mb-5" style={{ color: "var(--ed-ink-2)", lineHeight: 1.5 }}>
                    {mappable === undefined
                        ? "Loading…"
                        : `${livePins.length} business${livePins.length === 1 ? "" : "es"} the team has interviewed that now have a live website. Tap any pin to study what's working.`}
                </p>

                {/* Map */}
                <div
                    className="rounded-2xl overflow-hidden mb-5"
                    style={{ border: "1px solid var(--ed-rule)", height: 480, background: "var(--ed-paper-2)" }}
                >
                    <APIProvider apiKey={MAPS_API_KEY}>
                        <Map
                            mapId="leads-live-map"
                            defaultCenter={userLoc ?? PH_CENTER}
                            defaultZoom={userLoc ? 12 : 6}
                            gestureHandling="greedy"
                            disableDefaultUI={false}
                            style={{ width: "100%", height: "100%" }}
                        >
                            <FitToBoundsOnLoad pins={livePins} userLoc={userLoc} />
                            {userLoc && (
                                <AdvancedMarker position={userLoc}>
                                    <div
                                        style={{
                                            width: 14,
                                            height: 14,
                                            borderRadius: "50%",
                                            background: "#3478F6",
                                            border: "2px solid white",
                                            boxShadow: "0 0 0 2px rgba(52,120,246,0.25)",
                                        }}
                                        aria-label="You are here"
                                    />
                                </AdvancedMarker>
                            )}
                            <LivePins pins={livePins} />
                        </Map>
                    </APIProvider>
                </div>

                {/* Below-map list */}
                {mappable === undefined ? (
                    <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div
                                key={i}
                                className="animate-pulse rounded-2xl"
                                style={{ background: "var(--ed-paper-2)", height: 80 }}
                            />
                        ))}
                    </div>
                ) : livePins.length === 0 ? (
                    <div
                        className="rounded-2xl py-10 px-6 text-center"
                        style={{ background: "var(--ed-paper-3)", border: "1px solid var(--ed-rule)" }}
                    >
                        <Globe className="w-9 h-9 mx-auto mb-3" style={{ color: "var(--ed-accent)" }} />
                        <h3 style={{ fontFamily: "var(--ed-serif)", fontSize: 26, color: "var(--ed-ink)" }}>
                            Nothing live{" "}
                            <em style={{ fontStyle: "italic", color: "var(--ed-accent)" }}>yet.</em>
                        </h3>
                        <p className="text-[14px] mt-2" style={{ color: "var(--ed-ink-2)", lineHeight: 1.5 }}>
                            When the first team submission gets a website deployed, it&apos;ll appear here.
                        </p>
                    </div>
                ) : (
                    <ul className="space-y-3">
                        {livePins.map((row: any) => (
                            <li key={String(row._id)}>
                                <Link
                                    href={`/leads/${row._id}`}
                                    className="flex items-start gap-3 rounded-2xl p-3.5 hover:bg-white transition-colors"
                                    style={{
                                        background: "var(--ed-paper-3)",
                                        border: "1px solid var(--ed-rule)",
                                        textDecoration: "none",
                                        color: "inherit",
                                    }}
                                >
                                    <div
                                        className="w-10 h-10 rounded-xl inline-flex items-center justify-center flex-shrink-0"
                                        style={{ background: "var(--ed-accent-bg, #D1FAE5)" }}
                                    >
                                        <Globe className="w-5 h-5" style={{ color: "var(--ed-accent-ink, #064E3B)" }} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[15px] font-semibold truncate" style={{ color: "var(--ed-ink)" }}>
                                            {row.businessName}
                                        </div>
                                        {(row.businessAddress || row.businessCity) && (
                                            <div className="text-[12px] mt-0.5" style={{ color: "var(--ed-ink-3)" }}>
                                                {row.businessAddress ?? row.businessCity}
                                            </div>
                                        )}
                                        {row.websiteUrl && (
                                            <div className="text-[11px] mt-1 truncate" style={{ color: "var(--ed-accent)" }}>
                                                {row.websiteUrl}
                                            </div>
                                        )}
                                    </div>
                                    <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: "var(--ed-ink-3)" }} />
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

// ── Pins (Map A — single accent-emerald style across all pins) ────────────
function LivePins({ pins }: { pins: any[] }) {
    const [selected, setSelected] = useState<any | null>(null);
    return (
        <>
            {pins.map((pin) => (
                <AdvancedMarker
                    key={String(pin._id)}
                    position={{ lat: pin.lat, lng: pin.lng }}
                    onClick={() => setSelected(pin)}
                >
                    <EmeraldDroplet />
                </AdvancedMarker>
            ))}
            {selected && (
                <InfoWindow
                    position={{ lat: selected.lat, lng: selected.lng }}
                    onCloseClick={() => setSelected(null)}
                    pixelOffset={[0, -36]}
                >
                    <div style={{ fontFamily: "var(--ed-sans, system-ui)", minWidth: 220 }}>
                        <div
                            style={{
                                fontFamily: "var(--ed-serif, Georgia)",
                                fontSize: 18,
                                lineHeight: 1.15,
                                color: "#1B1C24",
                                marginBottom: 6,
                            }}
                        >
                            {selected.businessName}
                        </div>
                        {selected.submittedBy && (
                            <div style={{ fontSize: 11, color: "#7A7E8A", marginBottom: 6 }}>
                                Submitted by {selected.submittedBy.displayName}
                            </div>
                        )}
                        {(selected.businessAddress || selected.businessCity) && (
                            <div style={{ fontSize: 12, color: "#3C3F4A", marginBottom: 8 }}>
                                {selected.businessAddress ?? selected.businessCity}
                            </div>
                        )}
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {selected.websiteUrl && (
                                <a
                                    href={selected.websiteUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 600,
                                        padding: "4px 10px",
                                        borderRadius: 999,
                                        background: "#10B981",
                                        color: "#fff",
                                        textDecoration: "none",
                                    }}
                                >
                                    Visit website ↗
                                </a>
                            )}
                            <a
                                href={`https://www.google.com/maps/search/?api=1&query=${selected.lat},${selected.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    padding: "4px 10px",
                                    borderRadius: 999,
                                    background: "#EFEBE0",
                                    color: "#1B1C24",
                                    textDecoration: "none",
                                }}
                            >
                                Directions
                            </a>
                            <Link
                                href={`/leads/${selected._id}`}
                                style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    padding: "4px 10px",
                                    borderRadius: 999,
                                    background: "#1B1C24",
                                    color: "#FCFAF5",
                                    textDecoration: "none",
                                }}
                            >
                                View detail →
                            </Link>
                        </div>
                    </div>
                </InfoWindow>
            )}
        </>
    );
}

function EmeraldDroplet() {
    return (
        <svg width={32} height={40} viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M16 0C7.16 0 0 7.16 0 16c0 11 16 24 16 24s16-13 16-24C32 7.16 24.84 0 16 0z"
                fill="#10B981"
                stroke="#FFFFFF"
                strokeWidth={2}
            />
            <circle cx={16} cy={15} r={5} fill="#FFFFFF" />
        </svg>
    );
}

// Recompute bounds + recenter once when pins arrive.
function FitToBoundsOnLoad({
    pins, userLoc,
}: {
    pins: any[];
    userLoc: { lat: number; lng: number } | null;
}) {
    const map = useMap();
    const [done, setDone] = useState(false);
    useEffect(() => {
        if (done || !map || pins.length === 0) return;
        const bounds = new google.maps.LatLngBounds();
        for (const p of pins) bounds.extend({ lat: p.lat, lng: p.lng });
        if (userLoc) bounds.extend(userLoc);
        map.fitBounds(bounds, 64);
        setDone(true);
    }, [map, pins, userLoc, done]);
    return null;
}
