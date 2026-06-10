"use client"

import { useState } from "react"
import { useAction, useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useAdminAuth } from "@/hooks/useAdmin"
import AdminLayout from "../components/AdminLayout"

export default function AppReleasePage() {
    const { isAdmin, loading: authLoading, creator } = useAdminAuth()
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [downloading, setDownloading] = useState(false)

    const generateApkUploadUrl = useAction(api.r2.generateApkUploadUrl)
    const setSetting = useMutation(api.settings.set)
    const deleteR2File = useAction(api.r2.deleteFile)

    const apkUrl = useQuery(api.settings.get, { key: "apk_download_url" }) as string | null
    const apkFileName = useQuery(api.settings.get, { key: "apk_file_name" }) as string | null
    const apkUploadedAt = useQuery(api.settings.get, { key: "apk_uploaded_at" }) as string | null
    const apkR2Key = useQuery(api.settings.get, { key: "apk_r2_key" }) as string | null

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.name.endsWith(".apk")) {
            setError("Please select a valid APK file")
            return
        }

        // 200MB limit
        if (file.size > 200 * 1024 * 1024) {
            setError("File size must be under 200MB")
            return
        }

        setUploading(true)
        setError(null)
        setSuccess(null)

        try {
            // Delete old APK from R2 if exists
            if (apkR2Key) {
                try {
                    await deleteR2File({ key: apkR2Key })
                } catch {
                    // Ignore deletion errors for old file
                }
            }

            // Get presigned upload URL
            const { uploadUrl, publicUrl, key } = await generateApkUploadUrl({
                fileName: file.name,
                fileType: file.type || "application/vnd.android.package-archive",
            })

            // Upload to R2
            const uploadRes = await fetch(uploadUrl, {
                method: "PUT",
                body: file,
                headers: {
                    "Content-Type": file.type || "application/vnd.android.package-archive",
                },
            })

            if (!uploadRes.ok) {
                throw new Error("Failed to upload file to storage")
            }

            // Save settings
            const adminId = creator?._id ? String(creator._id) : undefined
            await setSetting({ key: "apk_download_url", value: publicUrl, description: "APK download URL", adminId })
            await setSetting({ key: "apk_file_name", value: file.name, description: "APK file name", adminId })
            await setSetting({ key: "apk_uploaded_at", value: new Date().toISOString(), description: "APK upload timestamp", adminId })
            await setSetting({ key: "apk_r2_key", value: key, description: "APK R2 storage key", adminId })

            setSuccess(`Successfully uploaded ${file.name}`)
        } catch (err: any) {
            setError(err.message || "Failed to upload APK")
        } finally {
            setUploading(false)
            // Reset file input
            e.target.value = ""
        }
    }

    const handleDownload = async () => {
        if (!apkUrl || downloading) return
        setDownloading(true)
        try {
            const res = await fetch(apkUrl)
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = "Tendso.apk"
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
        } catch {
            window.open(apkUrl, "_blank")
        } finally {
            setDownloading(false)
        }
    }

    const handleRemove = async () => {
        setDeleting(true)
        setError(null)
        setSuccess(null)

        try {
            if (apkR2Key) {
                await deleteR2File({ key: apkR2Key })
            }

            const adminId = creator?._id ? String(creator._id) : undefined
            await setSetting({ key: "apk_download_url", value: null, adminId })
            await setSetting({ key: "apk_file_name", value: null, adminId })
            await setSetting({ key: "apk_uploaded_at", value: null, adminId })
            await setSetting({ key: "apk_r2_key", value: null, adminId })

            setSuccess("APK removed successfully")
        } catch (err: any) {
            setError(err.message || "Failed to remove APK")
        } finally {
            setDeleting(false)
            setShowDeleteModal(false)
        }
    }

    if (authLoading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
                </div>
            </AdminLayout>
        )
    }

    if (!isAdmin) {
        return (
            <AdminLayout>
                <div className="text-center py-20 text-gray-500">Access denied</div>
            </AdminLayout>
        )
    }

    return (
        <AdminLayout>
            <div className="max-w-2xl">

                
                <h1 className="text-2xl font-bold text-gray-900 mb-1">App Release</h1>
                <p className="text-sm text-gray-500 mb-8">
                    Upload an APK file that users can download from the &quot;Install App&quot; button on the landing page.
                </p>

                {/* Current APK Status */}
                <div className="bg-white rounded-2xl border border-amber-500 shadow-sm p-6 mb-6">
                    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Current Release</h2>

                    {apkUrl ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-lg border border-amber-100">
                                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-amber-800 truncate">{apkFileName}</p>
                                    {apkUploadedAt && (
                                        <p className="text-xs text-amber-600">
                                            Uploaded {new Date(apkUploadedAt).toLocaleDateString("en-US", {
                                                year: "numeric", month: "short", day: "numeric",
                                                hour: "2-digit", minute: "2-digit",
                                            })}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={handleDownload}
                                    disabled={downloading}
                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    {downloading ? "Downloading..." : "Download"}
                                </button>
                                <button
                                    onClick={() => setShowDeleteModal(true)}
                                    disabled={uploading}
                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Remove
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <p className="text-sm text-gray-500">No APK uploaded yet. Upload one below.</p>
                        </div>
                    )}
                </div>

                {/* Upload Section */}
                <div className="bg-white rounded-2xl border border-amber-500 shadow-sm p-6">
                    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                        {apkUrl ? "Replace APK" : "Upload APK"}
                    </h2>

                    <label
                        className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                            uploading
                                ? "border-gray-200 bg-gray-50 cursor-not-allowed"
                                : "border-gray-300 hover:border-amber-400 hover:bg-amber-50/50"
                        }`}
                    >
                        {uploading ? (
                            <div className="flex flex-col items-center gap-2">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
                                <p className="text-sm text-gray-500">Uploading...</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2">
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                <p className="text-sm text-gray-500">
                                    <span className="font-semibold text-amber-600">Click to upload</span> or drag and drop
                                </p>
                                <p className="text-xs text-gray-400">APK files only, max 200MB</p>
                            </div>
                        )}
                        <input
                            type="file"
                            accept=".apk"
                            onChange={handleUpload}
                            disabled={uploading}
                            className="hidden"
                        />
                    </label>

                    {error && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-lg text-sm text-amber-600">
                            {success}
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">Remove APK Release</h3>
                        </div>
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                            <p className="text-sm font-semibold text-red-800 mb-2">This action will:</p>
                            <ul className="text-sm text-red-700 space-y-1">
                                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>Delete the APK file from storage</li>
                                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>Disable the &quot;Install App&quot; button on the landing page</li>
                            </ul>
                        </div>
                        {apkFileName && (
                            <p className="text-sm text-gray-500 mb-4">
                                File: <span className="font-medium text-gray-700">{apkFileName}</span>
                            </p>
                        )}
                        <div className="flex gap-3">
                            <button onClick={() => setShowDeleteModal(false)} disabled={deleting} className="flex-1 py-2.5 px-4 rounded-xl font-semibold border border-gray-300 hover:bg-gray-50 transition-all disabled:opacity-50 text-sm">Cancel</button>
                            <button onClick={handleRemove} disabled={deleting} className="flex-1 py-2.5 px-4 rounded-xl font-semibold bg-red-600 hover:bg-red-700 text-white transition-all disabled:opacity-50 text-sm">
                                {deleting ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Removing...
                                    </span>
                                ) : "Remove Permanently"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    )
}
