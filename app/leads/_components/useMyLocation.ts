"use client";

import { useCallback, useEffect, useState } from "react";

import type { LatLng } from "./leadUtils";

export type MyLocation =
    | { status: "unknown" } // not asked yet, or the browser cannot say
    | { status: "asking" }
    | { status: "ready"; pos: LatLng }
    | { status: "denied" }
    | { status: "unsupported" };

// Same tolerances as the map pages and the Find a local business search: a
// five-minute-old fix is close enough to rank shops by distance.
const OPTIONS: PositionOptions = { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60_000 };

/**
 * Where the creator is, for "Closest first" and the distance column.
 *
 * It reads the position on its own only when the browser already allows it.
 * A permission prompt the moment the list opens, before the creator asked for
 * anything, is the wrong time to ask; otherwise the list ranks newest first and
 * offers "Use my location", which calls `ask`.
 */
export function useMyLocation(): { location: MyLocation; ask: () => void } {
    const [location, setLocation] = useState<MyLocation>({ status: "unknown" });

    const ask = useCallback(() => {
        if (typeof navigator === "undefined" || !navigator.geolocation) {
            setLocation({ status: "unsupported" });
            return;
        }
        setLocation({ status: "asking" });
        navigator.geolocation.getCurrentPosition(
            (p) => setLocation({ status: "ready", pos: { lat: p.coords.latitude, lng: p.coords.longitude } }),
            // A refusal sticks; a timeout or a weak signal can be tried again.
            (err) => setLocation(err.code === err.PERMISSION_DENIED ? { status: "denied" } : { status: "unknown" }),
            OPTIONS,
        );
    }, []);

    useEffect(() => {
        let cancelled = false;
        const permissions = typeof navigator !== "undefined" ? navigator.permissions : undefined;
        if (!permissions?.query) return;
        permissions
            .query({ name: "geolocation" })
            .then((s) => {
                if (cancelled) return;
                if (s.state === "granted") ask();
                else if (s.state === "denied") setLocation({ status: "denied" });
            })
            .catch(() => {
                // Some browsers cannot query geolocation; the button still works.
            });
        return () => {
            cancelled = true;
        };
    }, [ask]);

    return { location, ask };
}
