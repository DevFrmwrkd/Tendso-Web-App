import type { FunctionReturnType } from "convex/server"

import { Card, Skeleton } from "@/components/r1"
import type { api } from "@/convex/_generated/api"

type GiveawayReviewStatus = FunctionReturnType<typeof api.giveaway.giveawayReviewStatus>

/** These totals cover the entire giveaway, independent of queue filters. */
export function GiveawaySummary({ status }: { status?: GiveawayReviewStatus }) {
    return (
        <Card pad className="mb-4" role="region" aria-label="Giveaway slots" aria-busy={status === undefined}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="t-label">Giveaway slots</h2>
                {status && <span className="t-meta t-num">{status.cap.toLocaleString("en-US")} total</span>}
            </div>
            <dl className="grid grid-cols-3 gap-3" aria-live="polite">
                {([
                    ["Held", status?.held],
                    ["Given", status?.given],
                    ["Left", status?.slotsLeft],
                ] as const).map(([label, value]) => (
                    <div key={label} className="flex min-w-0 flex-col gap-1">
                        <dt className="t-meta">{label}</dt>
                        <dd className="t-h2 t-num">
                            {value === undefined ? <Skeleton width={40} height={24} /> : value.toLocaleString("en-US")}
                        </dd>
                    </div>
                ))}
            </dl>
            <p className="t-meta mt-3">Held includes websites already given. Rejecting an application frees its slot.</p>
        </Card>
    )
}
