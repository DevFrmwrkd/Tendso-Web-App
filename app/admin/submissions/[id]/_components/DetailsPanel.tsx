"use client";

/**
 * The submission's details (board Review: the Details panel docked beside the
 * preview; below a wide screen it opens as the 480px drawer).
 *
 * One fact per row, then the owner's photos, then folds, closed by default, for
 * everything long or technical: the owner's typed answers, the transcript, the
 * checklist, the emails the owner has had, and the custom domain. The last two
 * used to be pages of their own (/domain, /emails); those routes now land here
 * with the fold open (?fold=domain, ?fold=emails).
 *
 * Also exports the pieces the before-generation overview reuses, so the two
 * views say the same thing in the same words.
 */

import Image from "next/image";
import { useEffect, useId, useState, type ReactNode } from "react";
import { Check, ChevronDown, Download } from "lucide-react";
import { toast } from "sonner";

import { Dot, Icon, SkeletonText, Status, domainStatus, formatMoney, submissionStatus } from "@/components/r1";
import { campaignDiscountRate, campaignListPrice, isComped, normalizeCampaign } from "@/lib/pricing";
import { isHouseCreator } from "@/lib/houseCreator";

import { DomainFold } from "./DomainFold";
import { DriveFact } from "./DriveFact";
import { EmailsFold } from "./EmailsFold";
import { formatDate, type ClientEmail, type IntakeRow, type SubmissionDoc } from "./review";

export type FoldKey = "answers" | "transcript" | "checklist" | "emails" | "domain";

export const linkBtn =
    "inline-flex h-8 items-center self-start border-0 bg-transparent p-0 text-[13px] font-medium text-r1-ink underline decoration-r1-ink-4 underline-offset-[3px] hover:decoration-r1-ink disabled:cursor-not-allowed disabled:opacity-45";

// ── Small pieces ──────────────────────────────────────────────────────────

/** One fact: the label in a narrow column, the value (and its meta) beside it. */
export function Fact({ label, children }: { label: ReactNode; children: ReactNode }) {
    return (
        <div className="grid grid-cols-[92px_minmax(0,1fr)] items-start gap-3 border-b border-r1-line-3 py-2.5">
            <span className="t-label pt-0.5">{label}</span>
            <div className="flex min-w-0 flex-col gap-0.5 break-words text-sm leading-5 text-r1-ink-2">{children}</div>
        </div>
    );
}

/**
 * A fold (the kit's look and markup), but one that can open on arrival — the
 * old /domain and /emails links land on it open — and whose content mounts
 * only once it is first opened, so the custom-domain fold does not ask
 * Hostinger for the card on file every time the details open.
 */
export function DetailFold({
    foldKey,
    title,
    defaultOpen = false,
    children,
}: {
    foldKey: FoldKey;
    title: ReactNode;
    defaultOpen?: boolean;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);
    const [seen, setSeen] = useState(defaultOpen);
    const panelId = useId();
    return (
        <div className="t-fold" id={`fold-${foldKey}`}>
            <button
                type="button"
                className="t-fold-btn"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => {
                    setOpen((o) => !o);
                    setSeen(true);
                }}
            >
                {title}
                <span className="t-fold-chev">
                    <Icon icon={ChevronDown} />
                </span>
            </button>
            <div className="t-fold-in gap-3" id={panelId} hidden={!open}>
                {seen ? children : null}
            </div>
        </div>
    );
}

/** The price, said once: what the owner pays, and where that figure came from. */
export function priceFact(s: SubmissionDoc): { text: string; meta: string | null } {
    if (isComped(s)) {
        return { text: `${formatMoney(0)} · Free (promo)`, meta: ["Comped — owner pays nothing", s.compedReason].filter(Boolean).join(" · ") };
    }
    if (s.amount == null) return { text: "Not set", meta: null };
    const parts: string[] = [];
    const campaign = normalizeCampaign(s.campaign);
    if (campaign) {
        const rate = campaignDiscountRate(campaign);
        parts.push(`${campaign.toUpperCase()} campaign${rate ? ` · ${Math.round(rate * 100)}% off ${formatMoney(campaignListPrice(campaign))}` : ""}`);
    } else if (s.campaign) {
        parts.push(`${String(s.campaign).toUpperCase()} campaign`);
    }
    if (s.submissionType === "with_custom_domain") parts.push("includes a custom domain");
    if (s.paidAt) parts.push(`paid ${formatDate(s.paidAt)}`);
    else if (s.status === "paid" || s.status === "completed") parts.push("paid");
    else parts.push("paid after it’s live");
    return { text: formatMoney(s.amount), meta: parts.join(" · ") };
}

