"use client"

import { useQuery } from "convex/react"
import { useId, useState } from "react"

import { Loading, Skeleton, Status } from "@/components/r1"
import { api } from "@/convex/_generated/api"

import { announcementStatus, audienceLabel, fmt, recipientsText, shortDate } from "../_lib/announce"

/** Rows before "Show all" (board: three, the rest expand in place). */
const CAP = 3

/**
 * Past broadcasts, newest first: the audit trail (announcements.list, the last
 * 30). Its own component so a failure here, inside its own boundary, never
 * takes the composer with it.
 */
export default function RecentAnnouncements({ adminId }: { adminId: string }) {
    const past = useQuery(api.announcements.list, { adminId })
    const [showAll, setShowAll] = useState(false)
    const headingId = useId()

    const rows = past ?? []
    const visible = showAll ? rows : rows.slice(0, CAP)

    return (
        <section className="t-card" aria-labelledby={headingId}>
            <div className="flex flex-col gap-0.5 px-5 pb-4 pt-5">
                <h2 className="t-h2" id={headingId}>
                    Recent announcements
                </h2>
                <p className="t-meta">Each went out by email and in-app.</p>
            </div>

            {past === undefined ? (
                <Loading label="Loading recent announcements" className="border-t border-r1-line-3">
                    {Array.from({ length: CAP }, (_, i) => (
                        <div key={i} className="flex min-h-16 items-center gap-3 border-b border-r1-line-3 px-5 py-3 last:border-b-0" aria-hidden="true">
                            <span className="flex flex-1 flex-col gap-1.5">
                                <Skeleton width="70%" height={12} />
                                <Skeleton width="50%" height={10} />
                            </span>
                            <Skeleton width={48} height={12} />
                        </div>
                    ))}
                </Loading>
            ) : rows.length === 0 ? (
                <p className="t-meta border-t border-r1-line-3 px-5 py-6">Nothing sent yet. Each announcement shows up here once it goes out.</p>
            ) : (
                <div className="t-list border-t border-r1-line-3">
                    {visible.map((a) => (
                        <div key={a._id} className="flex min-h-16 items-center gap-3 border-b border-r1-line-3 px-5 py-3 last:border-b-0">
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <p className="truncate text-sm font-medium text-r1-ink">{a.title}</p>
                                <p className="t-meta">
                                    {audienceLabel(a.audience)} ·{" "}
                                    {a.status === "failed"
                                        ? `${fmt(a.emailsSent ?? 0)} of ${fmt(a.recipientCount)} delivered`
                                        : recipientsText(a.recipientCount)}{" "}
                                    · {shortDate(a.createdAt)}
                                </p>
                            </div>
                            <Status {...announcementStatus(a.status)} />
                        </div>
                    ))}
                </div>
            )}

            {rows.length > CAP && (
                <button type="button" className="t-showall" aria-expanded={showAll} onClick={() => setShowAll((s) => !s)}>
                    {showAll ? "Show fewer" : `Show all ${rows.length}`}
                </button>
            )}
        </section>
    )
}
