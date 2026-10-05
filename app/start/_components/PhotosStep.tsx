"use client";

import { useRef } from "react";
import { Camera, Plus, Upload } from "lucide-react";

import { Button, Card, EmptyState, Icon, RadioCards, Status, cx } from "@/components/r1";

import { visibleSlots, type PhotoSlot } from "../photoSlots";
import { Spinner, StepHeader } from "./frame";

/** The id of a slot's card, so page.tsx can bring the first missing one into view. */
export function slotCardId(slot: PhotoSlot): string {
    return `photo-slot-${slot.index}`;
}

/** The products question's group, for the same reason. */
export const PRODUCTS_QUESTION_ID = "start-products";

export type PhotoError = { index: number; message: string };

/**
 * Step 3: photos, by named slot (Round 1, board Start, "Photos").
 *
 * Each slot is one PHOTO_ROLES position (see photoSlots.ts), so the owner is
 * asked for the storefront, not "three photos", and nothing downstream has to
 * guess which picture is which.
 */
export function PhotosStep({
    hasProducts,
    onHasProducts,
    photos,
    uploadingIndex,
    photoError,
    tried,
    onPick,
    onRemove,
}: {
    hasProducts: boolean | null;
    onHasProducts: (value: boolean) => void;
    photos: Record<number, string>;
    uploadingIndex: number | null;
    photoError: PhotoError | null;
    /** The owner pressed Continue with something missing: say what. */
    tried: boolean;
    onPick: (slot: PhotoSlot, file: File) => void;
    onRemove: (slot: PhotoSlot) => void;
}) {
    const slots = hasProducts === null ? [] : visibleSlots(hasProducts);
    const required = slots.filter((slot) => !slot.optional);
    const haveRequired = required.filter((slot) => !!photos[slot.index]).length;
    const missingAny = haveRequired < required.length;

    return (
        <>
            <StepHeader title="Now show us the place." sub="Straight from your phone is fine. We clean them up before they go on the site." />

            {/* Asked here rather than on step 1 because it is the thing that
                decides which slots exist. Nothing in the repo has ever written
                hasProducts — convex/airtable.ts:214 guesses it from
                photos.length > 4. The owner just gets asked. */}
            <div id={PRODUCTS_QUESTION_ID} className="scroll-mt-6">
                <RadioCards
                    name="hasProducts"
                    legend={
                        <span className="flex flex-col gap-1 pb-1">
                            <span className="t-h2">Do you sell products a customer can see and pick up?</span>
                            <span className="t-meta font-normal">
                                Things on a shelf — not a service like a haircut or a repair. This decides which photos we ask for.
                            </span>
                        </span>
                    }
                    value={hasProducts === null ? null : hasProducts ? "yes" : "no"}
                    onChange={(value) => onHasProducts(value === "yes")}
                    options={[
                        { value: "yes", title: "Yes, we sell things" },
                        { value: "no", title: "No, we do a service" },
                    ]}
                    error={tried && hasProducts === null ? "Pick one first — it decides which photos we need." : undefined}
                    className="sm:max-w-[520px]"
                />
            </div>

            {hasProducts === null ? (
                <Card>
                    <EmptyState
                        icon={<Icon icon={Camera} size={20} />}
                        title="Answer the question above"
                        body="Then we show you exactly which photos to take — three every business can take, an optional one of you, and two of what you sell if you sell things."
                    />
                </Card>
            ) : (
                <section className="flex flex-col gap-3" aria-labelledby="start-photos-title">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <h2 id="start-photos-title" className="t-h2">
                            Your photos
                        </h2>
                        <Status tone={missingAny ? "attn" : "done"}>
                            {haveRequired} of {required.length} required photos added
                        </Status>
                    </div>
                    <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2">
                        {slots.map((slot) => (
                            <PhotoSlotCard
                                key={slot.role}
                                slot={slot}
                                url={photos[slot.index]}
                                busy={uploadingIndex === slot.index}
                                locked={uploadingIndex !== null}
                                missing={tried && !slot.optional && !photos[slot.index] && uploadingIndex !== slot.index}
                                error={photoError?.index === slot.index ? photoError.message : null}
                                onPick={(file) => onPick(slot, file)}
                                onRemove={() => onRemove(slot)}
                            />
                        ))}
                    </div>
                    <p className="t-meta">JPG or PNG, up to 10MB each. Landscape shots work best.</p>
                </section>
            )}
        </>
    );
}

/**
 * One named slot. The Add photo button is the control; the tile beside it is a
 * bigger target for a thumb (and, once filled, the way to swap the photo), so
 * it is left out of the accessibility tree rather than announced twice.
 */
function PhotoSlotCard({
    slot,
    url,
    busy,
    locked,
    missing,
    error,
    onPick,
    onRemove,
}: {
    slot: PhotoSlot;
    url: string | undefined;
    /** This slot is uploading. */
    busy: boolean;
    /** Some slot is uploading: one at a time, so the rest wait. */
    locked: boolean;
    missing: boolean;
    error: string | null;
    onPick: (file: File) => void;
    onRemove: () => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const open = () => {
        if (!locked) inputRef.current?.click();
    };
    const filled = !!url && !busy;

    return (
        <div id={slotCardId(slot)} className="t-card relative flex scroll-mt-6 items-start gap-4 p-3 sm:items-center">
            {/* Visually hidden rather than display:none — some phone browsers
                will not open a picker for a file input that is not rendered —
                and out of the tab order, because the Add photo button below is
                the control a keyboard and a screen reader reach. */}
            <input
                ref={inputRef}
                type="file"
                accept=".jpg,.jpeg,.png"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                disabled={locked}
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    // Reset the input so re-picking the same file after a
                    // failed upload still fires.
                    event.target.value = "";
                    if (file) onPick(file);
                }}
            />
            <div
                aria-hidden="true"
                onClick={open}
                className={cx(
                    "flex size-[72px] flex-none items-center justify-center overflow-hidden rounded-r1",
                    filled ? "bg-r1-line" : "border border-dashed border-r1-line-2 bg-r1-fill-2 text-r1-ink-3",
                    locked ? "cursor-wait" : "cursor-pointer",
                )}
            >
                {busy ? (
                    <Spinner />
                ) : url ? (
                    // R2 URLs on a host next/image is not configured for.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="" className="size-full object-cover" />
                ) : (
                    <Icon icon={Plus} size={20} />
                )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="text-sm font-semibold leading-5">
                        {slot.label}
                        {slot.optional ? <span className="ml-1.5 font-normal text-r1-ink-3">(optional)</span> : null}
                    </p>
                    <p className="t-meta">{slot.hint}</p>
                    {error ? (
                        <p className="t-error mt-0.5" role="alert">
                            {error}
                        </p>
                    ) : busy ? (
                        <p className="t-help mt-0.5">Uploading…</p>
                    ) : filled ? (
                        <Status tone="done" className="mt-0.5">
                            Uploaded
                        </Status>
                    ) : missing ? (
                        <p className="t-error mt-0.5">We need this one.</p>
                    ) : null}
                </div>
                {filled ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onRemove}
                        aria-label={`Remove photo: ${slot.label}`}
                        className="self-start sm:self-auto"
                    >
                        Remove
                    </Button>
                ) : !busy ? (
                    <Button
                        size="sm"
                        onClick={open}
                        disabled={locked}
                        aria-label={`Add photo: ${slot.label}`}
                        className="self-start max-sm:h-10 max-sm:px-4 max-sm:text-sm sm:self-auto"
                    >
                        <Icon icon={Upload} />
                        Add photo
                    </Button>
                ) : null}
            </div>
        </div>
    );
}
