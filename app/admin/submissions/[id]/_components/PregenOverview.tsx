"use client";

/**
 * Before the site exists (board Review, "Before generation"): everything the
 * owner or creator sent, laid out to be checked before pressing Generate.
 *
 * The one highlighted card says what to do next; the business, the owner's
 * answers and the transcript on the left; the checklist, the photos and what
 * happens after it is live on the right. One column on a phone.
 */

import { useState, type ReactNode } from "react";

import { Card, Dot, Highlight, Status } from "@/components/r1";

import {
    AnswersList,
    ChecklistList,
    DomainValue,
    PhotoGrid,
    TranscriptBlock,
    cameFrom,
    checklistStatus,
    copyAnswers,
    copyBusinessInfo,
    creatorFact,
    linkBtn,
    priceFact,
    type FoldKey,
} from "./DetailsPanel";
import { DriveFact } from "./DriveFact";
import { formatDate, type ClientEmail, type IntakeRow, type SubmissionDoc } from "./review";

/** Answers shown before "Show all". */
const ANSWERS_SHOWN = 3;

function Kv({ label, children }: { label: ReactNode; children: ReactNode }) {
    return (
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 border-b border-r1-line-3 py-2.5 text-sm leading-5 text-r1-ink-2 last:border-b-0 sm:grid-cols-[140px_minmax(0,1fr)]">
            <span className="t-label pt-0.5">{label}</span>
            <div className="flex min-w-0 flex-col gap-0.5 break-words">{children}</div>
        </div>
    );
}

