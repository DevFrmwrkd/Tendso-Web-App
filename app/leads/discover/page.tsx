"use client";

/**
 * /leads/discover — Map B: Find Local Business destination (post-scrape).
 *
 * Per WEB-BUILD-CRM.md Map B spec — Google Maps view that opens after the
 * Find Local Business modal finishes a successful Outscraper scrape. Pins:
 *
 *   lead.source === "outscraper"
 *     && lead.submissionId == null            // not interviewed yet
 *     && lead.businessLatitude  != null
 *     && lead.businessLongitude != null
 *     // (within the search radius the user just scraped)
 *
 * Pin style is KEYED BY CATEGORY so creators can scan the map for the
 * kind of business they're targeting. Includes a sticky legend (top-right)
 * showing only categories that actually have pins.
 *
 * Tap pin → InfoWindow with business name, rating, address, phone,
 * "I'll interview this" / Directions / View detail action chips.
 *
 * URL state: ?category=salon&radiusKm=5 — passed by the modal on
 * success so the map can scope distance + headline copy.
 */
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
    APIProvider, Map, AdvancedMarker, InfoWindow, useMap,
} from "@vis.gl/react-google-maps";
import { toast } from "sonner";
import {
    ArrowLeft, Loader2, Scissors, Utensils, ShoppingBag, Car, Stethoscope,
    Building2, Hand, MapPin, Compass, Star,
} from "lucide-react";

const PH_CENTER = { lat: 14.5995, lng: 120.9842 };
const MAPS_API_KEY =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    "AIzaSyAt-knwNJgQ-Nx5ZY5aZUC-T8sj8D3QZ7U";

// ── Category → pin color + icon (per spec Map B table) ────────────────────
type CategoryKey = "salon" | "food" | "store" | "auto" | "medical" | "other";

const CATEGORY_META: Record<CategoryKey, { color: string; label: string; Icon: typeof Scissors }> = {
    salon:   { color: "#7C3AED", label: "Barbershop · Salon",    Icon: Scissors },
    food:    { color: "#C68A12", label: "Restaurant · Cafe",     Icon: Utensils },
    store:   { color: "#10B981", label: "Sari-sari · Grocery",   Icon: ShoppingBag },
    auto:    { color: "#1F3654", label: "Auto · Mechanic",       Icon: Car },
    medical: { color: "#B43A1F", label: "Pharmacy · Clinic",     Icon: Stethoscope },
    other:   { color: "#3C3F4A", label: "Other",                 Icon: Building2 },
};

function classifyCategory(raw: string | null | undefined): CategoryKey {
    const c = (raw ?? "").toLowerCase();
    if (/barbershop|salon|hair|beauty/.test(c)) return "salon";
    if (/restaurant|cafe|coffee|food|eatery|bakery/.test(c)) return "food";
    if (/sari-sari|convenience|grocery|mart|store/.test(c)) return "store";
    if (/auto|mechanic|repair|wash/.test(c)) return "auto";
    if (/pharmacy|clinic|dental|medical/.test(c)) return "medical";
    return "other";
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export default function DiscoverMapPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ed-paper)" }}>
                    <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--ed-accent)" }} />
                </div>
            }
        >
            <DiscoverInner />
        </Suspense>
    );
}

function DiscoverInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const category = searchParams.get("category") || "businesses";
    const radiusKm = Math.max(1, parseFloat(searchParams.get("radiusKm") ?? "5") || 5);
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

    // Pull unclaimed Outscraper prospects, filtered to the scrape radius.
    const prospects = useQuery(
        api.outscraper.listScrapedLeads,
        ready ? {} : "skip",
    ) as any[] | undefined;

    const pins = useMemo(() => {
        if (!prospects) return [];
        const origin = userLoc;
        return prospects
            .filter(
                (p: any) =>
                    !p.submissionId &&
                    p.businessLatitude != null &&
                    p.businessLongitude != null,
            )
            .filter((p: any) => {
                if (!origin) return true;
                return (
                    haversineKm(origin, { lat: p.businessLatitude, lng: p.businessLongitude }) <=
                    radiusKm
                );
            })
            .map((p: any) => ({
                ...p,
                lat: p.businessLatitude,
                lng: p.businessLongitude,
                categoryKey: classifyCategory(p.businessCategory),
            }));
    }, [prospects, userLoc, radiusKm]);

    const categoriesInView = useMemo(() => {
        const set = new Set<CategoryKey>();
        for (const p of pins) set.add(p.categoryKey);
        return Array.from(set);
    }, [pins]);

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
                        href="/leads?tab=prospects"
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
                        <span>Step 03 / Nearby to Interview</span>
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
                    Fresh finds{" "}
                    <em style={{ fontStyle: "italic", color: "var(--ed-accent)" }}>around you.</em>
                </h1>
                <p className="text-[14px] mb-5" style={{ color: "var(--ed-ink-2)", lineHeight: 1.5 }}>
                    {prospects === undefined
                        ? "Loading…"
                        : `${pins.length} business${pins.length === 1 ? "" : "es"} found within ${radiusKm} km of you. Pin colors show categories — tap any pin to claim it or get directions.`}
                </p>

                {/* Map with sticky legend */}
                <div
                    className="relative rounded-2xl overflow-hidden mb-5"
                    style={{ border: "1px solid var(--ed-rule)", height: 480, background: "var(--ed-paper-2)" }}
                >
                    <APIProvider apiKey={MAPS_API_KEY}>
                        <Map
                            mapId="leads-discover-map"
                            defaultCenter={userLoc ?? PH_CENTER}
                            defaultZoom={userLoc ? 13 : 6}
                            gestureHandling="greedy"
                            style={{ width: "100%", height: "100%" }}
                        >
                            <FitToBoundsOnLoad pins={pins} userLoc={userLoc} />
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
                            <CategoryPins pins={pins} />
                        </Map>
                    </APIProvider>

                    {/* Sticky legend — only categories present on the map */}
                    {categoriesInView.length > 0 && (
                        <div
                            className="absolute top-3 right-3 rounded-xl p-3"
                            style={{
                                background: "rgba(252,250,245,0.95)",
                                border: "1px solid var(--ed-rule)",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                                fontFamily: "var(--ed-sans)",
                                minWidth: 180,
                            }}
                        >
                            <div
                                className="text-[9px] mb-2"
                                style={{
                                    fontFamily: "var(--ed-mono)",
                                    letterSpacing: "0.14em",
                                    textTransform: "uppercase",
                                    color: "var(--ed-ink-3)",
                                }}
                            >
                                Categories
                            </div>
                            <ul className="space-y-1">
                                {categoriesInView.map((k) => {
                                    const meta = CATEGORY_META[k];
                                    const Icon = meta.Icon;
                                    return (
                                        <li key={k} className="flex items-center gap-2 text-[11px]" style={{ color: "var(--ed-ink)" }}>
                                            <span
                                                className="inline-flex items-center justify-center w-4 h-4 rounded-full"
                                                style={{ background: meta.color, color: "#fff" }}
                                            >
                                                <Icon className="w-2.5 h-2.5" />
                                            </span>
                                            {meta.label}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Below-map: empty state OR scrape-again CTA */}
                {prospects === undefined ? (
                    <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div
                                key={i}
                                className="animate-pulse rounded-2xl"
                                style={{ background: "var(--ed-paper-2)", height: 80 }}
                            />
                        ))}
                    </div>
                ) : pins.length === 0 ? (
                    <div
                        className="rounded-2xl py-10 px-6 text-center"
                        style={{ background: "var(--ed-paper-3)", border: "1px solid var(--ed-rule)" }}
                    >
                        <Compass className="w-9 h-9 mx-auto mb-3" style={{ color: "var(--ed-accent)" }} />
                        <h3 style={{ fontFamily: "var(--ed-serif)", fontSize: 26, color: "var(--ed-ink)" }}>
                            Nothing nearby{" "}
                            <em style={{ fontStyle: "italic", color: "var(--ed-accent)" }}>yet.</em>
                        </h3>
                        <p className="text-[14px] mt-2 mb-4" style={{ color: "var(--ed-ink-2)", lineHeight: 1.5 }}>
                            Try widening the radius to 10 km, or pick a different category and search again.
                        </p>
                        <Link
                            href="/leads"
                            className="inline-flex items-center gap-1.5 text-[12px] px-4 py-2.5 rounded-full"
                            style={{
                                background: "var(--ed-ink)",
                                color: "var(--ed-paper-3)",
                                fontFamily: "var(--ed-mono)",
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                            }}
                        >
                            Search again →
                        </Link>
                    </div>
                ) : (
                    <ul className="space-y-3">
                        {pins.map((p: any) => {
                            const meta = CATEGORY_META[p.categoryKey as CategoryKey];
                            const Icon = meta.Icon;
                            return (
                                <li key={String(p._id)}>
                                    <Link
                                        href={`/leads/${p._id}`}
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
                                            style={{ background: meta.color, color: "#fff" }}
                                        >
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[15px] font-semibold truncate" style={{ color: "var(--ed-ink)" }}>
                                                {p.businessName ?? "(unnamed)"}
                                            </div>
                                            <div className="text-[12px]" style={{ color: "var(--ed-ink-3)" }}>
                                                {[p.businessCategory, p.businessCity].filter(Boolean).join(" · ") || "—"}
                                            </div>
                                            {p.businessRating != null && (
                                                <div className="flex items-center gap-1 text-[11px] mt-0.5" style={{ color: "var(--ed-ink)" }}>
                                                    <Star className="w-2.5 h-2.5 fill-current" style={{ color: "var(--ed-warn)" }} />
                                                    {p.businessRating.toFixed(1)}
                                                    {p.businessReviewCount ? <span style={{ color: "var(--ed-ink-3)" }}> · {p.businessReviewCount}</span> : null}
                                                </div>
                                            )}
                                        </div>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}

// ── Pins (Map B — category-colored droplet with overlay icon) ─────────────
function CategoryPins({ pins }: { pins: any[] }) {
    const [selected, setSelected] = useState<any | null>(null);
    const claim = useMutation(api.outscraper.claimProspect);
    return (
        <>
            {pins.map((pin) => (
                <AdvancedMarker
                    key={String(pin._id)}
                    position={{ lat: pin.lat, lng: pin.lng }}
                    onClick={() => setSelected(pin)}
                >
                    <CategoryDroplet categoryKey={pin.categoryKey} />
                </AdvancedMarker>
            ))}
            {selected && (
                <InfoWindow
                    position={{ lat: selected.lat, lng: selected.lng }}
                    onCloseClick={() => setSelected(null)}
                    pixelOffset={[0, -36]}
                >
                    <div style={{ fontFamily: "var(--ed-sans, system-ui)", minWidth: 240 }}>
                        <div
                            style={{
                                fontFamily: "var(--ed-serif, Georgia)",
                                fontSize: 18,
                                lineHeight: 1.15,
                                color: "#1B1C24",
                                marginBottom: 4,
                            }}
                        >
                            {selected.businessName ?? "(unnamed)"}
                        </div>
                        <div style={{ fontSize: 11, color: "#7A7E8A", marginBottom: 8 }}>
                            {[selected.businessCategory, selected.businessCity].filter(Boolean).join(" · ") || "—"}
                        </div>
                        {selected.businessRating != null && (
                            <div style={{ fontSize: 12, color: "#1B1C24", marginBottom: 6 }}>
                                ⭐ {selected.businessRating.toFixed(1)}
                                {selected.businessReviewCount
                                    ? ` · ${selected.businessReviewCount.toLocaleString()} reviews`
                                    : ""}
                            </div>
                        )}
                        {selected.businessAddress && (
                            <div style={{ fontSize: 12, color: "#3C3F4A", marginBottom: 8 }}>
                                {selected.businessAddress}
                            </div>
                        )}
                        {selected.claimedBy && (
                            <div
                                style={{
                                    fontSize: 11,
                                    color: "#3C3F4A",
                                    marginBottom: 8,
                                    background: "#FBE9C4",
                                    padding: "4px 8px",
                                    borderRadius: 8,
                                }}
                            >
                                Claimed by {selected.claimedBy.displayName}
                            </div>
                        )}
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {!selected.claimedBy && (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        try {
                                            await claim({ leadId: selected._id });
                                            toast.success("Claimed — it's yours for the next 24h.");
                                            setSelected(null);
                                        } catch (e: any) {
                                            toast.error(e?.message ?? "Couldn't claim.");
                                        }
                                    }}
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 600,
                                        padding: "4px 10px",
                                        borderRadius: 999,
                                        background: "#1B1C24",
                                        color: "#FCFAF5",
                                        border: "none",
                                        cursor: "pointer",
                                    }}
                                >
                                    I&apos;ll interview this
                                </button>
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
                                    background: "#10B981",
                                    color: "#fff",
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

function CategoryDroplet({ categoryKey }: { categoryKey: CategoryKey }) {
    const meta = CATEGORY_META[categoryKey];
    return (
        <div style={{ position: "relative", width: 32, height: 40 }}>
            <svg width={32} height={40} viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
                <path
                    d="M16 0C7.16 0 0 7.16 0 16c0 11 16 24 16 24s16-13 16-24C32 7.16 24.84 0 16 0z"
                    fill={meta.color}
                    stroke="#FFFFFF"
                    strokeWidth={2}
                />
                <circle cx={16} cy={15} r={6} fill="rgba(255,255,255,0.9)" />
            </svg>
            <div
                style={{
                    position: "absolute",
                    top: 8,
                    left: 10,
                    width: 12,
                    height: 12,
                    color: meta.color,
                }}
            >
                <meta.Icon width={12} height={12} />
            </div>
        </div>
    );
}

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
