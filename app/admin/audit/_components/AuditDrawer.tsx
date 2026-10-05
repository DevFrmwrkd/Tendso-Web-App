"use client"

import { useQuery } from "convex/react"
import { ArrowRight } from "lucide-react"
import type { ReactNode } from "react"

import { Button, ButtonLink, Drawer, Fold, Folds, Icon } from "@/components/r1"
import { api } from "@/convex/_generated/api"

import { ActorBadge } from "./ActorBadge"
import { exactTime, longWhen, rawRows, roleWord, type EventView } from "./model"

/**
 * One event in the 480 drawer (board Audit; it replaces the old detail
 * modal): who, when, the target and the note, then every stored field in a
 * Raw metadata fold, closed by default. The foot opens the thing the event
 * changed, when it still exists.
 */
export function AuditDrawer({ event, now, onClose }: { event: EventView | null; now: number; onClose: () => void }) {
    // The log stores only an id for a person; their current role comes from
    // their profile, read while their event is open.
    const clerkId = event?.actor.kind === "person" ? event.log.adminId : null
    const profile = useQuery(api.creators.getByClerkId, clerkId ? { clerkId } : "skip")

    const actor = event?.actor
    const role =
        actor === undefined
            ? null
            : actor.kind !== "person"
              ? actor.role
              : profile === undefined
                ? null
                : profile === null
                  ? "No profile found for this account"
                  : roleWord(profile.role)

    const raw = event ? rawRows(event.log) : []

    return (
        <Drawer
            open={event !== null}
            onClose={onClose}
            closeLabel="Close event"
            title={
                event && (
                    <>
                        <span className="t-label mb-1 block">{event.label}</span>
                        {event.actor.name} {event.verb} {event.target}
                        {event.tail}
                    </>
                )
            }
            footer={
                <>
                    <Button onClick={onClose}>Close</Button>
                    {event?.link && (
                        <ButtonLink variant="primary" href={event.link.href}>
                            {event.link.label}
                            <Icon icon={ArrowRight} />
                        </ButtonLink>
                    )}
                </>
            }
        >
            {event && (
                <>
                    <dl className="m-0 flex flex-col gap-5">
                        <Fact term="Who">
                            <span className="flex min-w-0 items-center gap-2.5">
                                <ActorBadge actor={event.actor} />
                                <span className="flex min-w-0 flex-col">
                                    <span className="text-[14px] font-medium leading-5 text-r1-ink">{event.actor.name}</span>
                                    {role && <span className="t-meta">{role}</span>}
                                </span>
                            </span>
                        </Fact>
                        <Fact term="When">
                            <span className="t-mono text-r1-ink">{exactTime(event.log.timestamp)}</span>
                            <span className="t-meta">{longWhen(event.log.timestamp, now)}</span>
                        </Fact>
                        <Fact term="Target">
                            <span className="t-body font-medium text-r1-ink">{event.subject}</span>
                            <span className="t-meta">{event.kind}</span>
                            <span className="t-mono break-all text-r1-ink-2">{event.log.targetId}</span>
                            {event.liveUrl && (
                                <a className="t-link t-meta break-all" href={event.liveUrl} target="_blank" rel="noopener noreferrer">
                                    {event.liveUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                                </a>
                            )}
                            {event.gone && <span className="t-meta">{event.gone}</span>}
                        </Fact>
                        {event.note && (
                            <Fact term="Note">
                                <span className="t-body">{event.note}</span>
                            </Fact>
                        )}
                    </dl>

                    <Folds key={event.id}>
                        <Fold
                            title={
                                <span className="inline-flex items-center gap-1.5">
                                    Raw metadata <span className="t-count">{raw.length}</span>
                                </span>
                            }
                        >
                            <div className="flex flex-col pb-2 pt-1">
                                {raw.map(({ k, v }) => (
                                    <div
                                        key={k}
                                        className="grid grid-cols-1 gap-1 border-b border-r1-line-3 bg-r1-fill-2 px-3 py-2 sm:grid-cols-[168px_minmax(0,1fr)] sm:gap-3"
                                    >
                                        <span className="t-mono break-all text-r1-ink-3">{k}</span>
                                        <span className="t-mono break-all text-r1-ink">{v}</span>
                                    </div>
                                ))}
                            </div>
                        </Fold>
                    </Folds>
                </>
            )}
        </Drawer>
    )
}

/** A fact: the label in a narrow column, the value (one or more lines) beside it. */
function Fact({ term, children }: { term: string; children: ReactNode }) {
    return (
        <div className="grid grid-cols-[72px_minmax(0,1fr)] items-start gap-4 sm:grid-cols-[88px_minmax(0,1fr)]">
            <dt className="t-label pt-0.5">{term}</dt>
            <dd className="m-0 flex min-w-0 flex-col gap-1">{children}</dd>
        </div>
    )
}
