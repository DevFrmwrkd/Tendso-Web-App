"use client"

import { Suspense, useEffect, useState, type FormEvent, type ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { useQuery, useMutation } from "convex/react"
import { ArrowRight, MapPin } from "lucide-react"
import { toast } from "sonner"

import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { Button, ButtonLink, Field, Icon, Input, PhoneInput, Select } from "@/components/r1"
import { WEBSITE_PRICE, commissionFor } from "@/lib/pricing"
import {
    BUSINESS_TYPES,
    mapCategoryToBusinessType,
    toLocalPhDigits,
    looksLikeConvexId,
} from "@/lib/prospectPrefill"

import {
    DRAFT_ID_KEY,
    errorText,
    infoErrors,
    needRows,
    phoneToField,
    phoneToStored,
    savedInterviewKind,
    type InfoField,
    type InfoValues,
} from "../_components/flow"
import { ActionBar, NeedsCard, StepLoading, SubmitFrame } from "../_components/SubmitFrame"

const FORM_ID = "submit-info"

/** After a blocked Continue, take the creator to the first field to fix (on a phone it may be off screen). */
function focusFirstInvalid() {
    // Click handlers flush their updates before the next frame, so the error states are painted by then.
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`#${FORM_ID} [aria-invalid="true"]`)?.focus())
}

function InfoLoading() {
    return (
        <SubmitFrame step={0}>
            <StepLoading label="Loading the business details" shape="form" />
        </SubmitFrame>
    )
}

// useSearchParams() needs a Suspense boundary or the Next build fails with a
// CSR-bailout error.
export default function BusinessInfoPage() {
    return (
        <Suspense fallback={<InfoLoading />}>
            <BusinessInfoForm />
        </Suspense>
    )
}

