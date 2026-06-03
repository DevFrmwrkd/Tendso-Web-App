/**
 * Feasibility probe — run this from the Convex dashboard's "Run function"
 * panel AFTER deploying P0. Confirms `h3-js` loads and behaves correctly
 * inside Convex's sandboxed V8 runtime (we already verified Node V8 works
 * locally — this is the production-runtime double-check).
 *
 * Run as: `internal.lib.h3_test.test`
 * Expected output:
 *   {
 *     cell: "87694ec04ffffff",
 *     valid: true,
 *     neighbors: 7,
 *     children: 7,
 *     centroidLat: 14.6001,
 *     centroidLng: 120.9922,
 *     haversineKm: 0
 *   }
 *
 * If this throws or returns wrong values, h3-js doesn't work in Convex's
 * runtime — back off to a pure-JS fallback (see h3-js-pure) or compute
 * cells on the client side before write. Delete this file after the
 * check passes; it has no production purpose.
 */
import { internalQuery } from '../_generated/server';
import {
    latLngToH3Cells,
    getNeighborCellsRes7,
    cellChildrenRes8,
    cellCentroid,
    isValidCell,
    haversineKm,
} from './h3';

export const test = internalQuery({
    args: {},
    handler: async () => {
        // Quezon City coordinates (matches the doc's example)
        const lat = 14.5995;
        const lng = 120.9842;

        const cells = latLngToH3Cells(lat, lng);
        const neighbors = getNeighborCellsRes7(cells.res7, 1);
        const children = cellChildrenRes8(cells.res7);
        const [cLat, cLng] = cellCentroid(cells.res7);
        const valid = isValidCell(cells.res7);
        const self = haversineKm(lat, lng, lat, lng);

        return {
            cell: cells.res7,
            res8: cells.res8,
            res9: cells.res9,
            valid,
            neighbors: neighbors.length, // expect 7 (center + 6)
            children: children.length,   // expect 7
            centroidLat: Math.round(cLat * 10000) / 10000,
            centroidLng: Math.round(cLng * 10000) / 10000,
            haversineSelf: self,
        };
    },
});
