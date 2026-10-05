"use client";

import { ErrorState, PageHeader } from "@/components/r1";
import { CreatorShell } from "@/components/shells/CreatorShell";

/**
 * Submissions failed to load (a Convex query threw while rendering). Shown
 * inside the creator's frame, so the sidebar still works and the way out is
 * where it always is; app/error.tsx catches anything that breaks the frame
 * itself.
 */
export default function SubmissionsError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <CreatorShell>
            <PageHeader title="Submissions" sub="Where is each business I submitted?" />
            <div className="t-card">
                <ErrorState what="Submissions" reference={error.digest ?? null} />
            </div>
        </CreatorShell>
    );
}
