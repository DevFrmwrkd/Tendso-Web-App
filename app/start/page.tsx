"use client";

/**
 * /start — the owner-intake funnel. One public route, four client-side steps,
 * plus a poster-photo step for giveaway applications.
 *
 * The person on the other end of this page is a Filipino shop owner on a phone,
 * on mobile data, typing Taglish with one thumb while the shop is open. Every
 * structural decision here follows from that: one thing per screen, one question
 * at a time through the interview, targets you can hit without looking, a way
 * forward always under the thumb, and — above all — nothing they type is ever
 * lost (see draft.ts).
 *
 * ALL STEPS, ONE URL. A route change is a network round-trip
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
 *
 * THE LOOK IS ROUND 1 (board Start): a funnel frame — the wordmark and one quiet
 * "Save and exit" — the steps in a rail on a desk and a stepper on a phone, and
 * ONE action bar pinned to the bottom at every width. The steps themselves live
 * in ./_components; this file keeps the state, the draft and every handler, so
 * the behaviour above can be read in one place.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAction, useConvex, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { ArrowRight, Send } from "lucide-react";

import { Button, ButtonLink, Card, FunnelHeader, Icon, Loading, PublicPage, Skeleton, Stepper, cx } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import { INTAKE_QUESTIONS, meetsAnswerMinimum, type IntakeQuestionKey } from "@/lib/narrativeFromQa";
import { campaignListPrice, domainAddOnFor, formatPHP, normalizeCampaign, ownerChargeFor } from "@/lib/pricing";
import { clearCampaign, intakeCampaignForPage, rememberCampaign } from "@/lib/campaign";
import { GIVEAWAY_CLOSED } from "@/lib/giveaway";

import { ActionBar } from "./_components/ActionBar";
import { BasicsStep, type BasicsErrors, type GeoStatus } from "./_components/BasicsStep";
import { CONTAINER, HEADER_ALIGN, STEP_TITLE_ID, Spinner, revealField } from "./_components/frame";
import { InterviewStep, answerFieldId } from "./_components/InterviewStep";
import { PhotosStep, PRODUCTS_QUESTION_ID, slotCardId, type PhotoError } from "./_components/PhotosStep";
import { PosterStep, POSTER_PHOTO_ID } from "./_components/PosterStep";
import { ReviewStep } from "./_components/ReviewStep";
import { GIVEAWAY_STEP_LABELS, PriceNote, SavedNote, STEP_LABELS, StepRail } from "./_components/StepRail";
import {
    clearDraft,
    loadDraft,
    rememberSubmitted,
    saveDraft,
    resolveIntakeDraft,
    GIVEAWAY_STEPS,
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
import { quoteFor } from "./quote";
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
        // owner down a path that only fails after they have paid for it. The
        // mutation rejects blocked TLDs too — this is the friendlier half.
        return "Letters, numbers and dashes, ending in .com or similar — for example alingnena.com";
    }
    if (domain.split(".").some((label) => label.length > 63)) {
        return "That web address is too long — keep each part under 63 characters.";
    }
    return undefined;
}

function validateBasics(basics: StartBasics, giveaway = false): BasicsErrors {
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
    if (!basics.ownerEmail.trim()) errors.ownerEmail = giveaway
        ? "We need an email to update you about your application."
        : "We send your website and the bill here.";
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

/** The funnel frame's header: the wordmark and one quiet exit. Everything is
 *  already saved (see draft.ts), so leaving IS "save and exit". */
const header = <FunnelHeader exit={{ href: "/", label: "Save and exit" }} className={HEADER_ALIGN} />;