function BusinessInfoForm() {
    const router = useRouter()
    const { user, isLoaded, isSignedIn } = useUser()
    const searchParams = useSearchParams()

    // Prefill params, written by the "Start submission" link in the lead
    // drawer on /leads (app/leads/_components/leadUtils.ts builds it).
    const rawProspectLeadId = searchParams.get("prospectLeadId")
    // Shape-check before this ever reaches a v.id('leads') validator — a
    // place_id or hand-edited string would throw and dead-end step 1.
    const prospectLeadId = looksLikeConvexId(rawProspectLeadId) ? rawProspectLeadId : null
    const paramBusinessName = searchParams.get("businessName") ?? ""
    const paramPhone = searchParams.get("phone")
    const paramAddress = searchParams.get("address") ?? ""
    const paramCity = searchParams.get("city") ?? ""
    const paramCategory = searchParams.get("category")

    // Get creator from Convex
    const creator = useQuery(
        api.creators.getByClerkId,
        user ? { clerkId: user.id } : "skip"
    )

    // Get existing draft submission
    const existingDraft = useQuery(
        api.submissions.getDraftByCreatorId,
        creator?._id ? { creatorId: creator._id } : "skip"
    )

    // Mutations
    const createSubmission = useMutation(api.submissions.create)
    const updateSubmission = useMutation(api.submissions.update)

    // A save in flight (Continue or Save draft).
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Form state
    const [businessName, setBusinessName] = useState("")
    const [businessType, setBusinessType] = useState("")
    const [ownerName, setOwnerName] = useState("")
    // As the field shows it (0917 123 4567); stored as the 10 digits after
    // +63, the format this step has always saved (see flow.ts).
    const [ownerPhone, setOwnerPhone] = useState("")
    const [ownerEmail, setOwnerEmail] = useState("")
    const [address, setAddress] = useState("")
    const [city, setCity] = useState("")
    const [initialized, setInitialized] = useState(false)
    // 'unresolved' only matters when there's a draft-vs-prospect collision.
    const [draftChoice, setDraftChoice] = useState<"unresolved" | "continue" | "fresh">("unresolved")

    // Field errors show after the first Continue, then follow the typing.
    const [showErrors, setShowErrors] = useState(false)
    // Save draft only needs a name (so the draft can be found in Submissions).
    const [nameNeeded, setNameNeeded] = useState(false)
    // Edits since the last load or save, for "Draft saved" / "Not saved yet".
    const [dirty, setDirty] = useState(false)
    // The draft this form was loaded from, and the one Save draft created here.
    const [hydratedFrom, setHydratedFrom] = useState<string | null>(null)
    const [savedId, setSavedId] = useState<string | null>(null)

    // getDraftByCreatorId returns the creator's single NEWEST draft with no
    // business filter, and this page patches whatever it hands back. If that
    // draft belongs to a different business than the prospect we arrived for,
    // reusing it would rename it — and on submit mark the WRONG business
    // interviewed. Detect that and ask instead of guessing.
    const draftIsForThisProspect =
        !!existingDraft &&
        !!prospectLeadId &&
        ((existingDraft.prospectLeadId ?? null) === prospectLeadId ||
            // An unlinked draft for the same business is a back-navigation, not
            // a collision.
            (!existingDraft.prospectLeadId &&
                (existingDraft.businessName ?? "") === paramBusinessName) ||
            // The draft this visit loaded or Save draft created is this
            // interview, even after its name was edited and saved.
            existingDraft._id === hydratedFrom ||
            existingDraft._id === savedId)
    const draftCollision = !!existingDraft && !!prospectLeadId && !draftIsForThisProspect
    const awaitingChoice = draftCollision && draftChoice === "unresolved"
    const startingFresh = draftCollision && draftChoice === "fresh"

    // Redirect if not authenticated
    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            router.push("/login")
        }
    }, [isLoaded, isSignedIn, router])

    // Redirect to onboarding if no creator profile. (Same rule as before; it
    // used to run during render.)
    useEffect(() => {
        if (isLoaded && isSignedIn && creator === null) {
            router.push("/onboarding")
        }
    }, [isLoaded, isSignedIn, creator, router])

    // Single hydration step, once. A saved draft always wins over URL params;
    // the params only fill a genuinely empty form. It must run once the draft
    // query has answered — existingDraft resolves asynchronously, so prefilling
    // earlier gets clobbered when the draft lands later. It runs during render
    // (React's "adjust state when data arrives" pattern) instead of in an
    // effect, so the form never paints empty first.
    //
    // undefined is Convex's loading state, NOT "no draft". Treating it as
    // "no draft" (the old `if (existingDraft)` check) let a fast tap on Next
    // create a second draft.
    if (!initialized && existingDraft !== undefined && !awaitingChoice) {
        setInitialized(true)
        if (existingDraft && !startingFresh) {
            setBusinessName(existingDraft.businessName || "")
            setBusinessType(existingDraft.businessType || "")
            setOwnerName(existingDraft.ownerName || "")
            setOwnerPhone(phoneToField(existingDraft.ownerPhone))
            setOwnerEmail(existingDraft.ownerEmail || "")
            setAddress(existingDraft.address || "")
            setCity(existingDraft.city || "")
            setHydratedFrom(existingDraft._id)
        } else if (prospectLeadId) {
            // Prefill from the scraped prospect. Owner name and email are
            // deliberately left empty — a scrape can't know them.
            setBusinessName(paramBusinessName)
            setAddress(paramAddress)
            setCity(paramCity)
            setOwnerPhone(phoneToField(toLocalPhDigits(paramPhone)))
            setBusinessType(mapCategoryToBusinessType(paramCategory))
        }
    }

    // Store the continued draft's ID in session for the other steps.
    useEffect(() => {
        if (hydratedFrom) sessionStorage.setItem(DRAFT_ID_KEY, hydratedFrom)
    }, [hydratedFrom])

    const values: InfoValues = { businessName, businessType, ownerName, ownerPhone, ownerEmail, city, address }
    const errors = infoErrors(values)
    const errorCount = Object.keys(errors).length
    const fieldError = (k: InfoField) => (showErrors || (k === "businessName" && nameNeeded) ? errors[k] : undefined)

    const edit = (set: (v: string) => void) => (v: string) => {
        set(v)
        setDirty(true)
    }

    // Create or update the draft. Shared by Continue and Save draft.
    const save = async (): Promise<string> => {
        if (!creator) {
            throw new Error("You must complete your profile first")
        }

        const linkArg = prospectLeadId
            ? { prospectLeadId: prospectLeadId as Id<"leads"> }
            : {}
        const fields = {
            businessName,
            businessType,
            ownerName,
            ownerPhone: phoneToStored(ownerPhone),
            ownerEmail: ownerEmail || undefined,
            address,
            city,
        }

        let submissionId: string
        // A draft Save draft already created on this visit is the one to keep
        // patching; without this a second save could create a twin.
        const targetId = savedId ?? (existingDraft && !startingFresh ? existingDraft._id : null)

        if (targetId) {
            // Update existing draft
            await updateSubmission({
                id: targetId as Id<"submissions">,
                ...fields,
                ...linkArg,
            })
            submissionId = targetId
        } else {
            // Create new draft — either the creator has none, or they chose
            // to start fresh rather than reuse an unrelated one.
            submissionId = await createSubmission({
                creatorId: creator._id,
                ...fields,
                status: "draft",
                // A new sale starts at the full list price, no discount: the
                // review step's slider opens here. Not the server's default,
                // which stays ₱999 for the mobile app's older builds.
                amount: WEBSITE_PRICE,
                creatorPayout: commissionFor(WEBSITE_PRICE),
                ...linkArg,
            })
            setSavedId(submissionId)
        }

        // Store submission ID in session storage for next steps
        sessionStorage.setItem(DRAFT_ID_KEY, submissionId)
        return submissionId
    }

    const handleNext = async (e?: FormEvent) => {
        e?.preventDefault()
        if (errorCount > 0) {
            setShowErrors(true)
            focusFirstInvalid()
            return
        }
        setLoading(true)
        setError(null)

        try {
            await save()
            setDirty(false)
            // Navigate to next step
            router.push("/submit/photos")
        } catch (err) {
            console.error("Error saving business info:", err)
            setError(errorText(err, "Failed to save business information"))
        } finally {
            setLoading(false)
        }
    }

    const handleSaveDraft = async () => {
        if (!businessName.trim()) {
            setNameNeeded(true)
            focusFirstInvalid()
            return
        }
        setLoading(true)
        setError(null)
        try {
            await save()
            setDirty(false)
            toast.success("Draft saved. It is waiting in Submissions.")
        } catch (err) {
            console.error("Error saving business info:", err)
            setError(errorText(err, "Failed to save business information"))
        } finally {
            setLoading(false)
        }
    }

    // Loading state; also while a creator without a profile is sent to /onboarding.
    if (!isLoaded || !isSignedIn || !creator) {
        return <InfoLoading />
    }

    // Draft collision — the creator has an unfinished interview for a
    // DIFFERENT business. Reusing it silently would mark the wrong business
    // interviewed, so ask.
    const choicePanel = awaitingChoice ? (
        <section className="t-card t-card-pad flex flex-col gap-3" aria-labelledby="ns-draft-choice">
            <h2 id="ns-draft-choice" className="t-h2">
                You have an unfinished interview
            </h2>
            <p className="t-body">
                There is a draft for <strong className="font-medium text-r1-ink">{existingDraft?.businessName || "another business"}</strong>.
                Continue that one, or start fresh for <strong className="font-medium text-r1-ink">{paramBusinessName || "this business"}</strong>?
            </p>
            <div className="flex flex-wrap gap-2">
                <Button className="h-auto min-h-10 max-w-full whitespace-normal py-2 text-left" onClick={() => setDraftChoice("continue")}>
                    Continue {existingDraft?.businessName || "the draft"}
                </Button>
                <Button className="h-auto min-h-10 max-w-full whitespace-normal py-2 text-left" onClick={() => setDraftChoice("fresh")}>
                    Start fresh for {paramBusinessName || "this business"}
                </Button>
            </div>
            <p className="t-meta">Starting fresh keeps the other draft. It is not deleted.</p>
        </section>
    ) : null

    if (!initialized) {
        return awaitingChoice ? <SubmitFrame step={0}>{choicePanel}</SubmitFrame> : <InfoLoading />
    }

    // The rail reads the draft being continued; a fresh draft has nothing yet.
    const draftForRail = existingDraft && !startingFresh && !awaitingChoice ? existingDraft : null
    const rows = needRows({
        step: 0,
        businessErrors: errors,
        photoCount: (draftForRail?.photos ?? []).filter(Boolean).length,
        interview: savedInterviewKind(draftForRail),
        ownerName,
    })

    const backed = !!(savedId ?? hydratedFrom)
    let barMessage: ReactNode = `Step 1 of 4 · ${backed && !dirty ? "Draft saved" : "Not saved yet"}`
    let barError = false
    if (error) {
        barMessage = error
        barError = true
    } else if (showErrors && errorCount > 0) {
        barMessage = errorCount === 1 ? "1 field needs a fix before you continue." : `${errorCount} fields need a fix before you continue.`
        barError = true
    } else if (nameNeeded && errors.businessName) {
        barMessage = "Add the business name to save a draft."
        barError = true
    }

    // existingDraft === undefined is Convex still loading; saving through it
    // creates a second draft that would carry the prospect link while the
    // first is orphaned.
    const cannotSave = loading || existingDraft === undefined || awaitingChoice

    return (
        <SubmitFrame
            step={0}
            rail={<NeedsCard rows={rows} />}
            railLabel="What is still needed"
            bar={
                <ActionBar message={barMessage} error={barError}>
                    <Button onClick={handleSaveDraft} disabled={cannotSave}>
                        Save draft
                    </Button>
                    <Button variant="primary" type="submit" form={FORM_ID} disabled={cannotSave} aria-busy={loading}>
                        {loading ? "Saving…" : "Continue"}
                        {!loading && <Icon icon={ArrowRight} />}
                    </Button>
                </ActionBar>
            }
        >
            {choicePanel}

            {/* Arrived from a scraped prospect — say so, and offer a way back,
                so the creator can see this interview is attached to that
                record rather than floating free. */}
            {prospectLeadId && !awaitingChoice && (
                <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3.5 gap-y-3 rounded-r1-card bg-r1-fill-2 py-3.5 pl-[18px] pr-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                    <span className="flex pt-0.5 text-r1-ink-3 sm:pt-0">
                        <Icon icon={MapPin} size={18} />
                    </span>
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <p className="text-sm font-medium text-r1-ink">Filled in from your lead, {paramBusinessName || "this business"}</p>
                        <p className="t-meta">
                            The name, type and place came from the listing. Check them with the owner, then add what only the owner can give you.
                        </p>
                    </div>
                    <ButtonLink size="sm" href={`/leads?lead=${prospectLeadId}`} className="col-start-2 justify-self-start sm:col-start-3">
                        Open lead
                    </ButtonLink>
                </div>
            )}

            <form id={FORM_ID} noValidate onSubmit={handleNext} className="flex flex-col gap-8">
                <section className="flex flex-col gap-4" aria-labelledby="ns-business">
                    <h2 id="ns-business" className="t-h2">
                        The business
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2 sm:gap-x-5">
                        <Field label="Business name" required error={fieldError("businessName")}>
                            <Input
                                type="text"
                                autoComplete="off"
                                placeholder="e.g. Juan’s Barbershop"
                                value={businessName}
                                onChange={(e) => edit(setBusinessName)(e.target.value)}
                                disabled={loading}
                            />
                        </Field>
                        <Field label="Type of business" required error={fieldError("businessType")}>
                            <Select value={businessType} onChange={(e) => edit(setBusinessType)(e.target.value)} disabled={loading}>
                                <option value="">Pick a type</option>
                                {BUSINESS_TYPES.map((type) => (
                                    <option key={type} value={type}>
                                        {type}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                    </div>
                </section>

                <section className="flex flex-col gap-4" aria-labelledby="ns-owner">
                    <h2 id="ns-owner" className="t-h2">
                        The owner
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2 sm:gap-x-5">
                        <Field label="Owner’s full name" required error={fieldError("ownerName")}>
                            <Input
                                type="text"
                                autoComplete="off"
                                placeholder="e.g. Juan Dela Cruz"
                                value={ownerName}
                                onChange={(e) => edit(setOwnerName)(e.target.value)}
                                disabled={loading}
                            />
                        </Field>
                        <Field
                            label="Owner’s phone"
                            required
                            error={fieldError("ownerPhone")}
                            help="Digits only, 11 in all, starting with 09. The owner’s own number, not the one on the listing."
                        >
                            {/* autoComplete off: the browser would offer the creator's own number here. */}
                            <PhoneInput
                                autoComplete="off"
                                placeholder="0917 123 4567"
                                value={ownerPhone}
                                onValueChange={edit(setOwnerPhone)}
                                disabled={loading}
                            />
                        </Field>
                        <Field
                            label={
                                <>
                                    Owner’s email <span className="font-normal text-r1-ink-3">(optional)</span>
                                </>
                            }
                            error={fieldError("ownerEmail")}
                            help="We send the owner the site link and payment details here."
                        >
                            <Input
                                type="email"
                                autoComplete="off"
                                placeholder="owner@example.com"
                                value={ownerEmail}
                                onChange={(e) => edit(setOwnerEmail)(e.target.value)}
                                disabled={loading}
                            />
                        </Field>
                    </div>
                </section>

                <section className="flex flex-col gap-4" aria-labelledby="ns-where">
                    <h2 id="ns-where" className="t-h2">
                        Where it is
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2 sm:gap-x-5">
                        <Field label="City or municipality" required error={fieldError("city")}>
                            <Input
                                type="text"
                                autoComplete="off"
                                placeholder="e.g. Iloilo City"
                                value={city}
                                onChange={(e) => edit(setCity)(e.target.value)}
                                disabled={loading}
                            />
                        </Field>
                    </div>
                    <Field
                        label="Street, house or stall number, and barangay"
                        required
                        error={fieldError("address")}
                        help="What a tricycle driver would need. It goes on the site’s map and contact section."
                    >
                        <Input
                            type="text"
                            autoComplete="off"
                            placeholder="e.g. Stall 4, E. Lopez St., Jaro"
                            value={address}
                            onChange={(e) => edit(setAddress)(e.target.value)}
                            disabled={loading}
                        />
                    </Field>
                </section>
            </form>
        </SubmitFrame>
    )
}
