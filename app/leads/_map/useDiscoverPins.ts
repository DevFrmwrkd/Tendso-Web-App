"use client";

import { useQuery } from "convex/react";
import { useCallback, useMemo, useState } from "react";

import { leadStatus } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { haversineKm, type LatLng } from "./geo";
import type { ClaimTarget, ProspectPin } from "./types";

/*
 * Map B, "Businesses to visit" (per WEB-BUILD-CRM.md): the Find Local
 * Business search lands here. Pins are businesses nobody has interviewed:
 *
 *   submissionId == null                  // not interviewed yet
 *   && latitude/longitude known           // (or an address we can geocode)
 *   && within the search radius           // a hard filter, field-test fix #3
 *
 * Per the 2026-06-01 P1 prospect-pool deploy the map has THREE data sources,
 * merged in priority order with place_id dedup:
 *
 *   1. PRIMARY: the URL `data` param. After a successful scrape, the modal
 *      encodes result.businesses as JSON and passes it via the URL. This
 *      bypasses the silently-failing DB write path entirely.
 *
 *   2. POOL: prospects.searchNearby. The global prospect pool (shared across
 *      creators). Subscribes once the creator's GPS resolves; no Outscraper
 *      call.
 *
 *   3. LEGACY FALLBACK: outscraper.listScrapedLeads. The old per-creator
 *      scraped leads. Kept during the migration window so cold-start
 *      navigations (deep link, browser back/forward) still have data. Will be
 *      removed in Phase M.4 cleanup.
 *
 * All three are normalised into one shape and feed the same pins and list.
 */

type Source = "url" | "pool" | "legacy";

/** One business, whatever source it came from. */
type Candidate = {
    /** Dedup key: Google place_id (the only stable cross-source identity), else coords + name. */
    key: string;
    source: Source;
    /**
     * The Convex row behind the business and which table it is in. A fresh
     * search row has none until a pool or legacy row with the same place_id
     * lends it one.
     */
    rowId: string | null;
    rowKind: "lead" | "prospect" | null;
    submissionId: string | null;
    name: string | null;
    address: string | null;
    city: string | null;
    category: string | null;
    phone: string | null;
    lat: number | null;
    lng: number | null;
    rating: number | null;
    reviewCount: number | null;
    /** leads.status. Pool and fresh-search rows have none: nobody has touched them yet, so they read "New". */
    status: string | null;
    claimedBy: { displayName: string; isMine: boolean } | null;
};

/** listScrapedLeads row (the query returns untyped rows). */
type LegacyRow = {
    _id: string;
    status?: string | null;
    phone?: string | null;
    businessName?: string | null;
    businessAddress?: string | null;
    businessCity?: string | null;
    businessCategory?: string | null;
    businessLatitude?: number | null;
    businessLongitude?: number | null;
    businessRating?: number | null;
    businessReviewCount?: number | null;
    businessGooglePlaceId?: string | null;
    submissionId?: string | null;
    claimedBy?: { displayName: string; isMine: boolean } | null;
};

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const num = (v: unknown): number | null => {
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
    return null;
};
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function dedupKey(placeId: string | null, lat: number | null, lng: number | null, name: string | null): string {
    // place_id when present; very old legacy rows lack it, so fall back to lat,lng,name.
    return placeId ?? `${lat},${lng},${name}`;
}

/**
 * The URL `data` param: the scrape's `businesses` array. URLSearchParams has
 * already decoded it once; links that were encoded twice (what the old page
 * assumed) still parse through the second attempt. A name with a literal "%"
 * no longer throws away the whole search, which the old double decode did.
 */
function parseUrlBusinesses(raw: string | null): Candidate[] | null {
    if (!raw) return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        try {
            parsed = JSON.parse(decodeURIComponent(raw));
        } catch (err) {
            console.warn("[discover] failed to parse URL data param:", err);
            return null;
        }
    }
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(isRecord).map((b) => {
        const placeId = text(b.placeId);
        const name = text(b.businessName);
        const lat = num(b.businessLatitude);
        const lng = num(b.businessLongitude);
        return {
            key: dedupKey(placeId, lat, lng, name),
            source: "url" as const,
            rowId: null,
            rowKind: null,
            submissionId: null,
            name,
            address: text(b.businessAddress),
            city: text(b.businessCity),
            category: text(b.businessCategory),
            phone: text(b.businessPhone),
            lat,
            lng,
            rating: num(b.businessRating),
            reviewCount: num(b.businessReviewCount),
            status: null,
            claimedBy: null,
        };
    });
}