export default function StartPage() {
    const router = useRouter();
    const convex = useConvex();
    /** The one layout difference CSS cannot make: step 2 is one question per
     *  screen on a phone and all eight at once on a desk. See useIsDesktop. */
    const isDesktop = useIsDesktop();
    const submitOwnerIntake = useMutation(api.ownerIntake.submitOwnerIntake);
    const giveawayStatus = useQuery(api.giveaway.giveawayStatus);

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
    const [affiliateHandle, setAffiliateHandle] = useState<string | null>(null);
    const [source, setSource] = useState<string | null>(null);
    const affiliateOffer = useQuery(api.affiliates.publicPage, affiliateHandle !== null ? { handle: affiliateHandle } : "skip");
    const affiliatePrice = affiliateHandle === null ? undefined : affiliateOffer?.price ?? null;
    const [codeEntry, setCodeEntry] = useState("");
    const [codeRejected, setCodeRejected] = useState(false);
    const [arrival, setArrival] = useState<{ offer: ReturnType<typeof intakeCampaignForPage>; saved: StartDraft } | null>(null);
    // Unchanged, and called with no submissionId — the impl accepts the field
    // and ignores it (convex/r2.ts:109-142), and there is no submission yet.
    const generateUploadUrl = useAction(api.r2.generateUploadUrl);

    // null until the localStorage read lands. Rendering the form before that
    // would flash an empty first step over a saved draft.
    const [draft, setDraft] = useState<StartDraft | null>(null);
    const [showBasicsErrors, setShowBasicsErrors] = useState(false);
    /** The board's "tried" states for the interview (desk) and the photos: each
     *  step stays quiet until the owner presses Continue with something left to
     *  do, then says what — the same shape as showBasicsErrors. */
    const [showShortAnswers, setShowShortAnswers] = useState(false);
    const [showPhotoProblems, setShowPhotoProblems] = useState(false);
    const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
    /** Shown on the slot it belongs to, not above the list. */
    const [photoError, setPhotoError] = useState<PhotoError | null>(null);
    const [posterUploading, setPosterUploading] = useState(false);
    const [posterError, setPosterError] = useState<string | null>(null);
    const [showPosterProblem, setShowPosterProblem] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [giveawayClosed, setGiveawayClosed] = useState(false);
    /** Same shape as showBasicsErrors: the domain field stays quiet until the
     *  owner tries to send, so it isn't scolding them at the first letter. */
    const [showDomainError, setShowDomainError] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
    /** The answer whose recording holds the microphone. See VoiceAnswer. */
    const [voiceBusyKey, setVoiceBusyKey] = useState<IntakeQuestionKey | null>(null);

    /** The exactly-once guard. A ref, not state: a second tap lands in the same
     *  tick as the first and would read a stale `submitting`. */
    const submittedRef = useRef(false);

    useEffect(() => {
        setArrival({ offer: intakeCampaignForPage(), saved: loadDraft() });
    }, []);

    useEffect(() => {
        if (!arrival || draft) return;
        const { offer, saved } = arrival;
        // A fresh giveaway entrance waits for the live query instead of briefly
        // promising a free site after the last slot has already been taken.
        if (offer.giveaway && !offer.fullPrice && giveawayStatus === undefined) return;
        const next = resolveIntakeDraft(saved, offer, giveawayStatus?.open === true);
        setDraft(next);
        setCampaign(next.giveawayApplication || offer.fullPrice || offer.giveaway ? null : offer.campaign);
        setAffiliateHandle(next.giveawayApplication || offer.fullPrice || offer.giveaway ? null : offer.affiliateHandle ?? null);
        setSource(next.giveawayApplication ? next.giveawaySource : offer.fullPrice ? null : offer.source);
        if (offer.giveaway && !giveawayStatus?.open && !next.giveawayApplication) clearCampaign();
    }, [arrival, draft, giveawayStatus]);

    useEffect(() => {
        if (draft) saveDraft(draft);
    }, [draft]);

    const step = draft?.step ?? 1;
    const questionIndex = draft?.questionIndex ?? 0;
    const loaded = draft !== null && (affiliateHandle === null || affiliateOffer !== undefined);

    // Every step and every question is a new screen; a phone that keeps the old
    // scroll position hides the question the owner just moved to. Focus follows
    // to the new title, so a screen reader announces where the owner landed —
    // but only on a move they made, never when a saved draft is restored.
    const placeRef = useRef<string | null>(null);
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "auto" });
        if (!loaded) return;
        const place = `${step}:${questionIndex}`;
        const moved = placeRef.current !== null && placeRef.current !== place;
        placeRef.current = place;
        if (moved) document.getElementById(STEP_TITLE_ID)?.focus({ preventScroll: true });
    }, [loaded, step, questionIndex]);

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

    const basicsErrors = useMemo(() => (draft ? validateBasics(draft.basics, draft.giveawayApplication) : {}), [draft]);

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
                setPhotoError({ index: slot.index, message: problem });
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
                setPhotoError({
                    index: slot.index,
                    message: `"${slot.label}" didn't upload. Check your signal and try that one again.`,
                });
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

    const handlePosterPick = useCallback(async (file: File) => {
        const problem = validatePhotoFile(file);
        if (problem) { setPosterError(problem); return; }
        setPosterError(null);
        setPosterUploading(true);
        try {
            const { uploadUrl, publicUrl } = await generateUploadUrl({ fileName: file.name, fileType: file.type, mediaType: "photo" });
            const response = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
            if (!response.ok) throw new Error(`R2 responded ${response.status}`);
            patch((previous) => ({ ...previous, giveawayPosterPhoto: publicUrl }));
        } catch {
            setPosterError("Your poster photo didn't upload. Check your signal and try again.");
        } finally {
            setPosterUploading(false);
        }
    }, [generateUploadUrl, patch]);

    const setAnswer = useCallback(
        (key: IntakeQuestionKey, value: string) =>
            patch((previous) => ({ ...previous, answers: { ...previous.answers, [key]: value } })),
        [patch],
    );

    /**
     * Merge a spoken answer into whatever is already in the box.
     *
     * Appended, never substituted: a second recording extends the answer, and
     * nothing the owner typed is thrown away by a tap they cannot undo.
     */
    const appendAnswer = useCallback(
        (key: IntakeQuestionKey, text: string) =>
            patch((previous) => {
                const existing = (previous.answers[key] ?? "").trim();
                return {
                    ...previous,
                    answers: { ...previous.answers, [key]: existing ? `${existing} ${text}` : text },
                };
            }),
        [patch],
    );

    /** One recording at a time: a release only clears the flag if it is still
     *  the holder's, so a late "done" from one answer cannot free another's. */
    const setVoiceBusy = useCallback((key: IntakeQuestionKey, busy: boolean) => {
        setVoiceBusyKey((holder) => (busy ? key : holder === key ? null : holder));
    }, []);

    const handleSubmit = useCallback(async () => {
        if (!draft || submittedRef.current || (affiliateHandle !== null && affiliateOffer === undefined)) return;
        if (draft.giveawayApplication && giveawayStatus?.open === false) {
            setGiveawayClosed(true);
            setSubmitError("The giveaway is closed. Your draft is saved on this device.");
            return;
        }
        if (draft.giveawayApplication && !draft.giveawayPosterPhoto) {
            setShowPosterProblem(true);
            goToStep(4);
            return;
        }
        // Before the guard, and before anything is spent: a bad domain is the one
        // thing on this screen the owner can still get wrong, and the mutation
        // would reject it anyway.
        if (!draft.giveawayApplication && draft.wantsCustomDomain && validateDomain(draft.requestedDomain)) {
            setShowDomainError(true);
            revealField(document.querySelector('[name="requestedDomain"]'));
            return;
        }
        submittedRef.current = true;
        setSubmitting(true);
        setSubmitError(null);

        const { basics } = draft;
        try {
            const submissionId = await submitOwnerIntake({
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
                submissionType: !draft.giveawayApplication && draft.wantsCustomDomain ? "with_custom_domain" : "standard",
                requestedDomain: !draft.giveawayApplication && draft.wantsCustomDomain
                    ? draft.requestedDomain.trim().toLowerCase()
                    : undefined,
                // A hint, not a price. The mutation resolves the campaign against
                // the ones we run and bills from that; anything else is ignored
                // and the owner pays the ordinary price.
                campaign: draft.giveawayApplication ? undefined : campaign ?? undefined,
                affiliateHandle: draft.giveawayApplication ? undefined : affiliateHandle ?? undefined,
                source: draft.giveawayApplication ? draft.giveawaySource ?? undefined : source ?? undefined,
                giveawayApplication: draft.giveawayApplication ? true : undefined,
                giveawayPosterPhoto: draft.giveawayApplication ? draft.giveawayPosterPhoto ?? undefined : undefined,
            });

            // Read the committed figures: the offer may have changed since the
            // last review render. A failed receipt read must never retry a
            // successful mutation or create a duplicate order.
            const submitted = await convex.query(api.submissions.getById, { id: submissionId }).catch(() => null);
            const quoted = quoteFor(campaign, draft.wantsCustomDomain, draft.giveawayApplication, affiliatePrice);
            const amount = submitted ? ownerChargeFor(submitted) : affiliateHandle !== null ? null : quoted.total;
            rememberSubmitted({
                email: basics.ownerEmail.trim(),
                amount,
                businessName: basics.businessName.trim(),
                city: basics.city.trim(),
                campaign: submitted ? submitted.campaign ?? null : draft.giveawayApplication ? null : normalizeCampaign(campaign),
                customDomain: submitted ? submitted.submissionType === "with_custom_domain" : !draft.giveawayApplication && draft.wantsCustomDomain,
                giveawayApplication: draft.giveawayApplication,
                ...(amount !== null ? {
                    websitePrice: submitted ? amount - domainAddOnFor(submitted.submissionType ?? "standard", submitted.domainCostPHP, submitted.domainChargedPHP) : quoted.sellPrice,
                    websiteListPrice: submitted ? submitted.websiteListPrice ?? campaignListPrice(submitted.campaign) : quoted.listPrice,
                } : {}),
            });
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
            const message = messageFor(error);
            if (draft.giveawayApplication && message === "The free website giveaway is closed. You can still apply for a website at the regular price.") {
                setGiveawayClosed(true);
                setSubmitError("The giveaway is closed. Your draft is saved on this device.");
            } else setSubmitError(message);
        }
    }, [affiliateHandle, affiliateOffer, affiliatePrice, campaign, convex, draft, giveawayStatus?.open, goToStep, router, source, submitOwnerIntake]);

    if (!draft || !loaded) {
        return (
            <PublicPage header={header}>
                <Loading label="Loading your form" className={cx(CONTAINER, "flex flex-col gap-8 pb-16 pt-6 sm:pt-8 lg:pl-[360px] lg:pt-10")}>
                    <div className="flex max-w-[680px] flex-col gap-3">
                        <Skeleton width="60%" height={36} />
                        <Skeleton width="90%" height={14} />
                    </div>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-x-6">
                        {Array.from({ length: 6 }, (_, index) => (
                            <div key={index} className="flex flex-col gap-2">
                                <Skeleton width="40%" height={12} />
                                <Skeleton height={40} />
                            </div>
                        ))}
                    </div>
                </Loading>
            </PublicPage>
        );
    }

    const { basics, answers, photos, hasProducts, wantsCustomDomain, requestedDomain } = draft;
    const giveaway = draft.giveawayApplication;
    const finalStep = giveaway ? GIVEAWAY_STEPS : TOTAL_STEPS;
    const stepNames = (giveaway ? GIVEAWAY_STEP_LABELS : STEP_LABELS).map((entry) => entry.title);
    const domainError = !giveaway && wantsCustomDomain ? validateDomain(requestedDomain) : undefined;
    /** What the payment email will ask for, and everything the screens say
     *  about it. Derived, never typed: lib/pricing is the same module the
     *  mutation prices the row with. The domain is never discounted. */
    const quote = quoteFor(campaign, wantsCustomDomain, giveaway, affiliatePrice);
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
    const shortQuestions = INTAKE_QUESTIONS.filter((entry) => !meetsAnswerMinimum(entry, answers[entry.key] ?? ""));
    const firstShortQuestion = shortQuestions[0];
    const slots = hasProducts === null ? [] : visibleSlots(hasProducts);
    const requiredSlots = slots.filter((slot) => !slot.optional);
    const missingSlots = requiredSlots.filter((slot) => !photos[slot.index]);
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
            // is on it), never to /start again, which would loop them. (The bar
            // draws this one as a link to `/`, so it works before script too.)
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

    /** Back to an earlier step from the rail or an Edit button. The interview
     *  reopens on its first question, where a phone would start reading. */
    const jumpToStep = (target: number) => {
        if (target === 2) {
            patch((previous) => ({ ...previous, step: 2, questionIndex: 0 }));
            return;
        }
        goToStep(target);
    };

    const handleBasicsContinue = () => {
        // validateBasics adds its errors in the order the fields are drawn, so
        // the first key is the first box on screen that needs the owner.
        const firstProblem = Object.keys(basicsErrors)[0];
        if (firstProblem) {
            setShowBasicsErrors(true);
            revealField(document.querySelector(`[name="${firstProblem}"]`));
            return;
        }
        setShowBasicsErrors(false);
        goToStep(2);
    };

    const handleAnswerContinue = () => {
        if (isDesktop) {
            // Not disabled, unlike the phone button. With eight boxes on screen
            // a dead button is a puzzle; instead the press marks every box that
            // is holding it up and takes the owner to the first, which already
            // carries its own "X of about 80 characters so far" line.
            if (firstShortQuestion) {
                setShowShortAnswers(true);
                revealField(document.getElementById(answerFieldId(firstShortQuestion.key)));
                return;
            }
            setShowShortAnswers(false);
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

    const handlePhotosContinue = () => {
        if (!photosOk) {
            // Live, like the desk interview: the press says what is missing and
            // goes there, rather than leaving a dead button to puzzle over.
            setShowPhotoProblems(true);
            if (hasProducts === null) {
                revealField(document.querySelector(`#${PRODUCTS_QUESTION_ID} input`));
            } else if (missingSlots[0]) {
                revealField(document.querySelector(`#${slotCardId(missingSlots[0])} button`));
            }
            return;
        }
        setShowPhotoProblems(false);
        goToStep(4);
    };

    const applyCode = () => {
        if (giveaway) return;
        const resolved = normalizeCampaign(codeEntry);
        if (!resolved) {
            setCodeRejected(true);
            return;
        }
        rememberCampaign(resolved, source);
        setCampaign(resolved);
        setAffiliateHandle(null);
        setCodeRejected(false);
    };

    // ── The action bar: what this step is waiting on, and the way forward ────
    const stepOf = `Step ${step} of ${finalStep}`;
    let barInfo: string;
    let barError: ReactNode = null;
    let barExtra: ReactNode = null;
    if (step === 1) {
        barInfo = `${stepOf} · Saved on this device as you go.`;
        const count = Object.keys(basicsErrors).length;
        if (showBasicsErrors && count > 0) {
            barError = count === 1 ? "One field needs you — it is marked in red." : `${count} fields need you — they are marked in red.`;
        }
    } else if (step === 2) {
        barInfo = isDesktop
            ? `${stepOf} · ${INTAKE_QUESTIONS.length - shortQuestions.length} of ${INTAKE_QUESTIONS.length} answered well enough to build from.`
            : `${stepOf} · Question ${questionIndex + 1} of ${INTAKE_QUESTIONS.length}.`;
        if (isDesktop && showShortAnswers && firstShortQuestion) {
            barError =
                shortQuestions.length === 1
                    ? `One answer is holding this up: "${firstShortQuestion.q}"`
                    : `${shortQuestions.length} answers are holding this up, starting with: "${firstShortQuestion.q}"`;
            barExtra = (
                <Button size="sm" onClick={() => revealField(document.getElementById(answerFieldId(firstShortQuestion.key)))}>
                    Show me
                </Button>
            );
        }
    } else if (step === 3) {
        barInfo =
            hasProducts === null
                ? `${stepOf} · Answer the question to see your photo list.`
                : `${stepOf} · ${requiredSlots.length - missingSlots.length} of ${requiredSlots.length} required photos added.`;
        if (showPhotoProblems && !photosOk) {
            if (hasProducts === null) barError = "Tell us whether you sell products first.";
            else if (missingSlots.length > 0) barError = `Add ${missingSlots.map((slot) => `"${slot.label}"`).join(" and ")} to continue.`;
        }
    } else if (giveaway && step === 4) {
        barInfo = `${stepOf} · ${draft.giveawayPosterPhoto ? "Your poster photo is saved." : "Add a photo of your poster in the shop."}`;
        if (showPosterProblem && !draft.giveawayPosterPhoto) barError = "Add your poster photo to continue.";
    } else {
        barInfo = giveaway ? `${stepOf} · Free, if your application qualifies.` : `${stepOf} · Nothing to pay now. You pay ${formatPHP(quote.total)} after it is live.`;
        // A bad web address is the current blocker; a server rejection is from
        // the last attempt and is said until the next one clears it.
        barError = showDomainError && domainError ? "Fix the web address, then send it in." : submitError;
    }

    const back = (
        <Button variant="ghost" size="lg" onClick={handleBack} disabled={submitting}>
            Back
        </Button>
    );

    return (
        <PublicPage header={header}>
            <div className={cx(CONTAINER, "flex flex-1 items-start gap-16 pb-10 pt-6 sm:pt-8 lg:pb-16 lg:pt-10")}>
                <StepRail step={step} quote={quote} onJump={jumpToStep} disabled={submitting} />

                <div className="flex min-w-0 flex-1 flex-col gap-8">
                    <Stepper
                        steps={stepNames}
                        current={step - 1}
                        label="Your progress"
                        className={cx("lg:hidden", giveaway && "max-lg:gap-1 max-lg:[&>.t-step]:gap-1 max-lg:[&>.t-step-line]:min-w-1")}
                    />

                    {giveawayClosed ? (
                        <Card pad className="flex flex-col gap-3" role="alert">
                            <h2 className="t-h2">{GIVEAWAY_CLOSED.heading}</h2>
                            <p className="t-body">{GIVEAWAY_CLOSED.thanks}</p>
                            <p className="t-body">Your draft is saved on this device. A slot is held only after an application is sent successfully.</p>
                            <ButtonLink href="/100-pages-giveaway" size="lg" className="self-start">See your options</ButtonLink>
                        </Card>
                    ) : null}

                    {step === 1 && (
                        <BasicsStep
                            basics={basics}
                            errors={showBasicsErrors ? basicsErrors : {}}
                            onChange={setBasic}
                            onSubmit={handleBasicsContinue}
                            giveaway={giveaway}
                            isDesktop={isDesktop}
                            coordinates={draft.coordinates}
                            onCoordinatesChange={setCoordinates}
                            mapAddress={mapAddress}
                            geoStatus={geoStatus}
                            onRequestLocation={requestLocation}
                        />
                    )}

                    {step === 2 && (
                        <InterviewStep
                            isDesktop={isDesktop}
                            answers={answers}
                            questionIndex={questionIndex}
                            flagShort={showShortAnswers}
                            onAnswerChange={setAnswer}
                            onAppend={appendAnswer}
                            submitting={submitting}
                            voiceBusyKey={voiceBusyKey}
                            onVoiceBusy={setVoiceBusy}
                        />
                    )}

                    {step === 3 && (
                        <PhotosStep
                            hasProducts={hasProducts}
                            onHasProducts={(value) => patch((previous) => ({ ...previous, hasProducts: value }))}
                            photos={photos}
                            uploadingIndex={uploadingIndex}
                            photoError={photoError}
                            tried={showPhotoProblems}
                            onPick={(slot, file) => void handlePhotoPick(slot, file)}
                            onRemove={removePhoto}
                        />
                    )}

                    {giveaway && step === 4 ? (
                        <PosterStep
                            photo={draft.giveawayPosterPhoto} busy={posterUploading} error={posterError} tried={showPosterProblem}
                            onPick={(file) => void handlePosterPick(file)}
                            onRemove={() => { patch((previous) => ({ ...previous, giveawayPosterPhoto: null })); setPosterError(null); }}
                        />
                    ) : null}

                    {step === finalStep && (
                        <ReviewStep
                            draft={draft}
                            quote={quote}
                            submitting={submitting}
                            onEditBasics={() => jumpToStep(1)}
                            onEditAnswers={() => jumpToStep(2)}
                            onEditPhotos={() => jumpToStep(3)}
                            onEditPoster={() => jumpToStep(4)}
                            codeEntry={codeEntry}
                            onCodeEntry={(value) => {
                                setCodeEntry(value);
                                setCodeRejected(false);
                            }}
                            codeRejected={codeRejected}
                            onApplyCode={applyCode}
                            onTier={(wants) => {
                                patch((previous) => ({ ...previous, wantsCustomDomain: wants }));
                                if (!wants) setShowDomainError(false);
                            }}
                            onDomainChange={(value) => patch((previous) => ({ ...previous, requestedDomain: value }))}
                            domainError={showDomainError ? domainError : undefined}
                        />
                    )}

                    {/* What the desk rail says, for a phone: the price on the
                        first screen (so a scanned discount is seen to land), and
                        the saved-as-you-go promise on every screen. */}
                    {step === 1 ? <PriceNote quote={quote} className="lg:hidden" /> : null}
                    <SavedNote className="lg:hidden" />
                </div>
            </div>

            <ActionBar info={barInfo} error={barError} extra={barExtra}>
                {step === 1 && (
                    <>
                        <ButtonLink variant="ghost" size="lg" href="/">
                            Back to Tendso
                        </ButtonLink>
                        <Button variant="primary" size="lg" onClick={handleBasicsContinue} className="max-sm:flex-1">
                            Continue
                            <Icon icon={ArrowRight} />
                        </Button>
                    </>
                )}

                {step === 2 && (
                    <>
                        {back}
                        {isDesktop ? (
                            // Deliberately never disabled — see handleAnswerContinue.
                            <Button variant="primary" size="lg" onClick={handleAnswerContinue}>
                                Continue
                                <Icon icon={ArrowRight} />
                            </Button>
                        ) : (
                            <Button variant="primary" size="lg" onClick={handleAnswerContinue} disabled={!answerOk} className="max-sm:flex-1">
                                {question.optional && answer.trim().length === 0 ? "Skip this one" : "Next"}
                                <Icon icon={ArrowRight} />
                            </Button>
                        )}
                    </>
                )}

                {step === 3 && (
                    <>
                        {back}
                        {uploadingIndex !== null ? (
                            <Button variant="primary" size="lg" disabled className="max-sm:flex-1">
                                <Spinner />
                                Uploading…
                            </Button>
                        ) : (
                            <Button variant="primary" size="lg" onClick={handlePhotosContinue} className="max-sm:flex-1">
                                Continue
                                <Icon icon={ArrowRight} />
                            </Button>
                        )}
                    </>
                )}

                {giveaway && step === 4 ? (
                    <>
                        {back}
                        <Button variant="primary" size="lg" disabled={posterUploading} className="max-sm:flex-1" onClick={() => {
                            if (!draft.giveawayPosterPhoto) {
                                setShowPosterProblem(true);
                                revealField(document.querySelector(`#${POSTER_PHOTO_ID} button`));
                                return;
                            }
                            setShowPosterProblem(false);
                            goToStep(GIVEAWAY_STEPS);
                        }}>
                            {posterUploading ? <><Spinner />Uploading…</> : <>Continue<Icon icon={ArrowRight} /></>}
                        </Button>
                    </>
                ) : null}

                {step === finalStep && (
                    <>
                        {back}
                        <Button variant="primary" size="lg" onClick={handleSubmit} disabled={submitting} className="max-sm:flex-1">
                            {submitting ? (
                                <>
                                    <Spinner />
                                    Sending…
                                </>
                            ) : (
                                <>
                                    <Icon icon={Send} />
                                    Send it in
                                </>
                            )}
                        </Button>
                    </>
                )}
            </ActionBar>
        </PublicPage>
    );
}
