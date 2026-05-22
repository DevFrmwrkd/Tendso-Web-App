"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { useQuery, useMutation, useAction } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

export default function UploadPhotosPage() {
    const router = useRouter()
    const { user, isLoaded, isSignedIn } = useUser()

    // Get creator from Convex
    const creator = useQuery(
        api.creators.getByClerkId,
        user ? { clerkId: user.id } : "skip"
    )

    // Mutations and Actions
    const generateR2UploadUrl = useAction(api.r2.generateUploadUrl)
    const updateSubmission = useMutation(api.submissions.update)

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // New files to upload
    const [files, setFiles] = useState<File[]>([])
    const [previews, setPreviews] = useState<string[]>([])

    // Already uploaded photos from DB
    const [existingPhotos, setExistingPhotos] = useState<string[]>([])
    const [resolvedPhotoUrls, setResolvedPhotoUrls] = useState<(string | null)[]>([])

    const [submissionId, setSubmissionId] = useState<string | null>(null)

    // Get submission if we have the ID
    const submission = useQuery(
        api.submissions.getById,
        submissionId ? { id: submissionId as Id<"submissions"> } : "skip"
    )

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

    // Load submission ID from session
    useEffect(() => {
        const id = sessionStorage.getItem('current_submission_id')
        if (!id) {
            router.push('/submit/info')
            return
        }
        setSubmissionId(id)
    }, [router])

    // Load existing photos when submission data is available
    useEffect(() => {
        if (submission && submission.photos) {
            setExistingPhotos(submission.photos)
        }
    }, [submission])

    // Update resolved URLs when photoUrls query returns
    useEffect(() => {
        if (photoUrls) {
            setResolvedPhotoUrls(photoUrls)
        }
    }, [photoUrls])

    // Clean up object URLs when component unmounts
    useEffect(() => {
        return () => {
            previews.forEach(url => URL.revokeObjectURL(url))
        }
    }, [previews])

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files)
            const totalCount = files.length + existingPhotos.length + newFiles.length

            // Validate: Max 10 files total
            if (totalCount > 10) {
                setError("You can only have a maximum of 10 photos total.")
                return
            }

            // Validate: Max 5MB per file
            const oversizedFiles = newFiles.filter(file => file.size > 5 * 1024 * 1024)
            if (oversizedFiles.length > 0) {
                setError("Some files are larger than 5MB. Please upload smaller images.")
                return
            }

            // check duplicate files (simple name check against current batch)
            const uniqueFiles = newFiles.filter(
                (newFile) => !files.some((file) => file.name === newFile.name && file.size === newFile.size)
            );

            // Validate: Must be JPG, JPEG, or PNG only (required by Airtable pipeline)
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
            const invalidFiles = uniqueFiles.filter(file => !allowedTypes.includes(file.type))
            if (invalidFiles.length > 0) {
                const names = invalidFiles.map(f => f.name).join(', ')
                setError(`Only JPG, JPEG, and PNG files are accepted. Invalid: ${names}`)
                return
            }

            if (uniqueFiles.length === 0 && newFiles.length > 0 && files.length > 0) {
                setError("Duplicate files are not allowed.");
                return;
            }

            setError(null)
            setFiles(prev => [...prev, ...uniqueFiles])

            // Create previews
            const newPreviews = uniqueFiles.map(file => URL.createObjectURL(file))
            setPreviews(prev => [...prev, ...newPreviews])
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
        const newResolvedUrls = [...resolvedPhotoUrls]

        newExistingPhotos.splice(index, 1)
        newResolvedUrls.splice(index, 1)

        setExistingPhotos(newExistingPhotos)
        setResolvedPhotoUrls(newResolvedUrls)

        // Update submission in database immediately
        try {
            await updateSubmission({
                id: submissionId as Id<"submissions">,
                photos: newExistingPhotos,
            })
        } catch (err) {
            console.error('Error removing photo:', err)
            // Revert on error
            setExistingPhotos(existingPhotos)
            setResolvedPhotoUrls(resolvedPhotoUrls)
            setError('Failed to remove photo. Please try again.')
        }
    }

    const handleNext = async () => {
        if (!submissionId) return

        const totalPhotos = files.length + existingPhotos.length

        // Validate: Min 3 photos
        if (totalPhotos < 3) {
            setError("Please upload at least 3 photos.")
            return
        }

        setLoading(true)
        setError(null)

        try {
            const uploadedUrls: string[] = []

            // Upload each NEW file to R2 storage
            for (const file of files) {
                // Get presigned upload URL from R2 action
                const { uploadUrl, publicUrl } = await generateR2UploadUrl({
                    fileName: file.name,
                    fileType: file.type,
                    submissionId: submissionId,
                    mediaType: 'photo',
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
                id: submissionId as Id<"submissions">,
                photos: finalPhotoList,
            })

            // Navigate to next step
            router.push('/submit/interview')
        } catch (err: any) {
            console.error('Error uploading photos:', err)
            setError(err.message || 'Failed to upload photos. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    // Loading state
    if (!isLoaded || !isSignedIn || creator === undefined) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ed-paper)" }}>
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--ed-accent)" }} />
            </div>
        )
    }

    const totalCount = files.length + existingPhotos.length

    return (
        <div
            className="editorial min-h-screen flex flex-col"
            style={{ background: "var(--ed-paper)", color: "var(--ed-ink)", fontFamily: "var(--ed-sans)" }}
        >
            {/* Header */}
            <div className="p-4 flex items-center justify-between">
                <button
                    onClick={() => router.back()}
                    className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <span className="text-sm text-gray-500 font-medium">STEP 2 OF 4</span>
            </div>

            {/* Progress Bar */}
            <div className="px-4 mb-6">
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: '50%' }}></div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 px-6 pb-6">
                <div className="max-w-md mx-auto">
                    {/* Title */}
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Upload Photos</h1>
                    <p className="text-sm text-gray-500 mb-8">
                        Upload 3-10 photos of the business (storefront, interior, products, etc.)
                    </p>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-600 font-medium">{error}</p>
                        </div>
                    )}

                    {/* Upload Area */}
                    <div className="space-y-6">
                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-gray-50 transition-colors relative">
                            <input
                                type="file"
                                multiple
                                accept=".jpg,.jpeg,.png"
                                onChange={handleFileSelect}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                disabled={loading || totalCount >= 10}
                            />
                            <div className="space-y-2">
                                <div className="mx-auto w-12 h-12 bg-green-100 text-green-500 rounded-full flex items-center justify-center">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div className="text-gray-600 font-medium">
                                    Click or drag photos here
                                </div>
                                <div className="text-xs text-gray-400">
                                    JPG, JPEG, PNG only — up to 5MB each
                                </div>
                            </div>
                        </div>

                        {/* File Previews */}
                        <div className="grid grid-cols-3 gap-2">
                            {/* Existing Photos (Saved) */}
                            {existingPhotos.map((originalUrl, index) => {
                                const resolvedUrl = resolvedPhotoUrls[index] || originalUrl
                                const isValidUrl = resolvedUrl && !resolvedUrl.startsWith('convex:')

                                return (
                                    <div key={originalUrl} className="relative aspect-square bg-green-50 rounded-lg overflow-hidden group border border-green-200">
                                        {isValidUrl ? (
                                            <img
                                                src={resolvedUrl}
                                                alt={`Saved Photo ${index + 1}`}
                                                className="absolute inset-0 w-full h-full object-cover opacity-90"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                                <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                                            </div>
                                        )}
                                        <button
                                            onClick={() => removeExistingPhoto(index)}
                                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                            title="Remove photo"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                        <div className="absolute bottom-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-xs text-white font-medium bg-green-600/80 px-2 py-0.5 rounded">Saved</span>
                                        </div>
                                    </div>
                                )
                            })}

                            {/* New Photos (Pending) */}
                            {previews.map((url, index) => (
                                <div key={url} className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden group border border-gray-200">
                                    <Image
                                        src={url}
                                        alt={`Preview ${index + 1}`}
                                        fill
                                        className="object-cover"
                                    />
                                    <button
                                        onClick={() => removeFile(index)}
                                        className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Count Info */}
                        <div className="flex justify-between text-sm text-gray-500">
                            <span>{totalCount} of 10 photos total</span>
                            <span className={totalCount < 3 ? "text-amber-500" : "text-green-500"}>
                                {totalCount < 3 ? "Need at least 3" : "Good to go!"}
                            </span>
                        </div>

                        {/* Next Button */}
                        <Button
                            onClick={handleNext}
                            disabled={loading || totalCount < 3}
                            className="w-full h-12 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-colors mt-8"
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <Loader2 className="animate-spin h-5 w-5" />
                                    {files.length > 0 ? `Uploading ${files.length} photos...` : 'Saving...'}
                                </span>
                            ) : (
                                <span className="flex items-center justify-center gap-2">
                                    Next: Upload Interview
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                </span>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
