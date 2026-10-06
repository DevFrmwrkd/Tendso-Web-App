"use client"

import { useEffect, useId, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { useQuery, useMutation } from "convex/react"
import { Send } from "lucide-react"
import { toast } from "sonner"

import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import {
    Button,
    ButtonLink,
    Checkbox,
    Field,
    Fold,
    Icon,
    Input,
    MoneyLine,
    MoneyLines,
    Skeleton,
    Status,
    formatMoney,
} from "@/components/r1"
import {
    BASE_PRICE,
    COMMISSION_RATE,
    CUSTOM_DOMAIN_ADDON,
    PRICE_CEILING,
    WEBSITE_PRICE,
    clampSellPrice,
    commissionFor,
    creatorDiscount,
    domainAddOnFor,
    ownerTotal,
} from "@/lib/pricing"

import { directMediaUrl, errorText, firstNameOf, phoneForReading } from "../_components/flow"
import { ActionBar, DraftMissing, StepLoading, SubmitFrame } from "../_components/SubmitFrame"
import { useRequiredDraftId } from "../_components/useDraftId"

interface DomainCheckResult {
    valid: boolean
    available?: boolean
    domain?: string
    priceUSD?: number
    pricePHP?: number
    withinBudget?: boolean
    reason?: string
    error?: string
    suggestions?: Array<{ domain: string; pricePHP: number; withinBudget: boolean }>
}

/** Where the typed custom domain stands. */
type DomainState = "off" | "empty" | "checking" | "ok" | "over" | "taken"

function SectionHead({ id, title, edit, editLabel }: { id: string; title: ReactNode; edit: string; editLabel: string }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <h3 id={id} className="t-h2">
                {title}
            </h3>
            <ButtonLink variant="ghost" size="sm" href={edit} aria-label={editLabel}>
                Edit
            </ButtonLink>
        </div>
    )
}

