/**
 * Distance, shape and radius helpers for the Leads map. Pure (no React, no
 * Google Maps), so the radius ring and the camera framing work out the same
 * numbers the list does, before the Maps geometry library has loaded.
 */
import type { MapLayer, Radius } from "./types";

export type LatLng = { lat: number; lng: number };
export type Bounds = { north: number; south: number; east: number; west: number };

/** Manila: where the map starts before it knows where the creator is. */
export const PH_CENTER: LatLng = { lat: 14.5995, lng: 120.9842 };

const EARTH_KM = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function haversineKm(a: LatLng, b: LatLng): number {
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The point `km` from `from` on a compass bearing, along the great circle. */
function destination(from: LatLng, km: number, bearingDeg: number): LatLng {
    const d = km / EARTH_KM;
    const brg = toRad(bearingDeg);
    const lat1 = toRad(from.lat);
    const lng1 = toRad(from.lng);
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brg));
    const lng2 = lng1 + Math.atan2(Math.sin(brg) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
    return { lat: toDeg(lat2), lng: toDeg(lng2) };
}

/**
 * A closed ring of points `km` around `center`. The radius ring is a dashed
 * polyline along these points: google.maps.Circle cannot be dashed, and the
 * board draws the radius as a dashed circle.
 */
export function circlePath(center: LatLng, km: number, steps = 96): LatLng[] {
    const pts: LatLng[] = [];
    for (let i = 0; i <= steps; i++) pts.push(destination(center, km, (360 * i) / steps));
    return pts;
}

/** The box around a circle: what the camera frames to show the whole radius. */
export function circleBounds(center: LatLng, km: number): Bounds {
    const n = destination(center, km, 0);
    const e = destination(center, km, 90);
    const s = destination(center, km, 180);
    const w = destination(center, km, 270);
    return { north: n.lat, south: s.lat, east: e.lng, west: w.lng };
}

/**
 * The box around some points. A single point (or a tight cluster) gets a 1 km
 * box instead, so the camera does not zoom into one rooftop.
 */
export function boundsOf(points: LatLng[]): Bounds | null {
    if (points.length === 0) return null;
    let north = -90;
    let south = 90;
    let east = -180;
    let west = 180;
    for (const p of points) {
        north = Math.max(north, p.lat);
        south = Math.min(south, p.lat);
        east = Math.max(east, p.lng);
        west = Math.min(west, p.lng);
    }
    if (north - south < 0.005 && east - west < 0.005) {
        return circleBounds({ lat: (north + south) / 2, lng: (east + west) / 2 }, 1);
    }
    return { north, south, east, west };
}

/**
 * The spec's distance format: metres under 1 km, one decimal under 10 km,
 * whole kilometres beyond ("430 m", "1.2 km", "38 km"). Metres go in steps of
 * 10, the same as the Leads list, so a business reads the same on both.
 */
export function formatDistance(km: number): string {
    if (km < 1) return `${Math.max(10, Math.round(km * 100) * 10)} m`;
    if (km < 10) return `${km.toFixed(1)} km`;
    return `${Math.round(km).toLocaleString("en-US")} km`;
}

/** Same Google Maps link the old map pins used. Opens the app on a phone. */
export function directionsUrl(p: LatLng): string {
    return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
}

// ── Radius ──────────────────────────────────────────────────────────────

/** The board's three steps. */
export const STANDARD_RADII = [2, 5, 10] as const;
/** The board's starting radius. */
export const DEFAULT_RADIUS = 5;

/**
 * The radius from the URL (`?radiusKm=`). The Find Local Business search sends
 * the radius it searched (500 m, 1, 3, 5 or 10 km) and the map keeps exactly
 * that one: field-test fix #3 (2026-06-04) made the radius a hard filter
 * because pins 2-3 km out on a "1 km" search confused creators. 500 m is
 * honoured now; the old page floored it to 1 km, which predates the 500 m
 * option. "all" exists only on the live layer.
 */
export function parseRadius(raw: string | null, layer: MapLayer): Radius {
    if (raw === "all") return layer === "live" ? "all" : DEFAULT_RADIUS;
    const n = parseFloat(raw ?? "");
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_RADIUS;
    return Math.max(0.5, n);
}

/** The control's options: the board's 2/5/10 km, plus the URL's own radius when it is none of those. */
export function radiusOptions(current: Radius): Radius[] {
    const opts: Radius[] = [...STANDARD_RADII];
    if (typeof current === "number" && !opts.includes(current)) {
        opts.push(current);
        opts.sort((a, b) => (a as number) - (b as number));
    }
    if (current === "all") opts.push("all");
    return opts;
}

/** The next step out ("Widen to 5 km"), or null at the widest. */
export function nextRadius(current: Radius): number | null {
    if (current === "all") return null;
    return STANDARD_RADII.find((r) => r > current) ?? null;
}

export function formatRadius(r: Radius): string {
    if (r === "all") return "All";
    return r < 1 ? `${Math.round(r * 1000)} m` : `${r} km`;
}
