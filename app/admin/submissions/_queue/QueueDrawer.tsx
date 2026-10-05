"use client"

import { ArrowRight, Check, Eye, MoreHorizontal, Trash2, X } from "lucide-react"
import type { ReactNode } from "react"

import { Avatar, Button, ButtonLink, cx, Drawer, Icon, MoreMenu, Status, type MenuItem } from "@/components/r1"

import {
    businessName,
    checklist,
    creatorGets,
    creatorName,
    daysText,
    isOwnerSubmitted,
    longDate,
    ownerPaysLine,
    ownerPaysWhen,
    placeLine,
    statusNotes,
    statusOf,
    waitingDays,
    type QueueRow,
} from "./model"

/*
 * Quick details for one row (board Queue, ComponentKit "Drawer · 480"): the
 * facts an admin needs to decide what to open next, and the checklist a
 * reviewer runs first. The work itself happens in the review workspace,
 * /admin/submissions/[id], which "Open review" goes to. Everything else (mark
 * in review, delete) sits in the foot's More menu, never red in a header.
 *
 * Everything here comes from the row the list already holds, so the drawer
 * opens instantly and has no query of its own to fail.
 */

export function QueueDrawer({
    row,
    now,
    onClose,
    onMarkInReview,
    onDelete,
}: {
    row: QueueRow | null
    now: number
    onClose: () => void
    onMarkInReview: (row: QueueRow) => void
    onDelete: (row: QueueRow) => void
}) {
    return (
        <Drawer
            open={row !== null}
            onClose={onClose}
            title={row ? businessName(row) : ""}
            meta={row ? placeLine(row) || undefined : undefined}
            footer={row ? <Foot row={row} onMarkInReview={onMarkInReview} onDelete={onDelete} /> : undefined}
        >
            {row && <Details row={row} now={now} />}
        </Drawer>
    )
}

function Foot({ row, onMarkInReview, onDelete }: { row: QueueRow; onMarkInReview: (row: QueueRow) => void; onDelete: (row: QueueRow) => void }) {
    const name = businessName(row)
    // The review page offers "Mark in review" for exactly this status, through the same mutation.
    const canMark = row.status === "submitted"
    const items: MenuItem[] = [
        ...(canMark ? [{ label: "Mark in review", icon: <Icon icon={Eye} />, onSelect: () => onMarkInReview(row) }, "divider" as const] : []),
        { label: "Delete submission", icon: <Icon icon={Trash2} />, danger: true, onSelect: () => onDelete(row) },
    ]
    return (
        <>
            {/* The foot sits at the bottom of the screen, so this menu opens upwards. */}
            <MoreMenu
                label={`More actions for ${name}`}
                align="start"
                items={items}
                className="mr-auto [&>.t-menu]:top-auto [&>.t-menu]:bottom-[calc(100%+6px)] [&>.t-menu]:w-60"
                trigger={(props) => (
                    <Button {...props}>
                        <Icon icon={MoreHorizontal} />
                        More
                    </Button>
                )}
            />
            <ButtonLink variant="primary" href={`/admin/submissions/${row._id}`}>
                Open review
                <Icon icon={ArrowRight} />
            </ButtonLink>
        </>
    )
}

/** A term and its value: the term in a 120px column on the left, the value under itself on the right. */
function Fact({ term, children, className }: { term: ReactNode; children: ReactNode; className?: string }) {
    return (
        <>
            <dt className="text-[13px] leading-5 text-r1-ink-3">{term}</dt>
            <dd className={cx("flex min-w-0 flex-col gap-0.5", className)}>{children}</dd>
        </>
    )
}

function Details({ row, now }: { row: QueueRow; now: number }) {
    const status = statusOf(row)
    const notes = statusNotes(row)
    const wait = waitingDays(row, now)
    const owner = isOwnerSubmitted(row)
    const creator = creatorName(row.creator)
    const when = ownerPaysWhen(row)
    const checks = checklist(row)
    const done = checks.filter((c) => c.done).length
    return (
        <>
            <dl className="grid grid-cols-[120px_minmax(0,1fr)] items-start gap-x-4 gap-y-3.5">
                <Fact term="Status">
                    <Status {...status} className="text-[14px] leading-5 text-r1-ink" />
                    {notes.map((n) => (
                        <span key={n.text} className={cx("t-meta pl-3.5", n.problem && "text-r1-red")}>
                            {n.text}
                        </span>
                    ))}
                </Fact>

                {/* A draft has not been sent: the date is when it was started. */}
                <Fact term={row.status === "draft" ? "Started" : "Submitted"}>
                    <span className="t-body t-num">{longDate(row._creationTime)}</span>
                    {wait !== null && <span className="t-meta">Waiting {daysText(wait)}</span>}
                </Fact>

                <Fact term="Creator" className="flex-row items-center gap-2.5">
                    <Avatar name={creator} />
                    <span className="flex min-w-0 flex-col">
                        <span className="t-body break-words text-r1-ink">{creator}</span>
                        <span className="t-meta">
                            {owner ? ((row.creatorPayout ?? 0) > 0 ? "Owner-submitted" : "Owner-submitted, no creator payout") : "Creator"}
                        </span>
                    </span>
                </Fact>

                <Fact term="Owner">
                    <span className="t-body break-words text-r1-ink">{row.ownerName.trim() || "Not given"}</span>
                    <span className="t-meta t-num">{row.ownerPhone.trim() || "Phone not captured"}</span>
                </Fact>

                <Fact term="Owner pays">
                    <span className="t-body t-num text-r1-ink">{ownerPaysLine(row)}</span>
                    {when && <span className="t-meta">{when}</span>}
                </Fact>

                <Fact term="Creator gets">
                    <span className="t-body t-num text-r1-ink">{creatorGets(row)}</span>
                </Fact>
            </dl>

            <hr className="t-divider" />

            <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-4">
                    <h3 className="t-h2">Quality checklist</h3>
                    <span className="t-meta t-num">
                        <span aria-hidden="true">
                            {done}/{checks.length}
                        </span>
                        <span className="sr-only">
                            {done} of {checks.length} done
                        </span>
                    </span>
                </div>
                <ul className="flex flex-col">
                    {checks.map((c) => (
                        <li key={c.label} className="flex h-8 items-center gap-2.5 text-[14px] text-r1-ink-2">
                            {c.done ? (
                                <Icon icon={Check} className="flex-none text-r1-ink" />
                            ) : (
                                <Icon icon={X} className="flex-none text-r1-red" />
                            )}
                            <span className="min-w-0 truncate">{c.label}</span>
                            {c.done ? (
                                <span className="sr-only">done</span>
                            ) : (
                                <span className="ml-auto flex-none text-[13px] text-r1-red">Missing</span>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        </>
    )
}