export default function ReviewSubmissionPage() {
    const router = useRouter()
    const { user, isLoaded, isSignedIn } = useUser()
    const priceId = useId()
    const confirmErrorId = useId()

    const [submitting, setSubmitting] = useState(false)
    // Save draft in flight.
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [agreed, setAgreed] = useState(false)
    // Send (or Save draft) was pressed; the blocking errors show from then on.
    const [triedSubmit, setTriedSubmit] = useState(false)
    // Price or domain changed since the draft was loaded or saved.
    const [dirty, setDirty] = useState(false)

    // Load submission ID from session (back to step 1 without one)
    const submissionId = useRequiredDraftId()

    // Custom domain: the box says whether one is wanted, the field which one.
    const [domainOn, setDomainOn] = useState(false)
    const [domainInput, setDomainInput] = useState("")
    // Creator-set sell price, clamped to BASE_PRICE..PRICE_CEILING (see lib/pricing.ts).
    // Opens at the full list price, no discount; a saved draft's own price replaces it.
    const [sellPrice, setSellPrice] = useState<number>(WEBSITE_PRICE)
    // The last availability answer, kept with the domain it answers for, so
    // an answer for an earlier spelling is never read as one for this one.
    const [domainCheck, setDomainCheck] = useState<{ domain: string; result: DomainCheckResult } | null>(null)
    const [prefilled, setPrefilled] = useState(false)

    const typedDomain = domainInput.trim().toLowerCase()
    // Auto-derived: a ticked box with a typed domain is "with_custom_domain"
    const wantsCustomDomain = domainOn && typedDomain.length > 0
    const tier: "standard" | "with_custom_domain" = wantsCustomDomain ? "with_custom_domain" : "standard"
    const check = wantsCustomDomain && domainCheck?.domain === typedDomain ? domainCheck.result : null
    // Real registrar price for the typed domain (from /api/check-domain). 0 until resolved.
    const domainPricePHP = (wantsCustomDomain && check?.available && typeof check.pricePHP === "number")
        ? check.pricePHP
        : 0
    const totalAmount = ownerTotal(sellPrice, tier, domainPricePHP || undefined)

    // Get creator from Convex
    const creator = useQuery(
        api.creators.getByClerkId,
        user ? { clerkId: user.id } : "skip"
    )

    // Get submission from Convex
    const submission = useQuery(
        api.submissions.getById,
        submissionId ? { id: submissionId as Id<"submissions"> } : "skip"
    )

    // Get resolved photo URLs
    const photoUrls = useQuery(
        api.files.getMultipleUrls,
        submission?.photos?.length ? { storageIds: submission.photos } : "skip"
    )

    // Get interview URL (video or audio).
    // Client-side resolution first — full URLs pass through, R2 relative paths
    // (audio/..., videos/...) get prefixed with NEXT_PUBLIC_R2_PUBLIC_URL so the
    // preview works even if the server query hasn't redeployed yet. Only true
    // Convex storage IDs require the server round-trip.
    const directInterviewUrl =
        directMediaUrl(submission?.videoUrl) ||
        directMediaUrl(submission?.audioUrl) ||
        directMediaUrl(submission?.videoStorageId?.toString()) ||
        directMediaUrl(submission?.audioStorageId?.toString())

    const interviewStorageId = submission?.videoStorageId || submission?.audioStorageId
    const needsServerResolution =
        !directInterviewUrl && !!interviewStorageId
    const legacyInterviewUrl = useQuery(
        api.files.getUrlByString,
        needsServerResolution ? { storageId: interviewStorageId!.toString() } : "skip"
    )
    const interviewUrl = directInterviewUrl || legacyInterviewUrl || null

    // Mutations
    const submitSubmission = useMutation(api.submissions.submit)
    const setDomainTier = useMutation(api.submissions.setDomainTier)

    // Debounced domain availability check (500ms after typing stops)
    useEffect(() => {
        if (!wantsCustomDomain) return
        const domain = typedDomain
        const timer = setTimeout(async () => {
            try {
                const response = await fetch("/api/check-domain", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ domain, maxBudgetPHP: PRICE_CEILING }),
                })
                const data: DomainCheckResult = await response.json()
                setDomainCheck({ domain, result: data })
            } catch {
                setDomainCheck({ domain, result: { valid: false, error: "Network error" } })
            }
        }, 500)
        return () => clearTimeout(timer)
    }, [wantsCustomDomain, typedDomain])

    // Pre-fill from the saved draft, once (a later change to the draft, like
    // the transcript arriving, must not wipe what the creator is typing).
    if (!prefilled && submission) {
        setPrefilled(true)
        if (submission.requestedDomain) {
            setDomainInput(submission.requestedDomain)
            setDomainOn(true)
        }
        // Re-derive the saved website sell price (amount = sellPrice + domain
        // add-on when a custom domain was chosen). Prefer the frozen real
        // domain price (domainCostPHP); fall back to the flat addon.
        if (typeof submission.amount === "number" && submission.amount > 0) {
            const addon = submission.submissionType === "with_custom_domain"
                ? (typeof submission.domainCostPHP === "number" && submission.domainCostPHP > 0 ? submission.domainCostPHP : CUSTOM_DOMAIN_ADDON)
                : 0
            setSellPrice(Math.max(submission.amount - addon, BASE_PRICE))
        }
    }

    // Redirect if not authenticated
    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            router.push("/login")
        }
    }, [isLoaded, isSignedIn, router])

    const domainState: DomainState = !domainOn
        ? "off"
        : !typedDomain
          ? "empty"
          : !check
            ? "checking"
            : check.available && check.withinBudget
              ? "ok"
              : check.available
                ? "over"
                : "taken"
    // If user typed a domain, it must be available and priced within the
    // allowed ceiling (real registrar price — no flat ₱500 cap anymore).
    const domainBlocks = domainState === "empty" || domainState === "checking" || domainState === "over" || domainState === "taken"

    // The same three arguments Send uses: the tier + domain choice, the
    // creator's chosen sell price, and the domain's REAL registrar price
    // (frozen server-side as domainCostPHP).
    const saveChoices = (id: string) =>
        setDomainTier({
            id: id as Id<"submissions">,
            submissionType: tier,
            requestedDomain: wantsCustomDomain ? typedDomain : undefined,
            sellPrice,
            domainPricePHP: wantsCustomDomain ? domainPricePHP : undefined,
        })

    const handleSubmit = async () => {
        if (!submission || !submissionId) return
        setTriedSubmit(true)
        if (!agreed || domainBlocks) return

        setSubmitting(true)
        setError(null)

        try {
            await saveChoices(submissionId)

            // Update status to submitted
            await submitSubmission({ id: submissionId as Id<"submissions"> })

            // Navigate to success page
            router.push("/submit/success")
        } catch (err) {
            console.error("Error submitting:", err)
            setError(errorText(err, "Failed to submit. Please try again."))
            setSubmitting(false)
        }
    }

    const handleSaveDraft = async () => {
        if (!submission || !submissionId) return
        if (domainBlocks) {
            setTriedSubmit(true)
            return
        }
        setSaving(true)
        setError(null)
        try {
            await saveChoices(submissionId)
            setDirty(false)
            toast.success("Draft saved. It is waiting in Submissions.")
        } catch (err) {
            console.error("Error saving the price:", err)
            setError(errorText(err, "The draft was not saved. Try again."))
        } finally {
            setSaving(false)
        }
    }

    // Loading state
    if (!isLoaded || !isSignedIn || creator === undefined || !submissionId || submission === undefined) {
        return (
            <SubmitFrame step={3}>
                <StepLoading label="Loading the review" shape="cards" />
            </SubmitFrame>
        )
    }

    if (!submission) {
        return (
            <SubmitFrame step={3}>
                <DraftMissing />
            </SubmitFrame>
        )
    }

    // Determine interview type and payout (50% of the chosen sell price)
    // Check both R2 URLs (new) and storage IDs (legacy)
    const hasVideo = !!submission.videoUrl || !!submission.videoStorageId
    const hasAudio = !!submission.audioUrl || !!submission.audioStorageId
    const payout = (hasVideo || hasAudio) ? commissionFor(sellPrice) : 0

    const who = firstNameOf(submission.ownerName) || "the owner"
    const photoCount = submission.photos?.length || 0
    const busy = submitting || saving

    const domainError =
        domainState === "over"
            ? `This domain costs more than the included budget (${formatMoney(PRICE_CEILING)}). Try another name or ending, or untick the box.`
            : domainState === "taken"
              ? check?.reason || "Not available"
              : domainState === "empty" && triedSubmit
                ? "Type the whole domain, like yourbusiness.com, or untick the box."
                : undefined
    const confirmError = triedSubmit && !agreed

    let barMessage: ReactNode = `Step 4 of 4 · ${dirty ? "Not saved yet" : "Draft saved"}`
    let barError = false
    if (error) {
        barMessage = error
        barError = true
    } else if (triedSubmit && !agreed) {
        barMessage = "Tick the confirmation to send it."
        barError = true
    } else if (triedSubmit && domainState === "checking") {
        barMessage = "Wait for the domain check to finish."
        barError = true
    } else if (triedSubmit && domainBlocks) {
        barMessage = "Check the domain, or untick it."
        barError = true
    }

    // Suggestions — always render when the typed domain is unavailable.
    // If Hostinger returned alternatives, show those with prices.
    // Otherwise generate TLD variants client-side so the creator
    // always has something to click. Clicking fills the input and
    // re-runs the real availability check.
    const suggestions = (() => {
        if (!wantsCustomDomain || !check || check.available !== false) return null
        const serverSuggestions = check.suggestions || []
        const typed = (check.domain || typedDomain)
        const baseName = typed.split(".")[0]
        const typedTld = typed.split(".").slice(1).join(".")
        const fallbackTlds = ["com", "net", "co", "shop", "store", "online", "xyz", "site"]
        const fallbackSuggestions = baseName
            ? fallbackTlds
                  .filter((t) => t !== typedTld)
                  .slice(0, 6)
                  .map((tld) => ({
                      domain: `${baseName}.${tld}`,
                      pricePHP: 0,
                      withinBudget: true as boolean,
                      isFallback: true,
                  }))
            : []

        const items = serverSuggestions.length > 0
            ? serverSuggestions.map((s) => ({ ...s, isFallback: false }))
            : fallbackSuggestions

        if (items.length === 0) return null

        return (
            <div className="flex flex-col gap-2">
                <p className="t-label">{serverSuggestions.length > 0 ? "Try one of these" : "Try another ending (tap to check)"}</p>
                <div className="flex flex-wrap gap-2">
                    {items.slice(0, 6).map((sug) => (
                        <button
                            key={sug.domain}
                            type="button"
                            className="t-chip min-w-0 max-w-full disabled:cursor-not-allowed disabled:opacity-45"
                            onClick={() => {
                                setDomainInput(sug.domain)
                                setDirty(true)
                            }}
                            disabled={!sug.withinBudget}
                        >
                            <span className="t-mono min-w-0 truncate text-r1-ink">{sug.domain}</span>
                            <span className="t-meta">{sug.isFallback ? "Check" : sug.withinBudget ? "Available" : "Over budget"}</span>
                        </button>
                    ))}
                </div>
            </div>
        )
    })()

    // What the owner's bill will show: the list price struck through, the
    // creator's price, then the percentage off. Beside the total on the
    // standard tier; with a domain the total also holds the add-on, which is
    // never discounted, so it all moves to the website's own line (the rule
    // /start and the pay page follow).
    const discount = creatorDiscount(sellPrice, WEBSITE_PRICE)
    const struckTotal = discount && !wantsCustomDomain ? discount.listPrice : null

    const priceCard = (
        <section className="t-card t-card-pad flex flex-col gap-4" aria-labelledby="ns-price">
            <div className="flex flex-col gap-1">
                <h2 id="ns-price" className="t-label">
                    The owner pays
                </h2>
                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    {struckTotal !== null ? (
                        <span className="text-base tabular-nums text-r1-ink-3 line-through decoration-r1-ink-3">
                            <span className="sr-only">Was </span>
                            {formatMoney(struckTotal)}
                        </span>
                    ) : null}
                    <span className="t-figure">
                        {struckTotal !== null ? <span className="sr-only">Now </span> : null}
                        {formatMoney(totalAmount)}
                    </span>
                </p>
                {discount && struckTotal !== null ? <Status tone="done" word={`${discount.percentOff}% off`} /> : null}
                <p className="t-meta">Once, only after the site is live, by bank transfer.</p>
            </div>
            <div className="flex flex-col gap-2">
                <MoneyLines>
                    <MoneyLine
                        label="Website, your price"
                        meta={discount && wantsCustomDomain ? `${discount.percentOff}% off` : undefined}
                        amount={
                            discount && wantsCustomDomain ? (
                                <>
                                    <span className="mr-2 font-normal text-r1-ink-3 line-through decoration-r1-ink-3">
                                        <span className="sr-only">Was </span>
                                        {formatMoney(discount.listPrice)}
                                    </span>
                                    <span className="sr-only">Now </span>
                                    {formatMoney(sellPrice)}
                                </>
                            ) : (
                                formatMoney(sellPrice)
                            )
                        }
                    />
                    {wantsCustomDomain && <MoneyLine label="Custom domain, year 1" amount={formatMoney(domainAddOnFor(tier, domainPricePHP || undefined))} />}
                </MoneyLines>
                <div className="flex flex-col gap-2 pt-1">
                    <label htmlFor={priceId} className="t-field-label">
                        Your price
                    </label>
                    <input
                        id={priceId}
                        type="range"
                        min={BASE_PRICE}
                        max={PRICE_CEILING}
                        step={100}
                        value={sellPrice}
                        aria-valuetext={discount ? `${formatMoney(sellPrice)}, ${discount.percentOff}% off` : `${formatMoney(sellPrice)}, no discount`}
                        onChange={(e) => {
                            setSellPrice(clampSellPrice(Number(e.target.value)))
                            setDirty(true)
                        }}
                        className="w-full accent-r1-ink"
                        disabled={busy}
                    />
                    <p className="t-meta">
                        Slide left to give the owner a discount, down to {formatMoney(BASE_PRICE)}. You keep {Math.round(COMMISSION_RATE * 100)}%.
                    </p>
                </div>
            </div>
            <hr className="t-divider" />
            <Checkbox
                checked={domainOn}
                onChange={(e) => {
                    setDomainOn(e.target.checked)
                    setDirty(true)
                }}
                disabled={busy}
                label={
                    <>
                        <span className="flex-1">Add a custom domain</span>
                        <span className="t-meta t-num">+{formatMoney(domainAddOnFor("with_custom_domain", domainPricePHP || undefined))}</span>
                    </>
                }
            />
            {domainOn && (
                <div className="flex flex-col gap-2">
                    <Field label="Domain" required error={domainError}>
                        <Input
                            type="text"
                            autoComplete="off"
                            spellCheck={false}
                            autoCapitalize="none"
                            placeholder="e.g. yourbusiness.com"
                            className="t-mono"
                            value={domainInput}
                            onChange={(e) => {
                                setDomainInput(e.target.value.replace(/\s/g, "").toLowerCase())
                                setDirty(true)
                            }}
                            disabled={busy}
                        />
                    </Field>
                    {domainState === "checking" && <p className="t-meta">Checking {typedDomain}…</p>}
                    {domainState === "ok" && (
                        <Status tone="done" word={`${check?.domain || typedDomain} is available`} className="whitespace-normal [overflow-wrap:anywhere]" />
                    )}
                    {suggestions}
                    <p className="t-help">
                        Year 1 is included. After that the owner pays the renewal each year; we never renew on our own, and we remind them 30 days before.
                    </p>
                </div>
            )}
            <hr className="t-divider" />
            <div className="flex flex-col gap-1">
                <p className="t-h2">You earn {formatMoney(payout)}</p>
                <p className="t-meta">Lands in your Wallet when the owner pays. The domain add-on is not part of your share.</p>
            </div>
        </section>
    )

    return (
        <SubmitFrame
            step={3}
            rail={priceCard}
            railLabel="Price"
            after={
                <div className="flex flex-col gap-1.5">
                    <Checkbox
                        className="items-start [&>input]:mt-px"
                        checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)}
                        disabled={busy}
                        aria-invalid={confirmError ? true : undefined}
                        aria-describedby={confirmError ? confirmErrorId : undefined}
                        label={
                            <span>
                                This is a real business, and {who} agreed to pay {formatMoney(totalAmount)} once the site is live.
                            </span>
                        }
                    />
                    {confirmError && (
                        <p id={confirmErrorId} className="t-error pl-7">
                            Tick this to send it. Ask the owner first if you have not.
                        </p>
                    )}
                </div>
            }
            bar={
                <ActionBar back="/submit/interview" message={barMessage} error={barError}>
                    <Button onClick={handleSaveDraft} disabled={busy}>
                        Save draft
                    </Button>
                    <Button variant="primary" onClick={handleSubmit} disabled={busy} aria-busy={submitting}>
                        {!submitting && <Icon icon={Send} />}
                        {submitting ? "Sending…" : "Send for review"}
                    </Button>
                </ActionBar>
            }
        >
            <div className="flex flex-col gap-1.5">
                <h2 className="t-h2">Check it, then send</h2>
                <p className="t-body">Go through it with the owner before you leave. After you send it, changes go through Help.</p>
            </div>

            <div className="flex flex-col gap-4">
                {/* Business Info Section */}
                <section className="t-card t-card-pad flex flex-col gap-4" aria-labelledby="ns-r-business">
                    <SectionHead id="ns-r-business" title="Business" edit="/submit/info" editLabel="Edit business details" />
                    <dl className="m-0 grid gap-4 sm:grid-cols-2 sm:gap-x-6">
                        <div className="flex min-w-0 flex-col gap-0.5">
                            <dt className="t-label">Business</dt>
                            <dd className="t-body m-0 text-r1-ink">{submission.businessName}</dd>
                            <dd className="t-meta m-0">{submission.businessType}</dd>
                        </div>
                        <div className="flex min-w-0 flex-col gap-0.5">
                            <dt className="t-label">Owner</dt>
                            <dd className="t-body m-0 text-r1-ink">{submission.ownerName}</dd>
                            <dd className="t-meta t-num m-0 [overflow-wrap:anywhere]">
                                {phoneForReading(submission.ownerPhone)}
                                {submission.ownerEmail ? ` · ${submission.ownerEmail}` : " · No email"}
                            </dd>
                        </div>
                        <div className="flex min-w-0 flex-col gap-0.5 sm:col-span-2">
                            <dt className="t-label">Address</dt>
                            <dd className="t-body m-0">{[submission.address, submission.city].filter(Boolean).join(", ")}</dd>
                        </div>
                    </dl>
                </section>

                {/* Photos Section */}
                <section className="t-card t-card-pad flex flex-col gap-3" aria-labelledby="ns-r-photos">
                    <SectionHead
                        id="ns-r-photos"
                        title={
                            <>
                                Photos <span className="t-count">{photoCount}</span>
                            </>
                        }
                        edit="/submit/photos"
                        editLabel="Edit photos"
                    />
                    {photoCount > 0 ? (
                        <div className="grid grid-cols-4 gap-2">
                            {(submission.photos ?? []).slice(0, 4).map((p, i) => {
                                const url = photoUrls?.[i] ?? directMediaUrl(p)
                                return (
                                    <div key={i} className="relative aspect-square overflow-hidden rounded-r1 bg-r1-fill">
                                        {url && !url.startsWith("convex:") ? (
                                            // Photos live on R2 and Convex storage; next/image would need every host configured.
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={url} alt={`Photo ${i + 1}`} className="absolute inset-0 h-full w-full object-cover" />
                                        ) : (
                                            <Skeleton height="100%" className="rounded-none" />
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <p className="t-body">No photos yet</p>
                    )}
                    {photoCount > 4 && <p className="t-meta t-num">And {photoCount - 4} more</p>}
                </section>

                {/* Interview Section */}
                <section className="t-card t-card-pad flex flex-col gap-3" aria-labelledby="ns-r-interview">
                    <SectionHead id="ns-r-interview" title="Interview" edit="/submit/interview" editLabel="Edit interview" />
                    <p className="t-body">{hasVideo ? "Video interview" : hasAudio ? "Audio interview" : "No interview yet"}</p>

                    {/* Media Player */}
                    {interviewUrl &&
                        (hasVideo ? (
                            <video src={interviewUrl} controls playsInline className="max-h-64 w-full rounded-r1 bg-r1-ink" preload="metadata" />
                        ) : hasAudio ? (
                            <audio src={interviewUrl} controls className="w-full" preload="metadata" />
                        ) : null)}
                    {(hasVideo || hasAudio) && !interviewUrl && <p className="t-meta">Loading the recording…</p>}

                    {/* AI Transcript */}
                    {submission.transcript ? (
                        <Fold title="Transcript">
                            <div className="max-h-64 overflow-y-auto rounded-r1 bg-r1-fill-2 p-3">
                                <p className="whitespace-pre-wrap text-xs leading-relaxed text-r1-ink-2">{submission.transcript}</p>
                            </div>
                        </Fold>
                    ) : (hasVideo || hasAudio) && submission.transcriptionStatus === "processing" ? (
                        <Status tone="progress" word="Transcript being written" />
                    ) : null}
                </section>
            </div>
        </SubmitFrame>
    )
}
