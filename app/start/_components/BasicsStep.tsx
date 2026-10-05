"use client";

import dynamic from "next/dynamic";
import { LocateFixed } from "lucide-react";

import { Button, Card, Field, Icon, Input, PhoneInput, Select, Status } from "@/components/r1";
import { BUSINESS_TYPES } from "@/lib/prospectPrefill";

import type { StartBasics } from "../draft";
import { OptionalMark, StepHeader } from "./frame";

export type BasicsErrors = Partial<Record<keyof StartBasics, string>>;
export type GeoStatus = "idle" | "asking" | "denied";
type Coordinates = { lat: number; lng: number };

/**
 * The desktop map picker, loaded with `ssr: false`, because Leaflet reaches for
 * `window` the moment it is imported. The component ALSO defers
 * `import("leaflet")` into its own effect, which is belt and braces on purpose:
 * the one thing worse than two guards here is none.
 *
 * It is referenced only inside `isDesktop`, so a phone never pays for the
 * chunk: the import is what pulls it, and on a phone the import never runs.
 */
const MapPicker = dynamic(() => import("../MapPicker"), {
    ssr: false,
    // Renders in place of <MapPicker/>, the same height as its map, so nothing
    // jumps the moment it loads.
    loading: () => (
        <div className="flex h-[264px] w-full items-center justify-center rounded-r1 border border-r1-line-2 bg-r1-fill">
            <span className="t-meta">Loading map…</span>
        </div>
    ),
});

/**
 * Step 1: business basics (Round 1, board Start, "Your business").
 *
 * One column on a phone. From `sm`, the board's two-column grid the short
 * fields pair up in; the two that carry a whole line of prose — a business
 * name, a street address — and the map keep the full width. Help sits under
 * every box, so every pair of boxes lines up whichever of them carries help.
 *
 * Inputs carry `name`s matching the StartBasics keys: autofill reads them, and
 * page.tsx finds the first field to fix by them.
 */
