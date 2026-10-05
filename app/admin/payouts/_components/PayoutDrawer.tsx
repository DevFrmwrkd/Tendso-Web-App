"use client"

import { useQuery } from "convex/react"
import { Copy, ExternalLink, RefreshCw, Send } from "lucide-react"
import { useMemo } from "react"
import { toast } from "sonner"

import { Button, ButtonLink, DefList, DefRow, Dot, Drawer, Fold, formatMoney, Icon, Status, Timeline } from "@/components/r1"
import { api } from "@/convex/_generated/api"
import { describeStateAge } from "@/lib/payouts/fundingState"
import { wiseTransferUrl } from "@/lib/payouts/wiseLinks"

import { dateTime, displayName, drawerNote, payeeLine, rawFields, referenceOf, statusOf, stepDate, timelineOf, type Step, type Withdrawal } from "../_lib/model"
import { Boundary } from "./Boundary"

/*
 * The payout drawer (board Payouts, ComponentKit "Drawer · 480"). It is the
 * old Transaction detail modal, all of it: the creator and their email, the
 * amount and the one status, where the money goes, the reference, the
 * "Action needed" funding note, the error, the Wise transfer (open it, check
 * it now, how fresh the reading is) and the dates. The raw Wise values sit in
 * a fold, closed. The only new thing is "Tell the creator" on a failed one.
 *
 * Still read-only about money, as the old modal said in its footer: Wise and
 * its webhooks settle a payout; "Check Wise now" only reads Wise's state.
 */

/** Ruled rows like the board's fact list: a hairline between rows, none under the last. */
const RULED =
    "[&>div]:min-h-11 [&>div]:items-center [&>div]:border-b [&>div]:border-r1-line-3 [&>div]:py-2 [&>div:last-child]:border-b-0"

export function PayoutDrawer({
    row,
    now,
    checking,
    onCheck,
    onClose,
    onTell,
}: {
    row: Withdrawal | null
    now: number
    checking: boolean
    onCheck: (w: Withdrawal) => void
    onClose: () => void
    onTell: (w: Withdrawal) => void
}) {
    return (
        <Drawer
            open={row !== null}
            onClose={onClose}
            closeLabel="Close payout details"
            title={
                row ? (
                    <>
                        <span className="t-label mb-1 block">Withdrawal</span>
                        {formatMoney(row.amount)} to {displayName(row)}
                    </>
                ) : (
                    "Withdrawal"
                )
            }
            footer={
                row ? (
                    <>
                        <Button onClick={onClose}>Close</Button>
                        {/* Only a withdrawal our ledger failed: its money is back in
                            the creator's balance, which is what the message says. */}
                        {row.status === "failed" && (
                            <Button variant="primary" onClick={() => onTell(row)}>
                                <Icon icon={Send} />
                                Tell the creator
                            </Button>
                        )}
                    </>
                ) : undefined
            }
        >
            {row && <DrawerBody w={row} now={now} checking={checking} onCheck={onCheck} />}
        </Drawer>
    )
}

