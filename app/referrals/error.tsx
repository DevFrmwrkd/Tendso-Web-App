"use client";

import { ErrorState, PageHeader } from "@/components/r1";
import { CreatorShell } from "@/components/shells/CreatorShell";

/**
 * Referrals failed to load: a Convex query threw while rendering (ComponentKit,
 * "Page failed to load"). Shown inside the creator frame so the sidebar still
 * works. Reload is a full reload, which re-subscribes every query; nothing was
 * changed by the failure itself. If the frame is what failed, this throws too
 * and the root app/error.tsx takes over.
 */
export default function ReferralsError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <CreatorShell>
            <PageHeader title="Referrals" sub="Who have I brought in, and what did it earn?" />
            <ErrorState what="Referrals" reference={error.digest ?? null} />
        </CreatorShell>
    );
}
