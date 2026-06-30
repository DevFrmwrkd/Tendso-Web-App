"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Loader2, Palette, FileEdit, Check, X, AlertTriangle, Trash2, ExternalLink, PanelRightClose, PanelRightOpen, Globe, ChevronLeft } from "lucide-react";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import WebsitePreview from "@/components/WebsitePreview";
import VisualEditor from "@/components/editor/VisualEditor";
import ContentEditor, { EditorCustomizations } from "@/components/ContentEditor";
import SandboxEditor from "@/components/editor/SandboxEditor";
import TopActionBar from "./_components/TopActionBar";
import DetailsSidebar from "./_components/DetailsSidebar";
import DriveSection from "./_components/DriveSection";

// The "preview" tab was redundant — VisualEditor already shows the live
// iframe preview alongside the sandbox sidebar. We default to the sandbox
// editor and surface design-system controls under "styles".
type TabKey = "editor" | "styles";

export default function SubmissionDetailPage() {
    const params = useParams();
    const router = useRouter();
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
    const photoStorageIdsForQuery = submissionData?.photos?.filter((p: any) => !p.startsWith("http")) || [];
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

    const websiteImages = existingWebsite?.extractedContent?.images as string[] | undefined;
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

    // Enhanced image extraction
    const enhancedImageData = (() => {
        let enhancedImages = (existingWebsite as any)?.enhancedImages || null;
        if (!enhancedImages) {
            enhancedImages = (existingWebsite?.extractedContent as any)?.enhancedImages || null;
        }
        if (!enhancedImages) {
            enhancedImages = (websiteContentRecord as any)?.enhancedImages || null;
        }
        if (!enhancedImages || typeof enhancedImages !== "object") return null;
        return enhancedImages as Record<string, { url?: string; storageId?: string }>;
    })();

    const enhancedImagesByCategory = (() => {
        if (!enhancedImageData) return null;
        const categories: Record<string, string[]> = {};
        const allUrls: string[] = [];
        for (const [key, img] of Object.entries(enhancedImageData)) {
            let imageUrl = "";
            if (typeof img === "string") {
                imageUrl = img;
            } else if (img && typeof img === "object") {
                imageUrl = (img as any).storageId || (img as any).url || "";
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

    const hasEnhancedImages = (enhancedImagesByCategory?.allUrls?.length ?? 0) > 0;

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
    const updateSubmissionMutation = useMutation(api.submissions.update);
    const updateStatusMutation = useMutation(api.submissions.updateStatus);
    const approveSubmissionMutation = useMutation(api.admin.approveSubmission);
    const rejectSubmissionMutation = useMutation(api.admin.rejectSubmission);
    const markDeployedMutation = useMutation(api.admin.markDeployed);
    const logTranscriptionRegeneratedMutation = useMutation(api.admin.logTranscriptionRegenerated);
    const logImagesEnhancedMutation = useMutation(api.admin.logImagesEnhanced);
    const triggerAirtablePushMutation = useMutation(api.airtable.triggerAirtablePush);

    const authLoading = !isLoaded || (user && currentCreator === undefined);
    const dataLoading = isAdmin && submissionData === undefined;

    // Tab + state — default to the sandbox-style editor so the admin lands
    // directly on the click-to-edit experience that matches Landing Pages v01.
    const [activeTab, setActiveTab] = useState<TabKey>("editor");
    // Default the right details panel CLOSED so the page lands on the
    // 2-column sandbox layout (editor sidebar + iframe) that matches
    // Landing Pages v01 / sandbox.html. Admin can re-open with "Details".
    // Auto-opens further down (useEffect) when there's no website yet,
    // so the admin can read the submission info before generating.
    const [sidebarOpen, setSidebarOpen] = useState(false);
    // Tracks whether the user has manually toggled the sidebar this
    // session — once they have, we stop auto-opening on their behalf.
    const [sidebarManuallyToggled, setSidebarManuallyToggled] = useState(false);

    const [updating, setUpdating] = useState(false);
    const [transcribing, setTranscribing] = useState(false);
    const [enhancing, setEnhancing] = useState(false);

    const [showModal, setShowModal] = useState(false);
    const [modalMessage, setModalMessage] = useState("");
    const [modalType, setModalType] = useState<"success" | "error">("success");

    const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
    const [markingPaid, setMarkingPaid] = useState(false);

    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("");
    const [rejecting, setRejecting] = useState(false);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);

    const [qualityChecklist, setQualityChecklist] = useState({
        hasPhotos: false,
        hasAudioVideo: false,
        hasTranscript: false,
        businessInfoComplete: false,
        contactInfoComplete: false,
    });

    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editedData, setEditedData] = useState({
        business_name: "",
        business_type: "",
        owner_name: "",
        owner_phone: "",
        owner_email: "",
        address: "",
        city: "",
        transcript: "",
        photos: [] as string[],
    });

    const [generatingWebsite, setGeneratingWebsite] = useState(false);
    const [websiteGenerated, setWebsiteGenerated] = useState(false);
    const [websiteHtmlContent, setWebsiteHtmlContent] = useState<string | null>(null);
    const [websiteContent, setWebsiteContent] = useState<any>(null);
    const [websiteCustomizations, setWebsiteCustomizations] = useState<any>(null);
    const [websiteError, setWebsiteError] = useState<string | null>(null);
    const [websitePublishedUrl, setWebsitePublishedUrl] = useState<string | null>(null);

    const [publishingWebsite, setPublishingWebsite] = useState(false);
    const [republishingWebsite, setRepublishingWebsite] = useState(false);
    const [unpublishingWebsite, setUnpublishingWebsite] = useState(false);
    const [sendingEmail, setSendingEmail] = useState(false);

    const submission = submissionData
        ? {
              id: submissionData._id,
              business_name: submissionData.businessName,
              business_type: submissionData.businessType,
              owner_name: submissionData.ownerName,
              owner_phone: submissionData.ownerPhone,
              owner_email: submissionData.ownerEmail,
              address: submissionData.address,
              city: submissionData.city,
              photos: submissionData.photos,
              video_url: videoUrl || null,
              audio_url: audioUrl || null,
              transcript: submissionData.transcript,
              status: submissionData.status,
              creator_payout: submissionData.creatorPayout,
              amount: submissionData.amount,
              payout_requested_at: submissionData.payoutRequestedAt,
              paid_at: submissionData.paidAt,
              created_at: (submissionData as any)._creationTime,
          }
        : null;

    const creator = submissionData?.creator
        ? {
              first_name: submissionData.creator.firstName,
              last_name: submissionData.creator.lastName,
              email: submissionData.creator.email,
              phone: submissionData.creator.phone,
          }
        : null;

    useEffect(() => {
        if (existingWebsite) {
            setWebsiteHtmlContent(existingWebsite.htmlContent || "");
            setWebsiteContent(existingWebsite.extractedContent);
            setWebsiteCustomizations(existingWebsite.customizations || {});
            setWebsitePublishedUrl(existingWebsite.publishedUrl || null);
            if (existingWebsite.htmlContent) setWebsiteGenerated(true);
        }
    }, [existingWebsite]);

    // (Auto-open the Details sidebar on no-website submissions used to be
    // here. The actual fix was rendering the DetailsSidebar inline in the
    // main area when no website exists, which moots the auto-open. The
    // sidebarManuallyToggled state is kept so the existing toggle keeps
    // working for users who flip the sidebar open alongside the editor.)

    useEffect(() => {
        if (submissionData) {
            setQualityChecklist({
                hasPhotos: (submissionData.photos?.length || 0) > 0,
                hasAudioVideo: !!(submissionData.audioStorageId || submissionData.videoStorageId || submissionData.audioUrl || submissionData.videoUrl),
                hasTranscript: !!submissionData.transcript,
                businessInfoComplete: !!(
                    submissionData.businessName &&
                    submissionData.businessType &&
                    submissionData.ownerName &&
                    submissionData.ownerPhone &&
                    submissionData.address &&
                    submissionData.city
                ),
                contactInfoComplete: !!(submissionData.ownerPhone && (submissionData.ownerEmail || submissionData.ownerPhone)),
            });
        }
    }, [submissionData?._id]);

    // --- Handlers (preserved verbatim from previous version) ---

    const refresh = () => {};

    const handleEdit = () => {
        if (submission) {
            setEditedData({
                business_name: submission.business_name,
                business_type: submission.business_type,
                owner_name: submission.owner_name,
                owner_phone: submission.owner_phone,
                owner_email: submission.owner_email || "",
                address: submission.address,
                city: submission.city,
                transcript: submission.transcript || "",
                photos: submission.photos || [],
            });
            setIsEditing(true);
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
            setModalType("success");
            setModalMessage("Transcription generated successfully.");
            setShowModal(true);
        } catch (error: any) {
            console.error("Transcription error:", error);
            setModalType("error");
            const msg = error.message || "Failed to generate transcription";
            setModalMessage(msg);
            setShowModal(true);
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
            setModalType("success");
            setModalMessage("Airtable enhancement triggered. Enhanced images will be available shortly.");
            setShowModal(true);
        } catch (error: any) {
            setModalType("error");
            setModalMessage(error.message || "Failed to trigger Airtable enhancement");
            setShowModal(true);
        } finally {
            setEnhancing(false);
        }
    };

    const handleStatusUpdate = async (newStatus: string) => {
        if (!submissionData || !user) return;
        if (newStatus === "approved") {
            setUpdating(true);
            try {
                await approveSubmissionMutation({ submissionId: submissionData._id, adminId: user.id });
                setModalType("success");
                setModalMessage("Submission approved successfully.");
                setShowModal(true);
                try {
                    await fetch("/api/send-approval-email", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ submissionId }),
                    });
                } catch (error) {
                    console.error("Failed to send approval email:", error);
                }
            } catch (err: any) {
                setModalType("error");
                setModalMessage("Failed to approve. Please try again.");
                setShowModal(true);
            } finally {
                setUpdating(false);
            }
            return;
        }
        if (newStatus === "rejected") {
            setShowRejectModal(true);
            return;
        }
        setUpdating(true);
        try {
            await updateStatusMutation({ id: submissionData._id, status: newStatus as any });
            setModalType("success");
            setModalMessage(`Submission ${newStatus} successfully.`);
            setShowModal(true);
        } catch (err: any) {
            setModalType("error");
            setModalMessage("Failed to update status. Please try again.");
            setShowModal(true);
        } finally {
            setUpdating(false);
        }
    };

    const handleRejectWithReason = async () => {
        if (!submissionData || !user) return;
        setRejecting(true);
        try {
            await rejectSubmissionMutation({
                submissionId: submissionData._id,
                adminId: user.id,
                reason: rejectionReason || undefined,
            });
            setShowRejectModal(false);
            setRejectionReason("");
            setModalType("success");
            setModalMessage("Submission rejected successfully.");
            setShowModal(true);
        } catch (err: any) {
            setModalType("error");
            setModalMessage("Failed to reject. Please try again.");
            setShowModal(true);
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
            setModalType("success");
            setModalMessage(result.message || "Payment confirmed. Creator balance updated.");
            setShowModal(true);
        } catch (error: any) {
            setModalType("error");
            setModalMessage(error.message || "Failed to mark as paid. Please try again.");
            setShowModal(true);
        } finally {
            setMarkingPaid(false);
        }
    };

    const handleDeleteSubmission = async () => {
        if (!submissionData || !user) return;
        setDeleting(true);
        try {
            const response = await fetch("/api/delete-submission", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ submissionId: submissionData._id }),
            });
            const data = await response.json().catch(() => ({} as any));
            if (!response.ok) throw new Error(data?.error || "Failed to delete submission");
            const failed: Array<{ asset: string; error: string }> = data?.failedAssets || [];
            if (failed.length > 0) {
                setShowDeleteModal(false);
                setModalType("error");
                setModalMessage(
                    `Submission record deleted, but ${failed.length} external ${failed.length === 1 ? "asset" : "assets"} could not be cleaned up:\n\n` +
                        failed.map((f) => `• ${f.asset}: ${f.error}`).join("\n") +
                        `\n\nThese may need manual cleanup.`
                );
                setShowModal(true);
                return;
            }
            window.location.href = "/admin";
        } catch (error: any) {
            setShowDeleteModal(false);
            setModalType("error");
            setModalMessage(error.message || "Failed to delete submission. Please try again.");
            setShowModal(true);
        } finally {
            setDeleting(false);
        }
    };

    const handleGenerateWebsite = async (customizationsOverride?: any) => {
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
        } catch (error: any) {
            setWebsiteError(error.message || "Failed to generate website");
        } finally {
            setGeneratingWebsite(false);
        }
    };

    const handlePublishWebsite = async () => {
        if (publishingWebsite) return;
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
            setModalType("success");
            setModalMessage(`Website published successfully. View at: ${data.url}`);
            setShowModal(true);
        } catch (error: any) {
            setModalType("error");
            setModalMessage(error.message || "Failed to publish website");
            setShowModal(true);
        } finally {
            setPublishingWebsite(false);
        }
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
            setModalType("success");
            setModalMessage(`Website republished successfully. Live at: ${data.url}`);
            setShowModal(true);
        } catch (error: any) {
            setModalType("error");
            setModalMessage(error.message || "Failed to republish website");
            setShowModal(true);
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
            setWebsitePublishedUrl(null);
            setModalType("success");
            setModalMessage("Website unpublished successfully.");
            setShowModal(true);
        } catch (error: any) {
            setModalType("error");
            setModalMessage(error.message || "Failed to unpublish website");
            setShowModal(true);
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
            setModalType("success");
            setModalMessage(`Email sent successfully to ${submission?.owner_email || "the business owner"}.`);
            setShowModal(true);
        } catch (error: any) {
            setModalType("error");
            setModalMessage(error.message || "Failed to send email");
            setShowModal(true);
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
                setModalType("success");
                setModalMessage("Payment email re-sent to the business owner.");
                setShowModal(true);
            } else {
                const data = await res.json();
                throw new Error(data.error || "Failed to send email");
            }
        } catch (err: any) {
            setModalType("error");
            setModalMessage(err.message || "Failed to re-send email");
            setShowModal(true);
        }
    };

    const [sendingFollowUp, setSendingFollowUp] = useState(false);
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
                setModalType("success");
                setModalMessage("Follow-up email sent to the business owner.");
                setShowModal(true);
            } else {
                const data = await res.json();
                throw new Error(data.error || "Failed to send follow-up email");
            }
        } catch (err: any) {
            setModalType("error");
            setModalMessage(err.message || "Failed to send follow-up email");
            setShowModal(true);
        } finally {
            setSendingFollowUp(false);
        }
    };

    const handleUpdateDesign = async (customizations: EditorCustomizations) => {
        if (JSON.stringify(customizations) === JSON.stringify(websiteCustomizations)) return;
        setWebsiteCustomizations(customizations);
        await handleGenerateWebsite(customizations);
    };

    const handleSaveContent = async (content: any, customizationsOverride?: any) => {
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
        await refresh();
    };

    // --- Render ---

    if (authLoading || dataLoading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
            </div>
        );
    }

    if (!isAdmin || !submission) return null;

    const tabs: Array<{ key: TabKey; label: string; icon: any }> = [
        { key: "editor", label: "Editor", icon: FileEdit },
        { key: "styles", label: "Styles", icon: Palette },
    ];

    return (
        <div className="min-h-screen bg-neutral-50 text-neutral-900">
            {/* Minimal back+title strip — only when in editor tab AND a
                website already exists. When there's no website yet, fall
                back to the full TopActionBar (below) so the admin can see
                the Generate button + submission status + payment actions.
                Without this gate the page rendered just an empty "No
                website generated yet" card with no controls at all. */}
            {activeTab === "editor" && websiteGenerated && (
                <div className="border-b border-neutral-200 bg-white px-4 sm:px-6 py-3 flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-700 hover:text-amber-700 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" /> Back
                    </button>
                    <div className="min-w-0">
                        <h1 className="text-base sm:text-lg font-bold text-neutral-900 truncate">
                            {submission.business_name}
                        </h1>
                        <p className="text-xs text-neutral-500 truncate">Submission details</p>
                    </div>
                </div>
            )}

            {/* TopActionBar is normally hidden in the editor tab — the
                SandboxEditor preview-bar owns Enhance / Regen / Publish /
                Republish / Unpublish / Send to client / Approve / Reject /
                Delete. But when no website has been generated yet, we
                ALWAYS show the TopActionBar so the Generate button + status
                pills + payment actions are reachable. */}
            {(activeTab !== "editor" || !websiteGenerated) && (
                <TopActionBar
                    businessName={submission.business_name}
                    status={submission.status}
                    websiteGenerated={websiteGenerated}
                    websitePublishedUrl={websitePublishedUrl}
                    hasTranscript={!!submission.transcript}
                    followUpSentAt={(submission as any).followUpEmailSentAt}
                    updating={updating}
                    generatingWebsite={generatingWebsite}
                    publishingWebsite={publishingWebsite}
                    republishingWebsite={republishingWebsite}
                    unpublishingWebsite={unpublishingWebsite}
                    enhancing={enhancing}
                    sendingEmail={sendingEmail}
                    markingPaid={markingPaid}
                    deleting={deleting}
                    sendingFollowUp={sendingFollowUp}
                    onGenerateWebsite={() => handleGenerateWebsite()}
                    onApprove={() => handleStatusUpdate("approved")}
                    onMarkInReview={() => handleStatusUpdate("in_review")}
                    onPublish={handlePublishWebsite}
                    onRepublish={handleRepublishWebsite}
                    onUnpublish={handleUnpublishWebsite}
                    onSendToClient={handleSendWebsiteEmail}
                    onEnhanceImages={handleTriggerEnhancedImages}
                    onMarkAsPaid={() => setShowMarkPaidModal(true)}
                    onResendPaymentEmail={handleResendPaymentEmail}
                    onSendFollowUp={handleSendFollowUp}
                    onReject={() => handleStatusUpdate("rejected")}
                    onDelete={() => setShowDeleteModal(true)}
                />
            )}

            <div
                className={`max-w-[1600px] mx-auto px-4 sm:px-6 py-5 grid grid-cols-1 gap-5 items-start ${
                    sidebarOpen ? "xl:grid-cols-[1fr_360px]" : "xl:grid-cols-1"
                }`}
            >
                {/* Main content (editor + preview) */}
                <div className="min-w-0">
                    {/* Sandbox-style slim toolbar — only shown when the admin is
                        viewing the legacy Styles panel. In sandbox/editor mode
                        the SandboxEditor's own preview-bar has all the actions,
                        so this strip stays hidden to avoid double chrome. */}
                    {websiteGenerated && activeTab !== "editor" && (
                        <div className="bg-white rounded-2xl border border-neutral-200 px-3 py-2 mb-4 flex items-center gap-2 overflow-x-auto">
                            <div className="inline-flex items-center bg-neutral-100 rounded-lg p-0.5">
                                {tabs.map((tab) => {
                                    const Icon = tab.icon;
                                    const active = activeTab === tab.key;
                                    return (
                                        <button
                                            key={tab.key}
                                            type="button"
                                            onClick={() => setActiveTab(tab.key)}
                                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                                                active
                                                    ? "bg-white text-amber-700 shadow-sm"
                                                    : "text-neutral-500 hover:text-neutral-900"
                                            }`}
                                        >
                                            <Icon className="w-3.5 h-3.5" />
                                            {tab.label}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="ml-auto flex items-center gap-2">
                                {websitePublishedUrl && (
                                    <a
                                        href={websitePublishedUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={websitePublishedUrl}
                                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 px-2.5 py-1.5 rounded-lg border border-amber-600 hover:border-amber-700 transition-colors whitespace-nowrap shadow-sm"
                                    >
                                        <Globe className="w-3.5 h-3.5" />
                                        View Deployed
                                    </a>
                                )}
                                <a
                                    href={`/api/preview/${submissionId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-700 hover:text-amber-700 px-2.5 py-1.5 rounded-lg border border-neutral-200 hover:border-amber-300 hover:bg-amber-50 transition-colors whitespace-nowrap"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    Open in New Tab
                                </a>
                                <button
                                    onClick={() => {
                                        setSidebarManuallyToggled(true);
                                        setSidebarOpen(!sidebarOpen);
                                    }}
                                    className="hidden xl:inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-700 hover:text-amber-700 px-2.5 py-1.5 rounded-lg border border-neutral-200 hover:border-amber-300 hover:bg-amber-50 transition-colors whitespace-nowrap"
                                    title={sidebarOpen ? "Hide details panel" : "Show details panel"}
                                    aria-label={sidebarOpen ? "Hide details panel" : "Show details panel"}
                                    aria-pressed={sidebarOpen}
                                >
                                    {sidebarOpen ? (
                                        <PanelRightClose className="w-3.5 h-3.5" />
                                    ) : (
                                        <PanelRightOpen className="w-3.5 h-3.5" />
                                    )}
                                    {sidebarOpen ? "Hide details" : "Details"}
                                </button>
                            </div>
                        </div>
                    )}

                    {websiteError && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-sm mb-4">
                            {websiteError}
                        </div>
                    )}

                    {/* No website yet — show the FULL submission overview
                        inline (business info / owner / address / media /
                        transcript / quality checklist) so the admin can
                        actually review what they're acting on. Before this
                        the main area was just an empty placeholder card
                        and all submission detail lived in an off-by-default
                        sidebar — meaning a fresh submission detail page
                        rendered no usable information at all. */}
                    {!websiteGenerated && !generatingWebsite && (
                        <div className="space-y-4">
                            <div
                                className="rounded-2xl px-5 py-4 flex items-start gap-3"
                                style={{
                                    background: "var(--ed-accent-bg, #F5E4C0)",
                                    border: "1px solid var(--ed-accent)",
                                    color: "var(--ed-accent-ink, #5C3A0F)",
                                }}
                            >
                                <Palette className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                    <h4
                                        style={{ fontFamily: "var(--font-fraunces)" }}
                                        className="text-base font-semibold mb-0.5"
                                    >
                                        Ready to generate this website.
                                    </h4>
                                    <p className="text-[13px]" style={{ color: "var(--ed-ink-2)" }}>
                                        Review the submission below, then click{" "}
                                        <span className="font-semibold">Generate</span>{" "}
                                        in the top bar to create a real coded site.
                                    </p>
                                </div>
                            </div>

                            <DetailsSidebar
                                submission={{
                                    business_name: submission.business_name,
                                    business_type: submission.business_type,
                                    owner_name: submission.owner_name,
                                    owner_phone: submission.owner_phone,
                                    owner_email: submission.owner_email,
                                    address: submission.address,
                                    city: submission.city,
                                    photos: submission.photos || [],
                                    transcript: submission.transcript,
                                    status: submission.status,
                                    creator_payout: submission.creator_payout,
                                    created_at: submission.created_at,
                                }}
                                photoUrls={photoUrls}
                                transcriptionUpdatedAt={submissionData?.transcriptionUpdatedAt}
                                qualityChecklist={qualityChecklist}
                                creator={creator}
                                onEditBusinessInfo={handleEdit}
                                onEditPhotos={handleEdit}
                                onOpenLightbox={(index) => {
                                    setLightboxIndex(index);
                                    setLightboxOpen(true);
                                }}
                                transcribing={transcribing}
                                onRetriggerTranscription={handleRetriggerTranscription}
                            />
                        </div>
                    )}

                    {/* Generating spinner */}
                    {generatingWebsite && (
                        <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center">
                            <Loader2 className="w-12 h-12 animate-spin text-amber-600 mx-auto mb-4" />
                            <h4
                                style={{ fontFamily: "var(--font-fraunces)" }}
                                className="text-xl font-semibold text-neutral-900 mb-1"
                            >
                                Generating website…
                            </h4>
                            <p className="text-sm text-neutral-600">This usually takes 30–60 seconds.</p>
                        </div>
                    )}

                    {/* Tab content (only when website exists) */}
                    {websiteGenerated && !generatingWebsite && (
                        <>
                            {activeTab === "styles" && (
                                <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
                                    <div className="h-[calc(100vh-220px)] sticky top-[88px] overflow-hidden">
                                        <ContentEditor
                                            initialCustomizations={websiteCustomizations}
                                            onUpdate={handleUpdateDesign}
                                            disabled={generatingWebsite}
                                        />
                                    </div>
                                    <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
                                        <WebsitePreview
                                            htmlContent={websiteHtmlContent || ""}
                                            isRegenerating={generatingWebsite}
                                        />
                                    </div>
                                </div>
                            )}

                            {activeTab === "editor" && (
                                <SandboxEditor
                                    submissionId={submissionId}
                                    businessName={submission.business_name}
                                    businessType={submission.business_type}
                                    htmlContent={websiteHtmlContent || ""}
                                    content={websiteContent ?? {
                                        business_name: submission.business_name || "",
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
                                    onUpdateDesign={handleUpdateDesign}
                                    websitePublishedUrl={websitePublishedUrl ?? undefined}
                                    websiteGenerated={websiteGenerated}
                                    generatingWebsite={generatingWebsite}
                                    publishingWebsite={publishingWebsite}
                                    republishingWebsite={republishingWebsite}
                                    unpublishingWebsite={unpublishingWebsite}
                                    enhancing={enhancing}
                                    sendingEmail={sendingEmail}
                                    onSendToClient={handleSendWebsiteEmail}
                                    onEnhanceImages={handleTriggerEnhancedImages}
                                    onRegenerate={() => handleGenerateWebsite()}
                                    onPublish={handlePublishWebsite}
                                    onRepublish={handleRepublishWebsite}
                                    onUnpublish={handleUnpublishWebsite}
                                    onDelete={() => setShowDeleteModal(true)}
                                    onApprove={() => handleStatusUpdate("approved")}
                                    onReject={() => handleStatusUpdate("rejected")}
                                    submissionStatus={submission.status}
                                    onToggleDetails={() => {
                                        setSidebarManuallyToggled(true);
                                        setSidebarOpen(!sidebarOpen);
                                    }}
                                    detailsOpen={sidebarOpen}
                                />
                            )}
                        </>
                    )}
                </div>

                {/* Right sidebar — sticky with its own scroll container, collapsible at xl+ */}
                {sidebarOpen && (
                    <div className="xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto xl:pr-1 sidebar-scroll space-y-4">
                        {/* Drive folder sync status + actions — visible only
                            when the submission is approved or has had a manual
                            sync attempt, so the section doesn't clutter the
                            sidebar for draft/pending rows. */}
                        {(submission.status === "approved" || (submissionData as any)?.driveSyncStatus) && (
                            <DriveSection
                                submissionId={submissionData!._id}
                                status={(submissionData as any)?.driveSyncStatus}
                                folderUrl={(submissionData as any)?.driveFolderUrl}
                                folderCreatedAt={(submissionData as any)?.driveFolderCreatedAt}
                                error={(submissionData as any)?.driveSyncError}
                            />
                        )}
                        <DetailsSidebar
                            submission={{
                                business_name: submission.business_name,
                                business_type: submission.business_type,
                                owner_name: submission.owner_name,
                                owner_phone: submission.owner_phone,
                                owner_email: submission.owner_email,
                                address: submission.address,
                                city: submission.city,
                                photos: submission.photos || [],
                                transcript: submission.transcript,
                                status: submission.status,
                                creator_payout: submission.creator_payout,
                                created_at: submission.created_at,
                            }}
                            photoUrls={photoUrls}
                            transcriptionUpdatedAt={submissionData?.transcriptionUpdatedAt}
                            qualityChecklist={qualityChecklist}
                            creator={creator}
                            onEditBusinessInfo={handleEdit}
                            onEditPhotos={handleEdit}
                            onOpenLightbox={(index) => {
                                setLightboxIndex(index);
                                setLightboxOpen(true);
                            }}
                            transcribing={transcribing}
                            onRetriggerTranscription={handleRetriggerTranscription}
                        />
                    </div>
                )}
            </div>

            {/* Modals (same as before) */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
                        <div className="text-center">
                            <div
                                className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                                    modalType === "success"
                                        ? "bg-amber-50 border-2 border-amber-200"
                                        : "bg-rose-50 border-2 border-rose-200"
                                }`}
                            >
                                {modalType === "success" ? (
                                    <Check className="w-8 h-8 text-amber-600" strokeWidth={3} />
                                ) : (
                                    <X className="w-8 h-8 text-rose-600" strokeWidth={3} />
                                )}
                            </div>
                            <h3
                                style={{ fontFamily: "var(--font-fraunces)" }}
                                className={`text-2xl font-semibold mb-2 ${modalType === "success" ? "text-neutral-900" : "text-rose-900"}`}
                            >
                                {modalType === "success" ? "Success" : "Something went wrong"}
                            </h3>
                            <p className="text-neutral-600 mb-6 text-sm whitespace-pre-wrap">{modalMessage}</p>
                            <button
                                onClick={() => setShowModal(false)}
                                className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-colors min-h-[44px] ${
                                    modalType === "success"
                                        ? "bg-amber-600 hover:bg-amber-700 text-white"
                                        : "bg-neutral-900 hover:bg-black text-white"
                                }`}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showMarkPaidModal && submission && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 sm:p-7">
                        <h3
                            style={{ fontFamily: "var(--font-fraunces)" }}
                            className="text-2xl font-semibold text-neutral-900 mb-2"
                        >
                            Confirm payment received
                        </h3>
                        <p className="text-neutral-600 mb-4 text-sm">Are you sure you want to mark this submission as paid?</p>
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                            <p className="text-sm font-semibold text-amber-900 mb-2">This will:</p>
                            <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
                                <li>Update submission status to &quot;Paid&quot;</li>
                                <li>Add ₱{(submission.creator_payout ?? 0).toLocaleString()} to creator&apos;s balance</li>
                                <li>Update creator&apos;s total earnings</li>
                            </ul>
                        </div>
                        <div className="bg-neutral-50 rounded-xl p-4 mb-4 space-y-1">
                            <div className="flex justify-between text-sm">
                                <span className="text-neutral-600">Business</span>
                                <span className="font-medium text-neutral-900">{submission.business_name}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-neutral-600">Creator payout</span>
                                <span className="font-bold text-amber-700">₱{(submission.creator_payout ?? 0).toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowMarkPaidModal(false)}
                                disabled={markingPaid}
                                className="flex-1 py-3 px-4 rounded-xl font-semibold border border-neutral-200 hover:bg-neutral-50 transition-colors disabled:opacity-50 min-h-[44px] text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleMarkAsPaid}
                                disabled={markingPaid}
                                className="flex-1 py-3 px-4 rounded-xl font-semibold bg-amber-600 hover:bg-amber-700 text-white transition-colors disabled:opacity-50 min-h-[44px] text-sm inline-flex items-center justify-center gap-2"
                            >
                                {markingPaid && <Loader2 className="w-4 h-4 animate-spin" />}
                                {markingPaid ? "Processing…" : "Confirm payment"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showRejectModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl">
                        <h3
                            style={{ fontFamily: "var(--font-fraunces)" }}
                            className="text-2xl font-semibold text-neutral-900 mb-2"
                        >
                            Reject submission
                        </h3>
                        <p className="text-neutral-600 mb-4 text-sm">Provide a reason for rejecting this submission (optional).</p>
                        <textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Reason for rejection…"
                            className="w-full h-32 p-3 border border-neutral-200 rounded-xl text-sm resize-none focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 mb-4"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setShowRejectModal(false);
                                    setRejectionReason("");
                                }}
                                disabled={rejecting}
                                className="flex-1 py-3 px-4 rounded-xl font-semibold border border-neutral-200 hover:bg-neutral-50 transition-colors disabled:opacity-50 min-h-[44px] text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRejectWithReason}
                                disabled={rejecting}
                                className="flex-1 py-3 px-4 rounded-xl font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors disabled:opacity-50 min-h-[44px] text-sm inline-flex items-center justify-center gap-2"
                            >
                                {rejecting && <Loader2 className="w-4 h-4 animate-spin" />}
                                {rejecting ? "Rejecting…" : "Reject"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showDeleteModal && submission && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-rose-50 border-2 border-rose-200 rounded-full flex items-center justify-center">
                                <AlertTriangle className="w-5 h-5 text-rose-600" />
                            </div>
                            <h3
                                style={{ fontFamily: "var(--font-fraunces)" }}
                                className="text-xl font-semibold text-neutral-900 truncate"
                            >
                                Delete &ldquo;{submission.business_name}&rdquo;
                            </h3>
                        </div>
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-4">
                            <p className="text-sm font-semibold text-rose-900 mb-2">This is permanent.</p>
                            <ul className="text-sm text-rose-800 space-y-1 list-disc list-inside">
                                <li>Business submission record</li>
                                <li>Generated website &amp; content</li>
                                <li>All media files from R2</li>
                                <li>Cloudflare Pages deployment</li>
                                <li>Airtable record</li>
                            </ul>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                disabled={deleting}
                                className="flex-1 py-3 px-4 rounded-xl font-semibold border border-neutral-200 hover:bg-neutral-50 transition-colors disabled:opacity-50 min-h-[44px] text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteSubmission}
                                disabled={deleting}
                                className="flex-1 py-3 px-4 rounded-xl font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors disabled:opacity-50 min-h-[44px] text-sm inline-flex items-center justify-center gap-2"
                            >
                                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                {deleting ? "Processing…" : "Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {lightboxOpen && photoUrls && photoUrls.length > 0 && (
                <PhotoLightbox
                    photos={photoUrls.filter((url): url is string => url !== null && url.startsWith("http"))}
                    initialIndex={lightboxIndex}
                    onClose={() => setLightboxOpen(false)}
                />
            )}
        </div>
    );
}
