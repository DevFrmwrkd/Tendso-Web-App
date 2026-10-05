"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery } from "convex/react"
import { useUser } from "@clerk/nextjs"
import { ArrowLeft } from "lucide-react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { Button, EmptyState, Icon, Loading, Segmented, Skeleton } from "@/components/r1"
import WebsitePreview, { PREVIEW_DEVICE_OPTIONS, type PreviewDevice } from "@/components/WebsitePreview"
import { useMinWidth } from "@/components/editor/useMinWidth"

/**
 * The generated site, previewed (board Review: the preview frame with its
 * Desktop / Tablet / Phone sizes). A creator opens it for their own
 * submission, an admin for any.
 *
 * Same rules as before: signed-out visitors go to /login; a signed-in creator
 * who does not own the submission (and is not an admin) is refused; a
 * submission with no site yet says so.
 */
export default function WebsitePreviewPage() {
    const params = useParams()
    const router = useRouter()
    const submissionId = params.id as string
    const { user, isLoaded } = useUser()

    // Get generated website from Convex
    const website = useQuery(
        api.generatedWebsites.getBySubmissionId,
        submissionId ? { submissionId: submissionId as Id<"submissions"> } : "skip"
    )

    // Get submission to check ownership
    const submission = useQuery(
        api.submissions.getById,
        submissionId ? { id: submissionId as Id<"submissions"> } : "skip"
    )

    // Get current user's creator profile
    const currentCreator = useQuery(
        api.creators.getByClerkId,
        user?.id ? { clerkId: user.id } : "skip"
    )

    useEffect(() => {
        if (isLoaded && !user) router.push('/login')
    }, [isLoaded, user, router])

    // The size the frame shows. Until someone picks one it follows the
    // screen: a phone previews the phone layout, a desk the desktop one.
    const [deviceChoice, setDeviceChoice] = useState<PreviewDevice | null>(null)
    const small = !useMinWidth(640)
    const device: PreviewDevice = deviceChoice ?? (small ? "phone" : "desktop")

    const loading = !isLoaded || website === undefined || submission === undefined

    // Check if user owns this submission or is admin
    const denied =
        isLoaded && !!user && !!submission && !!currentCreator &&
        submission.creatorId !== currentCreator._id && currentCreator.role !== 'admin'
    const error = !isLoaded || !user
        ? null
        : denied
            ? "You do not have permission to view this website"
            : website === null
                ? "This website has not been generated yet"
                : null

    if (loading) {
        return (
            <div className="r1 flex h-dvh flex-col bg-r1-paper">
                <Loading label="Loading the website preview" className="flex min-h-0 flex-1 flex-col">
                    <div className="flex h-16 flex-none items-center gap-3 border-b border-r1-line px-4">
                        <Skeleton width={84} height={32} />
                        <Skeleton width={220} height={22} />
                    </div>
                    <div className="flex flex-1 items-start justify-center bg-r1-fill-2 p-6">
                        <Skeleton width="100%" height="70%" className="max-w-[900px] rounded-r1-card" />
                    </div>
                </Loading>
            </div>
        )
    }

    if (error) {
        return (
            <div className="r1 flex min-h-dvh items-center justify-center bg-r1-paper p-4">
                <EmptyState
                    title={error}
                    body={website === null && !denied ? "It shows here once the site is generated." : undefined}
                    action={<Button onClick={() => router.back()}>Go back</Button>}
                />
            </div>
        )
    }

    const htmlUrl = website?.htmlUrl || undefined
    const label = website?.offlineAt
        ? "Offline · visitors see a holding page"
        : website?.publishedUrl
            ? (
                <>
                    Live at{" "}
                    <a href={website.publishedUrl} target="_blank" rel="noopener noreferrer" className="t-link">
                        {website.publishedUrl.replace(/^https?:\/\//i, "").replace(/\/$/, "")}
                    </a>
                </>
            )
            : "Preview · not live yet"

    return (
        <div className="r1 flex h-dvh flex-col bg-r1-paper">
            <header className="flex flex-none flex-wrap items-center gap-x-3 gap-y-2 border-b border-r1-line px-3 py-2.5 sm:h-16 sm:flex-nowrap sm:px-4 sm:py-0">
                <Button variant="ghost" className="flex-none px-2.5" onClick={() => router.back()}>
                    <Icon icon={ArrowLeft} />
                    Back
                </Button>
                <span className="hidden h-7 w-px flex-none bg-r1-line sm:block" aria-hidden="true" />
                {/* On a phone the title takes its own line under Back and the sizes. */}
                <div className="order-last flex min-w-0 basis-full flex-col gap-0.5 sm:order-none sm:flex-1 sm:basis-0">
                    <h1 className="truncate font-r1-serif text-[22px] font-normal leading-7 tracking-[-0.01em] text-r1-ink sm:text-2xl">
                        {submission?.businessName || "Website preview"}
                    </h1>
                    <p className="truncate text-[13px] leading-4 text-r1-ink-3">Website preview</p>
                </div>
                <Segmented
                    label="Preview size"
                    options={PREVIEW_DEVICE_OPTIONS}
                    value={device}
                    onChange={setDeviceChoice}
                    className="ml-auto flex-none sm:ml-0"
                />
            </header>
            <WebsitePreview
                className="flex-1"
                device={device}
                src={htmlUrl}
                html={htmlUrl ? undefined : (website?.htmlContent || '')}
                title="Website Preview"
                sandbox="allow-scripts allow-same-origin"
                label={label}
            />
        </div>
    )
}
