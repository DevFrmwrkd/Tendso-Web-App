"use client";

import { ErrorState } from "@/components/r1/ErrorState";

/**
 * Any page that throws while rendering lands here instead of a blank screen
 * (ComponentKit, "Page failed to load"). A failing Convex query throws during
 * render, so this is also what a crashed list looks like now.
 */
export default function RouteError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <div className="r1 flex min-h-dvh items-center justify-center">
            <ErrorState reference={error.digest ?? null} />
        </div>
    );
}
