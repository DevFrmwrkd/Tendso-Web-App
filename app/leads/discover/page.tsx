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
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
    APIProvider,
    Map as GoogleMap,
    AdvancedMarker,
    InfoWindow,
    useMap,
    useMapsLibrary,
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
    const [locDenied, setLocDenied] = useState(false);
    useEffect(() => {
        if (!ready) return;
        if (typeof window === "undefined" || !navigator.geolocation) {
            setLocDenied(true);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => setLocDenied(true),
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60_000 },
        );
    }, [ready]);

    // Per the 2026-06-01 P1 prospect-pool deploy: the discover map has
    // THREE data sources, merged in priority order with place_id dedup:
    //
    //   1. PRIMARY — URL `data` param. After a successful scrape, the
    //      modal encodes result.businesses as JSON and passes it via the
    //      URL. This bypasses the silently-failing DB write path entirely.
    //
    //   2. POOL — prospects.searchNearby. The new global prospect pool
    //      (shared across creators, replenished by background cron in P4).
    //      Subscribes once the user's GPS resolves; no Outscraper call.
    //
    //   3. LEGACY FALLBACK — outscraper.listScrapedLeads. The old per-creator
    //      scraped leads. Kept during the migration window so cold-start
    //      navigations (deep link, browser back/forward) still have data.
    //      Will be removed in Phase M.4 cleanup.
    //
    // All three sources get normalized into a shared shape (with a
    // `__source` tag for the DEBUG strip + claim-button gating) and feed
    // the same downstream pin-rendering pipeline. The "I'll interview
    // this" button is hidden on pool-sourced pins until P2's
    // prospects.reserve mutation ships — legacy/url pins still use
    // outscraper.claimProspect as before.
    const urlData = searchParams.get("data");
    const urlBusinesses = useMemo(() => {
        if (!urlData) return null;
        try {
            const parsed = JSON.parse(decodeURIComponent(urlData));
            if (!Array.isArray(parsed)) return null;
            // Normalize URL businesses to match the listScrapedLeads shape
            // the rest of the page expects (_id, submissionId, etc.). The
            // synthetic _id is used purely as a React `key`; nothing actually
            // looks it up in the DB.
            return parsed.map((b: any) => ({
                _id: b.placeId ?? `${b.businessName}:${b.businessLatitude}:${b.businessLongitude}`,
                __source: "url" as const,
                businessGooglePlaceId: b.placeId ?? null,
                submissionId: null,
                businessName: b.businessName ?? null,
                businessAddress: b.businessAddress ?? null,
                businessCity: b.businessCity ?? null,
                businessCategory: b.businessCategory ?? null,
                businessWebsite: b.businessWebsite ?? null,
                phone: b.businessPhone ?? null,
                businessLatitude: b.businessLatitude ?? null,
                businessLongitude: b.businessLongitude ?? null,
                businessRating: b.businessRating ?? null,
                businessReviewCount: b.businessReviewCount ?? null,
            }));
        } catch (err) {
            console.warn("[discover] failed to parse URL data param:", err);
            return null;
        }
    }, [urlData]);

    // P1 pool query — prospects.searchNearby reads from the new global
    // pool. Subscribes only once GPS resolves so we have a real (lat, lng);
    // suspending earlier would cost a wasted query. The (api as any) cast
    // lets us ship before the next-build codegen refresh wires up the
    // typed binding — drops to `api.prospects.searchNearby` once codegen
    // catches up. Safe because P1 web deploy already shipped this function.
    const poolProspects = useQuery(
        (api as any).prospects?.searchNearby,
        ready && userLoc
            ? { lat: userLoc.lat, lng: userLoc.lng, radiusKm, limit: 200 }
            : "skip",
    ) as any[] | undefined;

    const poolArray = useMemo(() => {
        if (!Array.isArray(poolProspects)) return [];
        // Map prospects.* shape → the discover-map row shape. Pool docs use
        // `latitude`/`longitude` (no `business` prefix), `phone`, `rating`,
        // `reviewCount`, `address`. We also stamp `__source: "pool"` so the
        // claim button can be hidden until P2's reserve mutation lands.
        return poolProspects.map((p: any) => ({
            _id: p._id,
            __source: "pool" as const,
            businessGooglePlaceId: p.googlePlaceId ?? null,
            // submissionId on the pool side means "already converted" —
            // map it through so the candidate filter below excludes it
            // (same semantics as the legacy lead.submissionId).
            submissionId: p.submissionId ?? null,
            businessName: p.businessName ?? null,
            businessAddress: p.address ?? null,
            businessCity: p.city ?? null,
            businessCategory: p.category ?? null,
            businessWebsite: p.website ?? null,
            phone: p.phone ?? null,
            businessLatitude: p.latitude ?? null,
            businessLongitude: p.longitude ?? null,
            businessRating: p.rating ?? null,
            businessReviewCount: p.reviewCount ?? null,
        }));
    }, [poolProspects]);

    // Legacy fallback query — ONLY subscribe when there's no URL data.
    // Stays during the migration window; removed in Phase M.4.
    const fallbackProspects = useQuery(
        api.outscraper.listScrapedLeads,
        ready && !urlBusinesses ? {} : "skip",
    ) as any[] | undefined;

    // Defensive against the deployed validator-drift shape: the deployed
    // listScrapedLeads sometimes returns { leads, stats } instead of an
    // array. Unwrap if needed.
    const fallbackArray: any[] | undefined = useMemo(() => {
        if (fallbackProspects === undefined) return undefined;
        const arr = Array.isArray(fallbackProspects)
            ? fallbackProspects
            : Array.isArray((fallbackProspects as any)?.leads)
                ? (fallbackProspects as any).leads
                : [];
        return arr.map((p: any) => ({ ...p, __source: "legacy" as const }));
    }, [fallbackProspects]);

    // Merge sources with place_id dedup. Priority: url > pool > legacy.
    // Falls back to the legacy-only path when URL data is present (post-
    // scrape happy path) — pool + legacy still ride along so a partial
    // URL set doesn't hide nearby pool rows.
    const prospects: any[] | undefined = useMemo(() => {
        // Suspense gate: wait until at least ONE source has resolved.
        // (poolProspects can resolve faster than fallbackProspects since
        // it doesn't depend on the legacy list-all path.)
        const haveAnyResolved =
            urlBusinesses != null ||
            poolProspects !== undefined ||
            fallbackProspects !== undefined;
        if (!haveAnyResolved) return undefined;

        const byKey = new Map<string, any>();
        const stash = (row: any) => {
            // Dedup key: prefer Google place_id (the only stable cross-source
            // identity), fall back to lat,lng,name when place_id is missing
            // (rare — only happens for very old legacy rows).
            const key =
                row.businessGooglePlaceId
                ?? `${row.businessLatitude},${row.businessLongitude},${row.businessName}`;
            if (!byKey.has(key)) byKey.set(key, row);
        };
        if (urlBusinesses) urlBusinesses.forEach(stash);
        poolArray.forEach(stash);
        if (fallbackArray) fallbackArray.forEach(stash);
        return Array.from(byKey.values());
    }, [urlBusinesses, poolProspects, poolArray, fallbackProspects, fallbackArray]);

    // Client-side geocoder cache — keyed by lead id. Used when an Outscraper
    // prospect has an address but no latitude/longitude (sometimes happens
    // when Outscraper can't resolve precise coords for informal places).
    const [geocoded, setGeocoded] = useState<Map<string, { lat: number; lng: number }>>(
        new Map(),
    );

    // Candidate set per spec — unclaimed Outscraper rows. Includes both
    // rows with coords and rows with only an address (the latter get
    // geocoded client-side via <AddressGeocoder> below). Filtering by
    // radius is a separate step so we can fall back if the radius yields
    // zero pins (e.g. user is in a different area than their older scrape).
    const allMappableProspects = useMemo(() => {
        if (!prospects) return [] as any[];
        return prospects
            .filter((p: any) => !p.submissionId)
            .map((p: any) => {
                // Resolve coords: Outscraper-provided first, then geocoded.
                let lat: number | null = p.businessLatitude ?? null;
                let lng: number | null = p.businessLongitude ?? null;
                if (lat == null || lng == null) {
                    const g = geocoded.get(String(p._id));
                    if (g) {
                        lat = g.lat;
                        lng = g.lng;
                    }
                }
                if (lat == null || lng == null) return null;
                return {
                    ...p,
                    lat,
                    lng,
                    categoryKey: classifyCategory(p.businessCategory),
                    distanceKm: userLoc
                        ? haversineKm(userLoc, { lat, lng })
                        : null,
                };
            })
            .filter((p): p is any => p !== null);
    }, [prospects, userLoc, geocoded]);

    // Pending geocode set — prospects with an address but no coords yet.
    // The <AddressGeocoder> child resolves these in batch.
    const pendingGeocodes = useMemo(() => {
        if (!prospects) return [] as Array<{ id: string; address: string }>;
        return prospects
            .filter(
                (p: any) =>
                    !p.submissionId &&
                    (p.businessLatitude == null || p.businessLongitude == null) &&
                    p.businessAddress,
            )
            .map((p: any) => ({
                id: String(p._id),
                address: [p.businessAddress, p.businessCity, "Philippines"]
                    .filter(Boolean)
                    .join(", "),
            }))
            .filter((p: { id: string; address: string }) => !geocoded.has(p.id));
    }, [prospects, geocoded]);

    const withinRadius = useMemo(() => {
        if (!userLoc) return allMappableProspects;
        return allMappableProspects.filter(
            (p: any) => (p.distanceKm ?? Infinity) <= radiusKm,
        );
    }, [allMappableProspects, userLoc, radiusKm]);

    // Field-test fix #3 (2026-06-04): hard distance filter. The previous
    // behaviour silently relaxed to "show all" when the radius excluded
    // every prospect; creators reported confusing pins 2-3km away on a
    // "1km" search. Now we strictly honor radiusKm. The banner below still
    // shows when there are out-of-radius prospects so creators understand
    // why the map looks empty — but the pin set itself is no longer relaxed.
    const usingRadiusFallback = withinRadius.length === 0 && allMappableProspects.length > 0;
    const pinsUnsorted = withinRadius;

    const pins = useMemo(() => {
        const arr = [...pinsUnsorted];
        if (userLoc) {
            arr.sort(
                (a: any, b: any) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity),
            );
        }
        return arr;
    }, [pinsUnsorted, userLoc]);

    // Distance formatter matching spec: "{N} m" < 1km, "{N.N} km" < 10km,
    // "{N} km" otherwise, "—" if null.
    const formatDistance = (km: number | null): string => {
        if (km == null) return "—";
        if (km < 1) return `${Math.round(km * 1000)} m`;
        if (km < 10) return `${km.toFixed(1)} km`;
        return `${Math.round(km)} km`;
    };

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
                {/* Sub-copy — three variants per spec: loading / empty / has results.
                    The category name is interpolated from the URL param. */}
                <p className="text-[14px] mb-5" style={{ color: "var(--ed-ink-2)", lineHeight: 1.5 }}>
                    {prospects === undefined
                        ? "Loading nearby businesses to interview…"
                        : pins.length === 0
                            ? "No nearby businesses yet — try widening the radius or a different category."
                            : `${pins.length} ${category} business${pins.length === 1 ? "" : "es"} within ${radiusKm} km. Pin colors show categories.`}
                </p>

                {/* Map with sticky legend */}
                <div
                    className="relative rounded-2xl overflow-hidden mb-5"
                    style={{ border: "1px solid var(--ed-rule)", height: 480, background: "var(--ed-paper-2)" }}
                >
                    <APIProvider apiKey={MAPS_API_KEY}>
                        <AddressGeocoder
                            pending={pendingGeocodes}
                            onResolved={(id, lat, lng) => {
                                setGeocoded((prev) => {
                                    const next = new Map(prev);
                                    next.set(id, { lat, lng });
                                    return next;
                                });
                            }}
                        />
                        <GoogleMap
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
                        </GoogleMap>
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

                {/* Radius-fallback banner — fires when the user's GPS
                    radius excluded every mappable prospect but there are
                    prospects elsewhere we can show. Better than a blank
                    map. */}
                {usingRadiusFallback && (
                    <div
                        className="flex items-start gap-2 rounded-xl px-3 py-2.5 mb-4 text-[12px]"
                        style={{
                            background: "var(--ed-status-contacted-bg, #FBE9C4)",
                            color: "var(--ed-ink-2)",
                            border: "1px solid var(--ed-rule)",
                        }}
                    >
                        <Compass className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "var(--ed-warn)" }} />
                        <span>
                            None of the {allMappableProspects.length} prospect{allMappableProspects.length === 1 ? "" : "s"} on the map are within {radiusKm} km of you. Showing them all so you can plan a route — or tap <strong>Find Local Business</strong> again with a wider radius.
                        </span>
                    </div>
                )}

                {/* Permission-denied banner — only when geolocation was
                    explicitly denied. Per spec: "Enable location to sort
                    by distance" ghost Door. */}
                {locDenied && (
                    <div
                        className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 mb-4 text-[12px]"
                        style={{
                            background: "var(--ed-status-contacted-bg, #FBE9C4)",
                            color: "var(--ed-ink-2)",
                            border: "1px solid var(--ed-rule)",
                        }}
                    >
                        <span className="inline-flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5" style={{ color: "var(--ed-warn)" }} />
                            Enable location to sort by distance.
                        </span>
                    </div>
                )}

                {/* Section header above the card list — NEAREST FIRST when
                    GPS granted, ALL NEARBY when denied. Right side: N pinned. */}
                {prospects !== undefined && pins.length > 0 && (
                    <div className="flex items-center justify-between mb-3">
                        <div
                            className="text-[10px]"
                            style={{
                                fontFamily: "var(--ed-mono)",
                                letterSpacing: "0.18em",
                                textTransform: "uppercase",
                                color: "var(--ed-ink-3)",
                            }}
                        >
                            {userLoc ? "Nearest first" : "All nearby"}
                        </div>
                        <div
                            className="text-[10px]"
                            style={{
                                fontFamily: "var(--ed-mono)",
                                letterSpacing: "0.18em",
                                textTransform: "uppercase",
                                color: "var(--ed-ink-3)",
                            }}
                        >
                            {pins.length} pinned
                        </div>
                    </div>
                )}

                {/* Below-map: list, empty state, or skeleton */}
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
                        <div
                            className="w-14 h-14 rounded-full inline-flex items-center justify-center mb-3"
                            style={{ background: "var(--ed-paper-2)" }}
                        >
                            <Compass className="w-7 h-7" style={{ color: "var(--ed-ink-3)" }} />
                        </div>
                        <h3 style={{ fontFamily: "var(--ed-serif)", fontSize: 26, color: "var(--ed-ink)" }}>
                            Nothing to interview{" "}
                            <em style={{ fontStyle: "italic", color: "var(--ed-accent)" }}>yet.</em>
                        </h3>
                        <p className="text-[13px] mt-2 mb-4" style={{ color: "var(--ed-ink-3)", lineHeight: 1.5 }}>
                            Tap Find Local Business again with a wider radius or a different category to add more pins here.
                        </p>

                        {/* Field-test fix #5 (2026-06-04): debug strip removed.
                            Dual-read fallback is stable; per-source counts no
                            longer carry diagnostic value and were visible to
                            creators. Matches mobile discover.tsx. */}
                        <Link
                            href="/leads"
                            className="inline-flex items-center justify-center gap-1.5 text-[12px] px-4 py-2.5 rounded-xl w-full"
                            style={{
                                background: "var(--ed-ink)",
                                color: "var(--ed-paper-3)",
                                fontFamily: "var(--ed-mono)",
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                            }}
                        >
                            ← Back to leads
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
                                        className="flex items-stretch gap-3 rounded-2xl p-3.5 hover:bg-white transition-colors"
                                        style={{
                                            background: "var(--ed-paper-3)",
                                            border: "1px solid var(--ed-rule)",
                                            textDecoration: "none",
                                            color: "inherit",
                                        }}
                                    >
                                        <div
                                            className="w-11 h-11 rounded-xl inline-flex items-center justify-center flex-shrink-0"
                                            style={{ background: meta.color, color: "#fff" }}
                                        >
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[15px] font-semibold truncate" style={{ color: "var(--ed-ink)" }}>
                                                {p.businessName ?? "(unnamed)"}
                                            </div>
                                            <div className="text-[12px] truncate" style={{ color: "var(--ed-ink-3)" }}>
                                                {[p.businessCategory, p.businessCity].filter(Boolean).join(" · ") ||
                                                    p.businessAddress ||
                                                    "—"}
                                            </div>
                                            {p.businessRating != null && (
                                                <div className="flex items-center gap-1 text-[11px] mt-1" style={{ color: "var(--ed-ink)" }}>
                                                    <Star className="w-2.5 h-2.5 fill-current" style={{ color: "var(--ed-warn)" }} />
                                                    {p.businessRating.toFixed(1)}
                                                    {p.businessReviewCount ? <span style={{ color: "var(--ed-ink-3)" }}> · {p.businessReviewCount}</span> : null}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right flex-shrink-0 flex flex-col items-end justify-center">
                                            {p.distanceKm != null ? (
                                                <div
                                                    style={{
                                                        fontFamily: "var(--ed-serif)",
                                                        fontSize: 18,
                                                        letterSpacing: "-0.01em",
                                                        color: "var(--ed-ink)",
                                                        lineHeight: 1,
                                                    }}
                                                >
                                                    {formatDistance(p.distanceKm)}
                                                </div>
                                            ) : (
                                                <div
                                                    className="text-[9px]"
                                                    style={{
                                                        fontFamily: "var(--ed-mono)",
                                                        color: "var(--ed-ink-3)",
                                                        letterSpacing: "0.14em",
                                                        textTransform: "uppercase",
                                                    }}
                                                >
                                                    Distance off
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
    // P2: prospects.reserve for pool-sourced pins (replaces the old hint chip).
    // `(api as any)` cast keeps web buildable when codegen hasn't refreshed yet;
    // drops to `api.prospects.reserve` once everyone's local codegen catches up.
    const reservePool = useMutation((api as any).prospects?.reserve);
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
                            {/* Claim button: shown for legacy/url-sourced pins only.
                                Pool-sourced pins are reserved via prospects.reserve
                                in P2; until that mutation ships, the button is
                                hidden on pool entries to prevent leadId type
                                mismatches with outscraper.claimProspect. */}
                            {!selected.claimedBy && selected.__source !== "pool" && (
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
                            {selected.__source === "pool" && !selected.claimedBy && (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        try {
                                            await reservePool({ prospectId: selected._id });
                                            toast.success("Reserved — it's yours for the next 24h.");
                                            setSelected(null);
                                        } catch (e: any) {
                                            toast.error(e?.message ?? "Couldn't reserve.");
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
                            {selected.phone && (
                                <a
                                    href={`tel:${String(selected.phone).replace(/[^0-9+]/g, "")}`}
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
                                    Call
                                </a>
                            )}
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

// Pin per spec discover.tsx: 34×34 circle head (2px white border, 16×16 white
// Ionicon centered) + 8px downward triangle tail (6px half-width). Drop
// shadow for elevation. NOT a single droplet — explicitly two stacked
// shapes per the spec's exact JSX.
function CategoryDroplet({ categoryKey }: { categoryKey: CategoryKey }) {
    const meta = CATEGORY_META[categoryKey];
    const Icon = meta.Icon;
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.25))",
            }}
        >
            <div
                style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: meta.color,
                    border: "2px solid #FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <Icon className="w-4 h-4" style={{ color: "#FFFFFF" }} />
            </div>
            <div
                style={{
                    width: 0,
                    height: 0,
                    borderLeft: "6px solid transparent",
                    borderRight: "6px solid transparent",
                    borderTop: `8px solid ${meta.color}`,
                    marginTop: -2,
                }}
                aria-hidden
            />
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
    const [lastCount, setLastCount] = useState(0);
    useEffect(() => {
        // Re-fit when the pin set grows (e.g. geocoding finishes after
        // first paint and new pins arrive). Skips when nothing changed to
        // avoid camera jitter on every render.
        if (!map || pins.length === 0 || pins.length === lastCount) return;
        const bounds = new google.maps.LatLngBounds();
        for (const p of pins) bounds.extend({ lat: p.lat, lng: p.lng });
        if (userLoc) bounds.extend(userLoc);
        map.fitBounds(bounds, 64);
        setLastCount(pins.length);
    }, [map, pins, userLoc, lastCount]);
    return null;
}

/**
 * Same client-side Google Geocoder pattern as /leads/live. Lives inside
 * <APIProvider> so useMapsLibrary can hand back the loaded geocoding lib.
 * The parent caches results in a Map keyed by lead id so each address is
 * geocoded once per session.
 */
function AddressGeocoder({
    pending, onResolved,
}: {
    pending: Array<{ id: string; address: string }>;
    onResolved: (id: string, lat: number, lng: number) => void;
}) {
    const geocodingLib = useMapsLibrary("geocoding");
    const inFlightRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!geocodingLib || pending.length === 0) return;
        const geocoder = new geocodingLib.Geocoder();
        for (const item of pending) {
            if (inFlightRef.current.has(item.id)) continue;
            inFlightRef.current.add(item.id);
            geocoder
                .geocode({ address: item.address })
                .then((res) => {
                    const loc = res.results[0]?.geometry.location;
                    if (loc) onResolved(item.id, loc.lat(), loc.lng());
                })
                .catch((err) => {
                    console.warn(
                        `[geocoder] failed for "${item.address}":`,
                        err?.message ?? err,
                    );
                });
        }
    }, [geocodingLib, pending, onResolved]);

    return null;
}