export function BasicsStep({
    basics,
    errors,
    onChange,
    onSubmit,
    isDesktop,
    coordinates,
    onCoordinatesChange,
    mapAddress,
    geoStatus,
    onRequestLocation,
}: {
    basics: StartBasics;
    /** Only the errors to show right now: empty until the owner tries to go on. */
    errors: BasicsErrors;
    onChange: (key: keyof StartBasics, value: string) => void;
    onSubmit: () => void;
    isDesktop: boolean;
    coordinates: Coordinates | null;
    onCoordinatesChange: (next: Coordinates | null) => void;
    mapAddress: string;
    geoStatus: GeoStatus;
    onRequestLocation: () => void;
}) {
    return (
        <>
            <StepHeader
                title="Tell us where to find you."
                sub="This is what goes on the page — the name, the address, and how customers reach you."
            />

            <form
                noValidate
                className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 sm:gap-x-6"
                onSubmit={(event) => {
                    event.preventDefault();
                    onSubmit();
                }}
            >
                <Field label="Business name" error={errors.businessName} className="sm:col-span-2">
                    <Input
                        name="businessName"
                        type="text"
                        autoComplete="organization"
                        placeholder="Aling Nena's Sari-Sari Store"
                        aria-required="true"
                        value={basics.businessName}
                        onChange={(event) => onChange("businessName", event.target.value)}
                    />
                </Field>

                <Field label="What kind of business is it?" error={errors.businessType}>
                    <Select
                        name="businessType"
                        aria-required="true"
                        value={basics.businessType}
                        onChange={(event) => onChange("businessType", event.target.value)}
                    >
                        <option value="">Choose one</option>
                        {BUSINESS_TYPES.map((type) => (
                            <option key={type} value={type}>
                                {type}
                            </option>
                        ))}
                    </Select>
                </Field>

                <Field label="Your name" error={errors.ownerName}>
                    <Input
                        name="ownerName"
                        type="text"
                        autoComplete="name"
                        placeholder="Juan Dela Cruz"
                        aria-required="true"
                        value={basics.ownerName}
                        onChange={(event) => onChange("ownerName", event.target.value)}
                    />
                </Field>

                <Field label="Mobile number" help="Digits only — the ten after +63." error={errors.ownerPhone}>
                    <div className="flex gap-2">
                        <span
                            aria-hidden="true"
                            className="inline-flex h-10 flex-none items-center rounded-r1 border border-r1-line-2 bg-r1-fill-2 px-3 text-sm text-r1-ink-2"
                        >
                            +63
                        </span>
                        {/* Ten local digits, no +63 — the shape the creator
                            funnel already stores and convex/domains.ts:53
                            already normalises. Letters and spaces are dropped
                            as they are typed. */}
                        <PhoneInput
                            name="ownerPhone"
                            autoComplete="tel-national"
                            maxLength={10}
                            placeholder="917 123 4567"
                            aria-required="true"
                            value={basics.ownerPhone}
                            onValueChange={(digits) => onChange("ownerPhone", digits)}
                        />
                    </div>
                </Field>

                <Field
                    label="Email address"
                    help="We send your finished website and the payment details here. Please double-check it."
                    error={errors.ownerEmail}
                >
                    <Input
                        name="ownerEmail"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder="juan@gmail.com"
                        aria-required="true"
                        value={basics.ownerEmail}
                        onChange={(event) => onChange("ownerEmail", event.target.value)}
                    />
                </Field>

                <Field label="Street address" error={errors.address} className="sm:col-span-2">
                    <Input
                        name="address"
                        type="text"
                        autoComplete="street-address"
                        placeholder="123 Rizal St."
                        aria-required="true"
                        value={basics.address}
                        onChange={(event) => onChange("address", event.target.value)}
                    />
                </Field>

                <Field label="City or municipality" error={errors.city}>
                    <Input
                        name="city"
                        type="text"
                        autoComplete="address-level2"
                        placeholder="Quezon City"
                        aria-required="true"
                        value={basics.city}
                        onChange={(event) => onChange("city", event.target.value)}
                    />
                </Field>

                <Field
                    label={
                        <>
                            Barangay
                            <OptionalMark />
                        </>
                    }
                >
                    <Input name="barangay" type="text" value={basics.barangay} onChange={(event) => onChange("barangay", event.target.value)} />
                </Field>

                <Field
                    label={
                        <>
                            Province
                            <OptionalMark />
                        </>
                    }
                >
                    <Input
                        name="province"
                        type="text"
                        autoComplete="address-level1"
                        value={basics.province}
                        onChange={(event) => onChange("province", event.target.value)}
                    />
                </Field>

                <Field
                    label={
                        <>
                            Postal code
                            <OptionalMark />
                        </>
                    }
                >
                    <Input
                        name="postalCode"
                        type="text"
                        inputMode="numeric"
                        autoComplete="postal-code"
                        value={basics.postalCode}
                        onChange={(event) => onChange("postalCode", event.target.value)}
                    />
                </Field>

                <Card className="flex flex-col gap-3.5 p-5 sm:col-span-2" role="group" aria-labelledby="start-map-title">
                    <div className="flex flex-col gap-1">
                        <h2 id="start-map-title" className="text-sm font-semibold leading-5">
                            Pin your shop on the map
                            <OptionalMark />
                        </h2>
                        <p className="t-meta">
                            {isDesktop
                                ? "Worth the ten seconds — the pin you place here is the spot the map on your finished site points at."
                                : "Tap this while you're standing at the shop and the map on your site lands on the right spot."}
                        </p>
                    </div>

                    {/* A PHONE ASKS; A DESK POINTS. The geolocation button below is
                        honest on a phone — the owner is standing in the shop and the
                        handset has GPS. On a desk getCurrentPosition resolves from
                        wifi and IP, so it would report the ISP's idea of where they
                        are and tick "Location saved" over it. That pin ships to the
                        finished site and nobody checks it again, so the desk layout
                        drops the button entirely and hands over a map instead. Both
                        write the same draft.coordinates. */}
                    {isDesktop ? (
                        <MapPicker value={coordinates} onChange={onCoordinatesChange} address={mapAddress} />
                    ) : (
                        <div className="flex flex-col gap-2">
                            {coordinates ? (
                                <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-2">
                                    <Status tone="done">Location saved</Status>
                                    <Button variant="ghost" size="sm" onClick={() => onCoordinatesChange(null)}>
                                        Remove
                                    </Button>
                                </div>
                            ) : (
                                <Button onClick={onRequestLocation} disabled={geoStatus === "asking"} className="self-start">
                                    <Icon icon={LocateFixed} />
                                    {geoStatus === "asking" ? "Waiting for your phone…" : "Use my current location"}
                                </Button>
                            )}
                            {geoStatus === "denied" ? (
                                <p className="t-meta">No problem — we&apos;ll find you from the address instead.</p>
                            ) : null}
                        </div>
                    )}
                </Card>
            </form>
        </>
    );
}
