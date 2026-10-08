"use client";

import { useRef } from "react";
import { Camera, Upload } from "lucide-react";

import { Button, Card, Icon, Status } from "@/components/r1";
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
                title="Show us your poster."
                sub="Take a photo of the poster on your wall, with your storefront or sign in the shot. Hang it where your customers will see it."
            />
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
                    <img src={photo} alt="Your poster hanging in your business" className="max-h-80 w-full rounded-r1 object-contain bg-r1-fill-2" />
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
