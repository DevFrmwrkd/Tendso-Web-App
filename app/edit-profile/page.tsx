"use client"

import { useState, useEffect, useRef } from "react"
import { useUser } from "@clerk/nextjs"
import { useQuery, useMutation, useAction } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Camera, Loader2, Check } from "lucide-react"

export default function EditProfilePage() {
    const router = useRouter()
    const { user, isLoaded } = useUser()
    const creator = useQuery(api.creators.getByClerkId, user ? { clerkId: user.id } : "skip")
    const updateCreator = useMutation(api.creators.update)
    const generateUploadUrl = useAction(api.r2.generateUploadUrl)
    const fileRef = useRef<HTMLInputElement>(null)

    const [firstName, setFirstName] = useState("")
    const [lastName, setLastName] = useState("")
    const [phone, setPhone] = useState("")
    const [profileImage, setProfileImage] = useState<string | undefined>()
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (creator) {
            setFirstName(creator.firstName || "")
            setLastName(creator.lastName || "")
            setPhone(creator.phone || "")
            setProfileImage(creator.profileImage)
        }
    }, [creator])

    useEffect(() => {
        if (isLoaded && !user) router.push("/login")
    }, [isLoaded, user, router])

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith("image/")) {
            setError("Please select an image file")
            return
        }
        if (file.size > 5 * 1024 * 1024) {
            setError("Image must be less than 5MB")
            return
        }

        setUploading(true)
        setError(null)
        try {
            // Get presigned URL from R2 via Convex
            const { uploadUrl, publicUrl } = await generateUploadUrl({
                fileName: file.name,
                fileType: file.type,
                submissionId: `profile-${creator?._id || "unknown"}`,
                mediaType: "photo",
            })

            // Upload directly to R2
            const uploadRes = await fetch(uploadUrl, {
                method: "PUT",
                body: file,
                headers: { "Content-Type": file.type },
            })

            if (!uploadRes.ok) throw new Error("Upload failed")
            setProfileImage(publicUrl)
        } catch {
            setError("Failed to upload image")
        } finally {
            setUploading(false)
        }
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!creator) return
        setError(null)
        setSuccess(false)
        setLoading(true)

        try {
            await updateCreator({
                id: creator._id,
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                phone: phone.trim() || undefined,
                profileImage,
            })
            setSuccess(true)
            setTimeout(() => setSuccess(false), 3000)
        } catch (err: any) {
            setError(err.message || "Failed to update profile")
        } finally {
            setLoading(false)
        }
    }

    if (!isLoaded || creator === undefined) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ed-paper)" }}>
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--ed-accent)" }} />
            </div>
        )
    }

    const initials = `${(creator?.firstName || "")[0] || ""}${(creator?.lastName || "")[0] || ""}`.toUpperCase()

    return (
        <div
            className="editorial min-h-screen pb-12"
            style={{ background: "var(--ed-paper)", color: "var(--ed-ink)", fontFamily: "var(--ed-sans)" }}
        >
            <header className="px-4 pt-6 pb-4">
                <div className="flex items-center gap-3">
                    <Link href="/profile" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-zinc-200 text-zinc-600 hover:text-zinc-900 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-xl font-bold text-zinc-900">Edit Profile</h1>
                </div>
            </header>

            <main className="px-4">
                {/* Avatar */}
                <div className="flex justify-center mb-8">
                    <div className="relative">
                        <div className="w-24 h-24 rounded-full bg-zinc-100 border-2 border-zinc-200 flex items-center justify-center overflow-hidden">
                            {profileImage ? (
                                <img src={profileImage} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-2xl font-bold text-zinc-400">{initials}</span>
                            )}
                        </div>
                        <button
                            onClick={() => fileRef.current?.click()}
                            disabled={uploading}
                            className="absolute bottom-0 right-0 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-white shadow-lg"
                        >
                            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                        </button>
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                    </div>
                </div>

                {success && (
                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-amber-600 text-sm font-medium mb-4 flex items-center gap-2">
                        <Check className="w-4 h-4" /> Profile updated successfully
                    </div>
                )}
                {error && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-medium mb-4">{error}</div>
                )}

                <form onSubmit={handleSave} className="space-y-5">
                    <div className="space-y-2">
                        <Label className="text-zinc-700 font-medium">First Name</Label>
                        <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="h-12 bg-zinc-50 border-zinc-200 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-zinc-700 font-medium">Last Name</Label>
                        <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required className="h-12 bg-zinc-50 border-zinc-200 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-zinc-700 font-medium">Phone Number</Label>
                        <Input
                            type="tel"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            autoComplete="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                            placeholder="09123456789"
                            className="h-12 bg-zinc-50 border-zinc-200 rounded-xl"
                        />
                    </div>
                    <Button type="submit" disabled={loading} className="w-full h-12 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded-xl">
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save Changes"}
                    </Button>
                </form>
            </main>
        </div>
    )
}
