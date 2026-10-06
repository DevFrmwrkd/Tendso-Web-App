"use client";

import { useQuery } from "convex/react";

import { Skeleton } from "@/components/r1";
import { api } from "@/convex/_generated/api";

import { interviewKind, type Submission } from "../_lib/derive";

/*
 * The photos and the owner interview, moved here from the old
 * /submissions/[id] page with the same URL rules. They sit in folds in the
 * drawer, closed by default: they are the raw material, not the status.
 */

/** The submission's photos, three to a row. Each opens full size in a new tab. */
export function PhotoGrid({ photos }: { photos: string[] }) {
    // Get resolved photo URLs (only for legacy Convex storage IDs).
    // R2 URLs start with http and don't need resolution.
    const needsResolution = photos.some((p) => p.startsWith("convex:") || !p.startsWith("http"));
    const photoUrls = useQuery(api.files.getMultipleUrls, needsResolution && photos.length ? { storageIds: photos } : "skip");

    return (
        <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0">
            {photos.map((originalUrl, index) => {
                // Use the original URL if it's an http URL (R2), otherwise the one Convex resolved.
                const resolvedUrl = originalUrl.startsWith("http") ? originalUrl : (photoUrls?.[index] ?? null);
                const displayUrl = resolvedUrl && !resolvedUrl.startsWith("convex:") ? resolvedUrl : null;
                return (
                    <li key={index} className="relative aspect-square overflow-hidden rounded-r1 border border-r1-line bg-r1-fill-2">
                        {displayUrl ? (
                            <a href={displayUrl} target="_blank" rel="noopener noreferrer" className="absolute inset-0">
                                {/* Photos live on R2 and in Convex storage, on hosts next/image is not set up for. */}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={displayUrl} alt={`Photo ${index + 1}`} loading="lazy" className="h-full w-full object-cover" />
                            </a>
                        ) : photoUrls === undefined ? (
                            <Skeleton width="100%" height="100%" className="absolute inset-0 rounded-none" />
                        ) : (
                            <span className="t-meta absolute inset-0 flex items-center justify-center p-2 text-center">Not available</span>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}

/** The recording, then the transcript written from it. */
export function Interview({ s }: { s: Submission }) {
    // Get the interview URL. Prefer R2 URLs (videoUrl/audioUrl) over Convex
    // storage IDs (legacy).
    const hasR2InterviewUrl = s.videoUrl || s.audioUrl;
    const interviewStorageId = s.videoStorageId || s.audioStorageId;
    const legacyInterviewUrl = useQuery(
        api.files.getUrlByString,
        !hasR2InterviewUrl && interviewStorageId ? { storageId: interviewStorageId.toString() } : "skip",
    );
    // Use the R2 URL if there is one, otherwise the resolved Convex URL.
    const interviewUrl = hasR2InterviewUrl ? s.videoUrl || s.audioUrl : legacyInterviewUrl;
    const kind = interviewKind(s);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <span className="t-label">{s.transcript ? "Original recording" : "Recording"}</span>
                {!kind ? (
                    <p className="t-meta">No interview uploaded.</p>
                ) : interviewUrl === undefined ? (
                    <Skeleton height={kind === "video" ? 200 : 40} />
                ) : !interviewUrl ? (
                    <p className="t-meta">The recording could not be loaded.</p>
                ) : kind === "video" ? (
                    // preload="none": the fold is closed by default, and a phone
                    // should not fetch a 30-minute video nobody pressed play on.
                    <video src={interviewUrl} controls playsInline preload="none" className="max-h-72 w-full rounded-r1 bg-r1-ink" />
                ) : (
                    <audio src={interviewUrl} controls preload="none" className="w-full" />
                )}
            </div>
            {s.transcript && (
                <div className="flex flex-col gap-2">
                    <span className="t-label">Transcript</span>
                    <div className="t-body max-h-72 overflow-y-auto whitespace-pre-wrap rounded-r1 bg-r1-fill-2 p-3">{s.transcript}</div>
                </div>
            )}
        </div>
    );
}
