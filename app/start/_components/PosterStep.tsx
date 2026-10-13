"use client";

import { useRef } from "react";
import { Camera, Check, Download, Upload } from "lucide-react";

import { Button, Card, Icon, Status } from "@/components/r1";
import { GIVEAWAY_POSTER_PATH } from "@/lib/giveaway";
import { Spinner, StepHeader } from "./frame";

export const POSTER_PHOTO_ID = "start-poster-photo";

/** Eligibility evidence has its own upload and never occupies a site photo slot. */
export function PosterStep({ photo, busy, error, tried, onPick, onRemove }: {
    photo: string | null;
    busy: boolean;
    error: string | null;
    tried: boolean;
    onPick: (file: File) => void;
    onRemove: () => void;
}) {
    const input = useRef<HTMLInputElement>(null);
    return (
        <>
            <StepHeader
                title="Show your Off the Record poster."
                sub="Off the Record checks this photo before your free Tendso website is built."
            />
            <PhotoThatGetsApproved />
            <a href={GIVEAWAY_POSTER_PATH} download className="t-link inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold">
                <Icon icon={Download} />No poster yet? Download it (A4 PDF)
            </a>
            <Card pad className="flex flex-col gap-4" id={POSTER_PHOTO_ID}>
                <h2 className="t-h2">Your poster photo</h2>
                <input
                    ref={input} type="file" accept=".jpg,.jpeg,.png" className="sr-only"
                    tabIndex={-1} aria-hidden="true" disabled={busy}
                    onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (file) onPick(file);
                    }}
                />
                {photo ? (
                    // R2 public URLs are the same assets used by the site photos.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="Your Off the Record poster hanging in your business" className="max-h-80 w-full rounded-r1 object-contain bg-r1-fill-2" />
                ) : (
                    <div aria-hidden="true" className="flex min-h-40 items-center justify-center rounded-r1 border border-dashed border-r1-line-2 bg-r1-fill-2 text-r1-ink-3">
                        {busy ? <Spinner /> : <Icon icon={Camera} size={32} />}
                    </div>
                )}
                {error ? <p className="t-error" role="alert">{error}</p> : busy ? (
                    <p className="t-help" role="status">Uploading your poster photo…</p>
                ) : photo ? <Status tone="done">Poster photo uploaded</Status> : tried ? (
                    <p className="t-error" role="alert">Add your poster photo to continue.</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                    <Button size="lg" onClick={() => input.current?.click()} disabled={busy}>
                        <Icon icon={Upload} />{photo ? "Replace photo" : "Add poster photo"}
                    </Button>
                    {photo ? <Button variant="ghost" size="lg" onClick={onRemove} disabled={busy}>Remove</Button> : null}
                </div>
                <p className="t-meta">JPG or PNG, up to 10MB. This photo is for your application; it won&apos;t appear on your website.</p>
            </Card>
        </>
    );
}

/**
 * The two things Off the Record looks for, drawn as the shot it wants: the
 * poster on the wall with the shop's sign in frame. A rejected photo costs
 * the owner their held slot, so this is said before the upload, not after.
 */
function PhotoThatGetsApproved() {
    return (
        <section className="gw-sample" aria-labelledby="poster-sample-title">
            <h2 id="poster-sample-title" className="gw-sample-head">A photo that gets approved</h2>
            <div className="gw-sample-shot" aria-hidden="true">
                <span className="gw-sample-sign">[YOUR SHOP SIGN]</span>
                <span className="gw-sample-door" />
                <span className="gw-sample-poster">
                    <span className="is-band" />
                    <span className="is-banner">GIVEAWAY</span>
                    <span className="is-line" />
                    <span className="is-foot" />
                    <span className="is-qr" />
                </span>
                <span className="gw-sample-corner is-tl" />
                <span className="gw-sample-corner is-tr" />
                <span className="gw-sample-corner is-bl" />
                <span className="gw-sample-corner is-br" />
            </div>
            <ul className="gw-sample-checks">
                <li><span className="gw-check" aria-hidden="true"><Icon icon={Check} size={12} /></span>The OTR poster is clearly visible</li>
                <li><span className="gw-check" aria-hidden="true"><Icon icon={Check} size={12} /></span>Your sign or storefront is in the shot</li>
            </ul>
        </section>
    );
}
