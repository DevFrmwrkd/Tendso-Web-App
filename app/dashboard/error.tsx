"use client";

import { ErrorState, PageHeader } from "@/components/r1";
import { CreatorShell } from "@/components/shells/CreatorShell";

/**
 * Home failed to load (a Convex query threw while rendering). Shown inside the
 * creator's frame, so the sidebar still works and the way out is where it
 * always is; app/error.tsx catches anything that breaks the frame itself.
 */
export default function HomeError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <CreatorShell>
            <PageHeader title="Home" sub="What should I do next?" />
            <div className="t-card">
                <ErrorState what="Home" reference={error.digest ?? null} />
            </div>
        </CreatorShell>
    );
}
