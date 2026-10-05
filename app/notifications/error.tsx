"use client";

import { ErrorState, PageHeader } from "@/components/r1";
import { CreatorShell } from "@/components/shells/CreatorShell";

/**
 * Notifications failed to load (a Convex query threw while rendering). Shown
 * inside the creator's frame, so the sidebar still works; app/error.tsx
 * catches anything that breaks the frame itself. (The Home drawn behind the
 * drawer cannot land here: QuietBoundary drops it instead.)
 */
export default function NotificationsError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <CreatorShell>
            <PageHeader title="Notifications" sub="What changed?" />
            <div className="t-card">
                <ErrorState what="Notifications" reference={error.digest ?? null} />
            </div>
        </CreatorShell>
    );
}
