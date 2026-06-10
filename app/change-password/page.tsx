"use client"

import { useState, useEffect } from "react"
import { useUser } from "@clerk/nextjs"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Eye, EyeOff, Loader2, Check, X } from "lucide-react"

function getPasswordStrength(pw: string): { level: number; label: string; color: string } {
    if (pw.length < 8) return { level: 1, label: "Weak", color: "bg-red-500" }
    const hasUpper = /[A-Z]/.test(pw)
    const hasLower = /[a-z]/.test(pw)
    const hasNumber = /\d/.test(pw)
    const hasSpecial = /[^A-Za-z0-9]/.test(pw)
    const mixedCase = hasUpper && hasLower
    if (mixedCase && hasNumber && hasSpecial) return { level: 4, label: "Strong", color: "bg-amber-500" }
    if ((mixedCase && hasNumber) || (mixedCase && hasSpecial)) return { level: 3, label: "Good", color: "bg-yellow-500" }
    return { level: 2, label: "Fair", color: "bg-orange-500" }
}

export default function ChangePasswordPage() {
    const router = useRouter()
    const { user, isLoaded } = useUser()
    const creator = useQuery(api.creators.getByClerkId, user ? { clerkId: user.id } : "skip")
    const createNotification = useMutation(api.notifications.createForClient)

    const [currentPw, setCurrentPw] = useState("")
    const [newPw, setNewPw] = useState("")
    const [confirmPw, setConfirmPw] = useState("")
    const [showCurrent, setShowCurrent] = useState(false)
    const [showNew, setShowNew] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (isLoaded && !user) router.push("/login")
    }, [isLoaded, user, router])

    const strength = getPasswordStrength(newPw)
    const passwordsMatch = newPw.length > 0 && confirmPw.length > 0 && newPw === confirmPw

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setSuccess(false)

        if (newPw.length < 8) { setError("Password must be at least 8 characters"); return }
        if (newPw === currentPw) { setError("New password must be different from current"); return }
        if (newPw !== confirmPw) { setError("Passwords do not match"); return }

        setLoading(true)
        try {
            await user?.updatePassword({ currentPassword: currentPw, newPassword: newPw })

            if (creator?._id) {
                await createNotification({
                    creatorId: creator._id,
                    type: "password_changed",
                    title: "Password Changed",
                    body: "Your password was updated successfully",
                })
            }

            setSuccess(true)
            setCurrentPw("")
            setNewPw("")
            setConfirmPw("")
        } catch (err: any) {
            setError(err.errors?.[0]?.longMessage || err.message || "Failed to update password")
        } finally {
            setLoading(false)
        }
    }

    if (!isLoaded || creator === undefined) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-white font-sans pb-12">
            <header className="px-4 pt-6 pb-4">
                <div className="flex items-center gap-3">
                    <Link href="/profile" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-zinc-200 text-zinc-600 hover:text-zinc-900 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-xl font-bold text-zinc-900">Change Password</h1>
                </div>
            </header>

            <main className="px-4">
                {success && (
                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-amber-600 text-sm font-medium mb-4 flex items-center gap-2">
                        <Check className="w-4 h-4" /> Password updated successfully
                    </div>
                )}
                {error && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-medium mb-4">{error}</div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Current Password */}
                    <div className="space-y-2">
                        <Label className="text-zinc-700 font-medium">Current Password</Label>
                        <div className="relative">
                            <Input type={showCurrent ? "text" : "password"} value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} required className="h-12 bg-zinc-50 border-zinc-200 rounded-xl pr-12" />
                            <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                                {showCurrent ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {/* New Password */}
                    <div className="space-y-2">
                        <Label className="text-zinc-700 font-medium">New Password</Label>
                        <div className="relative">
                            <Input type={showNew ? "text" : "password"} value={newPw} onChange={(e) => setNewPw(e.target.value)} required className="h-12 bg-zinc-50 border-zinc-200 rounded-xl pr-12" />
                            <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                                {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        {newPw.length > 0 && (
                            <div className="space-y-1">
                                <div className="flex gap-1">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= strength.level ? strength.color : 'bg-zinc-200'}`} />
                                    ))}
                                </div>
                                <p className="text-xs text-zinc-500">{strength.label}</p>
                            </div>
                        )}
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-2">
                        <Label className="text-zinc-700 font-medium">Confirm New Password</Label>
                        <div className="relative">
                            <Input type={showConfirm ? "text" : "password"} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required className="h-12 bg-zinc-50 border-zinc-200 rounded-xl pr-12" />
                            <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                                {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        {confirmPw.length > 0 && (
                            <div className="flex items-center gap-1 text-xs">
                                {passwordsMatch ? (
                                    <><Check className="w-3.5 h-3.5 text-amber-500" /><span className="text-amber-600">Passwords match</span></>
                                ) : (
                                    <><X className="w-3.5 h-3.5 text-red-500" /><span className="text-red-600">Passwords do not match</span></>
                                )}
                            </div>
                        )}
                    </div>

                    <Button type="submit" disabled={loading || !passwordsMatch} className="w-full h-12 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded-xl disabled:opacity-40">
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Update Password"}
                    </Button>
                </form>
            </main>
        </div>
    )
}