export function PregenOverview({
    s,
    isOwnerSubmitted,
    notice,
    websiteError,
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
    onOpenDetails,
}: {
    s: SubmissionDoc;
    isOwnerSubmitted: boolean;
    /** What to do next, in the one highlighted card. */
    notice: { title: string; body: ReactNode } | null;
    websiteError: string | null;
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
    /** Open the details drawer at a fold (the domain and email tools live there). */
    onOpenDetails: (fold: FoldKey) => void;
}) {
    const [answersAll, setAnswersAll] = useState(false);
    const price = priceFact(s);
    const creator = creatorFact(s, isOwnerSubmitted);
    const from = cameFrom(s);
    const answered = intakeRows?.filter((row) => row.a.trim().length > 0).length ?? 0;
    const photoCount = s.photos?.length ?? 0;
    const canSync = s.status === "approved" || !!s.driveSyncStatus;

    return (
        <div className="min-h-0 flex-1 overflow-y-auto bg-r1-paper px-4 pb-12 pt-6 sm:px-6 lg:px-12 lg:pt-8">
            <div className="mx-auto flex max-w-[1080px] flex-col gap-6">
                {notice && (
                    <Highlight className="flex flex-col gap-1 px-5 py-4 sm:px-6 sm:py-5">
                        <h2 className="t-h2">{notice.title}</h2>
                        <p className="t-body">{notice.body}</p>
                    </Highlight>
                )}

                {websiteError && (
                    <Card pad className="flex flex-col gap-1.5" role="alert">
                        <Status tone="bad" word="Generating the site failed" />
                        <p className="t-body break-words">{websiteError}</p>
                    </Card>
                )}

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                    <div className="flex min-w-0 flex-col gap-6">
                        <Card pad className="flex flex-col gap-2">
                            <div className="flex items-center justify-between gap-3">
                                <h2 className="t-h2">Business</h2>
                                <button type="button" className={linkBtn} onClick={() => copyBusinessInfo(s)}>
                                    Copy
                                </button>
                            </div>
                            <div className="flex flex-col">
                                <Kv label="Business">
                                    <span>{[s.businessName, s.businessType].filter(Boolean).join(" · ")}</span>
                                </Kv>
                                <Kv label="Where">
                                    <span>{s.city}</span>
                                    {s.address && <span className="t-meta">{s.address}</span>}
                                </Kv>
                                <Kv label="Owner">
                                    <span>{s.ownerName}</span>
                                    <span className="t-meta">{[s.ownerPhone, s.ownerEmail].filter(Boolean).join(" · ") || "No contact on file"}</span>
                                </Kv>
                                <Kv label="Came from">
                                    <span>{creator.text}</span>
                                    <span className="t-meta">{[creator.meta, from].filter(Boolean).join(" · ")}</span>
                                </Kv>
                                <Kv label="Price">
                                    <span className="t-num">{price.text}</span>
                                    {price.meta && <span className="t-meta">{price.meta}</span>}
                                </Kv>
                                <Kv label="Submitted">
                                    <span>{formatDate(s._creationTime)}</span>
                                </Kv>
                            </div>
                        </Card>

                        {intakeRows && (
                            <Card className="flex flex-col overflow-hidden">
                                <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-5 sm:px-6">
                                    <h2 className="t-h2">Owner’s answers</h2>
                                    <span className="t-count">
                                        {answered} of {intakeRows.length} answered
                                    </span>
                                </div>
                                <div className="flex flex-col gap-3 px-5 pb-5 pt-2 sm:px-6">
                                    <p className="t-help">Typed by the owner, word for word.</p>
                                    <AnswersList rows={intakeRows} limit={answersAll ? undefined : ANSWERS_SHOWN} />
                                    <button type="button" className={linkBtn} onClick={() => copyAnswers(intakeRows)}>
                                        Copy the answers
                                    </button>
                                </div>
                                {intakeRows.length > ANSWERS_SHOWN && (
                                    <button type="button" className="t-showall" aria-expanded={answersAll} onClick={() => setAnswersAll((v) => !v)}>
                                        {answersAll ? "Show fewer" : `Show all ${intakeRows.length} answers`}
                                    </button>
                                )}
                            </Card>
                        )}

                        <Card pad className="flex flex-col gap-2">
                            <h2 className="t-h2">Transcript</h2>
                            <TranscriptBlock
                                s={s}
                                isOwnerSubmitted={isOwnerSubmitted}
                                transcribing={transcribing}
                                onRetriggerTranscription={onRetriggerTranscription}
                                clamp
                            />
                        </Card>
                    </div>

                    <div className="flex min-w-0 flex-col gap-6">
                        <Card pad className="flex flex-col gap-3">
                            <div className="flex items-center justify-between gap-3">
                                <h2 className="t-h2">Checklist</h2>
                                <Status {...checklistStatus(checklist)} />
                            </div>
                            <ChecklistList items={checklist} />
                        </Card>

                        <Card pad className="flex flex-col gap-3">
                            <div className="flex items-center justify-between gap-3">
                                <h2 className="t-h2">Photos</h2>
                                <span className="t-count">{photoCount}</span>
                            </div>
                            <PhotoGrid
                                photoUrls={photoUrls}
                                tall
                                onOpenPhoto={onOpenPhoto}
                                onDownloadMedia={onDownloadMedia}
                                mediaZipProgress={mediaZipProgress}
                                photoCount={photoCount}
                                enhancedCount={enhancedCount}
                            />
                        </Card>

                        <Card pad className="flex flex-col gap-1">
                            <h2 className="t-h2 pb-1">After it’s live</h2>
                            <Kv label="Domain">
                                <DomainValue s={s} />
                                <button type="button" className={linkBtn} onClick={() => onOpenDetails("domain")}>
                                    {s.requestedDomain ? "Manage the domain" : "Check a domain"}
                                </button>
                            </Kv>
                            <Kv label="Emails sent">
                                <span className="t-num">{emails.length}</span>
                                {emails.length > 0 && (
                                    <button type="button" className={linkBtn} onClick={() => onOpenDetails("emails")}>
                                        See the emails
                                    </button>
                                )}
                            </Kv>
                            <Kv label="Google Drive">
                                <DriveFact
                                    submissionId={s._id}
                                    status={s.driveSyncStatus}
                                    folderUrl={s.driveFolderUrl}
                                    folderCreatedAt={s.driveFolderCreatedAt}
                                    error={s.driveSyncError}
                                    canSync={canSync}
                                />
                            </Kv>
                        </Card>

                        {s.status === "rejected" && s.rejectionReason && (
                            <p className="flex items-start gap-2 text-[13px] leading-[18px] text-r1-ink-2">
                                <Dot tone="bad" className="mt-[5px]" />
                                <span>Rejected: {s.rejectionReason}</span>
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
