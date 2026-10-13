"use client";

import dynamic from "next/dynamic";

import { Card, Field, Input, PhoneInput, Select } from "@/components/r1";
import { BUSINESS_TYPES } from "@/lib/prospectPrefill";

import type { StartBasics } from "../draft";
import { OptionalMark, StepHeader } from "./frame";

export type BasicsErrors = Partial<Record<keyof StartBasics, string>>;
type Coordinates = { lat: number; lng: number };

/** Load the interactive picker only when step 1 is shown, on every screen size. */
const MapPicker = dynamic(() => import("../MapPicker"), {
    ssr: false,
    // Reserve room for the map while its client bundle loads.
    loading: () => (
        <div className="flex h-[340px] w-full items-center justify-center rounded-r1 border border-r1-line-2 bg-r1-fill sm:h-[380px]">
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
    giveaway = false,
    coordinates,
    onCoordinatesChange,
    mapAddress,
}: {
    basics: StartBasics;
    /** Only the errors to show right now: empty until the owner tries to go on. */
    errors: BasicsErrors;
    onChange: (key: keyof StartBasics, value: string) => void;
    onSubmit: () => void;
    giveaway?: boolean;
    coordinates: Coordinates | null;
    onCoordinatesChange: (next: Coordinates | null) => void;
    mapAddress: string;
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
                    help={giveaway
                        ? "We send your Off the Record application receipt and, if you qualify, your Tendso website link here. Please double-check it."
                        : "We send your finished website and the payment details here. Please double-check it."}
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
                        <p className="t-meta">Find your shop using nearby businesses and landmarks. Move the map until the pin points at your entrance, then choose “Use this spot”.</p>
                    </div>

                    <MapPicker value={coordinates} onChange={onCoordinatesChange} address={mapAddress} />
                </Card>
            </form>
        </>
    );
}