function DrawerBody({ w, now, checking, onCheck }: { w: Withdrawal; now: number; checking: boolean; onCheck: (w: Withdrawal) => void }) {
    const status = statusOf(w)
    const note = drawerNote(w)
    const ref = referenceOf(w)
    const age = describeStateAge(w, now)

    const copyRef = async () => {
        if (!ref) return
        try {
            await navigator.clipboard.writeText(ref)
            toast.success(`Reference copied: ${ref}`)
        } catch {
            toast.error("Could not copy the reference. Select it and copy it by hand.")
        }
    }

    return (
        <>
            <div className="flex flex-col gap-3">
                <div className="flex items-end justify-between gap-4">
                    <span className="t-figure">{formatMoney(w.amount)}</span>
                    <Status {...status} className="text-[14px]" />
                </div>
                <p className="t-note flex items-start gap-2.5 text-[13px] leading-[18px]">
                    <Dot tone={note.tone} className="mt-[5px]" />
                    <span className="min-w-0">{note.text}</span>
                </p>
                {/* For ANY row with a transfer, not only one waiting for funding:
                    checking whether an in-flight payout has landed is the other
                    half of the job. */}
                {w.wiseTransferId && (
                    <div className="flex flex-wrap items-center gap-2">
                        <ButtonLink size="sm" href={wiseTransferUrl(w.wiseTransferId)} target="_blank" rel="noopener noreferrer">
                            Open in Wise
                            <Icon icon={ExternalLink} />
                        </ButtonLink>
                        <Button size="sm" onClick={() => onCheck(w)} disabled={checking} aria-busy={checking}>
                            <Icon icon={RefreshCw} className={checking ? "motion-safe:animate-spin" : undefined} />
                            {checking ? "Checking…" : "Check Wise now"}
                        </Button>
                        {/* The reading is only as fresh as the last check; without
                            saying so, an admin who just funded a transfer reads an
                            unchanged state as a failed payment. */}
                        <span className="t-meta">
                            {age.charAt(0).toUpperCase() + age.slice(1)}
                            {w.status === "processing" ? " · re-checked hourly" : ""}
                        </span>
                    </div>
                )}
            </div>

            <DefList className={RULED}>
                <DefRow term="Creator">
                    <span className="flex flex-col items-end">
                        <span>{displayName(w)}</span>
                        {w.creatorEmail && <span className="t-meta">{w.creatorEmail}</span>}
                    </span>
                </DefRow>
                <DefRow term="Paid to">{payeeLine(w)}</DefRow>
                <DefRow term="Reference">
                    {ref ? (
                        <span className="inline-flex items-center gap-1">
                            <span className="t-mono break-all text-r1-ink">{ref}</span>
                            <Button variant="ghost" size="sm" icon aria-label="Copy reference" onClick={copyRef}>
                                <Icon icon={Copy} />
                            </Button>
                        </span>
                    ) : (
                        "—"
                    )}
                </DefRow>
                <DefRow term="Requested">{dateTime(w.createdAt)}</DefRow>
                {/* Written by a manual intervention (adminRetry). */}
                {w.adminNotes && <DefRow term="Admin note">{w.adminNotes}</DefRow>}
            </DefList>

            <section className="flex flex-col gap-2" aria-label="Timeline">
                <h3 className="t-h2 text-[14px]">Timeline</h3>
                {/* The audit log adds when Wise got the transfer and any manual
                    override. If it will not load, the row's own dates still do. */}
                <Boundary what="Timeline" fallback={<Steps steps={timelineOf(w)} now={now} />}>
                    <AuditedSteps w={w} now={now} />
                </Boundary>
            </section>

            <Fold title="Raw Wise fields">
                <DefList className={RULED}>
                    {rawFields(w, now).map((f) => (
                        <DefRow key={f.k} term={f.k}>
                            <span className="t-mono break-all text-r1-ink">{f.v}</span>
                        </DefRow>
                    ))}
                </DefList>
                <p className="t-meta pt-2">Read-only: Wise and its webhooks settle this payout. Check Wise now only reads Wise’s state.</p>
            </Fold>
        </>
    )
}

function AuditedSteps({ w, now }: { w: Withdrawal; now: number }) {
    const audit = useQuery(api.auditLogs.getByTarget, { targetType: "withdrawal", targetId: w._id })
    const steps = useMemo(() => timelineOf(w, audit), [w, audit])
    return <Steps steps={steps} now={now} />
}

function Steps({ steps, now }: { steps: Step[]; now: number }) {
    return (
        <Timeline
            // Two-line steps: the dot sits on the first line, not between them.
            className="[&>li]:items-start [&>li]:py-1 [&>li>.t-dot]:mt-1.5"
            items={steps.map((s) => ({
                tone: s.tone,
                label: (
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="t-body text-r1-ink">{s.label}</span>
                        {s.sub && <span className="t-meta break-words">{s.sub}</span>}
                    </span>
                ),
                date: s.at ? stepDate(s.at, now) : undefined,
            }))}
        />
    )
}