/** Who made it: a creator, or the house account for owner self-serve. */
export function creatorFact(s: SubmissionDoc, isOwnerSubmitted: boolean): { text: string; meta: string } {
    const payout = `payout ${formatMoney(s.creatorPayout ?? 0)}`;
    if (isHouseCreator(s.creator)) {
        return {
            text: "Tendso self-serve",
            meta: isOwnerSubmitted ? `Owner-submitted via /start · ${payout}` : `Self-serve account · ${payout}`,
        };
    }
    const name = [s.creator?.firstName, s.creator?.lastName].filter(Boolean).join(" ").trim();
    return {
        text: name || "Unknown creator",
        meta: [s.creator?.email, s.creator?.phone, payout].filter(Boolean).join(" · "),
    };
}

/** Where the submission came from: the campaign that priced it, the placement that sent it. */
export function cameFrom(s: SubmissionDoc): string | null {
    const parts = [s.campaign ? `${String(s.campaign).toUpperCase()} campaign` : null, s.source ? `from ${s.source}` : null].filter(Boolean);
    return parts.length ? parts.join(" · ") : null;
}

/** The owner's photos: a grid of thumbnails that open the viewer, and the zip. */
export function PhotoGrid({
    photoUrls,
    tall = false,
    onOpenPhoto,
    onDownloadMedia,
    mediaZipProgress,
    photoCount,
    enhancedCount,
}: {
    photoUrls: string[];
    tall?: boolean;
    onOpenPhoto: (index: number) => void;
    onDownloadMedia?: () => void;
    mediaZipProgress?: string | null;
    photoCount: number;
    enhancedCount: number;
}) {
    return (
        <div className="flex flex-col gap-2.5">
            {photoUrls.length === 0 ? (
                <p className="t-meta">{photoCount > 0 ? "Loading the photos…" : "No photos."}</p>
            ) : (
                <div className="grid grid-cols-3 gap-1.5">
                    {photoUrls.map((url, i) => (
                        <button
                            key={`${url}-${i}`}
                            type="button"
                            onClick={() => onOpenPhoto(i)}
                            aria-label={`Open photo ${i + 1} of ${photoUrls.length}`}
                            className={`relative block cursor-pointer overflow-hidden rounded-r1 border-0 bg-r1-fill p-0 ${tall ? "h-24" : "h-[72px]"}`}
                        >
                            <Image src={url} alt="" fill sizes="160px" className="object-cover" />
                        </button>
                    ))}
                </div>
            )}
            {onDownloadMedia && (photoCount > 0 || enhancedCount > 0) && (
                <button type="button" className={linkBtn} onClick={onDownloadMedia} disabled={!!mediaZipProgress}>
                    <Icon icon={Download} className="mr-1.5" />
                    {mediaZipProgress ||
                        `Download all (.zip) · ${photoCount} photo${photoCount === 1 ? "" : "s"} + ${enhancedCount} AI`}
                </button>
            )}
        </div>
    );
}

/** The owner's typed interview, every canonical question, answered or not. */
export function AnswersList({ rows, limit }: { rows: IntakeRow[]; limit?: number }) {
    const shown = limit ? rows.slice(0, limit) : rows;
    return (
        <ol className="m-0 flex list-none flex-col gap-3.5 p-0">
            {shown.map((row, i) => (
                <li key={row.id} className="flex flex-col gap-0.5">
                    <span className="t-label">
                        {i + 1}. {row.q}
                    </span>
                    {row.a.trim().length > 0 ? (
                        // pre-wrap keeps the owner's own line breaks; break-words
                        // stops a pasted URL or an unspaced Tagalog run blowing
                        // out the narrow panel.
                        <span className="t-body whitespace-pre-wrap break-words">{row.a}</span>
                    ) : row.optional ? (
                        <span className="t-meta">Not answered (optional)</span>
                    ) : (
                        // An unanswered OPTIONAL question is ordinary. An unanswered
                        // required one is not — /start and submitOwnerIntake both
                        // enforce it — so it gets the louder treatment.
                        <span className="flex items-center gap-2 text-[13px] font-medium leading-[18px] text-r1-gold-ink">
                            <Dot tone="attn" />
                            No answer stored
                        </span>
                    )}
                </li>
            ))}
        </ol>
    );
}

export function copyAnswers(rows: IntakeRow[]) {
    const text = rows.map((row) => `${row.q}\n${row.a.trim() || "(not answered)"}`).join("\n\n");
    void navigator.clipboard.writeText(text).then(
        () => toast.success("Answers copied"),
        () => toast.error("Could not copy the answers"),
    );
}

