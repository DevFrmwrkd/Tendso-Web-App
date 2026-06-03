/**
 * H3 spatial indexing helpers — Uber's hexagonal hierarchical geospatial
 * index. Used by the Prospect Pool to partition the world into addressable
 * ~5km cells (res 7), with finer res-8 (~1km) and res-9 (~400m) subdivisions.
 *
 * Resolution reference (avg hex edge length):
 *   res 7 → 1.2 km     (the primary search key — `prospects.h3CellRes7`)
 *   res 8 → 461 m      (subdivision when a res-7 scrape hits the result cap)
 *   res 9 → 174 m      (block-level — for tightest dedup proximity checks)
 *
 * Used by:
 *   - prospects.searchNearby (P1) — computes user's res7 + k-ring neighbors
 *   - scrape.scrapeAndStore (P4) — cellCentroid → Outscraper coords
 *   - ingest dedup (P1+) — latLngToH3Cells() for the 4-layer dedup pipeline
 *
 * Convex runtime note: `h3-js` v4.x uses a WASM-free pure-JS build path
 * starting with v4.0. Verified to load in V8 (Node + Convex). If a future
 * version brings WASM back, validate it still loads in Convex actions via
 * the dashboard-runnable probe in convex/lib/h3-test.ts.
 */
import * as h3 from 'h3-js';

/**
 * Compute the H3 cell IDs at resolutions 7, 8, and 9 for a (lat, lng) pair.
 * Used on every prospect insert and every search query.
 */
export function latLngToH3Cells(lat: number, lng: number): {
    res7: string;
    res8: string;
    res9: string;
} {
    return {
        res7: h3.latLngToCell(lat, lng, 7),
        res8: h3.latLngToCell(lat, lng, 8),
        res9: h3.latLngToCell(lat, lng, 9),
    };
}

/**
 * Get the k-ring of res-7 cells around the given center (inclusive).
 * Default ringSize 2 yields ~13 cells covering a ~10km radius.
 * Used by searchNearby to widen the query window.
 */
export function getNeighborCellsRes7(centerCell: string, ringSize: number = 2): string[] {
    return h3.gridDisk(centerCell, ringSize);
}

/**
 * Return the 7 res-8 child cells inside a res-7 parent. Used by the
 * cell-subdivision logic in P5 — when a res-7 scrape hits the Outscraper
 * result cap, we recurse into its children.
 */
export function cellChildrenRes8(parentRes7Cell: string): string[] {
    return h3.cellToChildren(parentRes7Cell, 8);
}

/**
 * Geographic centroid of an H3 cell, as [lat, lng]. Used by scrape jobs
 * to pick the search center coordinate for Outscraper.
 */
export function cellCentroid(cell: string): [lat: number, lng: number] {
    const [lat, lng] = h3.cellToLatLng(cell);
    return [lat, lng];
}

/**
 * Validate a cell ID string before using it in a query. Cheap — pure
 * format + checksum validation, no allocation.
 */
export function isValidCell(cell: string): boolean {
    return h3.isValidCell(cell);
}

/**
 * Haversine great-circle distance in kilometers between two lat/lng points.
 * Used by the proximity dedup layer (layer 4) — flag prospects within
 * ~150m of an existing one with similar normalized name as a likely dup.
 */
export function haversineKm(
    aLat: number,
    aLng: number,
    bLat: number,
    bLng: number,
): number {
    const R = 6371; // Earth radius km
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const lat1 = toRad(aLat);
    const lat2 = toRad(bLat);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const a = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