export type DiscoverData = {
    /** Within the radius, nearest first. Undefined while no source has answered. */
    pins: ProspectPin[] | undefined;
    /** Mappable businesses outside the radius ("12 more beyond 5 km"). */
    beyond: number;
    /** Rows with an address but no coordinates, for the client geocoder. */
    pendingGeocodes: Array<{ id: string; address: string }>;
    onGeocoded: (id: string, lat: number, lng: number) => void;
};

export function useDiscoverPins({
    dataParam,
    userLoc,
    radiusKm,
}: {
    dataParam: string | null;
    userLoc: LatLng | null;
    radiusKm: number;
}): DiscoverData {
    const urlRows = useMemo(() => parseUrlBusinesses(dataParam), [dataParam]);

    // P1 pool query: reads the global pool around the creator. Subscribes only
    // once GPS resolves so it has a real (lat, lng); asking earlier would cost
    // a wasted query. (The typed binding replaces the old `(api as any)` cast
    // now that codegen includes prospects.)
    const pool = useQuery(
        api.prospects.searchNearby,
        userLoc ? { lat: userLoc.lat, lng: userLoc.lng, radiusKm, limit: 200 } : "skip",
    );

    // Legacy fallback: ONLY subscribe when there is no URL data. Stays during
    // the migration window; removed in Phase M.4.
    const legacyRaw = useQuery(api.outscraper.listScrapedLeads, urlRows ? "skip" : {}) as
        | LegacyRow[]
        | { leads?: LegacyRow[] }
        | undefined;

    const poolRows = useMemo<Candidate[]>(() => {
        if (!pool) return [];
        // prospects.* uses latitude/longitude (no `business` prefix), phone,
        // rating, reviewCount, address. submissionId on the pool side means
        // "already converted"; it maps through so the filter below drops it,
        // same as the legacy lead.submissionId.
        return pool.map((p) => ({
            key: dedupKey(p.googlePlaceId ?? null, p.latitude ?? null, p.longitude ?? null, p.businessName ?? null),
            source: "pool" as const,
            rowId: String(p._id),
            rowKind: "prospect" as const,
            submissionId: p.submissionId ? String(p.submissionId) : null,
            name: p.businessName ?? null,
            address: p.address ?? null,
            city: p.city ?? null,
            category: p.category ?? null,
            phone: p.phone ?? null,
            lat: p.latitude ?? null,
            lng: p.longitude ?? null,
            rating: p.rating ?? null,
            reviewCount: p.reviewCount ?? null,
            status: null,
            claimedBy: null,
        }));
    }, [pool]);

    // Defensive against the deployed validator-drift shape: the deployed
    // listScrapedLeads sometimes returns { leads, stats } instead of an array.
    const legacyRows = useMemo<Candidate[] | undefined>(() => {
        if (legacyRaw === undefined) return undefined;
        const arr = Array.isArray(legacyRaw) ? legacyRaw : Array.isArray(legacyRaw?.leads) ? legacyRaw.leads : [];
        return arr.map((l) => {
            const placeId = l.businessGooglePlaceId ?? null;
            const lat = l.businessLatitude ?? null;
            const lng = l.businessLongitude ?? null;
            return {
                key: dedupKey(placeId, lat, lng, l.businessName ?? null),
                source: "legacy" as const,
                rowId: String(l._id),
                rowKind: "lead" as const,
                submissionId: l.submissionId ? String(l.submissionId) : null,
                name: l.businessName ?? null,
                address: l.businessAddress ?? null,
                city: l.businessCity ?? null,
                category: l.businessCategory ?? null,
                phone: l.phone ?? null,
                lat,
                lng,
                rating: l.businessRating ?? null,
                reviewCount: l.businessReviewCount ?? null,
                status: l.status ?? null,
                claimedBy: l.claimedBy ?? null,
            };
        });
    }, [legacyRaw]);

    // Merge with place_id dedup. Priority: url > pool > legacy; pool and
    // legacy still ride along with URL data so a partial URL set does not
    // hide nearby pool rows. Undefined until at least ONE source has answered
    // (the pool can answer before the legacy list-all path).
    const merged = useMemo<Candidate[] | undefined>(() => {
        if (urlRows == null && pool === undefined && legacyRows === undefined) return undefined;
        const byKey = new Map<string, Candidate>();
        const stash = (row: Candidate) => {
            const existing = byKey.get(row.key);
            if (!existing) {
                byKey.set(row.key, row);
                return;
            }
            // A fresh-search row has no Convex id. The first duplicate that has
            // one lends it, together with which table it lives in, so claiming
            // goes to the right mutation (the old page kept the "url" tag and
            // sent pool ids to claimProspect, which always failed). It also
            // lends what only the database knows: status, claim, conversion.
            if (!existing.rowId && row.rowId) {
                byKey.set(row.key, {
                    ...existing,
                    rowId: row.rowId,
                    rowKind: row.rowKind,
                    status: existing.status ?? row.status,
                    claimedBy: existing.claimedBy ?? row.claimedBy,
                    submissionId: existing.submissionId ?? row.submissionId,
                });
            }
        };
        urlRows?.forEach(stash);
        poolRows.forEach(stash);
        legacyRows?.forEach(stash);
        return Array.from(byKey.values());
    }, [urlRows, pool, poolRows, legacyRows]);

    // Client-side geocoder cache, keyed by dedup key. Used when a prospect has
    // an address but no latitude/longitude (Outscraper sometimes cannot
    // resolve precise coords for informal places).
    const [geocoded, setGeocoded] = useState<Map<string, LatLng>>(() => new Map());
    const onGeocoded = useCallback((id: string, lat: number, lng: number) => {
        setGeocoded((prev) => new Map(prev).set(id, { lat, lng }));
    }, []);

    // Candidates: not interviewed, with coords (from the row or geocoded).
    const mappable = useMemo(() => {
        if (!merged) return undefined;
        const out: Array<Candidate & { lat: number; lng: number }> = [];
        for (const c of merged) {
            if (c.submissionId) continue;
            // The row's own coords first, else the geocoded pair (both, never one of each).
            const coords = c.lat != null && c.lng != null ? { lat: c.lat, lng: c.lng } : geocoded.get(c.key);
            if (!coords) continue;
            out.push({ ...c, lat: coords.lat, lng: coords.lng });
        }
        return out;
    }, [merged, geocoded]);

    const pendingGeocodes = useMemo(() => {
        if (!merged) return [];
        return merged
            .filter((c) => !c.submissionId && (c.lat == null || c.lng == null) && c.address && !geocoded.has(c.key))
            .map((c) => ({ id: c.key, address: [c.address, c.city, "Philippines"].filter(Boolean).join(", ") }));
    }, [merged, geocoded]);

    const { pins, beyond } = useMemo(() => {
        if (!mappable) return { pins: undefined, beyond: 0 };
        const withDistance = mappable.map((c) => ({ c, d: userLoc ? haversineKm(userLoc, c) : null }));
        // Field-test fix #3 (2026-06-04): a hard distance filter. The map used
        // to relax to "show all" when the radius excluded everything, and
        // creators reported confusing pins 2-3 km away on a "1 km" search.
        // What is outside is counted instead ("12 more beyond 5 km").
        const inside = userLoc ? withDistance.filter((x) => (x.d ?? Infinity) <= radiusKm) : withDistance;
        if (userLoc) inside.sort((a, b) => (a.d ?? Infinity) - (b.d ?? Infinity));
        return {
            pins: inside.map(({ c, d }) => toPin(c, d)),
            beyond: withDistance.length - inside.length,
        };
    }, [mappable, userLoc, radiusKm]);

    return { pins, beyond, pendingGeocodes, onGeocoded };
}

function toPin(c: Candidate & { lat: number; lng: number }, distanceKm: number | null): ProspectPin {
    let claim: ClaimTarget | null = null;
    if (c.rowId && c.rowKind === "prospect") claim = { kind: "prospect", id: c.rowId as Id<"prospects"> };
    else if (c.rowId && c.rowKind === "lead") claim = { kind: "lead", id: c.rowId as Id<"leads"> };
    return {
        layer: "discover",
        key: c.key,
        lat: c.lat,
        lng: c.lng,
        name: c.name ?? "Unnamed business",
        meta: [c.category, c.city].filter(Boolean).join(" · ") || c.address || "",
        distanceKm,
        status: leadStatus(c.status ?? "new"),
        rating: c.rating,
        reviewCount: c.reviewCount,
        address: c.address,
        phone: c.phone,
        claimedBy: c.claimedBy,
        claim,
        leadId: c.rowKind === "lead" ? c.rowId : null,
    };
}
