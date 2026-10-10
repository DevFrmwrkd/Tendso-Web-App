"use client";

import { ErrorState } from "@/components/r1";

export default function AffiliateDashboardError({ reset }: { reset: () => void }) {
    return <div className="r1 p-6"><ErrorState what="Affiliate dashboard" onRetry={reset} /></div>;
}
