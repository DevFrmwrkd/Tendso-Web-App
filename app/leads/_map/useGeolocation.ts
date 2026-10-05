"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import type { LatLng } from "./geo";

/**
 * Where the creator is. Asked once when the map mounts (both map pages did
 * this before the redesign), and again whenever they press the map's
 * locate button, which is how someone who said no at first can say yes.
 *
 *   pending  the browser has not answered yet
 *   ok       we have a position
 *   off      denied, timed out, or no geolocation in this browser
 */
export type GeoStatus = "pending" | "ok" | "off";
/** Why a request came back empty: the person (or browser) said no, or no fix was found. */
export type GeoFailure = "denied" | "unavailable";
export type Geo = {
    loc: LatLng | null;
    status: GeoStatus;
    /** Ask again. `onFail` runs when no position comes back (to say how to turn location on). */
    locate: (onFail?: (why: GeoFailure) => void) => void;
};

// The same options as before: a coarse fix is plenty for "what is near me",
// and a fix up to five minutes old saves waking the GPS again.
const OPTIONS: PositionOptions = { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60_000 };

const noSubscribe = () => () => {};
const hasGeolocation = () => typeof navigator !== "undefined" && "geolocation" in navigator;

export function useGeolocation(): Geo {
    // Read through useSyncExternalStore so the server render (no navigator)
    // and the first client render agree; the server assumes support.
    const supported = useSyncExternalStore(noSubscribe, hasGeolocation, () => true);
    const [loc, setLoc] = useState<LatLng | null>(null);
    const [failed, setFailed] = useState(false);

    const locate = useCallback((onFail?: (why: GeoFailure) => void) => {
        if (!hasGeolocation()) {
            onFail?.("unavailable");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setFailed(false);
                setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            },
            (err) => {
                setFailed(true);
                onFail?.(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable");
            },
            OPTIONS,
        );
    }, []);

    useEffect(() => {
        locate();
    }, [locate]);

    const status: GeoStatus = loc ? "ok" : !supported || failed ? "off" : "pending";
    return { loc, status, locate };
}
