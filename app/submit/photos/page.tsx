"use client"

import { useEffect, useId, useRef, useState, type ChangeEvent, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { useQuery, useMutation, useAction } from "convex/react"
import { ArrowRight, Camera, X } from "lucide-react"
import { toast } from "sonner"

import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { Button, Icon, Skeleton, Status, cx } from "@/components/r1"

import {
    MAX_PHOTOS,
    MAX_PHOTO_BYTES,
    MIN_PHOTOS,
    PHOTO_TYPES,
    directMediaUrl,
    errorText,
    fileSize,
    infoErrors,
    infoFromDoc,
    needRows,
    savedInterviewKind,
} from "../_components/flow"
import { ActionBar, DraftMissing, NeedsCard, StepLoading, SubmitFrame } from "../_components/SubmitFrame"
import { useRequiredDraftId } from "../_components/useDraftId"

/*
 * What to shoot (board: the six photo slots). `submissions.photos` carries no
 * roles; the Studio render assigns them by POSITION (convex/hyperagent.ts
 * PHOTO_ROLES), and this step has always sent the photos in the order they
 * were picked. Binding these six to named slots would change what the
 * Studio receives, so they are a shot list here, not slots. See the report.
 */
const SHOTS_FIRST = [
    { label: "Storefront", hint: "From across the street, with the sign readable." },
    { label: "Owner at work", hint: "Behind the counter or at the stove, facing the light." },
    { label: "Best dishes or products", hint: "The top 2 or 3 sellers, up close." },
]
const SHOTS_THEN = [
    { label: "Inside the shop", hint: "Where customers sit, order or line up." },
    { label: "Menu or price list", hint: "Straight on, so the prices can be read." },
    { label: "Anything else", hint: "The team, an award, the street at night." },
]

export default function UploadPhotosPage() {
    const router = useRouter()
    const { user, isLoaded, isSignedIn } = useUser()
    const inputRef = useRef<HTMLInputElement>(null)
    const errorId = useId()

    // Get creator from Convex
    const creator = useQuery(
        api.creators.getByClerkId,
        user ? { clerkId: user.id } : "skip"
    )

    // Mutations and Actions
    const generateR2UploadUrl = useAction(api.r2.generateUploadUrl)
    const updateSubmission = useMutation(api.submissions.update)

    const [loading, setLoading] = useState(false)
    // Upload or save failures (shown in the action bar).
    const [error, setError] = useState<string | null>(null)
    // Problems with the photos picked or removed (shown under the photos).
    const [pickError, setPickError] = useState<string | null>(null)
    // Continue was pressed with fewer than MIN_PHOTOS.
    const [showErrors, setShowErrors] = useState(false)

    // New files to upload
    const [files, setFiles] = useState<File[]>([])
    const [previews, setPreviews] = useState<string[]>([])

    // Load submission ID from session (back to step 1 without one)
    const submissionId = useRequiredDraftId()

    // Get submission if we have the ID
    const submission = useQuery(
        api.submissions.getById,
        submissionId ? { id: submissionId as Id<"submissions"> } : "skip"
    )

    // Already uploaded photos: the draft's list, or the list a removal is
    // writing right now (shown at once, put back if the write fails).
    const [optimisticPhotos, setOptimisticPhotos] = useState<string[] | null>(null)
    const pendingRemovals = useRef(0)
    const existingPhotos = optimisticPhotos ?? submission?.photos ?? []

    // Get resolved photo URLs
    const photoUrls = useQuery(
        api.files.getMultipleUrls,
        existingPhotos.length > 0 ? { storageIds: existingPhotos } : "skip"
    )

    // Redirect if not authenticated
    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            router.push("/login")
        }
    }, [isLoaded, isSignedIn, router])

    // Clean up object URLs when the page goes away
    const previewsRef = useRef<string[]>([])
    useEffect(() => {
        previewsRef.current = previews
    }, [previews])
    useEffect(() => {
        return () => {
            previewsRef.current.forEach((url) => URL.revokeObjectURL(url))
        }
    }, [])

    const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
        const input = e.target
        if (input.files) {
            const newFiles = Array.from(input.files)
            // Let the same photo be picked again after it was removed.
            input.value = ""
            const totalCount = files.length + existingPhotos.length + newFiles.length

            // Validate: Max 10 files total
            if (totalCount > MAX_PHOTOS) {
                setPickError(`That would make more than ${MAX_PHOTOS} photos. Remove some first, or pick fewer.`)
                return
            }

            // Validate: Max 10MB per file
            const oversizedFiles = newFiles.filter((file) => file.size > MAX_PHOTO_BYTES)
            if (oversizedFiles.length > 0) {
                setPickError("Some photos are over 10 MB. Pick smaller ones.")
                return
            }

            // check duplicate files (simple name check against current batch)
            const uniqueFiles = newFiles.filter(
                (newFile) => !files.some((file) => file.name === newFile.name && file.size === newFile.size)
            )

            // Validate: Must be JPG, JPEG, or PNG only (required by Airtable pipeline)
            const invalidFiles = uniqueFiles.filter((file) => !PHOTO_TYPES.includes(file.type))
            if (invalidFiles.length > 0) {
                const names = invalidFiles.map((f) => f.name).join(", ")
                setPickError(`Only JPG and PNG photos work. Not these: ${names}`)
                return
            }

            if (uniqueFiles.length === 0 && newFiles.length > 0 && files.length > 0) {
                setPickError("You already added these photos.")
                return
            }

            setPickError(null)
            setFiles((prev) => [...prev, ...uniqueFiles])

            // Create previews
            const newPreviews = uniqueFiles.map((file) => URL.createObjectURL(file))
            setPreviews((prev) => [...prev, ...newPreviews])
        }
    }

    const removeFile = (index: number) => {
        const newFiles = [...files]
        const newPreviews = [...previews]

        URL.revokeObjectURL(newPreviews[index])

        newFiles.splice(index, 1)
        newPreviews.splice(index, 1)

        setFiles(newFiles)
        setPreviews(newPreviews)
    }

    const removeExistingPhoto = async (index: number) => {
        if (!submissionId) return

        const newExistingPhotos = [...existingPhotos]
        newExistingPhotos.splice(index, 1)
        setOptimisticPhotos(newExistingPhotos)
        pendingRemovals.current += 1

        // Update submission in database immediately
        try {
            await updateSubmission({
                id: submissionId as Id<"submissions">,
                photos: newExistingPhotos,
            })
            pendingRemovals.current -= 1
            // The draft now says the same; show it once nothing else is in flight.
            if (pendingRemovals.current === 0) setOptimisticPhotos(null)
        } catch (err) {
            console.error("Error removing photo:", err)
            pendingRemovals.current -= 1
            // Revert on error
            setOptimisticPhotos(null)
            setPickError("The photo was not removed. Try again.")
        }
    }

    // Upload each NEW file to R2 storage and save the list. Shared by Continue
    // and Save draft; the order is the draft's photos, then the new ones in
    // the order they were picked.
    const uploadAndSave = async (id: string) => {
        const uploadedUrls: string[] = []

        for (const file of files) {
            // Get presigned upload URL from R2 action
            const { uploadUrl, publicUrl } = await generateR2UploadUrl({
                fileName: file.name,
                fileType: file.type,
                submissionId: id,
                mediaType: "photo",
            })

            // Upload the file directly to R2
            const result = await fetch(uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": file.type },
                body: file,
            })

            if (!result.ok) {
                throw new Error(`Failed to upload ${file.name}`)
            }

            // Store the public R2 URL
            uploadedUrls.push(publicUrl)
        }

        // Combine existing photos + new uploads
        const finalPhotoList = [...existingPhotos, ...uploadedUrls]

        // Update submission record
        await updateSubmission({
            id: id as Id<"submissions">,
            photos: finalPhotoList,
        })
    }

    const handleNext = async () => {
        if (!submissionId) return

        const totalPhotos = files.length + existingPhotos.length

        // Validate: Min 3 photos
        if (totalPhotos < MIN_PHOTOS) {
            setShowErrors(true)
            return
        }

        setLoading(true)
        setError(null)

        try {
            await uploadAndSave(submissionId)
            // Navigate to next step
            router.push("/submit/interview")
        } catch (err) {
            console.error("Error uploading photos:", err)
            setError(errorText(err, "Failed to upload photos. Please try again."))
        } finally {
            setLoading(false)
        }
    }

    const handleSaveDraft = async () => {
        if (!submissionId) return
        setLoading(true)
        setError(null)
        try {
            await uploadAndSave(submissionId)
            // Saved: they are the draft's photos now, not pending ones.
            previews.forEach((url) => URL.revokeObjectURL(url))
            setFiles([])
            setPreviews([])
            toast.success("Draft saved. It is waiting in Submissions.")
        } catch (err) {
            console.error("Error uploading photos:", err)
            setError(errorText(err, "Failed to upload photos. Please try again."))
        } finally {
            setLoading(false)
        }
    }

    // Loading state
    if (!isLoaded || !isSignedIn || creator === undefined || !submissionId || submission === undefined) {
        return (
            <SubmitFrame step={1}>
                <StepLoading label="Loading the photos" shape="tiles" />
            </SubmitFrame>
        )
    }

    if (submission === null) {
        return (
            <SubmitFrame step={1}>
                <DraftMissing />
            </SubmitFrame>
        )
    }

    const totalCount = files.length + existingPhotos.length
    const short = showErrors && totalCount < MIN_PHOTOS

    const rows = needRows({
        step: 1,
        businessErrors: infoErrors(infoFromDoc(submission)),
        photoCount: totalCount,
        interview: savedInterviewKind(submission),
        ownerName: submission.ownerName,
    })

    let barMessage: ReactNode = `Step 2 of 4 · ${files.length > 0 ? "Not saved yet" : "Draft saved"}`
    let barError = false
    if (error) {
        barMessage = error
        barError = true
    } else if (short) {
        barMessage = `Add at least ${MIN_PHOTOS} photos to continue. ${totalCount} so far.`
        barError = true
    }

    const tileFrame = "relative h-[132px] overflow-hidden rounded-[10px] bg-r1-fill"

    return (
        <SubmitFrame
            step={1}
            rail={<NeedsCard rows={rows} />}
            railLabel="What is still needed"
            bar={
                <ActionBar back="/submit/info" message={barMessage} error={barError}>
                    <Button onClick={handleSaveDraft} disabled={loading}>
                        Save draft
                    </Button>
                    <Button variant="primary" onClick={handleNext} disabled={loading} aria-busy={loading}>
                        {loading ? (files.length > 0 ? `Uploading ${files.length} photos…` : "Saving…") : "Continue"}
                        {!loading && <Icon icon={ArrowRight} />}
                    </Button>
                </ActionBar>
            }
        >
            <section className="flex flex-col gap-6" aria-labelledby="ns-photos">
                <div className="flex flex-col gap-1.5">
                    <h2 id="ns-photos" className="t-h2">
                        Photos of the shop
                    </h2>
                    <p className="t-body">
                        Take them while you are there. At least {MIN_PHOTOS} are needed; more make a better site. JPG or PNG, up to 10 MB each,{" "}
                        {MAX_PHOTOS} photos at most.
                    </p>
                </div>

                <ul className="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-6 p-0 sm:grid-cols-3 sm:gap-x-5">
                    {/* Existing Photos (Saved) */}
                    {existingPhotos.map((originalUrl, index) => {
                        const resolvedUrl = photoUrls?.[index] ?? directMediaUrl(originalUrl) ?? ""
                        const isValidUrl = !!resolvedUrl && !resolvedUrl.startsWith("convex:")
                        return (
                            <li key={`${originalUrl}-${index}`} className="flex min-w-0 flex-col gap-2.5">
                                <div className={tileFrame}>
                                    {isValidUrl ? (
                                        // Photos live on R2 and Convex storage; next/image would need every host configured.
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={resolvedUrl} alt={`Photo ${index + 1}`} className="h-full w-full object-cover" />
                                    ) : (
                                        <Skeleton height="100%" className="rounded-none" />
                                    )}
                                    <Button
                                        size="sm"
                                        icon
                                        className="absolute right-2 top-2 bg-r1-paper"
                                        aria-label={`Remove photo ${index + 1}`}
                                        onClick={() => removeExistingPhoto(index)}
                                        disabled={loading}
                                    >
                                        <Icon icon={X} />
                                    </Button>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-medium text-r1-ink">Photo {index + 1}</span>
                                    <Status tone="done" word="Added" />
                                </div>
                            </li>
                        )
                    })}

                    {/* New Photos (Pending) */}
                    {files.map((file, index) => (
                        <li key={previews[index]} className="flex min-w-0 flex-col gap-2.5">
                            <div className={tileFrame}>
                                {/* A local preview (blob: URL) of a photo not uploaded yet. */}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={previews[index]} alt={`New photo ${file.name}`} className="h-full w-full object-cover" />
                                <Button
                                    size="sm"
                                    icon
                                    className="absolute right-2 top-2 bg-r1-paper"
                                    aria-label={`Remove ${file.name}`}
                                    onClick={() => removeFile(index)}
                                    disabled={loading}
                                >
                                    <Icon icon={X} />
                                </Button>
                            </div>
                            <div className="flex min-w-0 flex-col gap-0.5">
                                <span className="truncate text-sm font-medium text-r1-ink">{file.name}</span>
                                <span className="t-meta t-num">{fileSize(file.size)} · uploads when you continue</span>
                            </div>
                        </li>
                    ))}

                    {totalCount < MAX_PHOTOS && (
                        <li className="flex min-w-0 flex-col gap-2.5">
                            <button
                                type="button"
                                className={cx(
                                    "flex h-[132px] w-full flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed bg-r1-paper text-[13px] font-medium text-r1-ink-2 hover:bg-r1-fill-2 disabled:cursor-not-allowed disabled:opacity-45",
                                    short ? "border-r1-red" : "border-r1-line-2 hover:border-[var(--r1-line-hover)]",
                                )}
                                onClick={() => inputRef.current?.click()}
                                disabled={loading}
                                aria-describedby={short ? errorId : undefined}
                            >
                                <Icon icon={Camera} size={20} />
                                Take or add photo
                            </button>
                            {short && (
                                <p id={errorId} className="t-error">
                                    {MIN_PHOTOS - totalCount === 1 ? "1 more needed" : `${MIN_PHOTOS - totalCount} more needed`}
                                </p>
                            )}
                        </li>
                    )}
                </ul>

                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept=".jpg,.jpeg,.png"
                    onChange={handleFileSelect}
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden="true"
                    disabled={loading || totalCount >= MAX_PHOTOS}
                />

                <div className="flex flex-col gap-1">
                    <p className="t-meta t-num">
                        {totalCount} of {MAX_PHOTOS} photos ·{" "}
                        {totalCount >= MIN_PHOTOS ? `the ${MIN_PHOTOS} needed are in` : `at least ${MIN_PHOTOS} needed`}
                    </p>
                    {pickError && (
                        <p className="t-error" role="alert">
                            {pickError}
                        </p>
                    )}
                </div>
            </section>

            <section className="t-card t-card-pad flex flex-col gap-4" aria-labelledby="ns-shots">
                <h2 id="ns-shots" className="t-h2">
                    What to shoot
                </h2>
                <div className="grid gap-5 sm:grid-cols-2 sm:gap-x-6">
                    {[
                        { title: "Start with these", shots: SHOTS_FIRST },
                        { title: "Then, if you can", shots: SHOTS_THEN },
                    ].map((group) => (
                        <div key={group.title} className="flex flex-col gap-3">
                            <h3 className="t-label">{group.title}</h3>
                            <ul className="m-0 flex list-none flex-col gap-3 p-0">
                                {group.shots.map((s) => (
                                    <li key={s.label} className="flex flex-col gap-0.5">
                                        <span className="text-sm font-medium text-r1-ink">{s.label}</span>
                                        <span className="t-meta">{s.hint}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </section>
        </SubmitFrame>
    )
}
