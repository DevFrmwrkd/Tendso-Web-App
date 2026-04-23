"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { useUser } from "@clerk/nextjs"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PhotoLightbox } from "@/components/PhotoLightbox"
import WebsitePreview from "@/components/WebsitePreview"
import VisualEditor from "@/components/editor/VisualEditor"
import ContentEditor, { EditorCustomizations } from "@/components/ContentEditor"
import { createClient } from "@/lib/supabase/client"

export default function SubmissionDetailPage() {
    const params = useParams()
    const submissionId = params.id as string
    const { user, isLoaded } = useUser()

    // Get current user to check admin status
    const currentCreator = useQuery(
        api.creators.getByClerkId,
        user ? { clerkId: user.id } : "skip"
    )
    const isAdmin = currentCreator?.role === 'admin'

    // Get submission with creator info
    const submissionData = useQuery(
        api.submissions.getByIdWithCreator,
        isAdmin && submissionId ? { id: submissionId as Id<"submissions"> } : "skip"
    )

    // Resolve photo storage IDs to actual URLs (only for legacy Convex storage IDs)
    // R2 URLs start with http and don't need resolution
    const needsPhotoResolution = submissionData?.photos?.some((p: any) => !p.startsWith('http'))
    const photoStorageIdsForQuery = submissionData?.photos?.filter((p: any) => !p.startsWith('http')) || []
    const photoViaResolve = useQuery(
        api.files.getMultipleUrls,
        photoStorageIdsForQuery.length > 0 ? { storageIds: photoStorageIdsForQuery } : "skip"
    )

    // Build consolidated photo URLs - include both direct HTTP and resolved storage IDs
    const photoUrls = (() => {
        const result: string[] = []
        
        // Add direct HTTP URLs from submission photos
        if (submissionData?.photos) {
            for (const photo of submissionData.photos) {
                if (photo.startsWith('http')) {
                    result.push(photo)
                }
            }
        }
        
        // Add resolved storage URLs
        if (photoViaResolve && Array.isArray(photoViaResolve)) {
            for (const url of photoViaResolve) {
                if (url && typeof url === 'string') {
                    result.push(url)
                }
            }
        }
        
        return result
    })()

    // Load existing generated website if available (moved up for heroImageUrls dependency)
    const existingWebsite = useQuery(
        api.generatedWebsites.getBySubmissionId,
        submissionData ? { submissionId: submissionData._id } : "skip"
    )

    // Resolve hero images from websiteContent (these may be different from submission photos)
    const websiteImages = existingWebsite?.extractedContent?.images as string[] | undefined
    const needsHeroResolution = websiteImages?.some(p => !p.startsWith('http'))
    const heroImageUrls = useQuery(
        api.files.getMultipleUrls,
        needsHeroResolution && websiteImages && websiteImages.length > 0
            ? { storageIds: websiteImages }
            : "skip"
    )

    // Fetch enhanced images from websiteContent table
    const websiteContentRecord = useQuery(
        api.websiteContent.getBySubmissionId,
        submissionData ? { submissionId: submissionData._id } : "skip"
    )

    // Extract enhanced image URLs from all possible sources (same priority as generate-website route)
    const enhancedImageData = (() => {
        // Source 1: generatedWebsites.enhancedImages (top-level, saved by Airtable sync)
        let enhancedImages = (existingWebsite as any)?.enhancedImages || null
        // Source 2: generatedWebsites.extractedContent.enhancedImages (nested)
        if (!enhancedImages) {
            enhancedImages = (existingWebsite?.extractedContent as any)?.enhancedImages || null
        }
        // Source 3: websiteContent.enhancedImages
        if (!enhancedImages) {
            enhancedImages = (websiteContentRecord as any)?.enhancedImages || null
        }
        if (!enhancedImages || typeof enhancedImages !== 'object') return null
        return enhancedImages as Record<string, { url?: string; storageId?: string }>
    })()

    // Categorize enhanced images by section (matching generate-website route logic)
    const enhancedImagesByCategory = (() => {
        if (!enhancedImageData) return null
        const categories: Record<string, string[]> = {}
        const allUrls: string[] = []
        for (const [key, img] of Object.entries(enhancedImageData)) {
            // Prefer storageId (Convex, resolves to fresh URL) over url (Airtable, expires)
            let imageUrl = ''
            if (typeof img === 'string') {
                imageUrl = img
            } else if (img && typeof img === 'object') {
                imageUrl = (img as any).storageId || (img as any).url || ''
            }

            if (!imageUrl) continue
            // Skip expired Airtable URLs — they'll show as broken images
            if (imageUrl.includes('airtableusercontent.com')) continue
            allUrls.push(imageUrl)
            
            // Enhanced images from Airtable may have prefixes, handle both
            const lowerKey = key.toLowerCase()
            
            if (lowerKey.includes('interior') || lowerKey.includes('headshot')) {
                categories.about = categories.about || []
                categories.about.push(imageUrl)
            }
            if (lowerKey.includes('product')) {
                categories.featured = categories.featured || []
                categories.featured.push(imageUrl)
            }
            if (lowerKey.includes('exterior') || lowerKey.includes('headshot')) {
                categories.hero = categories.hero || []
                categories.hero.push(imageUrl)
            }
            if (lowerKey.includes('interior') || lowerKey.includes('exterior')) {
                categories.services = categories.services || []
                categories.services.push(imageUrl)
            }
        }
        return { categories, allUrls }
    })()

    // Resolve enhanced image URLs (they may be storage IDs that need resolution)
    const enhancedUrls = enhancedImagesByCategory?.allUrls || []
    const enhancedStorageIds = enhancedUrls.filter(u => !u.startsWith('http'))
    const enhancedHttpUrls = enhancedUrls.filter(u => u.startsWith('http'))
    const resolvedEnhancedUrls = useQuery(
        api.files.getMultipleUrls,
        enhancedStorageIds.length > 0 ? { storageIds: enhancedStorageIds } : "skip"
    )

    // Build a map from storage ID -> resolved URL for enhanced images
    const enhancedUrlMap = (() => {
        const map: Record<string, string> = {}
        if (resolvedEnhancedUrls) {
            enhancedStorageIds.forEach((sid, i) => {
                if (resolvedEnhancedUrls[i]) map[sid] = resolvedEnhancedUrls[i]!
            })
        }
        // Add direct HTTP URLs (excluding expired Airtable URLs)
        enhancedHttpUrls
            .filter(url => !url.includes('airtableusercontent.com'))
            .forEach(url => { map[url] = url })
        return map
    })()

    // Helper to resolve an enhanced URL (storage ID or http URL)
    const resolveEnhancedUrl = (url: string): string | null => {
        if (!url) return null
        // Never return expired Airtable URLs
        if (url.includes('airtableusercontent.com')) return null
        if (url.startsWith('http')) return url
        // Resolve storage ID from map
        return enhancedUrlMap[url] || null
    }

    const hasEnhancedImages = (enhancedImagesByCategory?.allUrls?.length ?? 0) > 0

    // Prefer R2 URLs (videoUrl/audioUrl) over Convex storage IDs for video/audio
    const hasR2VideoUrl = !!submissionData?.videoUrl
    const hasR2AudioUrl = !!submissionData?.audioUrl

    // Resolve video storage ID to URL (only if no R2 URL)
    // Use getMultipleUrls which handles both Convex storage IDs and R2 key paths
    const resolvedVideoUrls = useQuery(
        api.files.getMultipleUrls,
        !hasR2VideoUrl && submissionData?.videoStorageId
            ? { storageIds: [submissionData.videoStorageId.toString()] }
            : "skip"
    )
    const legacyVideoUrl = resolvedVideoUrls?.[0] || null

    // Resolve audio storage ID to URL (only if no R2 URL)
    const resolvedAudioUrls = useQuery(
        api.files.getMultipleUrls,
        !hasR2AudioUrl && submissionData?.audioStorageId
            ? { storageIds: [submissionData.audioStorageId.toString()] }
            : "skip"
    )
    const legacyAudioUrl = resolvedAudioUrls?.[0] || null

    // Use R2 URLs if available, otherwise fall back to resolved legacy URLs
    const videoUrl = hasR2VideoUrl ? submissionData?.videoUrl : legacyVideoUrl
    const audioUrl = hasR2AudioUrl ? submissionData?.audioUrl : legacyAudioUrl

    // Mutations
    const updateSubmissionMutation = useMutation(api.submissions.update)
    const updateStatusMutation = useMutation(api.submissions.updateStatus)
    const approveSubmissionMutation = useMutation(api.admin.approveSubmission)
    const rejectSubmissionMutation = useMutation(api.admin.rejectSubmission)
    const markDeployedMutation = useMutation(api.admin.markDeployed)
    const markPaidMutation = useMutation(api.admin.markPaid)
    const logTranscriptionRegeneratedMutation = useMutation(api.admin.logTranscriptionRegenerated)
    const logImagesEnhancedMutation = useMutation(api.admin.logImagesEnhanced)

    // Airtable push mutation
    const triggerAirtablePushMutation = useMutation(api.airtable.triggerAirtablePush)

    const authLoading = !isLoaded || (user && currentCreator === undefined)
    const dataLoading = isAdmin && submissionData === undefined
    const [updating, setUpdating] = useState(false)

    // Transcription retrigger state
    const [transcribing, setTranscribing] = useState(false)

    // Airtable enhance state
    const [enhancing, setEnhancing] = useState(false)

    // Map Convex data to expected format
    const submission = submissionData ? {
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
    } : null

    const creator = submissionData?.creator ? {
        first_name: submissionData.creator.firstName,
        last_name: submissionData.creator.lastName,
        email: submissionData.creator.email,
        phone: submissionData.creator.phone,
    } : null

    // Refresh function (Convex auto-refreshes, but keep for compatibility)
    const refresh = () => { }

    // Modal state
    const [showModal, setShowModal] = useState(false)
    const [modalMessage, setModalMessage] = useState('')
    const [modalType, setModalType] = useState<'success' | 'error'>('success')

    // Mark as Paid modal state
    const [showMarkPaidModal, setShowMarkPaidModal] = useState(false)
    const [markingPaid, setMarkingPaid] = useState(false)

    // Rejection reason modal state
    const [showRejectModal, setShowRejectModal] = useState(false)
    const [rejectionReason, setRejectionReason] = useState('')
    const [rejecting, setRejecting] = useState(false)

    // Delete submission modal state
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [deleting, setDeleting] = useState(false)

    // Lightbox state
    const [lightboxOpen, setLightboxOpen] = useState(false)
    const [lightboxIndex, setLightboxIndex] = useState(0)

    // Quality checklist state
    const [qualityChecklist, setQualityChecklist] = useState({
        hasPhotos: false,
        hasAudioVideo: false,
        hasTranscript: false,
        businessInfoComplete: false,
        contactInfoComplete: false,
    })

    // Edit mode states
    const [isEditing, setIsEditing] = useState(false)
    const [saving, setSaving] = useState(false)
    const [editedData, setEditedData] = useState({
        business_name: '',
        business_type: '',
        owner_name: '',
        owner_phone: '',
        owner_email: '',
        address: '',
        city: '',
        transcript: '',
        photos: [] as string[],
    })

    // Website generation states
    const [generatingWebsite, setGeneratingWebsite] = useState(false)
    const [websiteGenerated, setWebsiteGenerated] = useState(false)
    const [websitePreviewUrl, setWebsitePreviewUrl] = useState<string | null>(null)
    const [websiteHtmlContent, setWebsiteHtmlContent] = useState<string | null>(null)
    const [publishingWebsite, setPublishingWebsite] = useState(false)

    // Handler to update HTML content from WebsitePreview
    const handleUpdateHtml = (html: string) => {
        setWebsiteHtmlContent(html)
    }

    // Handler to publish website to Cloudflare Pages
    const handlePublishWebsite = async () => {
        if (publishingWebsite) return

        setPublishingWebsite(true)
        try {
            const response = await fetch('/api/publish-website', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    submissionId,
                }),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to publish website')
            }

            const data = await response.json()
            setWebsitePublishedUrl(data.url)

            // Create audit trail for deployment
            if (user && submissionData) {
                try {
                    await markDeployedMutation({
                        submissionId: submissionData._id,
                        adminId: user.id,
                        websiteUrl: data.url,
                    })
                } catch (auditErr) {
                    console.error('Audit log error (non-blocking):', auditErr)
                }
            }

            setModalType('success')
            setModalMessage(`Website published successfully! View at: ${data.url}`)
            setShowModal(true)
        } catch (error: any) {
            console.error('Publish error:', error)
            setModalType('error')
            setModalMessage(error.message || 'Failed to publish website')
            setShowModal(true)
        } finally {
            setPublishingWebsite(false)
        }
    }

    // Handler to republish website (update existing deployment)
    const [republishingWebsite, setRepublishingWebsite] = useState(false)
    const handleRepublishWebsite = async () => {
        if (republishingWebsite) return

        setRepublishingWebsite(true)
        try {
            const response = await fetch('/api/publish-website', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    submissionId,
                }),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to republish website')
            }

            const data = await response.json()
            setWebsitePublishedUrl(data.url)
            setModalType('success')
            setModalMessage(`Website republished successfully! Changes are now live at: ${data.url}`)
            setShowModal(true)
        } catch (error: any) {
            console.error('Republish error:', error)
            setModalType('error')
            setModalMessage(error.message || 'Failed to republish website')
            setShowModal(true)
        } finally {
            setRepublishingWebsite(false)
        }
    }

    // Handler to unpublish website from Cloudflare Pages
    const [unpublishingWebsite, setUnpublishingWebsite] = useState(false)
    const handleUnpublishWebsite = async () => {
        if (unpublishingWebsite) return

        setUnpublishingWebsite(true)
        try {
            const response = await fetch('/api/unpublish-website', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ submissionId }),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to unpublish website')
            }

            setWebsitePublishedUrl(null)
            setModalType('success')
            setModalMessage('Website unpublished successfully.')
            setShowModal(true)
        } catch (error: any) {
            console.error('Unpublish error:', error)
            setModalType('error')
            setModalMessage(error.message || 'Failed to unpublish website')
            setShowModal(true)
        } finally {
            setUnpublishingWebsite(false)
        }
    }

    // Handler to save edits + regenerate + republish in one action
    const [saveAndPublishStep, setSaveAndPublishStep] = useState<'idle' | 'saving' | 'generating' | 'publishing'>('idle')
    const handleSaveAndPublishEdits = async () => {
        if (saveAndPublishStep !== 'idle' || !submission || !submissionData) return

        try {
            // Step 1: Save edits if currently in edit mode
            if (isEditing) {
                setSaveAndPublishStep('saving')
                await updateSubmissionMutation({
                    id: submissionData._id,
                    businessName: editedData.business_name,
                    businessType: editedData.business_type,
                    ownerName: editedData.owner_name,
                    ownerPhone: editedData.owner_phone,
                    ownerEmail: editedData.owner_email || undefined,
                    address: editedData.address,
                    city: editedData.city,
                    transcript: editedData.transcript || undefined,
                    photos: editedData.photos,
                })
                setIsEditing(false)
            }

            // Step 2: Regenerate website so htmlContent reflects the latest submission data
            setSaveAndPublishStep('generating')
            const genRes = await fetch('/api/generate-website', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    submissionId,
                    customizations: websiteCustomizations,
                }),
            })
            if (!genRes.ok) {
                const errData = await genRes.json().catch(() => ({}))
                throw new Error(`Regeneration failed: ${errData.error || genRes.statusText}`)
            }

            // Step 3: Republish to Cloudflare Worker (overwrites existing deployment in place)
            setSaveAndPublishStep('publishing')
            const pubRes = await fetch('/api/publish-website', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ submissionId }),
            })
            if (!pubRes.ok) {
                const errData = await pubRes.json().catch(() => ({}))
                throw new Error(`Publishing failed: ${errData.error || pubRes.statusText}`)
            }
            const pubData = await pubRes.json()

            setWebsitePublishedUrl(pubData.url)
            setModalType('success')
            setModalMessage(`Changes applied! Live at: ${pubData.url}`)
            setShowModal(true)
        } catch (error: any) {
            console.error('Save & publish error:', error)
            setModalType('error')
            setModalMessage(error.message || 'Failed to apply changes to the live site')
            setShowModal(true)
        } finally {
            setSaveAndPublishStep('idle')
        }
    }

    // Handler to send website URL to business owner
    const [sendingEmail, setSendingEmail] = useState(false)
    const handleSendWebsiteEmail = async () => {
        if (sendingEmail || !websitePublishedUrl) return

        setSendingEmail(true)
        try {
            const response = await fetch('/api/send-website-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    submissionId,
                    websiteUrl: websitePublishedUrl,
                }),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to send email')
            }

            setModalType('success')
            setModalMessage(`Email sent successfully to ${submission?.owner_email || 'the business owner'}!`)
            setShowModal(true)
        } catch (error: any) {
            console.error('Send email error:', error)
            setModalType('error')
            setModalMessage(error.message || 'Failed to send email')
            setShowModal(true)
        } finally {
            setSendingEmail(false)
        }
    }

    const handleUpdateDesign = async (customizations: EditorCustomizations) => {
        if (JSON.stringify(customizations) === JSON.stringify(websiteCustomizations)) {
            return
        }
        setWebsiteCustomizations(customizations)
        await handleGenerateWebsite(customizations)
    }

    const [websiteContent, setWebsiteContent] = useState<any>(null)
    const [websiteCustomizations, setWebsiteCustomizations] = useState<any>(null)
    const [websiteError, setWebsiteError] = useState<string | null>(null)
    const [websitePublishedUrl, setWebsitePublishedUrl] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<'preview' | 'design' | 'content'>('preview')

    const handleEdit = () => {
        if (submission) {
            setEditedData({
                business_name: submission.business_name,
                business_type: submission.business_type,
                owner_name: submission.owner_name,
                owner_phone: submission.owner_phone,
                owner_email: submission.owner_email || '',
                address: submission.address,
                city: submission.city,
                transcript: submission.transcript || '',
                photos: submission.photos || [],
            })
            setIsEditing(true)
        }
    }

    const handleCancel = () => {
        setIsEditing(false)
        setEditedData({
            business_name: '',
            business_type: '',
            owner_name: '',
            owner_phone: '',
            owner_email: '',
            address: '',
            city: '',
            transcript: '',
            photos: [],
        })
    }

    const handleSave = async () => {
        if (!submission || !submissionData) return

        setSaving(true)
        try {
            await updateSubmissionMutation({
                id: submissionData._id,
                businessName: editedData.business_name,
                businessType: editedData.business_type,
                ownerName: editedData.owner_name,
                ownerPhone: editedData.owner_phone,
                ownerEmail: editedData.owner_email || undefined,
                address: editedData.address,
                city: editedData.city,
                transcript: editedData.transcript || undefined,
                photos: editedData.photos,
            })

            setModalType('success')
            setModalMessage('Changes saved successfully!')
            setShowModal(true)
            setIsEditing(false)
        } catch (err: any) {
            console.error('Error saving changes:', err)
            setModalType('error')
            setModalMessage('Failed to save changes. Please try again.')
            setShowModal(true)
        } finally {
            setSaving(false)
        }
    }

    const removePhoto = (indexToRemove: number) => {
        setEditedData({
            ...editedData,
            photos: editedData.photos.filter((_, index) => index !== indexToRemove)
        })
    }

    // Re-generate transcription from audio/video
    const handleRetriggerTranscription = async () => {
        if (transcribing || !submissionData) return

        setTranscribing(true)
        try {
            const response = await fetch('/api/transcribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    submissionId: submissionData._id,
                    videoUrl: videoUrl || submissionData.videoUrl,
                    audioUrl: audioUrl || submissionData.audioUrl,
                    useConvexStorage: !!(submissionData.videoStorageId || submissionData.audioStorageId),
                    videoStorageId: submissionData.videoStorageId,
                    audioStorageId: submissionData.audioStorageId,
                }),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to transcribe')
            }

            // Log audit trail
            if (user) {
                try {
                    await logTranscriptionRegeneratedMutation({
                        submissionId: submissionData._id,
                        adminId: user.id,
                        businessName: submissionData.businessName,
                    })
                } catch (auditErr) {
                    console.error('Audit log error (non-blocking):', auditErr)
                }
            }

            setModalType('success')
            setModalMessage('Transcription generated successfully!')
            setShowModal(true)
        } catch (error: any) {
            console.error('Transcription error:', error)
            setModalType('error')
            const errorMsg = error.message || 'Failed to generate transcription'
            // Parse API error details if available
            if (errorMsg.includes('exceeds Groq size limit')) {
                setModalMessage('File is too large even after chunking. Try:\n1. Re-encoding at lower bitrate\n2. Trimming unnecessary segments\n3. Using a shorter video')
            } else if (errorMsg.includes('413') || errorMsg.includes('Entity Too Large')) {
                setModalMessage('File size issue during upload. This is usually temporary. Try again in a moment.')
            } else if (errorMsg.includes('Invalid')) {
                setModalMessage('Invalid file format. Please use MP3, WAV, MP4, or WebM.')
            } else if (errorMsg.includes('timeout')) {
                setModalMessage('Transcription took too long. Please try a shorter file.')
            } else {
                setModalMessage(errorMsg)
            }
            setShowModal(true)
        } finally {
            setTranscribing(false)
        }
    }

    // Trigger Airtable push for enhanced images & content
    const handleTriggerEnhancedImages = async () => {
        if (enhancing || !submissionData) return

        setEnhancing(true)
        try {
            await triggerAirtablePushMutation({
                submissionId: submissionData._id,
            })

            // Log audit trail
            if (user) {
                try {
                    await logImagesEnhancedMutation({
                        submissionId: submissionData._id,
                        adminId: user.id,
                        businessName: submissionData.businessName,
                    })
                } catch (auditErr) {
                    console.error('Audit log error (non-blocking):', auditErr)
                }
            }

            setModalType('success')
            setModalMessage('Airtable enhancement triggered! Enhanced images will be available shortly.')
            setShowModal(true)
        } catch (error: any) {
            console.error('Airtable push error:', error)
            setModalType('error')
            setModalMessage(error.message || 'Failed to trigger Airtable enhancement')
            setShowModal(true)
        } finally {
            setEnhancing(false)
        }
    }

    const handleStatusUpdate = async (newStatus: string) => {
        if (!submissionData || !user) return

        // Route approve/reject through wired admin mutations
        if (newStatus === 'approved') {
            setUpdating(true)
            try {
                await approveSubmissionMutation({
                    submissionId: submissionData._id,
                    adminId: user.id,
                })
                setModalType('success')
                setModalMessage('Submission approved successfully!')
                setShowModal(true)

                // Send approval email
                try {
                    await fetch('/api/send-approval-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ submissionId })
                    })
                } catch (error) {
                    console.error('Failed to send approval email:', error)
                }
            } catch (err: any) {
                console.error('Approve error:', err)
                setModalType('error')
                setModalMessage('Failed to approve. Please try again.')
                setShowModal(true)
            } finally {
                setUpdating(false)
            }
            return
        }

        if (newStatus === 'rejected') {
            // Show rejection reason modal instead of immediately rejecting
            setShowRejectModal(true)
            return
        }

        // For other statuses, use the generic updateStatus mutation
        setUpdating(true)
        try {
            await updateStatusMutation({
                id: submissionData._id,
                status: newStatus as any,
            })

            setModalType('success')
            setModalMessage(`Submission ${newStatus} successfully!`)
            setShowModal(true)
        } catch (err: any) {
            console.error('Status update error:', err)
            setModalType('error')
            setModalMessage('Failed to update status. Please try again.')
            setShowModal(true)
        } finally {
            setUpdating(false)
        }
    }

    const handleRejectWithReason = async () => {
        if (!submissionData || !user) return

        setRejecting(true)
        try {
            await rejectSubmissionMutation({
                submissionId: submissionData._id,
                adminId: user.id,
                reason: rejectionReason || undefined,
            })
            setShowRejectModal(false)
            setRejectionReason('')
            setModalType('success')
            setModalMessage('Submission rejected successfully.')
            setShowModal(true)
        } catch (err: any) {
            console.error('Reject error:', err)
            setModalType('error')
            setModalMessage('Failed to reject. Please try again.')
            setShowModal(true)
        } finally {
            setRejecting(false)
        }
    }

    const handleMarkAsPaid = async () => {
        if (!submissionData || !user) return

        setMarkingPaid(true)
        try {
            const response = await fetch('/api/mark-paid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ submissionId: submissionData._id }),
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'Failed to mark as paid')

            setShowMarkPaidModal(false)
            setModalType('success')
            setModalMessage(result.message || 'Payment confirmed! Earning record created and creator balance updated.')
            setShowModal(true)
        } catch (error: any) {
            console.error('Mark paid error:', error)
            setModalType('error')
            setModalMessage(error.message || 'Failed to mark as paid. Please try again.')
            setShowModal(true)
        } finally {
            setMarkingPaid(false)
        }
    }

    // Handle cascading deletion
    const handleDeleteSubmission = async () => {
        if (!submissionData || !user) return

        setDeleting(true)
        try {
            const response = await fetch('/api/delete-submission', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ submissionId: submissionData._id }),
            })

            const data = await response.json().catch(() => ({} as any))

            if (!response.ok) {
                throw new Error(data?.error || 'Failed to delete submission')
            }

            // If some external asset (Airtable, Cloudflare, R2) failed to delete,
            // show a warning before navigating away — otherwise orphan records are
            // invisible to the admin.
            const failed: Array<{ asset: string; error: string }> = data?.failedAssets || []
            if (failed.length > 0) {
                setShowDeleteModal(false)
                setModalType('error')
                setModalMessage(
                    `Submission record deleted, but ${failed.length} external ${failed.length === 1 ? 'asset' : 'assets'} could not be cleaned up:\n\n` +
                    failed.map((f) => `• ${f.asset}: ${f.error}`).join('\n') +
                    `\n\nThese may need manual cleanup.`
                )
                setShowModal(true)
                return
            }

            // Redirect to admin dashboard after successful deletion
            window.location.href = '/admin'
        } catch (error: any) {
            console.error('Delete submission error:', error)
            setShowDeleteModal(false)
            setModalType('error')
            setModalMessage(error.message || 'Failed to delete submission. Please try again.')
            setShowModal(true)
        } finally {
            setDeleting(false)
        }
    }

    // Handle website generation
    const handleGenerateWebsite = async (customizationsOverride?: any) => {
        // If already generating, skip (unless this is a distinct request, but for now prevent double-click)
        if (generatingWebsite) return

        setGeneratingWebsite(true)
        setWebsiteError(null)

        try {
            const response = await fetch('/api/generate-website', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    submissionId,
                    customizations: customizationsOverride || websiteCustomizations
                }),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to generate website')
            }

            const data = await response.json()
            setWebsitePreviewUrl(data.previewUrl)
            setWebsiteHtmlContent(data.htmlContent)
            setWebsiteContent(data.website?.extracted_content)
            setWebsiteCustomizations(data.website?.customizations)
            setWebsiteGenerated(true)
            setWebsiteCustomizations(data.website?.customizations)
            setWebsiteGenerated(true)
            // Do not refresh() here as it causes the page to remount (loading state) which resets the editor state
        } catch (error: any) {
            console.error('Website generation error:', error)
            setWebsiteError(error.message || 'Failed to generate website')
        } finally {
            setGeneratingWebsite(false)
        }
    }

    useEffect(() => {
        if (existingWebsite) {
            setWebsiteHtmlContent(existingWebsite.htmlContent || '')
            setWebsiteContent(existingWebsite.extractedContent)
            setWebsiteCustomizations(existingWebsite.customizations || {})
            setWebsitePublishedUrl(existingWebsite.publishedUrl || null)
            // Only mark as generated if there's actual HTML content
            if (existingWebsite.htmlContent) {
                setWebsiteGenerated(true)
            }
        }
    }, [existingWebsite])

    // Auto-populate quality checklist
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
                contactInfoComplete: !!(
                    submissionData.ownerPhone &&
                    (submissionData.ownerEmail || submissionData.ownerPhone)
                ),
            })
        }
    }, [submissionData?._id])

    if (authLoading || dataLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
            </div>
        )
    }

    if (!isAdmin || !submission) return null

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between py-4">
                        <div className="flex items-center gap-4">
                            <Link href="/admin">
                                <Button variant="outline" size="sm">
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                    Back
                                </Button>
                            </Link>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">{submission.business_name}</h1>
                                <p className="text-sm text-gray-500">Submission Details</p>
                            </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            {/* WORKFLOW: submitted -> in_review -> approved -> deployed -> pending_payment -> paid */}

                            {/* Step 1: Mark as In Review (for submitted status) */}
                            {submission.status === 'submitted' && (
                                <Button
                                    onClick={() => handleStatusUpdate('in_review')}
                                    disabled={updating}
                                    className="bg-yellow-500 hover:bg-yellow-600 text-white"
                                >
                                    {updating ? 'Updating...' : '📋 Mark as In Review'}
                                </Button>
                            )}

                            {/* Enhance Images via Airtable AI (available for submitted and beyond, but only if transcription is ready) */}
                            {(submission.status === 'submitted' || submission.status === 'in_review' || submission.status === 'website_generated' || submission.status === 'approved' || submission.status === 'deployed') && submission.transcript && (
                                <Button
                                    onClick={handleTriggerEnhancedImages}
                                    disabled={enhancing}
                                    className="bg-amber-500 hover:bg-amber-600 text-white"
                                >
                                    {enhancing ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Enhancing...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            {submissionData?.airtableRecordId ? 'Re-enhance Images' : 'Enhance Images'}
                                        </>
                                    )}
                                </Button>
                            )}

                            {/* Show tooltip if enhance button is hidden due to missing transcription */}
                            {(submission.status === 'submitted' || submission.status === 'in_review' || submission.status === 'website_generated' || submission.status === 'approved' || submission.status === 'deployed') && !submission.transcript && (
                                <div className="text-sm text-gray-500 px-3 py-2 rounded-lg bg-gray-100 flex items-center gap-2">
                                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>Generate transcription first to enable image enhancement</span>
                                </div>
                            )}

                            {/* Step 2: Generate Website (for in_review, website_generated, approved, or deployed status) */}
                            {(submission.status === 'in_review' || submission.status === 'website_generated' || submission.status === 'approved' || submission.status === 'deployed') && (
                                <Button
                                    onClick={() => handleGenerateWebsite()}
                                    disabled={generatingWebsite}
                                    className="bg-purple-600 hover:bg-purple-700 text-white"
                                >
                                    {generatingWebsite ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                            </svg>
                                            {websiteGenerated ? 'Regenerate Website' : 'Generate Website'}
                                        </>
                                    )}
                                </Button>
                            )}

                            {/* Step 3: Approve (for website_generated or in_review status when website exists) */}
                            {(submission.status === 'website_generated' || (submission.status === 'in_review' && websiteGenerated)) && (
                                <Button
                                    onClick={() => handleStatusUpdate('approved')}
                                    disabled={updating}
                                    className="bg-green-500 hover:bg-green-600 text-white"
                                >
                                    {updating ? 'Updating...' : '✓ Approve'}
                                </Button>
                            )}

                            {/* Step 4: Publish/Deploy (for approved, website_generated, deployed, pending_payment, paid) */}
                            {(submission.status === 'approved' || submission.status === 'website_generated' || submission.status === 'deployed' || submission.status === 'pending_payment' || submission.status === 'paid') && websiteGenerated && (
                                <Button
                                    onClick={websitePublishedUrl ? handleRepublishWebsite : handlePublishWebsite}
                                    disabled={publishingWebsite || republishingWebsite}
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                    {(publishingWebsite || republishingWebsite) ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            {websitePublishedUrl ? 'Republishing...' : 'Publishing...'}
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {websitePublishedUrl ? 'Republish Website' : 'Publish Website'}
                                        </>
                                    )}
                                </Button>
                            )}

                            {/* Step 5: Send to Client (for deployed status) */}
                            {submission.status === 'deployed' && (
                                <Button
                                    onClick={handleSendWebsiteEmail}
                                    disabled={sendingEmail}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                                >
                                    {sendingEmail ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                            </svg>
                                            Send to Client
                                        </>
                                    )}
                                </Button>
                            )}

                            {/* Step 6: Mark as Paid + Re-send Email (for pending_payment status) */}
                            {submission.status === 'pending_payment' && (
                                <>
                                    <Button
                                        onClick={async () => {
                                            try {
                                                const res = await fetch('/api/send-website-email', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ submissionId }),
                                                })
                                                if (res.ok) {
                                                    setModalType('success')
                                                    setModalMessage('Payment email re-sent to the business owner.')
                                                    setShowModal(true)
                                                } else {
                                                    const data = await res.json()
                                                    throw new Error(data.error || 'Failed to send email')
                                                }
                                            } catch (err: any) {
                                                setModalType('error')
                                                setModalMessage(err.message || 'Failed to re-send email')
                                                setShowModal(true)
                                            }
                                        }}
                                        variant="outline"
                                        className="border-blue-300 text-blue-600 hover:bg-blue-50"
                                    >
                                        📧 Re-send Payment Email
                                    </Button>
                                    <Button
                                        onClick={() => setShowMarkPaidModal(true)}
                                        disabled={markingPaid}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                    >
                                        {markingPaid ? 'Processing...' : '💰 Mark as Paid'}
                                    </Button>
                                </>
                            )}

                            {/* Unpublished: allow republishing */}
                            {submission.status === 'unpublished' && (
                                <Button
                                    onClick={handlePublishWebsite}
                                    disabled={publishingWebsite}
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                    {publishingWebsite ? 'Republishing...' : '🔄 Republish Website'}
                                </Button>
                            )}

                            {/* Reject button (available until deployed) */}
                            {!['rejected', 'deployed', 'pending_payment', 'paid', 'unpublished'].includes(submission.status) && (
                                <Button
                                    onClick={() => handleStatusUpdate('rejected')}
                                    disabled={updating}
                                    variant="outline"
                                    className="border-red-300 text-red-600 hover:bg-red-50"
                                >
                                    {updating ? 'Updating...' : '✗ Reject'}
                                </Button>
                            )}

                            {/* Trigger Payout Button - Specific for Payout Requests */}
                            {submission.payout_requested_at && (
                                <Button
                                    className="bg-orange-500 hover:bg-orange-600 text-white"
                                >
                                    💸 Trigger Payout
                                </Button>
                            )}

                            {/* Delete Submission (always available for admin) */}
                            <Button
                                onClick={() => setShowDeleteModal(true)}
                                disabled={deleting}
                                variant="outline"
                                className="border-red-500 text-red-600 hover:bg-red-50"
                            >
                                {deleting ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600 mr-2"></div>
                                        Deleting...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        Delete
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Website Preview Section */}
            {(websiteGenerated || generatingWebsite) && (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-gray-900">Website Preview</h2>
                        {websiteGenerated && (
                            <div className="flex space-x-2">
                                <a
                                    href={`/api/preview/${submissionId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center px-4 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 text-sm font-medium"
                                >
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                    Open in New Tab
                                </a>
                                {submission && ['pending_payment', 'paid', 'completed'].includes(submission.status) && (
                                    <a
                                        href={`/admin/submissions/${submissionId}/emails`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center px-4 py-2 border border-indigo-600 text-indigo-600 rounded-md hover:bg-indigo-50 text-sm font-medium"
                                    >
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                        View Email Sent
                                    </a>
                                )}
                                {websitePublishedUrl && (
                                    <>
                                        <a
                                            href={websitePublishedUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
                                        >
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            Visit Published Site
                                        </a>
                                        {/* Save & Publish Edits — pushes latest submission data to the live Cloudflare Worker */}
                                        <button
                                            onClick={handleSaveAndPublishEdits}
                                            disabled={saveAndPublishStep !== 'idle'}
                                            className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {saveAndPublishStep !== 'idle' ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                                    {saveAndPublishStep === 'saving' && 'Saving...'}
                                                    {saveAndPublishStep === 'generating' && 'Regenerating...'}
                                                    {saveAndPublishStep === 'publishing' && 'Publishing...'}
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    Save & Publish Edits
                                                </>
                                            )}
                                        </button>
                                        {/* Unpublish button */}
                                        <button
                                            onClick={handleUnpublishWebsite}
                                            disabled={unpublishingWebsite}
                                            className="inline-flex items-center px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {unpublishingWebsite ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                                    Unpublishing...
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                                    </svg>
                                                    Unpublish
                                                </>
                                            )}
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {websiteError && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                            {websiteError}
                        </div>
                    )}

                    {generatingWebsite ? (
                        <div className="bg-gray-100 rounded-lg p-12 text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                            <h3 className="text-lg font-medium text-gray-900">Generating Website...</h3>
                            <p className="text-gray-500">This usually takes about 30-60 seconds.</p>
                        </div>
                    ) : websiteGenerated ? (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                            {/* Tabs */}
                            <div className="border-b border-gray-200">
                                <nav className="flex -mb-px" aria-label="Tabs">
                                    <button
                                        onClick={() => setActiveTab('preview')}
                                        className={`w-1/3 py-4 px-1 text-center border-b-2 font-medium text-sm ${activeTab === 'preview'
                                            ? 'border-blue-500 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                            }`}
                                    >
                                        Live Preview
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('design')}
                                        className={`w-1/3 py-4 px-1 text-center border-b-2 font-medium text-sm ${activeTab === 'design'
                                            ? 'border-blue-500 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                            }`}
                                    >
                                        Styles
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('content')}
                                        className={`w-1/3 py-4 px-1 text-center border-b-2 font-medium text-sm ${activeTab === 'content'
                                            ? 'border-blue-500 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                            }`}
                                    >
                                        Content
                                    </button>
                                </nav>
                            </div>

                            {activeTab === 'preview' && (
                                <WebsitePreview
                                    htmlContent={websiteHtmlContent || ''}
                                    isRegenerating={generatingWebsite}
                                />
                            )}

                            {activeTab === 'design' && (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-gray-50 p-6 rounded-b-lg border border-t-0 border-gray-200">
                                    <div className="lg:col-span-1 h-[calc(100vh-300px)] lg:sticky lg:top-6">
                                        <ContentEditor
                                            initialCustomizations={websiteCustomizations}
                                            onUpdate={handleUpdateDesign}
                                            disabled={generatingWebsite}
                                        />
                                    </div>
                                    <div className="lg:col-span-2">
                                        <WebsitePreview
                                            htmlContent={websiteHtmlContent || ''}
                                            isRegenerating={generatingWebsite}
                                        />
                                    </div>
                                </div>
                            )}

                            {activeTab === 'content' && (
                                <div className="bg-gray-50 p-6 rounded-b-lg border border-t-0 border-gray-200 min-h-[500px]">
                                    <VisualEditor
                                        initialContent={{
                                            ...(websiteContent || {
                                                business_name: submission?.business_name || '',
                                                tagline: '',
                                                about: '',
                                                services: [],
                                                contact: {}
                                            }),
                                            // Prefer enhanced images over original images for each section
                                            images: (hasEnhancedImages && enhancedImagesByCategory?.categories.hero?.length)
                                                ? enhancedImagesByCategory.categories.hero
                                                : websiteContent?.images || submission?.photos || [],
                                            about_images: (hasEnhancedImages && enhancedImagesByCategory?.categories.about?.length)
                                                ? enhancedImagesByCategory.categories.about
                                                : websiteContent?.about_images,
                                            services_image: (hasEnhancedImages && enhancedImagesByCategory?.categories.services?.length)
                                                ? enhancedImagesByCategory.categories.services[0]
                                                : websiteContent?.services_image,
                                            featured_images: (hasEnhancedImages && enhancedImagesByCategory?.categories.featured?.length)
                                                ? enhancedImagesByCategory.categories.featured
                                                : websiteContent?.featured_images,
                                        }}
                                        htmlContent={websiteHtmlContent || ''}
                                        submissionId={submissionId}
                                        heroStyle={websiteCustomizations?.heroStyle || 'A'}
                                        aboutStyle={websiteCustomizations?.aboutStyle || 'A'}
                                        servicesStyle={websiteCustomizations?.servicesStyle || 'A'}
                                        galleryStyle={websiteCustomizations?.galleryStyle || websiteCustomizations?.featuredStyle || 'A'}
                                        contactStyle={websiteCustomizations?.contactStyle || websiteCustomizations?.footerStyle || 'A'}
                                        availableImages={[
                                            // Include enhanced images first (priority), then original photos
                                            ...(enhancedImagesByCategory?.allUrls?.map(u => resolveEnhancedUrl(u)).filter((url: any): url is string => url !== null) || []),
                                            ...(photoUrls || []),
                                            ...(heroImageUrls?.filter((url: any): url is string => url !== null) || [])
                                        ].filter((url: any, index: number, self: any) => self.indexOf(url) === index)}
                                        originalImages={[
                                            ...(photoUrls || []),
                                            ...(heroImageUrls?.filter((url: any): url is string => url !== null) || [])
                                        ].filter((url: any, index: number, self: any) => self.indexOf(url) === index)}
                                        onSave={async (content: any) => {
                                            const response = await fetch('/api/save-content', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    submissionId,
                                                    content,
                                                    customizations: websiteCustomizations
                                                })
                                            })

                                            if (!response.ok) throw new Error('Failed to save')

                                            const data = await response.json()

                                            // Update the HTML content and website content
                                            if (data.htmlContent) {
                                                setWebsiteHtmlContent(data.htmlContent)
                                            }
                                            setWebsiteContent(content)

                                            // Refresh submission data
                                            await refresh()
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>
            )}

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Business Info */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Business Information */}
                        <div className="bg-white rounded-xl p-6 border border-gray-200">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-gray-900">Business Information</h2>
                                <div className="flex items-center gap-2">
                                    {!isEditing && (
                                        <button
                                            onClick={() => {
                                                const info = [
                                                    `Business Name: ${submission.business_name}`,
                                                    `Business Type: ${submission.business_type}`,
                                                    `Owner Name: ${submission.owner_name}`,
                                                    `Phone: ${submission.owner_phone}`,
                                                    `Email: ${submission.owner_email || 'N/A'}`,
                                                    `City: ${submission.city}`,
                                                    `Address: ${submission.address}`,
                                                ].join('\n')
                                                navigator.clipboard.writeText(info)
                                                    .then(() => {
                                                        const btn = document.getElementById('copy-biz-info')
                                                        if (btn) { btn.textContent = '✓'; setTimeout(() => { btn.textContent = ''; btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>' }, 1500) }
                                                    })
                                            }}
                                            id="copy-biz-info"
                                            title="Copy business info"
                                            className="text-gray-400 hover:text-emerald-600 transition-colors p-1"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                        </button>
                                    )}
                                    {!isEditing && (
                                        <button
                                            onClick={handleEdit}
                                            className="text-gray-400 hover:text-blue-500 transition-colors"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs text-gray-500 uppercase font-medium">Business Name</Label>
                                    {isEditing ? (
                                        <Input
                                            value={editedData.business_name}
                                            onChange={(e) => setEditedData({ ...editedData, business_name: e.target.value })}
                                            className="mt-1"
                                        />
                                    ) : (
                                        <p className="text-gray-900 font-medium mt-1">{submission.business_name}</p>
                                    )}
                                </div>
                                <div>
                                    <Label className="text-xs text-gray-500 uppercase font-medium">Business Type</Label>
                                    {isEditing ? (
                                        <Input
                                            value={editedData.business_type}
                                            onChange={(e) => setEditedData({ ...editedData, business_type: e.target.value })}
                                            className="mt-1"
                                        />
                                    ) : (
                                        <p className="text-gray-900 mt-1">{submission.business_type}</p>
                                    )}
                                </div>
                                <div>
                                    <Label className="text-xs text-gray-500 uppercase font-medium">Owner Name</Label>
                                    {isEditing ? (
                                        <Input
                                            value={editedData.owner_name}
                                            onChange={(e) => setEditedData({ ...editedData, owner_name: e.target.value })}
                                            className="mt-1"
                                        />
                                    ) : (
                                        <p className="text-gray-900 mt-1">{submission.owner_name}</p>
                                    )}
                                </div>
                                <div>
                                    <Label className="text-xs text-gray-500 uppercase font-medium">Owner Phone</Label>
                                    {isEditing ? (
                                        <Input
                                            value={editedData.owner_phone}
                                            onChange={(e) => setEditedData({ ...editedData, owner_phone: e.target.value })}
                                            className="mt-1"
                                        />
                                    ) : (
                                        <p className="text-gray-900 mt-1">{submission.owner_phone}</p>
                                    )}
                                </div>
                                <div>
                                    <Label className="text-xs text-gray-500 uppercase font-medium">Owner Email</Label>
                                    {isEditing ? (
                                        <Input
                                            value={editedData.owner_email}
                                            onChange={(e) => setEditedData({ ...editedData, owner_email: e.target.value })}
                                            placeholder="Optional"
                                            className="mt-1"
                                        />
                                    ) : (
                                        <p className="text-gray-900 mt-1">{submission.owner_email || 'N/A'}</p>
                                    )}
                                </div>
                                <div>
                                    <Label className="text-xs text-gray-500 uppercase font-medium">City</Label>
                                    {isEditing ? (
                                        <Input
                                            value={editedData.city}
                                            onChange={(e) => setEditedData({ ...editedData, city: e.target.value })}
                                            className="mt-1"
                                        />
                                    ) : (
                                        <p className="text-gray-900 mt-1">{submission.city}</p>
                                    )}
                                </div>
                                <div className="col-span-2">
                                    <Label className="text-xs text-gray-500 uppercase font-medium">Address</Label>
                                    {isEditing ? (
                                        <Input
                                            value={editedData.address}
                                            onChange={(e) => setEditedData({ ...editedData, address: e.target.value })}
                                            className="mt-1"
                                        />
                                    ) : (
                                        <p className="text-gray-900 mt-1">{submission.address}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Photos */}
                        <div className="bg-white rounded-xl p-6 border border-gray-200">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-gray-900">
                                    Photos ({isEditing ? editedData.photos.length : (submission.photos?.length || 0)})
                                </h2>
                                <div className="flex items-center gap-4">
                                    {isEditing && editedData.photos.length > 0 && (
                                        <span className="text-xs text-gray-500">Click X to remove</span>
                                    )}
                                    {!isEditing && (
                                        <button
                                            onClick={handleEdit}
                                            className="text-gray-400 hover:text-blue-500 transition-colors"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                {(isEditing ? editedData.photos : (submission.photos || [])).map((url: string, index: number) => {
                                    // Get the resolved URL from photoUrls for display
                                    // photoUrls contains the resolved HTTP URLs from Convex storage
                                    const raw = photoUrls?.[index] || url
                                    const resolvedUrl = raw?.startsWith('http') ? raw : null

                                    if (!resolvedUrl) return null

                                    return (
                                        <div
                                            key={index}
                                            className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden group cursor-pointer"
                                            onClick={() => {
                                                if (!isEditing) {
                                                    setLightboxIndex(index)
                                                    setLightboxOpen(true)
                                                }
                                            }}
                                        >
                                            <Image
                                                src={resolvedUrl}
                                                alt={`Photo ${index + 1}`}
                                                fill
                                                className="object-cover"
                                            />
                                            {isEditing && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        removePhoto(index)
                                                    }}
                                                    className="absolute top-2 right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                                    type="button"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            )}
                                            {!isEditing && (
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                    <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m0 0v6m0-6h6m-6 0H4" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                            {isEditing && editedData.photos.length === 0 && (
                                <p className="text-gray-500 text-center py-8">No photos remaining</p>
                            )}
                        </div>

                        {/* Interview */}
                        <div className="bg-white rounded-xl p-6 border border-gray-200">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-gray-900">Interview</h2>
                                {!isEditing && (
                                    <button
                                        onClick={handleEdit}
                                        className="text-gray-400 hover:text-blue-500 transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                    </button>
                                )}
                            </div>

                            {/* Transcript Section */}
                            {(submission.transcript || isEditing || submission.video_url || submission.audio_url) && (
                                <div className="mb-6">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                                                AI Transcript
                                            </h3>
                                            {!isEditing && (submission.video_url || submission.audio_url) && (
                                                <button
                                                    onClick={handleRetriggerTranscription}
                                                    disabled={transcribing}
                                                    title={submission.transcript ? 'Regenerate transcription' : 'Generate transcription'}
                                                    className="text-gray-400 hover:text-blue-500 transition-colors disabled:opacity-50"
                                                >
                                                    {transcribing ? (
                                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                                                    ) : (
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                        </svg>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                        {!isEditing && submission.transcript && (
                                            <div className="flex items-center gap-2">
                                                {submissionData?.transcriptionUpdatedAt && (
                                                    <span className="text-xs text-gray-400">
                                                        {new Date(submissionData.transcriptionUpdatedAt).toLocaleString()}
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(submission.transcript || '')
                                                            .then(() => {
                                                                const btn = document.getElementById('copy-transcript')
                                                                if (btn) { btn.textContent = '✓ Copied'; setTimeout(() => { btn.textContent = 'Copy' }, 1500) }
                                                            })
                                                    }}
                                                    id="copy-transcript"
                                                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded-full font-medium transition-colors"
                                                >
                                                    Copy
                                                </button>
                                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                                                    Generated
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    {transcribing && (
                                        <div className="bg-gray-50 rounded-xl p-4 space-y-3 animate-pulse">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                                                <span className="text-sm text-blue-600 font-medium">Generating transcription...</span>
                                            </div>
                                            <div className="h-3 bg-gray-200 rounded w-full"></div>
                                            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                                            <div className="h-3 bg-gray-200 rounded w-4/6"></div>
                                            <div className="h-3 bg-gray-200 rounded w-full"></div>
                                            <div className="h-3 bg-gray-200 rounded w-3/6"></div>
                                        </div>
                                    )}
                                    {!transcribing && !submission.transcript && !isEditing && (
                                        <div className="bg-gray-50 rounded-xl p-4 text-center">
                                            <p className="text-sm text-gray-500 mb-2">No transcript generated yet</p>
                                            <button
                                                onClick={handleRetriggerTranscription}
                                                disabled={transcribing}
                                                className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                                            >
                                                Generate Transcription
                                            </button>
                                        </div>
                                    )}
                                    {!transcribing && (isEditing ? (
                                        <textarea
                                            value={editedData.transcript}
                                            onChange={(e) => setEditedData({ ...editedData, transcript: e.target.value })}
                                            className="w-full h-96 p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-700 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="Transcript will appear here after AI processing..."
                                        />
                                    ) : submission.transcript ? (
                                        <div className="bg-gray-50 rounded-xl p-4 max-h-96 overflow-y-auto">
                                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                                                {submission.transcript}
                                            </p>
                                        </div>
                                    ) : null)}
                                </div>
                            )}

                            {/* Save/Cancel Buttons - Only show when editing */}
                            {isEditing && (
                                <div className="flex gap-3 justify-end mt-6 pt-6 border-t border-gray-200 mb-6">
                                    <Button
                                        onClick={handleCancel}
                                        disabled={saving}
                                        variant="outline"
                                        className="px-6"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="bg-green-500 hover:bg-green-600 text-white px-6"
                                    >
                                        {saving ? 'Saving...' : 'Save Changes'}
                                    </Button>
                                </div>
                            )}

                            {/* Media Player */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                                        {submission.transcript ? 'Original Recording' : 'Recording'}
                                    </h3>
                                    {(submission.video_url || submission.audio_url) && (
                                        <a
                                            href={`/api/download-media?url=${encodeURIComponent(submission.video_url || submission.audio_url || '')}&filename=${encodeURIComponent(`${submission.business_name?.replace(/\s+/g, '-') || 'recording'}-interview.mp4`)}`}
                                            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                            Download
                                        </a>
                                    )}
                                </div>
                                {submission.video_url ? (
                                    <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
                                        <video
                                            src={submission.video_url}
                                            controls
                                            className="w-full h-full"
                                        />
                                    </div>
                                ) : submission.audio_url ? (
                                    <div className="p-6 bg-gray-50 rounded-xl">
                                        <audio
                                            src={submission.audio_url}
                                            controls
                                            className="w-full"
                                        />
                                    </div>
                                ) : (
                                    <p className="text-gray-500">No interview uploaded</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Metadata */}
                    <div className="space-y-6">
                        {/* Status */}
                        <div className="bg-white rounded-xl p-6 border border-gray-200">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">Status</h2>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-medium">Current Status</label>
                                    <p className="text-lg font-semibold text-gray-900 capitalize">{submission.status.replace('_', ' ')}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-medium">Creator Payout</label>
                                    <p className="text-2xl font-bold text-green-600">₱{submission.creator_payout || 0}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-medium">Submitted On</label>
                                    <p className="text-gray-900">{new Date(submission.created_at).toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        {/* Quality Checklist */}
                        <div className="bg-white rounded-xl p-6 border border-gray-200">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">Quality Checklist</h2>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${qualityChecklist.hasPhotos ? 'bg-green-100' : 'bg-gray-100'}`}>
                                        {qualityChecklist.hasPhotos && (
                                            <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </div>
                                    <span className={`text-sm ${qualityChecklist.hasPhotos ? 'text-gray-900' : 'text-gray-500'}`}>
                                        Has Photos ({submission.photos?.length || 0})
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${qualityChecklist.hasAudioVideo ? 'bg-green-100' : 'bg-gray-100'}`}>
                                        {qualityChecklist.hasAudioVideo && (
                                            <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </div>
                                    <span className={`text-sm ${qualityChecklist.hasAudioVideo ? 'text-gray-900' : 'text-gray-500'}`}>
                                        Has Audio/Video
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${qualityChecklist.hasTranscript ? 'bg-green-100' : 'bg-gray-100'}`}>
                                        {qualityChecklist.hasTranscript && (
                                            <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </div>
                                    <span className={`text-sm ${qualityChecklist.hasTranscript ? 'text-gray-900' : 'text-gray-500'}`}>
                                        Has Transcript
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${qualityChecklist.businessInfoComplete ? 'bg-green-100' : 'bg-gray-100'}`}>
                                        {qualityChecklist.businessInfoComplete && (
                                            <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </div>
                                    <span className={`text-sm ${qualityChecklist.businessInfoComplete ? 'text-gray-900' : 'text-gray-500'}`}>
                                        Business Info Complete
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${qualityChecklist.contactInfoComplete ? 'bg-green-100' : 'bg-gray-100'}`}>
                                        {qualityChecklist.contactInfoComplete && (
                                            <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </div>
                                    <span className={`text-sm ${qualityChecklist.contactInfoComplete ? 'text-gray-900' : 'text-gray-500'}`}>
                                        Contact Info Complete
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Creator Info */}
                        {creator && (
                            <div className="bg-white rounded-xl p-6 border border-gray-200">
                                <h2 className="text-lg font-bold text-gray-900 mb-4">Creator Info</h2>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-medium">Name</label>
                                        <p className="text-gray-900">{creator.first_name} {creator.last_name}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-medium">Email</label>
                                        <p className="text-gray-900">{creator.email || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-medium">Phone</label>
                                        <p className="text-gray-900">{creator.phone || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Pricing & Custom Domain */}
                        <div className="bg-white rounded-xl p-6 border border-gray-200">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">Pricing & Domain</h2>
                            <div className="space-y-3">
                                {/* Package type */}
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-medium">Package</label>
                                    <div className="flex items-center gap-2 mt-1">
                                        {(submissionData as any)?.requestedDomain ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" /></svg>
                                                Standard + Custom Domain
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
                                                Standard
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Amount */}
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-medium">Business Owner Fee</label>
                                    <p className="text-2xl font-black text-gray-900 mt-1">
                                        ₱{((submissionData as any)?.amount || ((submissionData as any)?.requestedDomain ? 1500 : 1000)).toLocaleString()}
                                    </p>
                                    {(submissionData as any)?.requestedDomain && (
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            Website ₱1,000 + Domain ₱500 included
                                        </p>
                                    )}
                                </div>

                                {/* Custom Domain (if requested) */}
                                {(submissionData as any)?.requestedDomain && (
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-medium">Custom Domain</label>
                                        <div className="mt-1 flex items-center gap-2">
                                            <p className="font-mono font-semibold text-emerald-700 text-sm">
                                                {(submissionData as any).requestedDomain}
                                            </p>
                                            {(submissionData as any)?.domainStatus && (
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                    (submissionData as any).domainStatus === 'live'
                                                        ? 'bg-green-100 text-green-700'
                                                        : (submissionData as any).domainStatus === 'failed'
                                                            ? 'bg-red-100 text-red-700'
                                                            : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                    {(submissionData as any).domainStatus}
                                                </span>
                                            )}
                                        </div>
                                        {(submissionData as any)?.domainStatus === 'live' && (
                                            <a
                                                href={`https://${(submissionData as any).requestedDomain}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium mt-1 inline-flex items-center gap-1"
                                            >
                                                Visit live site
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                            </a>
                                        )}
                                        {(submissionData as any)?.domainFailureReason && (
                                            <p className="text-xs text-red-500 mt-1">{(submissionData as any).domainFailureReason}</p>
                                        )}
                                    </div>
                                )}

                                {/* No domain */}
                                {!(submissionData as any)?.requestedDomain && (
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-medium">Custom Domain</label>
                                        <p className="text-sm text-gray-400 mt-1">Not requested (standard package)</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Status Update Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="text-center">
                            {/* Icon */}
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${modalType === 'success'
                                ? 'bg-green-100'
                                : 'bg-red-100'
                                }`}>
                                {modalType === 'success' ? (
                                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                )}
                            </div>

                            {/* Message */}
                            <h3 className={`text-xl font-bold mb-2 ${modalType === 'success' ? 'text-gray-900' : 'text-red-900'
                                }`}>
                                {modalType === 'success' ? 'Success!' : 'Error'}
                            </h3>
                            <p className="text-gray-600 mb-6">{modalMessage}</p>

                            {/* Close Button */}
                            <button
                                onClick={() => setShowModal(false)}
                                className={`w-full py-3 px-4 rounded-xl font-semibold transition-all ${modalType === 'success'
                                    ? 'bg-green-500 hover:bg-green-600 text-white'
                                    : 'bg-red-500 hover:bg-red-600 text-white'
                                    }`}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Mark as Paid Confirmation Modal */}
            {showMarkPaidModal && submission && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
                        <div className="p-6">
                            <h3 className="text-xl font-bold text-gray-900 mb-2">
                                Confirm Payment Received
                            </h3>
                            <p className="text-gray-600 mb-4">
                                Are you sure you want to mark this submission as paid?
                            </p>

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                <p className="text-sm font-medium text-blue-900 mb-2">This will:</p>
                                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                                    <li>Update submission status to "Paid"</li>
                                    <li>Add ₱{(submission.creator_payout ?? 0).toLocaleString()} to creator's balance</li>
                                    <li>Update creator's total earnings</li>
                                </ul>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-3 mb-4">
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-600">Business:</span>
                                    <span className="font-medium text-gray-900">{submission.business_name}</span>
                                </div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-600">Amount:</span>
                                    <span className="font-medium text-gray-900">₱{(submission.amount ?? 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Creator Payout:</span>
                                    <span className="font-bold text-green-600">₱{(submission.creator_payout ?? 0).toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowMarkPaidModal(false)}
                                    disabled={markingPaid}
                                    className="flex-1 py-3 px-4 rounded-xl font-semibold border border-gray-300 hover:bg-gray-50 transition-all disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleMarkAsPaid}
                                    disabled={markingPaid}
                                    className="flex-1 py-3 px-4 rounded-xl font-semibold bg-blue-500 hover:bg-blue-600 text-white transition-all disabled:opacity-50"
                                >
                                    {markingPaid ? 'Processing...' : 'Confirm Payment'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Rejection Reason Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Reject Submission</h3>
                        <p className="text-gray-600 mb-4">
                            Provide a reason for rejecting this submission (optional).
                        </p>
                        <textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Reason for rejection..."
                            className="w-full h-32 p-3 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowRejectModal(false)
                                    setRejectionReason('')
                                }}
                                disabled={rejecting}
                                className="flex-1 py-3 px-4 rounded-xl font-semibold border border-gray-300 hover:bg-gray-50 transition-all disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRejectWithReason}
                                disabled={rejecting}
                                className="flex-1 py-3 px-4 rounded-xl font-semibold bg-red-500 hover:bg-red-600 text-white transition-all disabled:opacity-50"
                            >
                                {rejecting ? 'Rejecting...' : 'Reject'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && submission && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900">Delete &ldquo;{submission.business_name}&rdquo;</h3>
                        </div>

                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                            <p className="text-sm font-semibold text-red-800 mb-2">This action is permanent and cannot be undone. The following will be deleted:</p>
                            <ul className="text-sm text-red-700 space-y-1">
                                <li className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                                    Business submission record
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                                    Generated website &amp; content
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                                    All media files (images, audio, video) from Cloudflare R2
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                                    Cloudflare Pages deployment (if published)
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                                    Airtable record (if synced)
                                </li>
                            </ul>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-3 mb-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Business</span>
                                <span className="font-medium text-gray-900">{submission.business_name}</span>
                            </div>
                            <div className="flex justify-between text-sm mt-1">
                                <span className="text-gray-500">Status</span>
                                <span className="font-medium text-gray-900">{submission.status}</span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                disabled={deleting}
                                className="flex-1 py-3 px-4 rounded-xl font-semibold border border-gray-300 hover:bg-gray-50 transition-all disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteSubmission}
                                disabled={deleting}
                                className="flex-1 py-3 px-4 rounded-xl font-semibold bg-red-600 hover:bg-red-700 text-white transition-all disabled:opacity-50"
                            >
                                {deleting ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Processing...
                                    </span>
                                ) : 'Delete Permanently'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Photo Lightbox */}
            {lightboxOpen && photoUrls && photoUrls.length > 0 && (
                <PhotoLightbox
                    photos={photoUrls.filter((url): url is string => url !== null && url.startsWith('http'))}
                    initialIndex={lightboxIndex}
                    onClose={() => setLightboxOpen(false)}
                />
            )}
        </div>
    )
}
