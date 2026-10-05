/**
 * /leads/discover — the Leads map, "Businesses to visit" layer (Map B).
 *
 * The Find Local Business search lands here after a successful scrape, with
 * `?category=…&radiusKm=…&data=…` (the same query contract as mobile's
 * discover screen). The screen itself is shared with /leads/live and lives in
 * app/leads/_map; see LeadsMap.tsx for the layers and useDiscoverPins.ts for
 * this layer's data (URL payload, prospect pool, legacy scraped leads).
 *
 * The page renders under Suspense because the screen reads useSearchParams.
 */
import { Suspense } from "react";

import { LeadsMap, LeadsMapFallback } from "../_map/LeadsMap";

export default function DiscoverMapPage() {
    return (
        <Suspense fallback={<LeadsMapFallback />}>
            <LeadsMap layer="discover" />
        </Suspense>
    );
}
