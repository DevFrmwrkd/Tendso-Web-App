"use client";

import { useEffect, useState } from "react";

/**
 * The time, refreshed every minute, for the expiry check. Reading Date.now()
 * while rendering is impure (react-hooks/purity): the first value comes from
 * the state initialiser and later ones from the interval, which also turns a
 * page left open past the link's end into the expired state on its own.
 */
export function useNow(intervalMs = 60_000): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), intervalMs);
        return () => clearInterval(t);
    }, [intervalMs]);
    return now;
}
