"use client";

/**
 * /start — the owner-intake funnel. ONE public route, four client-side steps.
 *
 * The person on the other end of this page is a Filipino shop owner on a phone,
 * on mobile data, typing Taglish with one thumb while the shop is open. Every
 * structural decision here follows from that: one thing per screen, one question
 * at a time through the interview, targets you can hit without looking, a way
 * forward always under the thumb, and — above all — nothing they type is ever
 * lost (see draft.ts).
 *
 * FOUR STEPS, ONE URL. Not four routes: a route change is a network round-trip
 * on a slow connection, and every one of them is a chance for the browser to
 * drop the form. The only navigation in the whole flow is the last one, to
 * /start/thanks, and that one is deliberate — a separate URL means a refresh
 * cannot resubmit.
 *
 * ONE WRITE. `submitOwnerIntake` is called exactly once, at the end, guarded so
 * a double-tap cannot fire it twice. Everything before that is React state and
 * R2 uploads.
 *
 * WHAT THE OWNER DOES NOT GET, ON PURPOSE: no preview, no editor, no account, no
 * checkout. They see the site for the first time in the payment email, after an
 * admin has reviewed, generated, approved and published it. That is the plan.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAction, useMutation } from "convex/react";
import { ConvexError } from "convex/values";

import { api } from "@/convex/_generated/api";
import { BUSINESS_TYPES } from "@/lib/prospectPrefill";
import { INTAKE_QUESTIONS, meetsAnswerMinimum } from "@/lib/narrativeFromQa";
import {
    BASE_PRICE,
    CUSTOM_DOMAIN_ADDON,
    campaignSellPrice,
    formatPHP,
    normalizeCampaign,
    ownerTotal,
} from "@/lib/pricing";
import { campaignFromLocation, readCampaign, rememberCampaign } from "@/lib/campaign";

import {
    clearDraft,
    loadDraft,
    rememberSubmittedEmail,
    saveDraft,
    TOTAL_STEPS,
    type StartBasics,
    type StartDraft,
} from "./draft";
import {
    buildPhotoArray,
    requiredSlotsFilled,
    validatePhotoFile,
    visibleSlots,
    type PhotoSlot,
} from "./photoSlots";
import {
    ActionBar,
    Field,
    GhostButton,
    INPUT_CLASS,
    Notice,
    PrimaryButton,
    ProgressHeader,
    SELECT_CLASS,
    Spinner,
    StepRail,
    StepTitle,
    TEXTAREA_CLASS,
} from "./ui";
import { useIsDesktop } from "./useIsDesktop";

/** The same expression convex/ownerIntake.ts re-checks against. Kept identical
 *  on purpose: an address that passes here and fails there is a dead end the
 *  owner cannot debug. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mirrors DOMAIN_PATTERN in convex/ownerIntake.ts, for the same reason
 *  EMAIL_PATTERN is mirrored: this one is checked at the very last tap of a
 *  ten-minute form, and a value that passes here but fails there is a dead end
 *  the owner cannot debug. */
const DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z]{2,24})+$/;

/** The same rejections normalizeRequestedDomain makes, in the same order and on
 *  the same grounds, so nothing that passes here is turned away by the mutation.
 *  Availability is NOT checked — see the note on that function; what the owner
 *  types is a request our team confirms before anyone is asked to pay. */
function validateDomain(raw: string): string | undefined {
    const domain = raw.trim().toLowerCase();
    if (!domain) return "Type the address you'd like — for example alingnena.com";
    if (domain.length > 253) return "That web address is too long.";
    if (domain.includes("/")) return "Just the address itself — no https:// and no slashes.";
    if (domain.startsWith("www.")) return 'Leave the "www." off — we set that up for you.';
    if (!DOMAIN_PATTERN.test(domain)) {
        // Deliberately does NOT suggest .ph: it is on BLOCKED_TLDS
        // (convex/lib/hostinger.ts) at ~$50/yr, so suggesting it here sends the
        // owner down a path that only fails after they have paid ₱1,499. The
        // mutation rejects blocked TLDs too — this is the friendlier half.
        return "Letters, numbers and dashes, ending in .com or similar — for example alingnena.com";
    }
    if (domain.split(".").some((label) => label.length > 63)) {
        return "That web address is too long — keep each part under 63 characters.";
    }
    return undefined;
}

type BasicsErrors = Partial<Record<keyof StartBasics, string>>;

function validateBasics(basics: StartBasics): BasicsErrors {
    const errors: BasicsErrors = {};
    if (!basics.businessName.trim()) errors.businessName = "We need the name that goes on the site.";
    if (!basics.businessType) errors.businessType = "Pick the closest one.";
    if (!basics.ownerName.trim()) errors.ownerName = "Who should we address?";
    // Ten local digits, no +63 — the shape the creator funnel already stores and
    // convex/domains.ts:53 already normalises.
    if (basics.ownerPhone.length !== 10) errors.ownerPhone = "Ten digits after +63, e.g. 917 123 4567.";
    // Required here, unlike the creator flow where it is labelled optional. With
    // no creator standing in the shop it is the ONLY channel back to the owner:
    // /api/send-website-email 400s without it and the 72h follow-up cron skips
    // rows that lack it.
    if (!basics.ownerEmail.trim()) errors.ownerEmail = "We send your website and the bill here.";
    else if (!EMAIL_PATTERN.test(basics.ownerEmail.trim())) errors.ownerEmail = "That address doesn't look right.";
    if (!basics.address.trim()) errors.address = "Customers need to find you.";
    if (!basics.city.trim()) errors.city = "Which city or municipality?";
    return errors;
}

function trimmedOrUndefined(value: string): string | undefined {
    const clean = value.trim();
    return clean.length > 0 ? clean : undefined;
}

/**
 * ConvexError's `data` is the only part of a server throw that crosses to the
 * browser, and every owner-fixable rejection in submitOwnerIntake throws one
 * carrying a plain sentence. Anything else is an operator problem — a missing
 * env var, a dropped connection — and must not be shown raw to a shop owner.
 */
function messageFor(error: unknown): string {
    if (error instanceof ConvexError && typeof error.data === "string") return error.data;
    return "Something went wrong on our side. Nothing you typed was lost — please try again in a moment.";
}

