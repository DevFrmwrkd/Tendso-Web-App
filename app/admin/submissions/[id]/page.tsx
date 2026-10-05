"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { Check, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { isComped, normalizeCampaign } from "@/lib/pricing";
import { isHouseCreator } from "@/lib/houseCreator";
import { buildMediaFileList, downloadMediaZip } from "@/lib/mediaZip";
import { orderedEnhancedEntries } from "@/convex/lib/enhancedImages";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import SandboxEditorV3 from "@/components/editor/SandboxEditorV3";
import type { EditorJson, EditorTools } from "@/components/editor/editorProps";
import { useMinWidth } from "@/components/editor/useMinWidth";
import { Button, ButtonLink, Dot, Drawer, EmptyState, Icon, Loading, Skeleton, SkeletonText, type MenuItem } from "@/components/r1";
import { DeleteDialog, GiveFreeDialog, MarkPaidDialog, RejectDialog } from "./_components/ActionDialogs";
import { DetailsContent, type FoldKey } from "./_components/DetailsPanel";
import { PregenOverview } from "./_components/PregenOverview";
import { ReviewHeader } from "./_components/ReviewHeader";
import { ReviewRail } from "./_components/ReviewRail";
import { buildIntakeRows, checklistFor, clientEmailsFor, formatDate } from "./_components/review";

/**
 * The review & editor workspace (board Review): one submission, from "is
 * everything here?" to "the site is live and paid".
 *
 * Three states, as before: before a site exists the page is an overview of
 * what was sent with Generate as its action; while generating it says so; once
 * a site exists it is the editor (SandboxEditorV3), with the details docked
 * beside the preview on a wide screen and in a drawer below that.
 *
 * Round 1 merged the old top action bar and the editor's toolbar into ONE
 * header: one primary action chosen by the state, everything else in More. The
 * result modal became toasts; the custom-domain and sent-emails pages became
 * folds in the details (their routes redirect here with ?fold=domain|emails).
 * Every handler below is the old page's, with the same routes, arguments and
 * order; only where its outcome is reported changed.
 */
export default function SubmissionReviewPage() {
    // useSearchParams (?fold=) needs a Suspense boundary for the Next build.
    return (
        <Suspense fallback={<WorkspaceSkeleton />}>
            <SubmissionReview />
        </Suspense>
    );
}

const FOLDS: FoldKey[] = ["answers", "transcript", "checklist", "emails", "domain"];
function parseFold(value: string | null): FoldKey | null {
    return value && (FOLDS as string[]).includes(value) ? (value as FoldKey) : null;
}

/** The skeleton of the workspace: header, panel, preview. Same shape as the page. */
function WorkspaceSkeleton() {
    return (
        <div className="r1 flex h-dvh overflow-hidden bg-r1-paper">
            <Loading label="Loading the submission" className="flex min-w-0 flex-1 flex-col">
                <div className="flex h-16 flex-none items-center gap-3 border-b border-r1-line px-4">
                    <Skeleton width={110} height={28} />
                    <Skeleton width={240} height={22} />
                    <span className="ml-auto flex gap-2">
                        <Skeleton width={96} height={40} />
                        <Skeleton width={40} height={40} />
                    </span>
                </div>
                <div className="flex min-h-0 flex-1">
                    <div className="hidden w-80 flex-none flex-col gap-4 border-r border-r1-line p-5 lg:flex">
                        <Skeleton width="70%" height={16} />
                        <SkeletonText lines={5} />
                    </div>
                    <div className="flex flex-1 items-start justify-center bg-r1-fill-2 p-6">
                        <Skeleton width="100%" height="70%" className="max-w-[900px] rounded-r1-card" />
                    </div>
                </div>
            </Loading>
        </div>
    );
}

