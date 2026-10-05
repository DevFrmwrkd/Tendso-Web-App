"use client";

import { ErrorState, PageHeader } from "@/components/r1";
import { CreatorShell } from "@/components/shells/CreatorShell";

/**
 * The map failed to load: a Convex query threw while rendering (ComponentKit,
 * "Page failed to load"). Shown inside the creator frame so the sidebar still
 * works; Reload is a full reload, which re-subscribes every query, and the
 * failure itself changed nothing. If the frame is what failed, this throws
 * too and the root app/error.tsx takes over. (The Google map failing on its
 * own is handled inside the map panel, with the list still usable.)
 */
export function MapError({ error }: { error: Error & { digest?: string } }) {
    return (
        <CreatorShell>
            <PageHeader title="Map" sub="What is near me?" />
            <ErrorState what="The map" reference={error.digest ?? null} />
        </CreatorShell>
    );
}