/**
 * The desktop map picker, loaded the way components/landing/ShowcaseSection.tsx
 * loads LiveMap: `ssr: false`, because Leaflet reaches for `window` the moment
 * it is imported. The component ALSO defers `import("leaflet")` into its own
 * effect, which is belt and braces on purpose — that is the pattern LiveMap
 * already established, and the one thing worse than two guards here is none.
 *
 * It is referenced only inside `isDesktop`, so a phone never pays for the
 * chunk: the import is what pulls it, and on a phone the import never runs.
 */
const MapPicker = dynamic(() => import("./MapPicker"), {
    ssr: false,
    // Renders in place of <MapPicker/>, which the call site has already put
    // inside its own `mt-4` wrapper — so no margin here, or the map jumps down
    // the moment it loads.
    loading: () => (
        <div className="flex h-[19rem] w-full items-center justify-center rounded-xl border border-ink/15 bg-khaki-deep">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                Loading map…
            </span>
        </div>
    ),
});

export default function StartPage() {
    const router = useRouter();
    /** The one layout difference CSS cannot make: step 2 is one question per
     *  screen on a phone and all eight at once on a desk. See useIsDesktop. */
    const isDesktop = useIsDesktop();
    const submitOwnerIntake = useMutation(api.ownerIntake.submitOwnerIntake);

    /**
     * The campaign this owner arrived under, if any.
     *
     * Read on mount, not during render: it touches the URL and localStorage. The
     * URL wins over what was remembered, so a fresh scan re-stamps the placement,
     * and a campaign that arrives in the link is remembered for anyone who leaves
     * this eight-minute form and comes back to it later.
     *
     * The price below follows from this, but it does not DECIDE the price: the
     * mutation resolves the campaign again and works the amount out itself.
     */
    const [campaign, setCampaign] = useState<string | null>(null);
    const [source, setSource] = useState<string | null>(null);
    const [codeEntry, setCodeEntry] = useState("");
    const [codeRejected, setCodeRejected] = useState(false);
    useEffect(() => {
        const fromUrl = campaignFromLocation();
        const resolved = normalizeCampaign(fromUrl.campaign);
        if (resolved) {
            rememberCampaign(resolved, fromUrl.source);
            setCampaign(resolved);
            setSource(fromUrl.source);
            return;
        }
        const remembered = readCampaign();
        if (remembered) {
            setCampaign(remembered.campaign);
            setSource(fromUrl.source ?? remembered.source);
        }
    }, []);
    // Unchanged, and called with no submissionId — the impl accepts the field
    // and ignores it (convex/r2.ts:109-142), and there is no submission yet.
    const generateUploadUrl = useAction(api.r2.generateUploadUrl);

    // null until the localStorage read lands. Rendering the form before that
    // would flash an empty first step over a saved draft.
    const [draft, setDraft] = useState<StartDraft | null>(null);
    const [showBasicsErrors, setShowBasicsErrors] = useState(false);
    const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
    const [photoError, setPhotoError] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    /** Same shape as showBasicsErrors: the domain field stays quiet until the
     *  owner tries to send, so it isn't scolding them at the first letter. */
    const [showDomainError, setShowDomainError] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [geoStatus, setGeoStatus] = useState<"idle" | "asking" | "denied">("idle");

    /** The exactly-once guard. A ref, not state: a second tap lands in the same
     *  tick as the first and would read a stale `submitting`. */
    const submittedRef = useRef(false);

    useEffect(() => {
        setDraft(loadDraft());
    }, []);

    useEffect(() => {
        if (draft) saveDraft(draft);
    }, [draft]);

    const step = draft?.step ?? 1;
    const questionIndex = draft?.questionIndex ?? 0;

    // Every step and every question is a new screen; a phone that keeps the old
    // scroll position hides the question the owner just moved to.
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "auto" });
    }, [step, questionIndex]);

    const patch = useCallback((update: (previous: StartDraft) => StartDraft) => {
        setDraft((previous) => (previous ? update(previous) : previous));
    }, []);

    const setBasic = useCallback(
        (key: keyof StartBasics, value: string) =>
            patch((previous) => ({ ...previous, basics: { ...previous.basics, [key]: value } })),
        [patch],
    );

    const goToStep = useCallback(
        (next: number) => patch((previous) => ({ ...previous, step: next })),
        [patch],
    );

    const basicsErrors = useMemo(() => (draft ? validateBasics(draft.basics) : {}), [draft]);

    /** What the desktop map writes. The same field requestLocation writes, so
     *  the two ways of answering "where is the shop" cannot diverge — and `null`
     *  is a real answer here, because the map can take a pin back. */
    const setCoordinates = useCallback(
        (next: { lat: number; lng: number } | null) =>
            patch((previous) => ({ ...previous, coordinates: next })),
        [patch],
    );


    const requestLocation = useCallback(() => {
        // Optional and unblocking. When it works, lib/astro-builder.ts:309 skips
        // a Nominatim geocode inside the 60-second build budget; when it doesn't,
        // nothing about the intake changes.
        if (typeof navigator === "undefined" || !navigator.geolocation) {
            setGeoStatus("denied");
            return;
        }
        setGeoStatus("asking");
        navigator.geolocation.getCurrentPosition(
            (position) => {
                patch((previous) => ({
                    ...previous,
                    coordinates: { lat: position.coords.latitude, lng: position.coords.longitude },
                }));
                setGeoStatus("idle");
            },
            () => setGeoStatus("denied"),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
        );
    }, [patch]);

    const handlePhotoPick = useCallback(
        async (slot: PhotoSlot, file: File) => {
            const problem = validatePhotoFile(file);
            if (problem) {
                setPhotoError(problem);
                return;
            }
            setPhotoError(null);
            setUploadingIndex(slot.index);
            try {
                // Uploaded the moment it is picked, not batched at submit: the
                // resulting URL is what goes in the draft, so a refresh three
                // photos in costs nothing. It also spreads the upload over the
                // time the owner spends on the remaining slots, which on mobile
                // data is the difference between "slow" and "stuck".
                const { uploadUrl, publicUrl } = await generateUploadUrl({
                    fileName: file.name,
                    fileType: file.type,
                    mediaType: "photo",
                });
                const response = await fetch(uploadUrl, {
                    method: "PUT",
                    headers: { "Content-Type": file.type },
                    body: file,
                });
                if (!response.ok) throw new Error(`R2 responded ${response.status}`);
                patch((previous) => ({
                    ...previous,
                    photos: { ...previous.photos, [slot.index]: publicUrl },
                }));
            } catch {
                setPhotoError(`"${slot.label}" didn't upload. Check your signal and try that one again.`);
            } finally {
                setUploadingIndex(null);
            }
        },
        [generateUploadUrl, patch],
    );

    const removePhoto = useCallback(
        (slot: PhotoSlot) =>
            patch((previous) => {
                const photos = { ...previous.photos };
                delete photos[slot.index];
                return { ...previous, photos };
            }),
        [patch],
    );

    const handleSubmit = useCallback(async () => {
        if (!draft || submittedRef.current) return;
        // Before the guard, and before anything is spent: a bad domain is the one
        // thing on this screen the owner can still get wrong, and the mutation
        // would reject it anyway.
        if (draft.wantsCustomDomain && validateDomain(draft.requestedDomain)) {
            setShowDomainError(true);
            return;
        }
        submittedRef.current = true;
        setSubmitting(true);
        setSubmitError(null);

        const { basics } = draft;
        try {
            await submitOwnerIntake({
                businessName: basics.businessName.trim(),
                businessType: basics.businessType,
                ownerName: basics.ownerName.trim(),
                ownerPhone: basics.ownerPhone,
                ownerEmail: basics.ownerEmail.trim(),
                address: basics.address.trim(),
                city: basics.city.trim(),
                province: trimmedOrUndefined(basics.province),
                barangay: trimmedOrUndefined(basics.barangay),
                postalCode: trimmedOrUndefined(basics.postalCode),
                coordinates: draft.coordinates ?? undefined,
                // Canonical display text from INTAKE_QUESTIONS, never a
                // hand-typed string — the mutation matches on it. Blank answers
                // are omitted rather than sent empty; only the last question may
                // be blank, and the testimonial block correctly hides itself.
                qa: INTAKE_QUESTIONS.map((question) => ({
                    q: question.q,
                    a: (draft.answers[question.key] ?? "").trim(),
                })).filter((pair) => pair.a.length > 0),
                photos: buildPhotoArray(draft.photos, !!draft.hasProducts),
                hasProducts: !!draft.hasProducts,
                // The tier decides `amount` server-side; the domain is sent
                // already trimmed and lower-cased, the form the mutation stores
                // and a registrar would eventually receive.
                submissionType: draft.wantsCustomDomain ? "with_custom_domain" : "standard",
                requestedDomain: draft.wantsCustomDomain
                    ? draft.requestedDomain.trim().toLowerCase()
                    : undefined,
                // A hint, not a price. The mutation resolves the campaign against
                // the ones we run and bills from that; anything else is ignored
                // and the owner pays the ordinary price.
                campaign: campaign ?? undefined,
                source: source ?? undefined,
            });

            rememberSubmittedEmail(basics.ownerEmail.trim());
            // Order matters: clear first, then leave. The draft must be gone
            // before /start/thanks can be back-navigated out of.
            clearDraft();
            router.replace("/start/thanks");
        } catch (error) {
            // A Convex mutation that throws wrote nothing — it is one
            // transaction — so releasing the guard is safe and a retry cannot
            // produce a second submission.
            submittedRef.current = false;
            setSubmitting(false);
            setSubmitError(messageFor(error));
        }
    }, [campaign, draft, router, source, submitOwnerIntake]);

    if (!draft) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-khaki text-ink">
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">Loading…</span>
            </main>
        );
    }

    const { basics, answers, photos, hasProducts, wantsCustomDomain, requestedDomain } = draft;
    const domainError = wantsCustomDomain ? validateDomain(requestedDomain) : undefined;
    /** What the payment email will ask for. Derived, never typed: lib/pricing is
     *  the same module the mutation prices the row with. */
    /** The website half, after any campaign. The domain is never discounted. */
    const sellPrice = campaignSellPrice(campaign);
    const discounted = sellPrice !== BASE_PRICE;
    const total = ownerTotal(sellPrice, wantsCustomDomain ? "with_custom_domain" : "standard");
    // loadDraft already clamps questionIndex, but the value it clamps came out of
    // localStorage — belt and braces, because every read below assumes a question
    // and a miss here is a white screen the owner cannot refresh their way out of.
    const question = INTAKE_QUESTIONS[questionIndex] ?? INTAKE_QUESTIONS[0];
    const answer = answers[question.key] ?? "";
    const answerOk = meetsAnswerMinimum(question, answer);
    /** The desktop gate for step 2, and the box to send the owner to when it is
     *  not clear. The same meetsAnswerMinimum the phone uses, run over all eight
     *  questions instead of the one on screen — so the ~2-sentence floor on the
     *  two load-bearing answers holds identically on both layouts, and neither
     *  can let through an intake submitOwnerIntake would reject.
     *
     *  `undefined` means every question clears its floor. Nothing is silently
     *  disabled on the desk layout: with eight boxes on screen the form has to
     *  say WHICH one is holding it up, so Continue stays live and jumps there. */
    const firstShortQuestion = INTAKE_QUESTIONS.find(
        (entry) => !meetsAnswerMinimum(entry, answers[entry.key] ?? ""),
    );
    const slots = visibleSlots(!!hasProducts);
    /** Only ever used to decide where the desktop map OPENS — never to place the
     *  pin. ", Philippines" is appended because Nominatim will otherwise happily
     *  match a Rizal St. on the other side of the world. Not memoised, and it
     *  does not need to be: it is a string, so an unchanged address produces an
     *  equal value and MapPicker's geocode effect does not re-run. */
    const mapAddress = (() => {
        const parts = [basics.address, basics.barangay, basics.city, basics.province]
            .map((part) => part.trim())
            .filter(Boolean);
        return parts.length > 0 ? `${parts.join(", ")}, Philippines` : "";
    })();
    const photosOk = hasProducts !== null && requiredSlotsFilled(photos, hasProducts) && uploadingIndex === null;

    const handleBack = () => {
        if (step === 1) {
            // Step 1 has nothing behind it, so Back is the exit: send the owner
            // to the pitch they came from (`/` — every entrance to this funnel
            // is on it), never to /start again, which would loop them.
            router.push("/");
            return;
        }
        if (step === 2) {
            // On the desk layout all eight questions are already on screen, so
            // there is no previous question to step back to — only step 1.
            if (!isDesktop && questionIndex > 0) {
                patch((previous) => ({ ...previous, questionIndex: previous.questionIndex - 1 }));
                return;
            }
            goToStep(1);
            return;
        }
        if (step === 3) {
            // Back into the interview lands on the LAST question on a phone,
            // where that is the one the owner just left. On a desk the whole
            // list comes back at once, so the index means nothing — but it is
            // still reset, so a window dragged narrow mid-form reopens on the
            // last question rather than somewhere arbitrary.
            patch((previous) => ({ ...previous, step: 2, questionIndex: INTAKE_QUESTIONS.length - 1 }));
            return;
        }
        goToStep(step - 1);
    };

    const handleBasicsContinue = () => {
        if (Object.keys(basicsErrors).length > 0) {
            setShowBasicsErrors(true);
            return;
        }
        setShowBasicsErrors(false);
        goToStep(2);
    };

    const handleAnswerContinue = () => {
        if (isDesktop) {
            // Not disabled, unlike the phone button. With eight boxes on screen
            // a dead button is a puzzle; instead the press takes the owner to
            // the box that is holding it up, which already carries its own
            // "X of about 80 characters so far" line.
            if (firstShortQuestion) {
                const field = document.getElementById(`answer-${firstShortQuestion.key}`);
                field?.scrollIntoView({ behavior: "smooth", block: "center" });
                (field as HTMLTextAreaElement | null)?.focus({ preventScroll: true });
                return;
            }
            goToStep(3);
            return;
        }
        if (!answerOk) return;
        if (questionIndex < INTAKE_QUESTIONS.length - 1) {
            patch((previous) => ({ ...previous, questionIndex: previous.questionIndex + 1 }));
            return;
        }
        goToStep(3);
    };

    return (
        <div className="flex min-h-screen flex-col bg-khaki text-ink">
            <ProgressHeader
                step={step}
                totalSteps={TOTAL_STEPS}
                onBack={handleBack}
                backLabel={step === 1 ? "Back to Tendso" : "Back"}
            />

            {/* Below `lg` this pair of wrappers is inert — a flex column inside a
                flex column — and the form is exactly the phone form it was. From
                `lg` the outer one becomes the desk row (rail + content) and the
                inner one the content column that the now-unpinned action bar
                sits at the bottom of. The inner column keeps `flex-1` on both,
                so a short step still pushes the sticky phone bar to the bottom
                of the viewport. */}
            <div className="flex flex-1 flex-col lg:mx-auto lg:w-full lg:max-w-6xl lg:flex-row lg:items-start lg:gap-16 lg:px-10 lg:pt-14">
                <StepRail
                    step={step}
                    onBack={handleBack}
                    backLabel={step === 1 ? "Back to Tendso" : "Back"}
                    priceNote={
                        <>
                            We build the site first and email it to you. You only pay once it&apos;s live —{" "}
                            {formatPHP(total)} {wantsCustomDomain ? "with your own .com." : "one time."}
                        </>
                    }
                />

                <div className="flex w-full min-w-0 flex-1 flex-col">
                    <main className="mx-auto w-full max-w-xl flex-1 px-5 pb-10 pt-8 lg:mx-0 lg:max-w-2xl lg:px-0 lg:pb-0 lg:pt-0">
                {/* ── Step 1 — business basics ─────────────────────────────── */}
                {step === 1 && (
                    <>
                        <StepTitle
                            eyebrow="Your business"
                            title="Tell us where to find you."
                            lede="This is what goes on the page — the name, the address, and how customers reach you."
                        />

                        {/* One column on a phone. On a desk, a two-column grid the
                            short fields pair up in — a 672px column of full-width
                            boxes for a name, a type and a postcode is a phone form
                            stretched, not a desk form. The two fields that carry a
                            whole line of prose keep the full width via `wide`. */}
                        <form
                            className="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-5 lg:gap-y-6"
                            onSubmit={(event) => {
                                event.preventDefault();
                                handleBasicsContinue();
                            }}
                        >
                            <Field
                                wide
                                label="Business name"
                                htmlFor="businessName"
                                error={showBasicsErrors ? basicsErrors.businessName : undefined}
                            >
                                <input
                                    id="businessName"
                                    type="text"
                                    autoComplete="organization"
                                    placeholder="Aling Nena's Sari-Sari Store"
                                    className={INPUT_CLASS}
                                    value={basics.businessName}
                                    onChange={(event) => setBasic("businessName", event.target.value)}
                                />
                            </Field>

                            <Field
                                label="What kind of business is it?"
                                htmlFor="businessType"
                                error={showBasicsErrors ? basicsErrors.businessType : undefined}
                            >
                                <select
                                    id="businessType"
                                    className={SELECT_CLASS}
                                    value={basics.businessType}
                                    onChange={(event) => setBasic("businessType", event.target.value)}
                                >
                                    <option value="">Choose one</option>
                                    {BUSINESS_TYPES.map((type) => (
                                        <option key={type} value={type}>
                                            {type}
                                        </option>
                                    ))}
                                </select>
                            </Field>

                            <Field
                                label="Your name"
                                htmlFor="ownerName"
                                error={showBasicsErrors ? basicsErrors.ownerName : undefined}
                            >
                                <input
                                    id="ownerName"
                                    type="text"
                                    autoComplete="name"
                                    placeholder="Juan Dela Cruz"
                                    className={INPUT_CLASS}
                                    value={basics.ownerName}
                                    onChange={(event) => setBasic("ownerName", event.target.value)}
                                />
                            </Field>

                            <Field
                                label="Mobile number"
                                htmlFor="ownerPhone"
                                error={showBasicsErrors ? basicsErrors.ownerPhone : undefined}
                            >
                                <div className="flex gap-2">
                                    <span className="inline-flex h-14 items-center rounded-xl border border-ink/15 bg-white px-4 text-base font-medium text-ink-soft">
                                        +63
                                    </span>
                                    <input
                                        id="ownerPhone"
                                        type="tel"
                                        inputMode="numeric"
                                        autoComplete="tel-national"
                                        maxLength={10}
                                        placeholder="917 123 4567"
                                        className={INPUT_CLASS}
                                        value={basics.ownerPhone}
                                        onChange={(event) =>
                                            setBasic("ownerPhone", event.target.value.replace(/\D/g, ""))
                                        }
                                    />
                                </div>
                            </Field>

                            <Field
                                label="Email address"
                                htmlFor="ownerEmail"
                                hint="We send your finished website and the payment details here. Please double-check it."
                                error={showBasicsErrors ? basicsErrors.ownerEmail : undefined}
                            >
                                <input
                                    id="ownerEmail"
                                    type="email"
                                    inputMode="email"
                                    autoComplete="email"
                                    autoCapitalize="none"
                                    spellCheck={false}
                                    placeholder="juan@gmail.com"
                                    className={INPUT_CLASS}
                                    value={basics.ownerEmail}
                                    onChange={(event) => setBasic("ownerEmail", event.target.value)}
                                />
                            </Field>

                            <Field
                                wide
                                label="Street address"
                                htmlFor="address"
                                error={showBasicsErrors ? basicsErrors.address : undefined}
                            >
                                <input
                                    id="address"
                                    type="text"
                                    autoComplete="street-address"
                                    placeholder="123 Rizal St."
                                    className={INPUT_CLASS}
                                    value={basics.address}
                                    onChange={(event) => setBasic("address", event.target.value)}
                                />
                            </Field>

                            <Field
                                label="City or municipality"
                                htmlFor="city"
                                error={showBasicsErrors ? basicsErrors.city : undefined}
                            >
                                <input
                                    id="city"
                                    type="text"
                                    autoComplete="address-level2"
                                    placeholder="Quezon City"
                                    className={INPUT_CLASS}
                                    value={basics.city}
                                    onChange={(event) => setBasic("city", event.target.value)}
                                />
                            </Field>

                            {/* `lg:contents` dissolves this wrapper on a desk so
                                Barangay and Province become cells of the form grid
                                itself, rather than two half-width boxes squeezed
                                inside one cell of it. */}
                            <div className="grid grid-cols-2 gap-4 lg:contents">
                                <Field label="Barangay" htmlFor="barangay" optional>
                                    <input
                                        id="barangay"
                                        type="text"
                                        className={INPUT_CLASS}
                                        value={basics.barangay}
                                        onChange={(event) => setBasic("barangay", event.target.value)}
                                    />
                                </Field>
                                <Field label="Province" htmlFor="province" optional>
                                    <input
                                        id="province"
                                        type="text"
                                        autoComplete="address-level1"
                                        className={INPUT_CLASS}
                                        value={basics.province}
                                        onChange={(event) => setBasic("province", event.target.value)}
                                    />
                                </Field>
                            </div>

                            <Field label="Postal code" htmlFor="postalCode" optional>
                                <input
                                    id="postalCode"
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="postal-code"
                                    className={INPUT_CLASS}
                                    value={basics.postalCode}
                                    onChange={(event) => setBasic("postalCode", event.target.value)}
                                />
                            </Field>

                            <div className="rounded-xl border border-ink/10 bg-khaki-deep p-4 lg:col-span-2 lg:mt-1">
                                <p className="text-sm font-semibold text-ink">Pin your shop on the map</p>
                                <p className="mt-1 text-[13px] leading-snug text-ink-soft">
                                    {isDesktop
                                        ? "Optional, and worth the ten seconds — the pin you place here is the spot the map on your finished site points at."
                                        : "Optional. Tap this while you're standing at the shop and the map on your site lands on the right spot."}
                                </p>

                                {/* A PHONE ASKS; A DESK POINTS. The geolocation button
                                    below is honest on a phone — the owner is standing
                                    in the shop and the handset has GPS. On a desk
                                    getCurrentPosition resolves from wifi and IP, so it
                                    would report the ISP's idea of where they are and
                                    tick "Location saved" over it. That pin ships to the
                                    finished site and nobody checks it again, so the
                                    desk layout drops the button entirely and hands over
                                    a map instead. Both write the same
                                    draft.coordinates. */}
                                {isDesktop ? (
                                    <div className="mt-4">
                                        <MapPicker
                                            value={draft.coordinates}
                                            onChange={setCoordinates}
                                            address={mapAddress}
                                        />
                                    </div>
                                ) : (
                                    <>
                                        {draft.coordinates ? (
                                            <p className="mt-3 inline-flex items-center gap-2 text-[13px] font-semibold text-ink">
                                                <span aria-hidden style={{ color: "var(--rust)" }}>
                                                    ✓
                                                </span>
                                                Location saved
                                            </p>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={requestLocation}
                                                disabled={geoStatus === "asking"}
                                                className="mt-3 inline-flex h-11 items-center justify-center rounded-lg border border-ink/15 bg-white px-4 text-sm font-semibold text-ink transition-colors hover:border-ink/35 disabled:opacity-50"
                                            >
                                                {geoStatus === "asking"
                                                    ? "Waiting for your phone…"
                                                    : "Use my current location"}
                                            </button>
                                        )}
                                        {geoStatus === "denied" ? (
                                            <p className="mt-2 text-[13px] text-ink-soft">
                                                No problem — we&apos;ll find you from the address instead.
                                            </p>
                                        ) : null}
                                    </>
                                )}
                            </div>
                        </form>
                    </>
                )}

                {/* ── Step 2 — the interview ───────────────────────────────────
                    One question per screen on a phone, all eight at once on a
                    desk. The ONLY place the two layouts diverge structurally,
                    and the reason useIsDesktop exists at all: eight textareas
                    rendered twice would be eight duplicate ids bound to the
                    same draft keys.

                    Both paths write the same `answers` keys through the same
                    `patch`, and both gate on meetsAnswerMinimum — the phone on
                    the question in hand, the desk on all eight. Neither can let
                    through an intake submitOwnerIntake would reject. ────────── */}
                {step === 2 && isDesktop && (
                    <>
                        <StepTitle
                            eyebrow={`${INTAKE_QUESTIONS.length} questions`}
                            title="Now tell us about the place."
                            lede="Answer in your own words — Taglish is fine. Nobody sees this except us; we turn your answers into the words on your site."
                        />

                        <div className="flex flex-col gap-8">
                            {INTAKE_QUESTIONS.map((entry, index) => {
                                const value = answers[entry.key] ?? "";
                                const ok = meetsAnswerMinimum(entry, value);
                                return (
                                    <div key={entry.key} className="flex flex-col gap-2">
                                        <label
                                            htmlFor={`answer-${entry.key}`}
                                            className="flex gap-3 text-base font-semibold text-ink"
                                        >
                                            <span
                                                aria-hidden
                                                className="mt-0.5 font-mono text-[11px] font-semibold text-ink-soft/60"
                                            >
                                                {String(index + 1).padStart(2, "0")}
                                            </span>
                                            <span>{entry.q}</span>
                                        </label>
                                        <p className="ml-[1.9rem] text-[13px] leading-snug text-ink-soft">
                                            {entry.hint}
                                        </p>
                                        <div className="ml-[1.9rem]">
                                            <textarea
                                                id={`answer-${entry.key}`}
                                                className={TEXTAREA_CLASS}
                                                placeholder="Type it the way you'd say it out loud."
                                                value={value}
                                                onChange={(event) =>
                                                    patch((previous) => ({
                                                        ...previous,
                                                        answers: {
                                                            ...previous.answers,
                                                            [entry.key]: event.target.value,
                                                        },
                                                    }))
                                                }
                                            />
                                            {/* The same two sentences the phone shows,
                                                per box — a counter has to sit beside
                                                the field it is counting when eight of
                                                them are on screen at once. */}
                                            {!ok && entry.minChars ? (
                                                <p className="mt-2 text-[13px] leading-snug text-ink-soft">
                                                    A couple of sentences, please — {value.trim().length} of
                                                    about {entry.minChars} characters so far.
                                                </p>
                                            ) : null}
                                            {!ok && !entry.minChars ? (
                                                <p className="mt-2 text-[13px] leading-snug text-ink-soft">
                                                    One line is enough — we just can&apos;t leave this one
                                                    blank.
                                                </p>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                {step === 2 && !isDesktop && (
                    <>
                        <StepTitle
                            eyebrow={`Question ${questionIndex + 1} of ${INTAKE_QUESTIONS.length}`}
                            title={question.q}
                            lede={question.hint}
                        />

                        <textarea
                            id={`answer-${question.key}`}
                            className={TEXTAREA_CLASS}
                            placeholder="Type it the way you'd say it out loud."
                            value={answer}
                            onChange={(event) =>
                                patch((previous) => ({
                                    ...previous,
                                    answers: { ...previous.answers, [question.key]: event.target.value },
                                }))
                            }
                        />

                        {/* The ~2-sentence floor on the two load-bearing answers is
                            the entire quality mechanism on this funnel — everything
                            the site says about the business is written from them.
                            The mutation re-checks with the same function. */}
                        {!answerOk && question.minChars ? (
                            <p className="mt-3 text-[13px] leading-snug text-ink-soft">
                                A couple of sentences, please — {answer.trim().length} of about{" "}
                                {question.minChars} characters so far.
                            </p>
                        ) : null}
                        {/* Otherwise the Next button is simply dead, with nothing
                            on screen saying why. */}
                        {!answerOk && !question.minChars ? (
                            <p className="mt-3 text-[13px] leading-snug text-ink-soft">
                                One line is enough — we just can&apos;t leave this one blank.
                            </p>
                        ) : null}

                        <p className="mt-6 rounded-xl border border-ink/10 bg-khaki-deep px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
                            Taglish is fine. Nobody sees this except us — we turn your answers into the words on
                            your site.
                        </p>
                    </>
                )}

                {/* ── Step 3 — photos, by named slot ────────────────────────── */}
                {step === 3 && (
                    <>
                        <StepTitle
                            eyebrow="Photos"
                            title="Now show us the place."
                            lede="Straight from your phone is fine. We clean them up before they go on the site."
                        />

                        {/* Asked here rather than on step 1 because it is the thing
                            that decides which slots exist. Nothing in the repo has
                            ever written hasProducts — convex/airtable.ts:214 guesses
                            it from photos.length > 4. The owner just gets asked. */}
                        <div className="mb-8">
                            <p className="text-base font-semibold text-ink">
                                Do you sell products a customer can see and pick up?
                            </p>
                            <p className="mt-1 text-[13px] leading-snug text-ink-soft">
                                Things on a shelf — not a service like a haircut or a repair.
                            </p>
                            <div className="mt-4 grid grid-cols-2 gap-3 lg:max-w-md">
                                {[
                                    { value: true, label: "Yes, we sell things" },
                                    { value: false, label: "No, we do a service" },
                                ].map((option) => {
                                    const selected = hasProducts === option.value;
                                    return (
                                        <button
                                            key={option.label}
                                            type="button"
                                            onClick={() =>
                                                patch((previous) => ({ ...previous, hasProducts: option.value }))
                                            }
                                            className={`h-20 rounded-xl border px-4 text-sm font-semibold transition-colors ${
                                                selected
                                                    ? "border-rust bg-white text-ink"
                                                    : "border-ink/15 bg-white/60 text-ink-soft hover:border-ink/35"
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {hasProducts !== null && (
                            <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
                                {photoError ? (
                                    <div className="lg:col-span-2">
                                        <Notice>{photoError}</Notice>
                                    </div>
                                ) : null}

                                {slots.map((slot) => {
                                    const url = photos[slot.index];
                                    const busy = uploadingIndex === slot.index;
                                    return (
                                        <div
                                            key={slot.role}
                                            className="flex items-center gap-4 rounded-xl border border-ink/10 bg-white p-3"
                                        >
                                            <label
                                                className={`relative flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed ${
                                                    url ? "border-transparent" : "border-ink/25 bg-khaki-deep"
                                                } ${uploadingIndex === null ? "cursor-pointer" : "cursor-wait"}`}
                                            >
                                                <input
                                                    type="file"
                                                    accept=".jpg,.jpeg,.png"
                                                    className="sr-only"
                                                    disabled={uploadingIndex !== null}
                                                    onChange={(event) => {
                                                        const file = event.target.files?.[0];
                                                        // Reset the input so re-picking the same
                                                        // file after a failed upload still fires.
                                                        event.target.value = "";
                                                        if (file) void handlePhotoPick(slot, file);
                                                    }}
                                                />
                                                {busy ? (
                                                    <span className="text-ink-soft">
                                                        <Spinner />
                                                    </span>
                                                ) : url ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={url}
                                                        alt={slot.label}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <svg
                                                        className="h-6 w-6 text-ink-soft"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                        aria-hidden
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={1.8}
                                                            d="M12 5v14m-7-7h14"
                                                        />
                                                    </svg>
                                                )}
                                            </label>

                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-semibold text-ink">
                                                    {slot.label}
                                                    {slot.optional ? (
                                                        <span className="ml-1.5 font-normal text-ink-soft/70">
                                                            (optional)
                                                        </span>
                                                    ) : null}
                                                </p>
                                                <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">
                                                    {slot.hint}
                                                </p>
                                                {url ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => removePhoto(slot)}
                                                        className="mt-1.5 text-[13px] font-semibold text-ink-soft underline underline-offset-2 hover:text-ink"
                                                    >
                                                        Remove
                                                    </button>
                                                ) : null}
                                            </div>
                                        </div>
                                    );
                                })}

                                <p className="text-[13px] leading-relaxed text-ink-soft lg:col-span-2">
                                    JPG or PNG, up to 10MB each. Landscape shots work best.
                                </p>
                            </div>
                        )}
                    </>
                )}

                {/* ── Step 4 — confirm ──────────────────────────────────────── */}
                {step === 4 && (
                    <>
                        <StepTitle
                            eyebrow="Last look"
                            title="Does this all look right?"
                            lede="We build from exactly what's below. Fix anything now — after this it goes to our team."
                        />

                        {submitError ? (
                            <div className="mb-6">
                                <Notice>{submitError}</Notice>
                            </div>
                        ) : null}

                        <div className="flex flex-col gap-4">
                            <SummaryCard title="Your business" onEdit={() => goToStep(1)} disabled={submitting}>
                                <SummaryLine label="Name" value={basics.businessName} />
                                <SummaryLine label="Type" value={basics.businessType} />
                                <SummaryLine label="Owner" value={basics.ownerName} />
                                <SummaryLine label="Mobile" value={`+63 ${basics.ownerPhone}`} />
                                <SummaryLine label="Email" value={basics.ownerEmail} />
                                <SummaryLine
                                    label="Address"
                                    value={[basics.address, basics.barangay, basics.city, basics.province, basics.postalCode]
                                        .filter(Boolean)
                                        .join(", ")}
                                />
                            </SummaryCard>

                            <SummaryCard
                                title="Your answers"
                                onEdit={() => patch((previous) => ({ ...previous, step: 2, questionIndex: 0 }))}
                                disabled={submitting}
                            >
                                {INTAKE_QUESTIONS.map((entry) => {
                                    const value = (answers[entry.key] ?? "").trim();
                                    if (!value) return null;
                                    return (
                                        <div
                                            key={entry.key}
                                            className="min-w-0 border-t border-ink/10 pt-3 first:border-t-0 first:pt-0"
                                        >
                                            <p className="text-[13px] font-semibold text-ink-soft">{entry.q}</p>
                                            {/* Answers are typed by hand into a
                                                textarea, and one long unbroken
                                                run — a URL, a string of digits,
                                                a run-on with no spaces — pushed
                                                this card wider than the screen
                                                and made the whole page scroll
                                                sideways. `anywhere` breaks mid
                                                run rather than only at spaces. */}
                                            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink [overflow-wrap:anywhere]">
                                                {value}
                                            </p>
                                        </div>
                                    );
                                })}
                            </SummaryCard>

                            <SummaryCard title="Your photos" onEdit={() => goToStep(3)} disabled={submitting}>
                                <div className="flex flex-wrap gap-2">
                                    {slots.map((slot) => {
                                        const url = photos[slot.index];
                                        if (!url) return null;
                                        return (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                key={slot.role}
                                                src={url}
                                                alt={slot.label}
                                                className="h-20 w-20 rounded-lg object-cover lg:h-24 lg:w-24"
                                            />
                                        );
                                    })}
                                </div>
                            </SummaryCard>

                            {/* The tier. The ONE money decision on this form, and
                                the only reason the ₱1,499 custom-domain tier is
                                reachable for an owner at all — nothing else on
                                this path writes submissionType. Deliberately no
                                availability check: /api/check-domain needs a
                                logged-in user and there is no account here, so
                                the name typed below is a request our team
                                confirms during the review they already do. */}
                            {/* The discount, and the one way back to it.
                                Arriving from a campaign link applies it without
                                anyone typing anything — this box exists for the
                                case that breaks: a different phone, or site data
                                cleared between seeing the offer and deciding. It
                                only changes what this page SHOWS; the mutation
                                resolves the campaign again and prices the row. */}
                            <section className="rounded-xl border border-ink/10 bg-white p-5">
                                {discounted ? (
                                    <p className="text-sm font-semibold text-ink">
                                        Your {(campaign ?? "").toUpperCase()} discount is applied —{" "}
                                        {formatPHP(BASE_PRICE - sellPrice)} off your website.
                                    </p>
                                ) : (
                                    <>
                                        <label
                                            htmlFor="discount-code"
                                            className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft"
                                        >
                                            Have a discount code?
                                        </label>
                                        <div className="mt-3 flex gap-2">
                                            <input
                                                id="discount-code"
                                                value={codeEntry}
                                                onChange={(event) => {
                                                    setCodeEntry(event.target.value);
                                                    setCodeRejected(false);
                                                }}
                                                autoComplete="off"
                                                autoCapitalize="characters"
                                                spellCheck={false}
                                                placeholder="Optional"
                                                className="min-w-0 flex-1 rounded-lg border border-ink/15 px-3 py-2 text-sm uppercase"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const resolved = normalizeCampaign(codeEntry);
                                                    if (!resolved) {
                                                        setCodeRejected(true);
                                                        return;
                                                    }
                                                    rememberCampaign(resolved, source);
                                                    setCampaign(resolved);
                                                    setCodeRejected(false);
                                                }}
                                                className="rounded-lg border border-ink/15 px-4 py-2 text-sm font-semibold text-ink hover:border-ink/40"
                                            >
                                                Apply
                                            </button>
                                        </div>
                                        {codeRejected && (
                                            <p className="mt-2 text-xs text-ink-soft">
                                                That code is not one of ours. Check it and try again, or carry
                                                on — the price below is what you pay.
                                            </p>
                                        )}
                                    </>
                                )}
                            </section>

                            <section className="rounded-xl border border-ink/10 bg-white p-5">
                                <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                                    Your web address
                                </h2>
                                <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                                    Every site comes with a web address we set up for you. If you&apos;d rather have
                                    your own .com, we can register one for your shop.
                                </p>

                                <div className="mt-4 flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start">
                                    {[
                                        {
                                            value: false,
                                            title: "The address we set up",
                                            price: sellPrice,
                                            note: "Included. Nothing else to arrange, nothing to renew.",
                                        },
                                        {
                                            value: true,
                                            title: "Your own .com",
                                            price: sellPrice + CUSTOM_DOMAIN_ADDON,
                                            note: `${formatPHP(sellPrice)} for the website + ${formatPHP(
                                                CUSTOM_DOMAIN_ADDON,
                                            )} for the domain. We pay the first year; after that it's yours to renew.`,
                                        },
                                    ].map((option) => {
                                        const selected = wantsCustomDomain === option.value;
                                        return (
                                            <button
                                                key={option.title}
                                                type="button"
                                                disabled={submitting}
                                                onClick={() =>
                                                    patch((previous) => ({
                                                        ...previous,
                                                        wantsCustomDomain: option.value,
                                                    }))
                                                }
                                                className={`rounded-xl border p-4 text-left transition-colors disabled:opacity-50 ${
                                                    selected
                                                        ? "border-rust bg-white"
                                                        : "border-ink/15 bg-white/60 hover:border-ink/35"
                                                }`}
                                            >
                                                <span className="flex items-baseline justify-between gap-3">
                                                    <span
                                                        className={`text-sm font-semibold ${
                                                            selected ? "text-ink" : "text-ink-soft"
                                                        }`}
                                                    >
                                                        {option.title}
                                                    </span>
                                                    <span className="flex-shrink-0 text-base font-semibold text-ink">
                                                        {formatPHP(option.price)}
                                                    </span>
                                                </span>
                                                <span className="mt-1 block text-[13px] leading-snug text-ink-soft">
                                                    {option.note}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {wantsCustomDomain ? (
                                    <div className="mt-4">
                                        <Field
                                            label="The address you want"
                                            htmlFor="requestedDomain"
                                            hint="Just the address — no www. and no https://"
                                            error={showDomainError ? domainError : undefined}
                                        >
                                            <input
                                                id="requestedDomain"
                                                type="text"
                                                inputMode="url"
                                                autoComplete="off"
                                                autoCapitalize="none"
                                                spellCheck={false}
                                                maxLength={253}
                                                placeholder="alingnena.com"
                                                className={INPUT_CLASS}
                                                value={requestedDomain}
                                                onChange={(event) =>
                                                    patch((previous) => ({
                                                        ...previous,
                                                        requestedDomain: event.target.value,
                                                    }))
                                                }
                                            />
                                        </Field>
                                        {/* Says what we will do, not that this
                                            particular name is free — nothing on
                                            this page has checked, and the owner
                                            must not read it as a reservation. */}
                                        <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
                                            We check that it&apos;s free before we ask you for anything. If someone
                                            already owns it, we&apos;ll email you the closest ones we can get and you
                                            pick.
                                        </p>
                                    </div>
                                ) : null}
                            </section>

                            <div className="rounded-xl border border-ink/10 bg-khaki-deep p-5">
                                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                                    What happens next
                                </p>
                                <p className="mt-3 text-sm leading-relaxed text-ink">
                                    Our team builds your website and emails it to{" "}
                                    <strong className="font-semibold">{basics.ownerEmail}</strong> within 48–72
                                    hours, along with how to pay {formatPHP(total)}. Nothing to pay now, and
                                    nothing to install.
                                </p>
                                {wantsCustomDomain ? (
                                    <p className="mt-3 text-sm leading-relaxed text-ink">
                                        That bill only goes out once we&apos;ve confirmed the address you asked for
                                        is still free.
                                    </p>
                                ) : null}
                            </div>
                        </div>
                    </>
                )}
            </main>

            <ActionBar>
                {step === 1 && (
                    <PrimaryButton onClick={handleBasicsContinue}>
                        Continue <span aria-hidden>→</span>
                    </PrimaryButton>
                )}

                {step === 2 &&
                    (isDesktop ? (
                        // Deliberately never disabled — see handleAnswerContinue.
                        <PrimaryButton onClick={handleAnswerContinue}>
                            Continue <span aria-hidden>→</span>
                        </PrimaryButton>
                    ) : (
                        <PrimaryButton onClick={handleAnswerContinue} disabled={!answerOk}>
                            {question.optional && answer.trim().length === 0 ? "Skip this one" : "Next"}{" "}
                            <span aria-hidden>→</span>
                        </PrimaryButton>
                    ))}

                {step === 3 && (
                    <PrimaryButton onClick={() => goToStep(4)} disabled={!photosOk}>
                        {uploadingIndex !== null ? "Uploading…" : "Continue"} <span aria-hidden>→</span>
                    </PrimaryButton>
                )}

                {step === 4 && (
                    <>
                        <GhostButton onClick={handleBack} disabled={submitting}>
                            Back
                        </GhostButton>
                        <PrimaryButton onClick={handleSubmit} disabled={submitting}>
                            {submitting ? (
                                <>
                                    <Spinner /> Sending…
                                </>
                            ) : (
                                <>Send it in</>
                            )}
                        </PrimaryButton>
                    </>
                )}
                    </ActionBar>
                </div>
            </div>

            {/* Phone only: on the desk layout the rail already carries this link,
                and a second copy across the bottom of a 1440px page is just a
                rule under an empty band. */}
            <footer className="border-t border-ink/10 px-5 py-5 text-center lg:hidden">
                <p className="text-[13px] text-ink-soft">
                    Questions first?{" "}
                    {/* Deep-links to the explanation itself rather than the top of
                        `/`: an owner who stalls mid-form wants the answer, not the
                        pitch again. Plain anchor, like the navbar's home-anchored
                        links — the hash has to survive the navigation. */}
                    <a href="/#how-it-works" className="font-semibold text-ink underline underline-offset-2">
                        Read how it works
                    </a>
                </p>
            </footer>
        </div>
    );
}

function SummaryCard({
    title,
    onEdit,
    disabled,
    children,
}: {
    title: string;
    onEdit: () => void;
    disabled?: boolean;
    children: ReactNode;
}) {
    return (
        <section className="rounded-xl border border-ink/10 bg-white p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">{title}</h2>
                <button
                    type="button"
                    onClick={onEdit}
                    disabled={disabled}
                    className="text-[13px] font-semibold text-ink underline underline-offset-2 disabled:opacity-40"
                >
                    Edit
                </button>
            </div>
            <div className="flex flex-col gap-3">{children}</div>
        </section>
    );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
    if (!value) return null;
    return (
        <div className="flex gap-3 text-sm">
            <span className="w-20 flex-shrink-0 text-ink-soft">{label}</span>
            <span className="min-w-0 flex-1 break-words text-ink">{value}</span>
        </div>
    );
}