function SubmissionReview() {
    const params = useParams();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const submissionId = params.id as string;
    const { user, isLoaded } = useUser();

    const currentCreator = useQuery(
        api.creators.getByClerkId,
        user ? { clerkId: user.id } : "skip"
    );
    const isAdmin = currentCreator?.role === "admin";

    const submissionData = useQuery(
        api.submissions.getByIdWithCreator,
        isAdmin && submissionId ? { id: submissionId as Id<"submissions"> } : "skip"
    );

    // Photo URL resolution (HTTP + Convex storage)
    const photoStorageIdsForQuery = submissionData?.photos?.filter((p) => !p.startsWith("http")) || [];
    const photoViaResolve = useQuery(
        api.files.getMultipleUrls,
        photoStorageIdsForQuery.length > 0 ? { storageIds: photoStorageIdsForQuery } : "skip"
    );
    const photoUrls = (() => {
        const result: string[] = [];
        if (submissionData?.photos) {
            for (const photo of submissionData.photos) {
                if (photo.startsWith("http")) result.push(photo);
            }
        }
        if (photoViaResolve && Array.isArray(photoViaResolve)) {
            for (const url of photoViaResolve) {
                if (url && typeof url === "string") result.push(url);
            }
        }
        return result;
    })();

    const existingWebsite = useQuery(
        api.generatedWebsites.getBySubmissionId,
        submissionData ? { submissionId: submissionData._id } : "skip"
    );

    // The Worker is serving the holding page rather than the site. Kept off the
    // local websitePublishedUrl state deliberately: that state is seeded once
    // from the row, while this has to track the row live so a restore lights
    // the buttons back up on its own.
    const websiteOffline = !!existingWebsite?.offlineAt;
    // Stale-publish signal. A regenerate (every Save in the editor runs one)
    // resets generatedWebsites.status to 'draft' while publishedUrl stays set —
    // so `draft + publishedUrl` means the live Worker is still serving the OLD
    // HTML. Read straight off the reactive row, so it clears by itself the
    // moment the republish lands.
    const publishStale = !!existingWebsite?.publishedUrl && existingWebsite?.status === "draft";

    const websiteImages = (existingWebsite?.extractedContent as EditorJson)?.images as string[] | undefined;
    const needsHeroResolution = websiteImages?.some((p) => !p.startsWith("http"));
    const heroImageUrls = useQuery(
        api.files.getMultipleUrls,
        needsHeroResolution && websiteImages && websiteImages.length > 0
            ? { storageIds: websiteImages }
            : "skip"
    );

    const websiteContentRecord = useQuery(
        api.websiteContent.getBySubmissionId,
        submissionData ? { submissionId: submissionData._id } : "skip"
    );

    // Approval history, read from the audit log: has this submission been
    // approved since it was last rejected? The status cannot say — a rebuild
    // puts an approved site back to website_generated — and approving twice is
    // not harmless (approveSubmission re-notifies the creator and counts the
    // approval again), so the primary action only approves when no approval
    // stands.
    const auditLogs = useQuery(
        api.auditLogs.getByTarget,
        isAdmin && submissionData ? { targetType: "submission", targetId: submissionData._id } : "skip"
    );
    const approvedBefore: boolean | undefined = (() => {
        if (auditLogs === undefined) return undefined;
        let lastApproved = 0;
        let lastRejected = 0;
        for (const log of auditLogs) {
            if (log.action === "submission_approved") lastApproved = Math.max(lastApproved, log.timestamp);
            if (log.action === "submission_rejected") lastRejected = Math.max(lastRejected, log.timestamp);
        }
        return lastApproved > 0 && lastApproved >= lastRejected;
    })();

    // Enhanced image extraction
    const enhancedImageData = (() => {
        let enhancedImages = (existingWebsite as EditorJson)?.enhancedImages || null;
        if (!enhancedImages) {
            enhancedImages = (existingWebsite?.extractedContent as EditorJson)?.enhancedImages || null;
        }
        if (!enhancedImages) {
            enhancedImages = (websiteContentRecord as EditorJson)?.enhancedImages || null;
        }
        if (!enhancedImages || typeof enhancedImages !== "object") return null;
        return enhancedImages as Record<string, { url?: string; storageId?: string }>;
    })();

    const enhancedImagesByCategory = (() => {
        if (!enhancedImageData) return null;
        const categories: Record<string, string[]> = {};
        const allUrls: string[] = [];
        // Page order: the latest render first, images kept from earlier renders
        // (archive_N) after it — so the picker's AI-enhanced tab leads with the set
        // the admin just rendered rather than whatever order the object lists.
        for (const [key, img] of orderedEnhancedEntries(enhancedImageData)) {
            let imageUrl = "";
            if (typeof img === "string") {
                imageUrl = img;
            } else if (img && typeof img === "object") {
                imageUrl = img.storageId || img.url || "";
            }
            if (!imageUrl) continue;
            if (imageUrl.includes("airtableusercontent.com")) continue;
            allUrls.push(imageUrl);
            // Supports legacy role keys (headshot/interior/exterior/product) AND
            // Tendso Studio v0.2 placement keys (hero/portrait/gallery_N).
            const lowerKey = key.toLowerCase();
            if (lowerKey.includes("interior") || lowerKey.includes("headshot") || lowerKey.includes("portrait") || lowerKey.includes("gallery")) {
                categories.about = categories.about || [];
                categories.about.push(imageUrl);
            }
            if (lowerKey.includes("product") || lowerKey.includes("gallery")) {
                categories.featured = categories.featured || [];
                categories.featured.push(imageUrl);
            }
            if (lowerKey.includes("hero") || lowerKey.includes("exterior") || lowerKey.includes("headshot") || lowerKey.includes("portrait")) {
                categories.hero = categories.hero || [];
                categories.hero.push(imageUrl);
            }
            if (lowerKey.includes("interior") || lowerKey.includes("exterior") || lowerKey.includes("gallery")) {
                categories.services = categories.services || [];
                categories.services.push(imageUrl);
            }
        }
        return { categories, allUrls };
    })();

    const enhancedUrls = enhancedImagesByCategory?.allUrls || [];
    const enhancedStorageIds = enhancedUrls.filter((u) => !u.startsWith("http"));
    const enhancedHttpUrls = enhancedUrls.filter((u) => u.startsWith("http"));
    const resolvedEnhancedUrls = useQuery(
        api.files.getMultipleUrls,
        enhancedStorageIds.length > 0 ? { storageIds: enhancedStorageIds } : "skip"
    );

    const enhancedUrlMap = (() => {
        const map: Record<string, string> = {};
        if (resolvedEnhancedUrls) {
            enhancedStorageIds.forEach((sid, i) => {
                if (resolvedEnhancedUrls[i]) map[sid] = resolvedEnhancedUrls[i]!;
            });
        }
        enhancedHttpUrls
            .filter((url) => !url.includes("airtableusercontent.com"))
            .forEach((url) => {
                map[url] = url;
            });
        return map;
    })();

    const resolveEnhancedUrl = (url: string): string | null => {
        if (!url) return null;
        if (url.includes("airtableusercontent.com")) return null;
        if (url.startsWith("http")) return url;
        return enhancedUrlMap[url] || null;
    };

    // Video/audio resolution
    const hasR2VideoUrl = !!submissionData?.videoUrl;
    const hasR2AudioUrl = !!submissionData?.audioUrl;
    const resolvedVideoUrls = useQuery(
        api.files.getMultipleUrls,
        !hasR2VideoUrl && submissionData?.videoStorageId
            ? { storageIds: [submissionData.videoStorageId.toString()] }
            : "skip"
    );
    const legacyVideoUrl = resolvedVideoUrls?.[0] || null;
    const resolvedAudioUrls = useQuery(
        api.files.getMultipleUrls,
        !hasR2AudioUrl && submissionData?.audioStorageId
            ? { storageIds: [submissionData.audioStorageId.toString()] }
            : "skip"
    );
    const legacyAudioUrl = resolvedAudioUrls?.[0] || null;

    const videoUrl = hasR2VideoUrl ? submissionData?.videoUrl : legacyVideoUrl;
    const audioUrl = hasR2AudioUrl ? submissionData?.audioUrl : legacyAudioUrl;

    // Mutations
    const updateStatusMutation = useMutation(api.submissions.updateStatus);
    const approveSubmissionMutation = useMutation(api.admin.approveSubmission);
    const rejectSubmissionMutation = useMutation(api.admin.rejectSubmission);
    const markDeployedMutation = useMutation(api.admin.markDeployed);
    const logTranscriptionRegeneratedMutation = useMutation(api.admin.logTranscriptionRegenerated);
    const logImagesEnhancedMutation = useMutation(api.admin.logImagesEnhanced);
    // Enhance Images now routes to Hyperagent (Tendso Studio), not Airtable.
    const triggerAirtablePushMutation = useMutation(api.hyperagent.triggerStudioRenderPublic);

    const authLoading = !isLoaded || (user && currentCreator === undefined);
    const dataLoading = isAdmin && submissionData === undefined;

    // v3 IS THE EDITOR. The stored preference from the retired version toggle
    // is MIGRATED, not just ignored: the key persisted "v1" per-browser for as
    // long as the toggle existed, so it is rewritten here once.
    useEffect(() => {
        try {
            if (window.localStorage.getItem("tendso.editorVersion") !== "v3") {
                window.localStorage.setItem("tendso.editorVersion", "v3");
            }
        } catch {
            /* localStorage unavailable — v3 is the default regardless */
        }
    }, []);

    // Details: closed by default so the editor lands on the panels + preview.
    // ?fold=domain|emails (the old /domain and /emails routes) opens them at
    // that fold.
    const initialFold = parseFold(searchParams.get("fold"));
    const [detailsOpen, setDetailsOpen] = useState(() => initialFold !== null);
    const [detailsFold, setDetailsFold] = useState<FoldKey | null>(initialFold);
    // Docked beside the preview on a wide screen; a drawer below that.
    const isWide = useMinWidth(1280);

    const [updating, setUpdating] = useState(false);
    const [transcribing, setTranscribing] = useState(false);
    const [enhancing, setEnhancing] = useState(false);

    const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
    const [markingPaid, setMarkingPaid] = useState(false);

    const [showGiveFreeModal, setShowGiveFreeModal] = useState(false);
    const [giveFreeReason, setGiveFreeReason] = useState("");
    // Self-serve only: the name the owner's email credits with the gift.
    const [giveFreeGiftedBy, setGiveFreeGiftedBy] = useState("");
    // "Downloading 3/16…" while the media zip is being built; null when idle.
    const [mediaZipProgress, setMediaZipProgress] = useState<string | null>(null);
    const [markingComped, setMarkingComped] = useState(false);

    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("");
    const [rejectionReasonMissing, setRejectionReasonMissing] = useState(false);
    const [rejecting, setRejecting] = useState(false);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting] = useState(false);
    // Deleted cleanly and on the way back to the list.
    const [leaving, setLeaving] = useState(false);
    // Set when a delete succeeded in Convex but left external assets behind.
    // It cannot live in a dialog: the row this page renders is gone the moment
    // the mutation commits, so the page would unmount it with everything else.
    // Rendered standalone, above the "no submission" guard.
    const [orphanedAssetsNotice, setOrphanedAssetsNotice] = useState<{
        businessName: string;
        failed: Array<{ asset: string; error: string }>;
    } | null>(null);

    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);

    const [generatingWebsite, setGeneratingWebsite] = useState(false);
    const [websiteGenerated, setWebsiteGenerated] = useState(false);
    const [websiteHtmlContent, setWebsiteHtmlContent] = useState<string | null>(null);
    const [websiteContent, setWebsiteContent] = useState<EditorJson>(null);
    const [websiteCustomizations, setWebsiteCustomizations] = useState<EditorJson>(null);
    const [websiteError, setWebsiteError] = useState<string | null>(null);
    const [websitePublishedUrl, setWebsitePublishedUrl] = useState<string | null>(null);

    const [publishingWebsite, setPublishingWebsite] = useState(false);
    const [republishingWebsite, setRepublishingWebsite] = useState(false);
    const [unpublishingWebsite, setUnpublishingWebsite] = useState(false);
    const [sendingEmail, setSendingEmail] = useState(false);
    const [sendingFollowUp, setSendingFollowUp] = useState(false);

    // ── The website row, mirrored into local state ────────────────────────
    // Re-seeded every time the reactive row changes; between changes, what
    // generate / save / publish return overrides it (so the editor shows a
    // fresh build at once). Done during render rather than in an effect: the
    // row is the source, and copying it after paint only showed a frame of
    // the old values.
    const [syncedWebsite, setSyncedWebsite] = useState<typeof existingWebsite>(undefined);
    if (existingWebsite !== syncedWebsite) {
        setSyncedWebsite(existingWebsite);
        if (existingWebsite) {
            // HTML is inline (legacy) or in file storage (htmlUrl). Prefer
            // inline; a stored file is fetched below, and until it lands the
            // editor keeps the HTML it already had.
            const inlineHtml = existingWebsite.htmlContent || "";
            const htmlUrl = existingWebsite.htmlUrl;
            if (inlineHtml) setWebsiteHtmlContent(inlineHtml);
            else if (!htmlUrl) setWebsiteHtmlContent("");
            setWebsiteContent(existingWebsite.extractedContent);
            setWebsiteCustomizations(existingWebsite.customizations || {});
            setWebsitePublishedUrl(existingWebsite.publishedUrl || null);
            if (inlineHtml || htmlUrl) setWebsiteGenerated(true);
        }
    }
    // The stored HTML file, fetched whenever it is a new file. Guard against
    // out-of-order resolution: two quick saves produce two different htmlUrls,
    // and an older fetch must not win and show a stale build in the editor.
    const storedHtmlUrl = existingWebsite && !existingWebsite.htmlContent ? existingWebsite.htmlUrl ?? null : null;
    useEffect(() => {
        if (!storedHtmlUrl) return;
        let ignore = false;
        fetch(storedHtmlUrl)
            .then((r) => (r.ok ? r.text() : ""))
            .then((html) => { if (!ignore) setWebsiteHtmlContent(html); })
            .catch(() => { if (!ignore) setWebsiteHtmlContent(""); });
        return () => { ignore = true; };
    }, [storedHtmlUrl]);

    const s = submissionData ?? null;

    // Owner-originated rows come in through the self-serve /start intake and are
    // attributed to the house creator, so the Creator fact looks normal. Flag
    // them explicitly: there was no field visit and no recorded interview, and
    // the transcript is synthesized from the owner's typed answers.
    // `contentSource` is optional on the schema and only ever set on that path.
    const isOwnerSubmitted = s?.contentSource === "owner_intake";

    // --- Handlers (the old page's, outcome reported by toasts) ---

    /**
     * Download every original photo and every AI-enhanced image as one zip,
     * built in the browser (both image hosts allow it — see lib/mediaZip.ts).
     * Originals keep their upload order; AI images keep page order, named by
     * slot, earlier renders as archive_N.
     */
    const handleDownloadMedia = async () => {
        if (!submissionData || mediaZipProgress) return;
        // Storage-id photos resolve through photoViaResolve, in the same order.
        let resolvedIndex = 0;
        const originals = (submissionData.photos || []).map((p: string) =>
            p.startsWith("http") ? p : ((photoViaResolve as (string | null)[] | undefined)?.[resolvedIndex++] ?? ""),
        );
        const enhanced = enhancedImageData
            ? orderedEnhancedEntries(enhancedImageData as Record<string, unknown>).map(([key, img]) => {
                const loose = img as EditorJson;
                const raw = typeof img === "string" ? img : (loose?.storageId || loose?.url || "");
                return { key, url: resolveEnhancedUrl(raw) };
            })
            : [];
        const files = buildMediaFileList({ originals, enhanced });
        if (files.length === 0) return;
        setMediaZipProgress(`Downloading 0/${files.length}…`);
        try {
            const result = await downloadMediaZip({
                zipName: `${submissionData.businessName || "submission"} photos`,
                files,
                onProgress: (done, total) => setMediaZipProgress(`Downloading ${done}/${total}…`),
            });
            if (result.failed.length > 0) {
                toast.warning(
                    `The zip downloaded with ${result.added} file${result.added === 1 ? "" : "s"}, but ${result.failed.length} could not be fetched.`,
                    { description: "They are listed in missing-files.txt inside the zip.", duration: 10000 },
                );
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error && error.message ? error.message : "Could not build the zip. Please try again.");
        } finally {
            setMediaZipProgress(null);
        }
    };

    const handleRetriggerTranscription = async () => {
        if (transcribing || !submissionData) return;
        setTranscribing(true);
        try {
            const response = await fetch("/api/transcribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    submissionId: submissionData._id,
                    videoUrl: videoUrl || submissionData.videoUrl,
                    audioUrl: audioUrl || submissionData.audioUrl,
                    useConvexStorage: !!(submissionData.videoStorageId || submissionData.audioStorageId),
                    videoStorageId: submissionData.videoStorageId,
                    audioStorageId: submissionData.audioStorageId,
                }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to transcribe");
            }
            if (user) {
                try {
                    await logTranscriptionRegeneratedMutation({
                        submissionId: submissionData._id,
                        adminId: user.id,
                        businessName: submissionData.businessName,
                    });
                } catch (auditErr) {
                    console.error("Audit log error (non-blocking):", auditErr);
                }
            }
            toast.success("Transcript generated");
        } catch (error: unknown) {
            console.error("Transcription error:", error);
            toast.error(error instanceof Error && error.message ? error.message : "Failed to generate transcription");
        } finally {
            setTranscribing(false);
        }
    };

    const handleTriggerEnhancedImages = async () => {
        if (enhancing || !submissionData) return;
        setEnhancing(true);
        try {
            await triggerAirtablePushMutation({ submissionId: submissionData._id });
            if (user) {
                try {
                    await logImagesEnhancedMutation({
                        submissionId: submissionData._id,
                        adminId: user.id,
                        businessName: submissionData.businessName,
                    });
                } catch (auditErr) {
                    console.error("Audit log error (non-blocking):", auditErr);
                }
            }
            toast.success("Enhancing the photos", { description: "The optimised images will be available shortly." });
        } catch (error: unknown) {
            toast.error(error instanceof Error && error.message ? error.message : "Failed to trigger image enhancement");
        } finally {
            setEnhancing(false);
        }
    };

    /** Approve: the mutation, then the creator's approval email. True when approved. */
    const approveSubmission = async (): Promise<boolean> => {
        if (!submissionData || !user) return false;
        setUpdating(true);
        try {
            await approveSubmissionMutation({ submissionId: submissionData._id, adminId: user.id });
            toast.success("Submission approved");
            try {
                await fetch("/api/send-approval-email", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ submissionId }),
                });
            } catch (error) {
                console.error("Failed to send approval email:", error);
            }
            return true;
        } catch {
            toast.error("Failed to approve. Please try again.");
            return false;
        } finally {
            setUpdating(false);
        }
    };

    const handleStatusUpdate = async (newStatus: "approved" | "rejected" | "in_review") => {
        if (!submissionData || !user) return;
        if (newStatus === "approved") {
            await approveSubmission();
            return;
        }
        if (newStatus === "rejected") {
            setRejectionReasonMissing(false);
            setShowRejectModal(true);
            return;
        }
        setUpdating(true);
        try {
            await updateStatusMutation({ id: submissionData._id, status: newStatus });
            toast.success(submissionData.status === "rejected" ? "Back in review" : "Marked in review");
        } catch {
            toast.error("Failed to update status. Please try again.");
        } finally {
            setUpdating(false);
        }
    };

    const handleRejectWithReason = async () => {
        if (!submissionData || !user) return;
        // The reason is required (it is saved on the submission so the next
        // admin knows why); the mutation still takes it as optional.
        if (!rejectionReason.trim()) {
            setRejectionReasonMissing(true);
            return;
        }
        setRejecting(true);
        try {
            await rejectSubmissionMutation({
                submissionId: submissionData._id,
                adminId: user.id,
                reason: rejectionReason.trim() || undefined,
            });
            setShowRejectModal(false);
            setRejectionReason("");
            toast.success("Submission rejected", { description: "The reason is saved on it." });
        } catch {
            toast.error("Failed to reject. Please try again.");
        } finally {
            setRejecting(false);
        }
    };

    const handleMarkAsPaid = async () => {
        if (!submissionData || !user) return;
        setMarkingPaid(true);
        try {
            const response = await fetch("/api/mark-paid", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ submissionId: submissionData._id }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Failed to mark as paid");
            setShowMarkPaidModal(false);
            toast.success(result.message || "Payment confirmed. Creator balance updated.");
        } catch (error: unknown) {
            toast.error(error instanceof Error && error.message ? error.message : "Failed to mark as paid. Please try again.");
        } finally {
            setMarkingPaid(false);
        }
    };

    /**
     * PROMO — give the website to the owner for free; the creator still earns
     * their commission. Separate route from mark-paid because the owner gets a
     * different email: a gift notice, never a receipt.
     */
    const handleGiveFree = async () => {
        if (!submissionData || !user) return;
        // Self-serve sites have no real creator to name, so the admin must say
        // who the gift is from. The route enforces this too.
        if (isHouseCreator(submissionData.creator) && !giveFreeGiftedBy.trim()) return;
        setMarkingComped(true);
        try {
            const response = await fetch("/api/mark-comped", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    submissionId: submissionData._id,
                    reason: giveFreeReason.trim() || undefined,
                    giftedBy: giveFreeGiftedBy.trim() || undefined,
                }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Failed to give this website away");
            setShowGiveFreeModal(false);
            setGiveFreeReason("");
            setGiveFreeGiftedBy("");
            toast.success(result.message || "Website given free. Creator credited.", { duration: 10000 });
        } catch (error: unknown) {
            toast.error(error instanceof Error && error.message ? error.message : "Failed to give this website away. Please try again.");
        } finally {
            setMarkingComped(false);
        }
    };

    const handleDeleteSubmission = async () => {
        if (!submissionData || !user) return;
        const businessName = submissionData.businessName;
        setDeleting(true);
        try {
            const response = await fetch("/api/delete-submission", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ submissionId: submissionData._id }),
            });
            const data = await response.json().catch(() => ({} as EditorJson));
            if (!response.ok) throw new Error(data?.error || "Failed to delete submission");
            const failed: Array<{ asset: string; error: string }> = data?.failedAssets || [];
            if (failed.length > 0) {
                setShowDeleteModal(false);
                setOrphanedAssetsNotice({ businessName, failed });
                return;
            }
            // The row vanishes over the subscription before the browser has
            // left; without this the page would flash "doesn't exist" first.
            setLeaving(true);
            window.location.href = "/admin/submissions";
        } catch (error: unknown) {
            setShowDeleteModal(false);
            toast.error(error instanceof Error && error.message ? error.message : "Failed to delete submission. Please try again.");
        } finally {
            setDeleting(false);
        }
    };

    const handleGenerateWebsite = async (customizationsOverride?: EditorJson) => {
        if (generatingWebsite) return;
        setGeneratingWebsite(true);
        setWebsiteError(null);
        try {
            const response = await fetch("/api/generate-website", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ submissionId, customizations: customizationsOverride || websiteCustomizations }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to generate website");
            }
            const data = await response.json();
            setWebsiteHtmlContent(data.htmlContent);
            setWebsiteContent(data.website?.extracted_content);
            setWebsiteCustomizations(data.website?.customizations);
            setWebsiteGenerated(true);
            // Customer quotes the guard removed. Silence here is the failure
            // mode that matters: on the creator funnel EVERY generated
            // testimonial is stripped, so without this the admin sees a page
            // with no testimonials band and no reason to suspect the recording
            // contained real praise they could type back in. Kept on screen
            // longer than an ordinary toast for that reason.
            if (data.testimonialGuard?.message) {
                toast.warning(data.testimonialGuard.message, { duration: 20000 });
            } else {
                toast.success("Site generated", { description: "Check it before you publish." });
            }
        } catch (error: unknown) {
            const message = error instanceof Error && error.message ? error.message : "Failed to generate website";
            setWebsiteError(message);
            toast.error("Generating the site failed", { description: message });
        } finally {
            setGeneratingWebsite(false);
        }
    };

    /**
     * Publish (also the restore of an offline site: same Worker, same URL). True
     * when live. `restore` only words the toast; the Undo on the unpublish toast
     * passes it, because that closure predates the offline flag arriving.
     */
    const handlePublishWebsite = async (restore?: boolean): Promise<boolean> => {
        if (publishingWebsite) return false;
        const restoring = restore ?? websiteOffline;
        setPublishingWebsite(true);
        try {
            const response = await fetch("/api/publish-website", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ submissionId }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to publish website");
            }
            const data = await response.json();
            setWebsitePublishedUrl(data.url);
            if (user && submissionData) {
                try {
                    await markDeployedMutation({
                        submissionId: submissionData._id,
                        adminId: user.id,
                        websiteUrl: data.url,
                    });
                } catch (auditErr) {
                    console.error("Audit log error (non-blocking):", auditErr);
                }
            }
            toast.success(restoring ? `Restored — live again at ${data.url}` : `Published — live at ${data.url}`);
            return true;
        } catch (error: unknown) {
            toast.error(error instanceof Error && error.message ? error.message : "Failed to publish website");
            return false;
        } finally {
            setPublishingWebsite(false);
        }
    };

    /** Approve & publish: approval first (the creator's email goes with it), then the site. */
    const handleApproveAndPublish = async () => {
        const approved = await approveSubmission();
        if (approved) await handlePublishWebsite();
    };

    const handleRepublishWebsite = async () => {
        if (republishingWebsite) return;
        setRepublishingWebsite(true);
        try {
            const response = await fetch("/api/publish-website", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ submissionId }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to republish website");
            }
            const data = await response.json();
            setWebsitePublishedUrl(data.url);
            toast.success("Republished — the live site matches the editor again", { description: data.url });
        } catch (error: unknown) {
            toast.error(error instanceof Error && error.message ? error.message : "Failed to republish website");
        } finally {
            setRepublishingWebsite(false);
        }
    };

    const handleUnpublishWebsite = async () => {
        if (unpublishingWebsite) return;
        setUnpublishingWebsite(true);
        try {
            const response = await fetch("/api/unpublish-website", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ submissionId }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to unpublish website");
            }
            // The published URL deliberately stays — the site is offline, not
            // gone, and that URL is where it comes back. `existingWebsite.offlineAt`
            // is what the actions read, and it arrives over the subscription.
            // Undo is the restore: the same publish, landing on the same URL.
            toast("Site taken offline — visitors see a holding page", {
                action: { label: "Undo", onClick: () => void handlePublishWebsite(true) },
            });
        } catch (error: unknown) {
            toast.error(error instanceof Error && error.message ? error.message : "Failed to unpublish website");
        } finally {
            setUnpublishingWebsite(false);
        }
    };

    const handleSendWebsiteEmail = async () => {
        if (sendingEmail || !websitePublishedUrl) return;
        setSendingEmail(true);
        try {
            const response = await fetch("/api/send-website-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ submissionId, websiteUrl: websitePublishedUrl }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to send email");
            }
            toast.success(`Sent to ${submissionData?.ownerEmail || "the business owner"}`, {
                description: "The email has the site link and how to pay.",
            });
        } catch (error: unknown) {
            toast.error(error instanceof Error && error.message ? error.message : "Failed to send email");
        } finally {
            setSendingEmail(false);
        }
    };

    const handleResendPaymentEmail = async () => {
        try {
            const res = await fetch("/api/send-website-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ submissionId }),
            });
            if (res.ok) {
                toast.success("Payment email re-sent to the business owner.");
            } else {
                const data = await res.json();
                throw new Error(data.error || "Failed to send email");
            }
        } catch (err: unknown) {
            toast.error(err instanceof Error && err.message ? err.message : "Failed to re-send email");
        }
    };

    const handleSendFollowUp = async () => {
        if (sendingFollowUp) return;
        setSendingFollowUp(true);
        try {
            const res = await fetch("/api/send-payment-followup-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ submissionId, isManual: true }),
            });
            if (res.ok) {
                toast.success("Follow-up email sent to the business owner.");
            } else {
                const data = await res.json();
                throw new Error(data.error || "Failed to send follow-up email");
            }
        } catch (err: unknown) {
            toast.error(err instanceof Error && err.message ? err.message : "Failed to send follow-up email");
        } finally {
            setSendingFollowUp(false);
        }
    };

    const handleSaveContent = async (content: EditorJson, customizationsOverride?: EditorJson) => {
        // Optional customizations override lets the SandboxEditor commit a
        // batched template+theme change atomically alongside content edits,
        // so a single regen applies everything at once.
        const customizations = customizationsOverride ?? websiteCustomizations;
        const response = await fetch("/api/save-content", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ submissionId, content, customizations }),
        });
        if (!response.ok) throw new Error("Failed to save");
        const data = await response.json();
        if (data.htmlContent) setWebsiteHtmlContent(data.htmlContent);
        setWebsiteContent(content);
        if (customizationsOverride) setWebsiteCustomizations(customizationsOverride);
    };

    const openPhoto = (index: number) => {
        setLightboxIndex(index);
        setLightboxOpen(true);
    };

    const openDetails = (fold: FoldKey | null) => {
        setDetailsFold(fold);
        setDetailsOpen(true);
    };
    const closeDetails = () => {
        setDetailsOpen(false);
        setDetailsFold(null);
        // Keep the URL honest: an old /domain or /emails link arrived with
        // ?fold=; once the details are closed it no longer describes the page.
        if (searchParams.get("fold")) router.replace(pathname, { scroll: false });
    };

    // --- Render ---

    if (authLoading || dataLoading) return <WorkspaceSkeleton />;

    // The delete removed the row this page is built on, so `submission` is
    // already null and the guard below would render the not-found state —
    // losing the only list of assets the cleanup could not reach. Show it on
    // its own (board Review: "… was deleted").
    if (orphanedAssetsNotice) {
        const n = orphanedAssetsNotice.failed.length;
        return (
            <div className="r1 flex h-dvh overflow-hidden bg-r1-paper">
                <ReviewRail isAdmin={isAdmin} name={meName(currentCreator, user?.fullName)} />
                <main className="flex min-w-0 flex-1 items-center justify-center overflow-y-auto p-4 sm:p-6">
                    <div className="t-empty max-w-[560px]">
                        <h2 className="t-h2">{orphanedAssetsNotice.businessName} was deleted.</h2>
                        <p className="t-body">
                            The submission record is gone, but {n} external {n === 1 ? "asset" : "assets"} could not be cleaned up. These need
                            manual cleanup — nothing else records them.
                        </p>
                        <ul className="m-0 flex w-full list-none flex-col gap-1.5 p-0 text-left">
                            {orphanedAssetsNotice.failed.map((f, i) => (
                                <li key={`${f.asset}-${i}`} className="flex items-start gap-2 text-[13px] leading-[18px] text-r1-ink-2">
                                    <Dot tone="bad" className="mt-[5px]" />
                                    <span className="break-words">
                                        <span className="font-medium text-r1-ink">{f.asset}</span>: {f.error}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <Button variant="primary" onClick={() => router.push("/admin/submissions")}>
                            Back to submissions
                        </Button>
                    </div>
                </main>
            </div>
        );
    }

    if (!isAdmin) return null;

    if (!s && leaving) return <WorkspaceSkeleton />;

    if (!s) {
        return (
            <div className="r1 flex h-dvh overflow-hidden bg-r1-paper">
                <ReviewRail isAdmin={isAdmin} name={meName(currentCreator, user?.fullName)} />
                <main className="flex min-w-0 flex-1 items-center justify-center p-4 sm:p-6">
                    <EmptyState
                        title="This submission doesn’t exist"
                        body="It may have been deleted, or the link is wrong."
                        action={<ButtonLink variant="primary" href="/admin/submissions">Back to submissions</ButtonLink>}
                    />
                </main>
            </div>
        );
    }

    // ── What the header offers, by state ──────────────────────────────────
    const status = s.status;
    const comped = isComped(s);
    const customDomainTier = s.submissionType === "with_custom_domain" || !!s.requestedDomain;
    const hasTranscript = !!s.transcript;
    const selfServe = isHouseCreator(s.creator);
    const published = !!websitePublishedUrl;

    // The eligibility rules the old action bar applied, unchanged.
    const canApprove = status === "website_generated" || (status === "in_review" && websiteGenerated);
    const canGenerate = ["in_review", "website_generated", "approved", "deployed"].includes(status);
    const canEnhanceBeforeSite = ["submitted", "in_review", "website_generated", "approved", "deployed"].includes(status) && hasTranscript;
    // Not once the site is out with the owner: rejecting then would strand a
    // live, billed site.
    const canReject = !["rejected", "deployed", "pending_payment", "paid", "unpublished"].includes(status);
    const canMarkInReview = status === "submitted";
    // Also offered once a site has been pulled: an owner who pays after the
    // three-day deadline is the ordinary way this ends, and without it there is
    // no way to settle the submission and restore the site. markPaid itself has
    // no status guard (convex/admin.ts), so this only widens the UI.
    const canMarkPaid = ["pending_payment", "unpublished"].includes(status);
    // Promo: hand the site to the owner for free, the creator still earns.
    // Offered from the moment a real website exists to give away, and still
    // offered at pending_payment — an owner who was billed and went quiet is
    // exactly the case a promo rescues. Hidden once the site is already comped
    // or settled, and never on the custom-domain tier, where "free" would mean
    // the platform paying a registrar out of pocket.
    const canGiveFree =
        !comped &&
        !customDomainTier &&
        websiteGenerated &&
        ["approved", "website_generated", "deployed", "pending_payment", "unpublished"].includes(status);
    const canPayments = status === "pending_payment";
    // While the site is offline the actions must not offer Republish/Unpublish
    // or link visitors at a holding page; the one way forward is Restore.
    const canUnpublish = published && !websiteOffline;

    const phase: "generated" | "generating" | "pregen" = generatingWebsite ? "generating" : websiteGenerated ? "generated" : "pregen";

    const reopen = (
        <Button onClick={() => void handleStatusUpdate("in_review")} disabled={updating} aria-busy={updating}>
            {updating ? "Reopening…" : "Reopen review"}
        </Button>
    );
    const markInReview = (
        <Button variant="primary" onClick={() => void handleStatusUpdate("in_review")} disabled={updating} aria-busy={updating}>
            {updating ? "Saving…" : "Mark in review"}
        </Button>
    );

    /** The one primary action once a site exists (and the editor has no unsaved changes). */
    const sitePrimary = (): ReactNode => {
        if (status === "rejected") return reopen;
        if (websiteOffline) {
            return (
                <Button variant="primary" onClick={() => void handlePublishWebsite()} disabled={publishingWebsite} aria-busy={publishingWebsite}>
                    {publishingWebsite ? "Restoring…" : "Restore website"}
                </Button>
            );
        }
        if (published) {
            return publishStale ? (
                <Button variant="primary" onClick={() => void handleRepublishWebsite()} disabled={republishingWebsite} aria-busy={republishingWebsite}>
                    {republishingWebsite ? "Republishing…" : "Republish"}
                </Button>
            ) : (
                <Button variant="primary" disabled title="The live site already matches the editor">
                    Republish
                </Button>
            );
        }
        if (canMarkInReview) return markInReview;
        if (canApprove && approvedBefore !== true) {
            const working = updating || publishingWebsite;
            return (
                <Button
                    variant="primary"
                    onClick={() => void handleApproveAndPublish()}
                    // Until the approval history has loaded, it cannot be told
                    // whether this would approve a second time.
                    disabled={working || approvedBefore === undefined}
                    aria-busy={working}
                >
                    <Icon icon={Check} />
                    {updating ? "Approving…" : publishingWebsite ? "Publishing…" : "Approve & publish"}
                </Button>
            );
        }
        return (
            <Button variant="primary" onClick={() => void handlePublishWebsite()} disabled={publishingWebsite} aria-busy={publishingWebsite}>
                <Icon icon={Check} />
                {publishingWebsite ? "Publishing…" : "Publish"}
            </Button>
        );
    };

    /** A disabled menu entry that says when it becomes available. */
    const later = (label: string, note: string): MenuItem => ({
        label: (
            <span className="flex flex-1 items-center justify-between gap-3">
                {label}
                <span className="text-xs text-r1-ink-3">{note}</span>
            </span>
        ),
        disabled: true,
    });

    /** Owner and money actions, shared by every state that has them. */
    const clientItems = (): MenuItem[] => {
        const items: MenuItem[] = [];
        if (canPayments) {
            items.push({ label: "Re-send the payment email", onSelect: () => void handleResendPaymentEmail() });
            items.push({
                label: sendingFollowUp
                    ? "Sending the follow-up…"
                    : s.followUpEmailSentAt
                        ? `Follow up again (last sent ${formatDate(s.followUpEmailSentAt)})`
                        : "Send a payment follow-up",
                disabled: sendingFollowUp,
                onSelect: () => void handleSendFollowUp(),
            });
        } else if (websiteGenerated) {
            items.push(
                canUnpublish
                    ? { label: sendingEmail ? "Sending…" : "Send to client", disabled: sendingEmail, onSelect: () => void handleSendWebsiteEmail() }
                    : later("Send to client", "after publishing"),
            );
        }
        if (canGiveFree) items.push({ label: "Give free (comp)…", onSelect: () => setShowGiveFreeModal(true) });
        if (canMarkPaid) items.push({ label: "Mark as paid…", onSelect: () => setShowMarkPaidModal(true) });
        else if (websiteGenerated && !published && !comped && !["paid", "completed"].includes(status)) items.push(later("Mark as paid", "after publishing"));
        return items;
    };

    const closingItems = (): MenuItem[] => {
        const items: MenuItem[] = [];
        if (canReject) items.push({ label: "Reject…", danger: true, onSelect: () => void handleStatusUpdate("rejected") });
        items.push({ label: "Delete…", danger: true, onSelect: () => setShowDeleteModal(true) });
        return items;
    };

    const siteMoreItems = (tools: EditorTools): MenuItem[] => {
        const items: MenuItem[] = [];
        if (tools.dirty) {
            items.push({ label: tools.previewing ? "Building the preview…" : "Preview unsaved changes", disabled: tools.busy, onSelect: tools.previewUnsaved });
            items.push({ label: "Discard unsaved changes", disabled: tools.busy, onSelect: tools.discard });
            items.push("divider");
        }
        items.push({ label: "Regenerate", disabled: tools.busy, onSelect: () => void handleGenerateWebsite() });
        items.push({ label: enhancing ? "Enhancing…" : "Enhance photos", disabled: enhancing, onSelect: () => void handleTriggerEnhancedImages() });
        // The build on disk, published or not. After a Regenerate (which never
        // publishes) it differs from the live page, which the address bar links.
        items.push({ label: "Open this build in a new tab", href: `/api/preview/${submissionId}`, external: true });
        // Approval on its own, for a submission never approved: before going
        // live (approve now, publish later), or for a site that went live
        // without one. Never offered twice — see approvedBefore.
        if (approvedBefore === false && !["approved", "rejected"].includes(status)) {
            items.push({
                label: updating ? "Approving…" : published ? "Approve" : "Approve without publishing",
                disabled: updating,
                onSelect: () => void handleStatusUpdate("approved"),
            });
        }
        const client = clientItems();
        if (client.length) items.push("divider", ...client);
        items.push("divider");
        items.push(
            canUnpublish
                ? { label: unpublishingWebsite ? "Unpublishing…" : "Unpublish", disabled: unpublishingWebsite, onSelect: () => void handleUnpublishWebsite() }
                : later("Unpublish", "not live"),
        );
        items.push(...closingItems());
        return items;
    };

    const pregenMoreItems = (): MenuItem[] => {
        const items: MenuItem[] = [];
        if (canEnhanceBeforeSite) items.push({ label: enhancing ? "Enhancing…" : "Enhance photos", disabled: enhancing, onSelect: () => void handleTriggerEnhancedImages() });
        const client = clientItems();
        if (client.length) items.push(...client);
        if (items.length) items.push("divider");
        items.push(...closingItems());
        return items;
    };

    /** Where the work stands, beside the actions. */
    const saveState = (tools: EditorTools): ReactNode => {
        if (tools.dirty) {
            return (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap pr-1 text-[13px] font-medium text-r1-gold-ink" aria-live="polite">
                    <Dot tone="attn" />
                    Unsaved changes
                </span>
            );
        }
        if (publishStale && !websiteOffline) {
            return (
                <span
                    className="inline-flex items-center gap-1.5 whitespace-nowrap pr-1 text-[13px] font-medium text-r1-gold-ink"
                    aria-live="polite"
                    title="The live site still has the previous version. Republish to update it."
                >
                    <Dot tone="attn" />
                    Changes not live yet
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap pr-1 text-[13px] text-r1-ink-3" aria-live="polite">
                <Icon icon={Check} />
                {canUnpublish ? "Saved · live is up to date" : "Saved"}
            </span>
        );
    };

    const details = { open: detailsOpen, onToggle: () => (detailsOpen ? closeDetails() : openDetails(null)) };

    const intakeRows = (s.interviewQa ?? []).length > 0 ? buildIntakeRows(s.interviewQa ?? []) : null;
    const checklist = checklistFor(s);
    const emails = clientEmailsFor(s);
    const enhancedCount = enhancedImageData ? Object.keys(enhancedImageData).length : 0;

    const detailsContent = (
        <DetailsContent
            // Re-open at the requested fold each time the details open there.
            key={detailsFold ?? "details"}
            s={s}
            isOwnerSubmitted={isOwnerSubmitted}
            photoUrls={photoUrls}
            checklist={checklist}
            intakeRows={intakeRows}
            emails={emails}
            enhancedCount={enhancedCount}
            onOpenPhoto={openPhoto}
            onDownloadMedia={() => void handleDownloadMedia()}
            mediaZipProgress={mediaZipProgress}
            transcribing={transcribing}
            onRetriggerTranscription={() => void handleRetriggerTranscription()}
            initialFold={detailsFold}
        />
    );

    // Docked: the board's 360px panel beside the preview, so editing goes on
    // while it is open. Only in the editor, only on a wide screen.
    const docked = phase === "generated" && isWide && detailsOpen;
    const dockedAside = docked ? (
        <aside aria-label="Submission details" className="flex w-[360px] flex-none flex-col border-l border-r1-line bg-r1-paper">
            <div className="flex h-14 flex-none items-center justify-between border-b border-r1-line bg-r1-fill-2 pl-5 pr-2">
                <h2 className="t-h2">Details</h2>
                <Button variant="ghost" icon aria-label="Close details" onClick={closeDetails}>
                    <Icon icon={X} />
                </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-1">{detailsContent}</div>
        </aside>
    ) : null;

    // The one sentence the overview leads with, by state.
    const pregenNotice: { title: string; body: ReactNode } | null =
        status === "rejected"
            ? { title: "This submission was rejected.", body: "Reopen review to work on it again." }
            : canMarkInReview
                ? { title: "New submission.", body: "Check what was sent below, then mark it in review to generate the website." }
                : canGenerate
                    ? {
                        title: "Ready to generate this website.",
                        body: "Check what was sent below, then press Generate site. It usually takes 30–60 seconds, and you can edit everything afterwards.",
                    }
                    : null;

    const pregenPrimary: ReactNode =
        status === "rejected" ? reopen : canMarkInReview ? markInReview : canGenerate ? (
            <Button variant="primary" onClick={() => void handleGenerateWebsite()}>
                <Icon icon={Sparkles} />
                Generate site
            </Button>
        ) : null;

    const campaignKey = normalizeCampaign(s.campaign);

    return (
        <div className="r1 flex h-dvh overflow-hidden bg-r1-paper">
            <ReviewRail isAdmin={isAdmin} name={meName(currentCreator, user?.fullName)} />

            <div className="flex min-w-0 flex-1 flex-col">
                {phase === "generated" ? (
                    <SandboxEditorV3
                        submissionId={submissionId}
                        businessName={s.businessName}
                        businessType={s.businessType}
                        htmlContent={websiteHtmlContent || ""}
                        htmlLoading={websiteHtmlContent === null}
                        content={websiteContent ?? {
                            business_name: s.businessName || "",
                            tagline: "",
                            about: "",
                            services: [],
                            contact: {},
                        }}
                        customizations={websiteCustomizations}
                        photos={[
                            ...(photoUrls || []),
                            ...((heroImageUrls || []).filter((u): u is string => u !== null)),
                        ].filter((url, index, self) => self.indexOf(url) === index)}
                        enhancedImageUrls={Object.values(enhancedUrlMap).filter(
                            (u): u is string => typeof u === "string" && u.length > 0,
                        )}
                        onSaveContent={handleSaveContent}
                        // While the site is offline the editor must not link
                        // visitors at a holding page. Withholding the address is
                        // what tells it so.
                        websitePublishedUrl={websiteOffline ? undefined : (websitePublishedUrl ?? undefined)}
                        websiteGenerated={websiteGenerated}
                        generatingWebsite={generatingWebsite}
                        aside={dockedAside}
                        renderHeader={(tools) => (
                            <ReviewHeader
                                businessName={s.businessName}
                                status={status}
                                saveState={saveState(tools)}
                                tools={tools}
                                details={details}
                                primary={
                                    tools.dirty ? (
                                        // Unsaved edits come first: publishing now would
                                        // ship the last saved build without them. Saving
                                        // a live site republishes it as well.
                                        <Button variant="primary" onClick={tools.save} disabled={tools.busy} aria-busy={tools.saving}>
                                            {tools.saving ? "Saving…" : "Save changes"}
                                        </Button>
                                    ) : (
                                        sitePrimary()
                                    )
                                }
                                moreItems={siteMoreItems(tools)}
                            />
                        )}
                    />
                ) : (
                    <>
                        <ReviewHeader
                            businessName={s.businessName}
                            status={status}
                            primary={
                                phase === "generating" ? (
                                    <Button variant="primary" disabled aria-busy>
                                        Generating…
                                    </Button>
                                ) : (
                                    pregenPrimary
                                )
                            }
                            moreItems={phase === "generating" ? undefined : pregenMoreItems()}
                        />
                        {phase === "generating" ? (
                            <div className="flex min-h-0 flex-1 items-center justify-center bg-r1-paper p-6">
                                <div className="t-empty" role="status">
                                    <h2 className="t-h2">Generating website…</h2>
                                    <p className="t-meta">This usually takes 30–60 seconds.</p>
                                    <span className="relative block h-1.5 w-60 overflow-hidden rounded-full bg-r1-fill" aria-hidden="true">
                                        <span className="absolute inset-y-0 left-0 w-2/5 animate-pulse rounded-full bg-r1-ink" />
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <PregenOverview
                                s={s}
                                isOwnerSubmitted={isOwnerSubmitted}
                                notice={pregenNotice}
                                websiteError={websiteError}
                                photoUrls={photoUrls}
                                checklist={checklist}
                                intakeRows={intakeRows}
                                emails={emails}
                                enhancedCount={enhancedCount}
                                onOpenPhoto={openPhoto}
                                onDownloadMedia={() => void handleDownloadMedia()}
                                mediaZipProgress={mediaZipProgress}
                                transcribing={transcribing}
                                onRetriggerTranscription={() => void handleRetriggerTranscription()}
                                onOpenDetails={(fold) => openDetails(fold)}
                            />
                        )}
                    </>
                )}
            </div>

            {/* The details as a drawer: below a wide screen in the editor, and
                in the overview when a fold is asked for (the old /domain and
                /emails links, or "Manage the domain"). */}
            <Drawer
                open={detailsOpen && !docked}
                onClose={closeDetails}
                title="Details"
                meta={[s.businessType, s.city].filter(Boolean).join(" · ")}
            >
                {detailsContent}
            </Drawer>

            <GiveFreeDialog
                open={showGiveFreeModal}
                onClose={() => setShowGiveFreeModal(false)}
                onConfirm={() => void handleGiveFree()}
                busy={markingComped}
                businessName={s.businessName}
                creatorPayout={s.creatorPayout ?? 0}
                selfServe={selfServe}
                published={published}
                reason={giveFreeReason}
                onReason={setGiveFreeReason}
                giftedBy={giveFreeGiftedBy}
                onGiftedBy={setGiveFreeGiftedBy}
            />
            <MarkPaidDialog
                open={showMarkPaidModal}
                onClose={() => setShowMarkPaidModal(false)}
                onConfirm={() => void handleMarkAsPaid()}
                busy={markingPaid}
                businessName={s.businessName}
                amount={s.amount}
                amountNote={campaignKey ? campaignKey.toUpperCase() : s.campaign ? String(s.campaign).toUpperCase() : null}
                creatorPayout={s.creatorPayout ?? 0}
                selfServe={selfServe}
            />
            <RejectDialog
                open={showRejectModal}
                onClose={() => {
                    setShowRejectModal(false);
                    setRejectionReason("");
                    setRejectionReasonMissing(false);
                }}
                onConfirm={() => void handleRejectWithReason()}
                busy={rejecting}
                reason={rejectionReason}
                onReason={(v) => {
                    setRejectionReason(v);
                    if (v.trim()) setRejectionReasonMissing(false);
                }}
                showError={rejectionReasonMissing}
            />
            <DeleteDialog
                open={showDeleteModal}
                onCancel={() => setShowDeleteModal(false)}
                onConfirm={() => void handleDeleteSubmission()}
                busy={deleting}
                businessName={s.businessName}
            />

            {lightboxOpen && photoUrls.length > 0 && (
                <PhotoLightbox
                    photos={photoUrls.filter((url): url is string => url !== null && url.startsWith("http"))}
                    initialIndex={lightboxIndex}
                    onClose={() => setLightboxOpen(false)}
                />
            )}
        </div>
    );
}

/** The admin's own name for the rail's foot, as AdminLayout builds it. */
function meName(me: { firstName?: string; lastName?: string } | null | undefined, fallback: string | null | undefined): string | null {
    const name = [me?.firstName, me?.lastName].filter(Boolean).join(" ") || fallback || "";
    return name || null;
}
