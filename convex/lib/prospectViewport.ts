import * as h3 from 'h3-js';
import { haversineKm } from './h3';

export interface ProspectViewport {
    south: number;
    north: number;
    west: number;
    east: number;
}

export const VIEWPORT_MAX_RANGES = 128;
export const VIEWPORT_MAX_READS = 2048;
export const VIEWPORT_ROWS_PER_RANGE = 256;
export const VIEWPORT_MAX_RESULTS = 400;

const EARTH_RADIUS_KM = 6371;
const radians = (degrees: number) => degrees * Math.PI / 180;
const normalizeLongitude = (longitude: number) => ((longitude + 180) % 360 + 360) % 360 - 180;

export function viewportLongitudeSpan(view: ProspectViewport): number {
    return view.east >= view.west ? view.east - view.west : view.east + 360 - view.west;
}

export function validateProspectViewport(view: ProspectViewport): void {
    if (![view.south, view.north, view.west, view.east].every(Number.isFinite)
        || view.south < -90 || view.north > 90 || view.south >= view.north
        || view.west < -180 || view.west > 180 || view.east < -180 || view.east > 180
        || viewportLongitudeSpan(view) <= 0) {
        throw new Error('Enter valid map bounds');
    }
}

export function pointInProspectViewport(view: ProspectViewport, latitude: number, longitude: number): boolean {
    const containsLongitude = (value: number) => view.west <= view.east
        ? value >= view.west && value <= view.east : value >= view.west || value <= view.east;
    return Number.isFinite(latitude) && Number.isFinite(longitude)
        && latitude >= view.south && latitude <= view.north && longitude >= -180 && longitude <= 180
        && (containsLongitude(longitude) || Math.abs(longitude) === 180 && containsLongitude(-longitude));
}

export function prospectViewportCenter(view: ProspectViewport) {
    return { latitude: (view.south + view.north) / 2,
        longitude: normalizeLongitude(view.west + viewportLongitudeSpan(view) / 2) };
}

function rectangleArea(south: number, north: number, longitudeSpan: number): number {
    return EARTH_RADIUS_KM ** 2 * Math.abs(Math.sin(radians(north)) - Math.sin(radians(south)))
        * radians(longitudeSpan);
}

/** Split unwrapped longitude bounds into ordinary, <=90 degree rectangles. */
function longitudeSlices(west: number, width: number): Array<[number, number]> {
    if (width >= 360) return [[-180, -90], [-90, 0], [0, 90], [90, 180]];
    const slices: Array<[number, number]> = [];
    let cursor = normalizeLongitude(west);
    let remaining = width;
    while (remaining > 1e-10) {
        const step = Math.min(90, remaining, 180 - cursor);
        if (step <= 1e-10) { cursor = -180; continue; }
        slices.push([cursor, cursor + step]);
        remaining -= step;
        cursor += step;
        if (cursor >= 180 - 1e-10) cursor = -180;
    }
    return slices;
}

/**
 * Use coarse H3 parents to read contiguous ranges in the existing res7 index.
 * Parent/child outlines do not coincide exactly. A generous parent-size buffer
 * covers that mismatch, and exact row coordinates are filtered after reading.
 * Estimate the BUFFERED area first so a world-width thin viewport cannot ask H3
 * to allocate millions of fine cells. Polar/global views use just 122 base cells.
 */
export function prospectViewportRanges(view: ProspectViewport): Array<{ lower: string; upper: string }> {
    validateProspectViewport(view);
    const width = viewportLongitudeSpan(view);
    let parents: string[] | null = null;
    for (let resolution = 7; resolution >= 1; resolution--) {
        const paddingKm = 3 * h3.getHexagonEdgeLengthAvg(resolution, 'km');
        const latitudePadding = paddingKm / 110;
        const south = Math.max(-90, view.south - latitudePadding);
        const north = Math.min(90, view.north + latitudePadding);
        // A longitude rectangle becomes ambiguous at a pole; the bounded base
        // cell fallback handles these views without dropping polar shops.
        if (south <= -89 || north >= 89) continue;
        const longitudePadding = paddingKm / (110 * Math.cos(radians(Math.max(Math.abs(south), Math.abs(north)))));
        const paddedWidth = Math.min(360, width + 2 * longitudePadding);
        if (rectangleArea(south, north, paddedWidth) / h3.getHexagonAreaAvg(resolution, 'km2') > 56) continue;
        const cells = new Set<string>();
        for (const [west, east] of longitudeSlices(view.west - longitudePadding, paddedWidth)) {
            const polygon = [[south, west], [south, east], [north, east], [north, west]];
            for (const cell of h3.polygonToCellsExperimental(polygon, resolution,
                h3.POLYGON_TO_CELLS_FLAGS.containmentOverlappingBbox)) cells.add(cell);
        }
        if (cells.size && cells.size <= VIEWPORT_MAX_RANGES) { parents = [...cells]; break; }
    }
    parents ??= h3.getRes0Cells();
    const center = prospectViewportCenter(view);
    parents.sort((left, right) => {
        const [leftLat, leftLng] = h3.cellToLatLng(left);
        const [rightLat, rightLng] = h3.cellToLatLng(right);
        return haversineKm(center.latitude, center.longitude, leftLat, leftLng)
            - haversineKm(center.latitude, center.longitude, rightLat, rightLng);
    });
    return parents.map((parent) => {
        const size = h3.cellToChildrenSize(parent, 7);
        return { lower: h3.childPosToCell(0, parent, 7), upper: h3.childPosToCell(size - 1, parent, 7) };
    });
}
