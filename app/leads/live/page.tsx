/**
 * /leads/live — the Leads map, "Live Tendso sites" layer (Map A).
 *
 * Every business the team has interviewed whose site is live, on Google
 * Maps (not Leaflet; per spec the old Leaflet view at /leads/near was
 * wrong). The creator's own sites carry their status and open in the
 * Submissions drawer. The screen is shared with /leads/discover and lives in
 * app/leads/_map; see useLivePins.ts for this layer's data.
 *
 * The page renders under Suspense because the screen reads useSearchParams.
 */
import { Suspense } from "react";

import { LeadsMap, LeadsMapFallback } from "../_map/LeadsMap";

export default function LiveBusinessesPage() {
    return (
        <Suspense fallback={<LeadsMapFallback />}>
            <LeadsMap layer="live" />
        </Suspense>
    );
}
