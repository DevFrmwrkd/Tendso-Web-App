"use client";

import { ErrorState, FunnelHeader, PublicPage } from "@/components/r1";

/**
 * The payment page threw (a Convex query failed). The Kit's error state, as in
 * app/error.tsx, but inside the funnel frame: someone who came from the payment
 * email keeps the wordmark and the way to Help. Reload is a full reload, which
 * is what reconnects a failed query.
 */
export default function PayError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <PublicPage header={<FunnelHeader exit={{ href: "/knowledge", label: "Questions? Help" }} />} mainClassName="items-center justify-center px-4">
            <ErrorState what="This payment page" reference={error.digest ?? null} />
        </PublicPage>
    );
}
