"use client";

import { useAction, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { formatMoney, submissionStatus } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { isComped, ownerChargeFor } from "@/lib/pricing";

import { readableError } from "./errors";
import { haversineKm, type LatLng } from "./geo";
import type { Radius, SitePin } from "./types";

/*
 * Map A, "Live Tendso sites" (per WEB-BUILD-CRM.md): every business the team
 * has already interviewed AND whose generated site is live:
 *
 *   submissionId != null               // someone interviewed it
 *   && websiteUrl != null              // and the site is live
 *   && latitude/longitude known        // (or an address we can geocode)
 *
 * The board draws this layer as the creator's own sites ("Submitted by you",
 * the status, "Open submission"). The team's sites stay on it, as before the
 * redesign (the spec's "what's working on the platform" view); the creator's
 * own pins carry the board's details. listForMap does not return a
 * submission's status, so the status comes from the creator's own
 * submissions (submissions.getByCreatorId, which CreatorShell already
 * subscribes to). Another creator's site has no status here.
 */

type MapRow = FunctionReturnType<typeof api.leads.listForMap>[number];

type GeocodeResult =
    | { phase: "done"; geocoded: number; failed: number; scanned: number }
    | { phase: "error"; message: string };

export type LiveData = {
    /** Within the radius, nearest first. Undefined while loading. */
    pins: SitePin[] | undefined;
    beyond: number;
    /** True when nothing is live yet and the layer shows every interviewed business instead. */
    usingFallback: boolean;
    /** Server geocoding of submission addresses (see below). */
    geocode: { running: number } | GeocodeResult | null;
    pendingGeocodes: Array<{ id: string; address: string }>;
    onGeocoded: (id: string, lat: number, lng: number) => void;
};

export function useLivePins({
    creatorId,
    userLoc,
    radius,
}: {
    creatorId: Id<"creators">;
    userLoc: LatLng | null;
    radius: Radius;
}): LiveData {
    const mappable = useQuery(api.leads.listForMap, {});
    const mySubmissions = useQuery(api.submissions.getByCreatorId, { creatorId });

    // Server-side geocoding: the Convex action geocodes submission addresses
    // and persists the result to `submission.coordinates`. listForMap is
    // reactive, so the new coords surface here once the action returns.
    const geocodePending = useAction(api.leads.geocodePendingSubmissions);
    const geocodeKickedOffRef = useRef(false);
    const [geocodeResult, setGeocodeResult] = useState<GeocodeResult | null>(null);

    // Leads we would map but that lack coords. If > 0 and the action has not
    // run yet, run it now. It is idempotent (already-geocoded submissions are
    // skipped), so this is safe.
    const needsGeocoding = useMemo(
        () => (mappable ? mappable.filter((m) => m.hasSubmission && (m.lat == null || m.lng == null)).length : 0),
        [mappable],
    );

    useEffect(() => {
        if (!mappable || needsGeocoding === 0 || geocodeKickedOffRef.current) return;
        geocodeKickedOffRef.current = true;
        geocodePending({ limit: 50 })
            .then((res) => setGeocodeResult({ phase: "done", geocoded: res.geocoded, failed: res.failed, scanned: res.scanned }))
            .catch((err: unknown) => setGeocodeResult({ phase: "error", message: readableError(err) ?? "Geocoding failed." }));
    }, [mappable, needsGeocoding, geocodePending]);

    // Client-side geocoding cache: a SECONDARY path for residual misses after
    // the server action runs (or while it is in flight).
    const [geocoded, setGeocoded] = useState<Map<string, LatLng>>(() => new Map());
    const onGeocoded = useCallback((id: string, lat: number, lng: number) => {
        setGeocoded((prev) => new Map(prev).set(id, { lat, lng }));
    }, []);

    const enriched = useMemo(() => {
        if (!mappable) return undefined;
        return mappable.map((m) => {
            if (m.lat != null && m.lng != null) return m;
            const g = geocoded.get(String(m._id));
            return g ? { ...m, lat: g.lat, lng: g.lng } : m;
        });
    }, [mappable, geocoded]);

    // Per the Map A spec: interviewed AND live website (strict). When that is
    // empty, fall back to every interviewed business with coords so the map
    // is not a blank canvas; the list says which one it is showing.
    const { livePins, usingFallback } = useMemo(() => {
        if (!enriched) return { livePins: [] as MapRow[], usingFallback: false };
        const strict = enriched.filter((m) => m.hasSubmission && m.hasLiveWebsite && m.lat != null && m.lng != null);
        const interviewed = enriched.filter((m) => m.hasSubmission && m.lat != null && m.lng != null);
        const fallback = strict.length === 0 && interviewed.length > 0;
        return { livePins: fallback ? interviewed : strict, usingFallback: fallback };
    }, [enriched]);

    // Rows with an address but no coords yet, for the client geocoder (with
    // the city, and "Philippines" since the data is PH-centric).
    const pendingGeocodes = useMemo(() => {
        if (!mappable) return [];
        return mappable
            .filter((m) => m.hasSubmission && m.lat == null && m.lng == null && !geocoded.has(String(m._id)))
            .map((m) => ({
                id: String(m._id),
                address: [m.businessAddress, m.businessCity, "Philippines"].filter(Boolean).join(", "),
            }));
    }, [mappable, geocoded]);

    const { pins, beyond } = useMemo(() => {
        if (!enriched || mySubmissions === undefined) return { pins: undefined, beyond: 0 };
        const mine = new Map(mySubmissions.map((s) => [String(s._id), s] as const));
        const all = livePins.map((m) => {
            const lat = m.lat as number;
            const lng = m.lng as number;
            const sub = m.submissionId ? mine.get(m.submissionId) : undefined;
            const isMine = !!sub || m.submittedBy?.creatorId === String(creatorId);
            const pin: SitePin = {
                layer: "live",
                key: String(m._id),
                lat,
                lng,
                // listForMap already prefers the submission's name, address and
                // city; the category is only known for the creator's own.
                name: m.businessName,
                meta: [sub?.businessType, m.businessCity].filter(Boolean).join(" · ") || m.businessAddress || "",
                distanceKm: userLoc ? haversineKm(userLoc, { lat, lng }) : null,
                status: sub ? submissionStatus(sub.status, "creator") : null,
                mine: isMine,
                submittedBy: m.submittedBy?.displayName ?? null,
                address: m.businessAddress,
                submissionId: m.submissionId,
                leadId: String(m._id),
                websiteUrl: m.websiteUrl,
                note: sub ? earningNote(sub) : null,
            };
            return pin;
        });
        const inside = userLoc && radius !== "all" ? all.filter((p) => (p.distanceKm ?? Infinity) <= radius) : all;
        if (userLoc) inside.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
        return { pins: inside, beyond: all.length - inside.length };
    }, [enriched, mySubmissions, livePins, creatorId, userLoc, radius]);

    const geocode: LiveData["geocode"] =
        geocodeResult ?? (mappable && needsGeocoding > 0 ? { running: needsGeocoding } : null);

    return { pins, beyond, usingFallback, geocode, pendingGeocodes, onGeocoded };
}

/**
 * The creator's money on one of their sites, from their own ledger: the
 * commission stored on the submission (`creatorPayout`) and what the owner is
 * charged (`ownerChargeFor`, which is ₱0 on a promo site). Nothing when the
 * row has no payout recorded.
 */
function earningNote(sub: Doc<"submissions">): string | null {
    const payout = sub.creatorPayout;
    if (payout == null || payout <= 0) return null;
    switch (sub.status) {
        case "paid":
        case "completed":
            return isComped(sub) ? `Free promo site. You earned ${formatMoney(payout)}.` : `You earned ${formatMoney(payout)}.`;
        case "deployed":
        case "pending_payment": {
            const owes = ownerChargeFor(sub);
            return owes > 0 ? `Your ${formatMoney(payout)} lands when the owner pays ${formatMoney(owes)}.` : null;
        }
        default:
            return null;
    }
}
