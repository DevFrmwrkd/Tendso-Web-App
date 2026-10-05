"use client";

import { MapError } from "../_map/MapError";

/** /leads/discover failed while rendering; see MapError. */
export default function DiscoverMapError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
    return <MapError error={error} />;
}