export function copyBusinessInfo(s: SubmissionDoc) {
    const info = [
        `Business Name: ${s.businessName}`,
        `Business Type: ${s.businessType}`,
        `Owner Name: ${s.ownerName}`,
        `Phone: ${s.ownerPhone}`,
        `Email: ${s.ownerEmail || "N/A"}`,
        `City: ${s.city}`,
        `Address: ${s.address}`,
    ].join("\n");
    void navigator.clipboard.writeText(info).then(
        () => toast.success("Business details copied"),
        () => toast.error("Could not copy the business details"),
    );
}

/** The transcript the site is written from, and the button that redoes it. */
export function TranscriptBlock({
    s,
    isOwnerSubmitted,
    transcribing,
    onRetriggerTranscription,
    clamp = false,
}: {
    s: SubmissionDoc;
    isOwnerSubmitted: boolean;
    transcribing: boolean;
    onRetriggerTranscription: () => void;
    /** Cap the height (the overview card); the fold shows it in full. */
    clamp?: boolean;
}) {
    return (
        <div className="flex flex-col gap-2">
            <p className="t-help">
                {isOwnerSubmitted
                    ? "No recording: this owner typed their answers, so the transcript is written from them."
                    : "Written by AI from the interview recording."}
            </p>
            {transcribing ? (
                <SkeletonText lines={4} />
            ) : s.transcript ? (
                <p className={`t-body whitespace-pre-wrap break-words ${clamp ? "max-h-64 overflow-y-auto" : ""}`}>{s.transcript}</p>
            ) : (
                <p className="t-meta">No transcript yet.</p>
            )}
            {s.transcriptionUpdatedAt && s.transcript && <span className="t-meta">Updated {formatDate(s.transcriptionUpdatedAt)}</span>}
            <button type="button" className={linkBtn} onClick={onRetriggerTranscription} disabled={transcribing}>
                {transcribing ? "Regenerating the transcript…" : "Regenerate the transcript"}
            </button>
        </div>
    );
}

export function ChecklistList({ items }: { items: { label: string; done: boolean }[] }) {
    return (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {items.map((item) => (
                <li key={item.label} className={`flex items-center gap-2 text-sm leading-5 ${item.done ? "text-r1-ink-2" : "text-r1-ink-3"}`}>
                    {item.done ? <Icon icon={Check} className="flex-none text-r1-ink" /> : <Dot tone="off" className="mx-1" />}
                    {item.label}
                    <span className="sr-only">{item.done ? "(done)" : "(not done)"}</span>
                </li>
            ))}
        </ul>
    );
}

export function checklistStatus(items: { done: boolean }[]) {
    const done = items.filter((i) => i.done).length;
    return { tone: done === items.length ? ("done" as const) : ("attn" as const), word: `${done} of ${items.length} done` };
}

/** The domain fact: none, or the domain and where its setup stands. */
export function DomainValue({ s }: { s: SubmissionDoc }) {
    if (!s.requestedDomain) return <span>None</span>;
    return (
        <>
            <span className="font-r1-mono text-[13px] text-r1-ink">{s.requestedDomain}</span>
            <Status {...domainStatus(s.domainStatus ?? "not_requested")} />
        </>
    );
}

// ── The panel ─────────────────────────────────────────────────────────────

export interface DetailsContentProps {
    s: SubmissionDoc;
    isOwnerSubmitted: boolean;
    photoUrls: string[];
    checklist: { label: string; done: boolean }[];
    intakeRows: IntakeRow[] | null;
    emails: ClientEmail[];
    enhancedCount: number;
    onOpenPhoto: (index: number) => void;
    onDownloadMedia: () => void;
    mediaZipProgress: string | null;
    transcribing: boolean;
    onRetriggerTranscription: () => void;
    /** A fold to open on arrival (the old /domain and /emails routes). */
    initialFold?: FoldKey | null;
}

