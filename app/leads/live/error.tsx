"use client";

import { MapError } from "../_map/MapError";

/** /leads/live failed while rendering; see MapError. */
export default function LiveMapError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
    return <MapError error={error} />;
}
