"use client";

import { useMutation } from "convex/react";
import { ArrowRight, ArrowUpRight, Star, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button, ButtonLink, Icon, Status } from "@/components/r1";
import { api } from "@/convex/_generated/api";

import { readableError } from "./errors";
import { directionsUrl, formatDistance } from "./geo";
import type { MapPin, ProspectPin, SitePin } from "./types";

/**
 * What the map popover says about a pin (board LeadsMap, kit "Map pin +
 * popover"): the name and where, the facts, the status, then what to do.
 * The actions are the old InfoWindows' (claim, directions, call, open), with
 * "View detail" now opening the drawer on the list page.
 */
export function PinPopover({ pin, titleId, onClose }: { pin: MapPin; titleId: string; onClose: () => void }) {
    return (
        <>
            <div className="t-pop-head">
                <div className="flex min-w-0 flex-col gap-0.5 pt-0.5">
                    <h3 id={titleId} className="t-pop-name">
                        {pin.name}
                    </h3>
                    {pin.meta && <p className="t-meta">{pin.meta}</p>}
                </div>
                <Button variant="ghost" size="sm" icon aria-label="Close" onClick={onClose}>
                    <Icon icon={X} />
                </Button>
            </div>
            {pin.layer === "discover" ? <ProspectBody pin={pin} onDone={onClose} /> : <SiteBody pin={pin} />}
        </>
    );
}

function Away({ km }: { km: number | null }) {
    if (km == null) return null;
    return <span className="t-num">{formatDistance(km)} away</span>;
}

function ProspectBody({ pin, onDone }: { pin: ProspectPin; onDone: () => void }) {
    const claim = useMutation(api.outscraper.claimProspect);
    // P2: prospects.reserve for pool prospects (it replaced the old hint chip).
    const reserve = useMutation(api.prospects.reserve);
    const [busy, setBusy] = useState(false);

    // Claiming is informational, not exclusive: it tells the team someone is
    // on their way. Hidden once anyone holds it, as before. A fresh-search
    // row the database has not matched yet has nothing to claim.
    const canClaim = !!pin.claim && !pin.claimedBy;

    const interview = async () => {
        if (!pin.claim || busy) return;
        setBusy(true);
        try {
            if (pin.claim.kind === "prospect") {
                await reserve({ prospectId: pin.claim.id });
                toast.success("Reserved — it's yours for the next 24h.");
            } else {
                await claim({ leadId: pin.claim.id });
                toast.success("Claimed — it's yours for the next 24h.");
            }
            onDone();
        } catch (e: unknown) {
            toast.error(readableError(e) ?? (pin.claim.kind === "prospect" ? "Couldn't reserve." : "Couldn't claim."));
        } finally {
            setBusy(false);
        }
    };

    const hasRating = pin.rating != null;
    return (
        <>
            {(hasRating || pin.distanceKm != null) && (
                <p className="t-meta flex flex-wrap items-center gap-x-2 text-r1-ink-2">
                    {pin.rating != null && (
                        <span className="inline-flex items-center gap-1">
                            <Icon icon={Star} size={14} />
                            <span className="sr-only">Rating </span>
                            <span className="t-num">{pin.rating.toFixed(1)}</span>
                            {pin.reviewCount ? (
                                <span className="t-num text-r1-ink-3">
                                    ({pin.reviewCount.toLocaleString()}
                                    <span className="sr-only"> reviews</span>)
                                </span>
                            ) : null}
                        </span>
                    )}
                    {hasRating && pin.distanceKm != null && <span aria-hidden="true">·</span>}
                    <Away km={pin.distanceKm} />
                </p>
            )}
            {pin.address && pin.address !== pin.meta && <p className="t-meta line-clamp-2">{pin.address}</p>}
            {pin.status && <Status {...pin.status} />}
            {pin.claimedBy && <p className="t-meta">{pin.claimedBy.isMine ? "You claimed this one." : `Claimed by ${pin.claimedBy.displayName}.`}</p>}
            <div className="flex flex-col gap-2 pt-1">
                {canClaim && (
                    <Button variant="primary" size="sm" block disabled={busy} onClick={interview}>
                        I&apos;ll interview this
                    </Button>
                )}
                <div className="flex flex-wrap gap-2">
                    {pin.leadId && (
                        <ButtonLink size="sm" href={`/leads?lead=${encodeURIComponent(pin.leadId)}`}>
                            Open lead
                            <Icon icon={ArrowRight} />
                        </ButtonLink>
                    )}
                    <ButtonLink size="sm" variant="ghost" href={directionsUrl(pin)} target="_blank" rel="noopener noreferrer">
                        Directions
                    </ButtonLink>
                    {pin.phone && (
                        <ButtonLink size="sm" variant="ghost" href={`tel:${pin.phone.replace(/[^0-9+]/g, "")}`}>
                            Call
                        </ButtonLink>
                    )}
                </div>
            </div>
        </>
    );
}

function SiteBody({ pin }: { pin: SitePin }) {
    const by = pin.mine ? "Submitted by you" : pin.submittedBy ? `Submitted by ${pin.submittedBy}` : null;
    return (
        <>
            {(by || pin.distanceKm != null) && (
                <p className="t-meta flex flex-wrap items-center gap-x-2 text-r1-ink-2">
                    {by && <span>{by}</span>}
                    {by && pin.distanceKm != null && <span aria-hidden="true">·</span>}
                    <Away km={pin.distanceKm} />
                </p>
            )}
            {pin.address && pin.address !== pin.meta && <p className="t-meta line-clamp-2">{pin.address}</p>}
            {pin.status && (
                <div className="flex flex-col gap-1">
                    <Status {...pin.status} />
                    {pin.note && <p className="t-meta">{pin.note}</p>}
                </div>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
                {pin.mine && pin.submissionId ? (
                    // The submission opens in the drawer on My submissions.
                    <ButtonLink size="sm" href={`/submissions?open=${encodeURIComponent(pin.submissionId)}`}>
                        Open submission
                    </ButtonLink>
                ) : (
                    <>
                        {pin.websiteUrl && (
                            <ButtonLink size="sm" href={siteHref(pin.websiteUrl)} target="_blank" rel="noopener noreferrer">
                                Visit site
                                <Icon icon={ArrowUpRight} />
                            </ButtonLink>
                        )}
                        {/* The old popup's "View detail": the business in the Leads drawer. */}
                        <ButtonLink size="sm" variant="ghost" href={`/leads?lead=${encodeURIComponent(pin.leadId)}`}>
                            Open lead
                        </ButtonLink>
                    </>
                )}
                <ButtonLink size="sm" variant="ghost" href={directionsUrl(pin)} target="_blank" rel="noopener noreferrer">
                    Directions
                </ButtonLink>
            </div>
        </>
    );
}

/** A stored site URL, made absolute (a bare "shop.tendso.com" would resolve as a path on this site). */
function siteHref(url: string): string {
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
