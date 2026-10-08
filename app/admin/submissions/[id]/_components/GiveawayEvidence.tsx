"use client";

import Image from "next/image";
import { Card } from "@/components/r1";
import type { SubmissionDoc } from "./review";

/** Use the submitted pin when present, otherwise look up the shop's address. */
export function giveawayMapUrls(s: Pick<SubmissionDoc, "coordinates" | "address" | "city">) {
    const pin = s.coordinates;
    const hasPin = pin && Number.isFinite(pin.lat) && Number.isFinite(pin.lng)
        && Math.abs(pin.lat) <= 90 && Math.abs(pin.lng) <= 180
        && (pin.lat !== 0 || pin.lng !== 0);
    const query = hasPin ? `${pin.lat},${pin.lng}` : [s.address, s.city].filter(Boolean).join(", ").trim();
    if (!query) return null;
    const encoded = encodeURIComponent(query);
    return {
        embed: `https://www.google.com/maps?q=${encoded}&output=embed`,
        search: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
    };
}

/** Evidence for eligibility stays separate from the generated site's photo roles. */
export function GiveawayEvidence({ s, posterUrl, compact = false }: {
    s: SubmissionDoc;
    posterUrl: string | null;
    compact?: boolean;
}) {
    if (!s.giveawayApplication) return null;
    const map = giveawayMapUrls(s);
    return (
        <Card pad className="mb-4 flex min-w-0 flex-col gap-4">
            <div className="flex flex-col gap-1">
                <h2 className="t-h2">Giveaway application</h2>
                <p className="t-help">Check that customers can see the poster at this walk-in business.</p>
            </div>
            <div className={`grid min-w-0 grid-cols-1 gap-5 ${compact ? "" : "lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]"}`}>
                <div className="flex min-w-0 flex-col gap-2">
                    <h3 className="t-field-label">Poster photo</h3>
                    {posterUrl ? (
                        <a
                            href={posterUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open poster photo for ${s.businessName}`}
                            className={`relative block overflow-hidden rounded-r1 bg-r1-fill-2 ${compact ? "h-[280px]" : "h-[320px] sm:h-[400px]"}`}
                        >
                            <Image
                                src={posterUrl}
                                alt={`The giveaway poster displayed at ${s.businessName}`}
                                fill
                                sizes={compact ? "440px" : "(min-width: 1024px) 600px, 100vw"}
                                className="object-contain"
                            />
                        </a>
                    ) : (
                        <p className="t-meta rounded-r1 bg-r1-fill-2 p-5">
                            {s.giveawayPosterPhoto ? "Loading the poster photo…" : "No poster photo on file."}
                        </p>
                    )}
                    {posterUrl && <p className="t-help">Tap the photo to open the original in a new tab.</p>}
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                    <h3 className="t-field-label">Business location</h3>
                    <p className="t-body break-words">{s.address || "No street address on file."}</p>
                    {s.city && <p className="t-meta break-words">{s.city}</p>}
                    {map && (
                        <>
                            <iframe
                                title={`Map of ${s.businessName}`}
                                src={map.embed}
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                                className="h-[220px] w-full rounded-r1 border border-r1-line"
                            />
                            <a href={map.search} target="_blank" rel="noopener noreferrer" className="self-start text-[13px] font-medium text-r1-ink underline underline-offset-4">
                                Open in Google Maps
                            </a>
                        </>
                    )}
                </div>
            </div>
        </Card>
    );
}
