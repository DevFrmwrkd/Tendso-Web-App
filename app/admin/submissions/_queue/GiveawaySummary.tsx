import type { FunctionReturnType } from "convex/server"

import { Card, Skeleton } from "@/components/r1"
import type { api } from "@/convex/_generated/api"

type GiveawayReviewStatus = FunctionReturnType<typeof api.giveaway.giveawayReviewStatus>

/** These totals cover the entire giveaway, independent of queue filters. */
export function GiveawaySummary({ status, onEnabledChange, busy = false, error }: {
    status?: GiveawayReviewStatus
    onEnabledChange?: (enabled: boolean) => void
    busy?: boolean
    error?: string | null
}) {
    const availability = !status ? undefined
        : status.open ? "Open"
            : !status.enabled ? "Closed"
                : status.slotsLeft <= 0 ? "Full"
                    : status.endsAt !== undefined ? "Deadline passed" : "Closed"

    return (
        <Card pad className="mb-4" role="region" aria-label="Giveaway slots" aria-busy={status === undefined}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="t-label">Giveaway slots</h2>
                {status && <span className="t-meta t-num">{status.cap.toLocaleString("en-US")} total</span>}
            </div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-r1-line pb-4">
                <div className="flex min-w-0 flex-col gap-1">
                    <p className="t-field-label">Accept new applications</p>
                    <p className="t-meta" aria-live="polite">
                        New applications: {availability ?? "Loading…"}
                    </p>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-label="Accept giveaway applications"
                    aria-checked={status?.enabled ?? false}
                    aria-busy={busy}
                    disabled={!status || !onEnabledChange || busy}
                    onClick={() => status && onEnabledChange?.(!status.enabled)}
                    className="t-btn min-h-11 shrink-0 gap-2"
                >
                    <span aria-hidden="true" className={`flex h-5 w-9 items-center rounded-full p-0.5 ${status?.enabled ? "justify-end bg-r1-ink" : "justify-start bg-r1-line"}`}>
                        <span className="h-4 w-4 rounded-full bg-white" />
                    </span>
                    <span aria-hidden="true">{busy ? "Saving…" : status ? status.enabled ? "On" : "Off" : "Loading…"}</span>
                </button>
            </div>
            {error && <p className="t-error mb-3" role="alert">{error}</p>}
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
            <p className="t-help mt-2">Closing intake preserves held applications for review.</p>
            <p className="t-help mt-3">Review the poster and business location. Generate and check the site, choose Approve &amp; publish, then More → Give free (comp) to send it to the owner.</p>
        </Card>
    )
}