export function DetailsContent({
    s,
    isOwnerSubmitted,
    photoUrls,
    checklist,
    intakeRows,
    emails,
    enhancedCount,
    onOpenPhoto,
    onDownloadMedia,
    mediaZipProgress,
    transcribing,
    onRetriggerTranscription,
    initialFold = null,
}: DetailsContentProps) {
    // Arriving on a fold: bring it into view once the panel has laid out.
    useEffect(() => {
        if (!initialFold) return;
        const raf = requestAnimationFrame(() => document.getElementById(`fold-${initialFold}`)?.scrollIntoView({ block: "start" }));
        return () => cancelAnimationFrame(raf);
    }, [initialFold]);

    const price = priceFact(s);
    const creator = creatorFact(s, isOwnerSubmitted);
    const from = cameFrom(s);
    const answered = intakeRows?.filter((row) => row.a.trim().length > 0).length ?? 0;
    const checklistDone = checklist.filter((c) => c.done).length;
    const photoCount = s.photos?.length ?? 0;
    // Shown once the submission is approved or has had a sync attempt — the
    // same rule the old Drive card used, so draft and pending rows stay quiet.
    const canSync = s.status === "approved" || !!s.driveSyncStatus;

    return (
        <div className="flex flex-col">
            <Fact label="Status">
                <Status {...submissionStatus(s.status, "admin")} />
                {s.status === "rejected" && s.rejectionReason && <span className="t-meta">Reason: {s.rejectionReason}</span>}
            </Fact>
            <Fact label="Price">
                <span className="t-num font-medium text-r1-ink">{price.text}</span>
                {price.meta && <span className="t-meta">{price.meta}</span>}
            </Fact>
            <Fact label="Creator">
                <span>{creator.text}</span>
                {creator.meta && <span className="t-meta">{creator.meta}</span>}
            </Fact>
            <Fact label="Owner">
                <span>{s.ownerName}</span>
                <span className="t-meta">{[s.ownerPhone, s.ownerEmail].filter(Boolean).join(" · ") || "No contact on file"}</span>
            </Fact>
            <Fact label="Business">
                <span>{[s.businessType, s.city].filter(Boolean).join(" · ")}</span>
                {s.address && <span className="t-meta">{s.address}</span>}
            </Fact>
            <Fact label="Submitted">
                <span>{formatDate(s._creationTime)}</span>
                {from && <span className="t-meta">{from}</span>}
            </Fact>
            <Fact label="Checklist">
                <Status {...checklistStatus(checklist)} />
            </Fact>
            <Fact label="Domain">
                <DomainValue s={s} />
            </Fact>
            <Fact label="Google Drive">
                <DriveFact
                    submissionId={s._id}
                    status={s.driveSyncStatus}
                    folderUrl={s.driveFolderUrl}
                    folderCreatedAt={s.driveFolderCreatedAt}
                    error={s.driveSyncError}
                    canSync={canSync}
                />
            </Fact>
            <Fact label="Emails sent">
                <span className="t-num">{emails.length}</span>
            </Fact>
            <button type="button" className={`${linkBtn} mt-2`} onClick={() => copyBusinessInfo(s)}>
                Copy business details
            </button>

            <div className="flex flex-col gap-2.5 py-4">
                <div className="flex items-center justify-between gap-2">
                    <span className="t-label">Photos</span>
                    <span className="t-count">{photoCount}</span>
                </div>
                <PhotoGrid
                    photoUrls={photoUrls}
                    onOpenPhoto={onOpenPhoto}
                    onDownloadMedia={onDownloadMedia}
                    mediaZipProgress={mediaZipProgress}
                    photoCount={photoCount}
                    enhancedCount={enhancedCount}
                />
            </div>

            <div className="t-folds">
                {/* Sits directly above the transcript because that transcript is
                    SYNTHESIZED from these answers: seeing the owner's words next
                    to the prose is the only way an admin can catch the narrative
                    builder dropping one. Gated on the DATA, never on
                    contentSource: interviewQa is unset on every creator-recorded
                    row, and any future funnel that writes real pairs gets this
                    for free. */}
                {intakeRows && (
                    <DetailFold
                        foldKey="answers"
                        defaultOpen={initialFold === "answers"}
                        title={
                            <span>
                                Owner’s answers{" "}
                                <span className="t-count">
                                    {answered} of {intakeRows.length}
                                </span>
                            </span>
                        }
                    >
                        <p className="t-help">Typed by the owner, word for word.</p>
                        <AnswersList rows={intakeRows} />
                        <button type="button" className={linkBtn} onClick={() => copyAnswers(intakeRows)}>
                            Copy the answers
                        </button>
                    </DetailFold>
                )}
                <DetailFold foldKey="transcript" defaultOpen={initialFold === "transcript"} title="Transcript">
                    <TranscriptBlock
                        s={s}
                        isOwnerSubmitted={isOwnerSubmitted}
                        transcribing={transcribing}
                        onRetriggerTranscription={onRetriggerTranscription}
                    />
                </DetailFold>
                <DetailFold
                    foldKey="checklist"
                    defaultOpen={initialFold === "checklist"}
                    title={
                        <span>
                            Checklist{" "}
                            <span className="t-count">
                                {checklistDone} of {checklist.length}
                            </span>
                        </span>
                    }
                >
                    <ChecklistList items={checklist} />
                </DetailFold>
                <DetailFold
                    foldKey="emails"
                    defaultOpen={initialFold === "emails"}
                    title={
                        <span>
                            Emails sent <span className="t-count">{emails.length}</span>
                        </span>
                    }
                >
                    <EmailsFold s={s} emails={emails} />
                </DetailFold>
                <DetailFold foldKey="domain" defaultOpen={initialFold === "domain"} title="Custom domain">
                    <DomainFold s={s} />
                </DetailFold>
            </div>
        </div>
    );
}
