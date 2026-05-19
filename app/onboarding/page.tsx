"use client"

import { useState, useEffect } from "react"
import { useUser } from "@clerk/nextjs"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import Logo from "@/public/logo.png"
import { motion } from "framer-motion"
import { Phone, Loader2, User, ArrowRight } from "lucide-react"
import { Bricolage_Grotesque, Outfit } from 'next/font/google';

const bricolage = Bricolage_Grotesque({ subsets: ['latin'], weight: ['400', '600', '800'] });
const outfit = Outfit({ subsets: ['latin'], weight: ['300', '400', '600'] });

function generateReferralCode(firstName: string, lastName: string): string {
    const namePrefix = (firstName.substring(0, 2) + lastName.substring(0, 1)).toUpperCase()
    const random = Math.random().toString(36).substring(2, 8).toUpperCase()
    return `${namePrefix}${random}`
}

export default function OnboardingPage() {
    const router = useRouter()
    const { user, isLoaded, isSignedIn } = useUser()
    const createCreator = useMutation(api.creators.create)
    const existingCreator = useQuery(
        api.creators.getByClerkId,
        user ? { clerkId: user.id } : "skip"
    )

    const [firstName, setFirstName] = useState("")
    const [middleName, setMiddleName] = useState("")
    const [lastName, setLastName] = useState("")
    const [phone, setPhone] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [initialized, setInitialized] = useState(false)

    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            router.push("/login")
        }
    }, [isLoaded, isSignedIn, router])

    useEffect(() => {
        if (isLoaded && isSignedIn && existingCreator) {
            router.push("/dashboard")
        }
    }, [isLoaded, isSignedIn, existingCreator, router])

    useEffect(() => {
        if (isLoaded && user && !initialized) {
            if (user.firstName) setFirstName(user.firstName)
            if (user.lastName) setLastName(user.lastName)
            setInitialized(true)
        }
    }, [isLoaded, user, initialized])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (!user) {
            setError("Authentication module detached")
            return
        }

        if (!firstName.trim() || !lastName.trim()) {
            setError("Primary identity fields required")
            return
        }

        const phoneRegex = /^(\+63|0)?9\d{9}$/
        if (phone && !phoneRegex.test(phone.replace(/\s/g, ''))) {
            setError("Invalid local communication format")
            return
        }

        setLoading(true)

        try {
            const referralCode = generateReferralCode(firstName, lastName)

            await createCreator({
                clerkId: user.id,
                firstName: firstName.trim(),
                middleName: middleName.trim() || undefined,
                lastName: lastName.trim(),
                email: user.primaryEmailAddress?.emailAddress,
                phone: phone.trim() || undefined,
                referralCode,
            })

            router.push("/training")
        } catch (err: any) {
            console.error("Failed to create profile:", err)
            setError(err.message || "Failed to initialize identity")
        } finally {
            setLoading(false)
        }
    }

    // Suppress the form UI while ANY of the following is true:
    //   - Clerk is still hydrating (isLoaded === false)
    //   - User is not signed in (about to redirect to /login)
    //   - Convex query for the creator profile is still in flight (existingCreator === undefined)
    //   - A creator profile already exists (about to redirect to /dashboard)
    //
    // Without this guard, returning users coming through Google OAuth see the
    // onboarding form for ~200ms before the dashboard-redirect useEffect fires,
    // which is the "flash of old onboarding page" we're fixing.
    const isRedirecting =
        !isLoaded ||
        !isSignedIn ||
        existingCreator === undefined ||
        existingCreator !== null

    if (isRedirecting) {
        return (
            <div
                className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
                style={{ background: "var(--khaki)", color: "var(--ink)" }}
            >
                <div
                    className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-multiply"
                    style={{
                        backgroundImage:
                            "radial-gradient(circle at 25% 25%, var(--ink) 0.5px, transparent 1px), radial-gradient(circle at 75% 75%, var(--ink) 0.5px, transparent 1px)",
                        backgroundSize: "4px 4px, 6px 6px",
                    }}
                />
                <div className="absolute -top-32 -right-20 w-[480px] h-[480px] bg-[var(--rust)]/8 rounded-full filter blur-[120px] pointer-events-none" />
                <Loader2 className="h-10 w-10 animate-spin text-[var(--rust)] relative z-10" />
            </div>
        )
    }

    return (
        <div className={`min-h-screen w-full flex bg-black text-white selection:bg-[#00FF66] selection:text-black overflow-x-hidden relative ${outfit.className}`}>
            {/* BACKGROUND EFFECTS */}
            <div className="fixed inset-0 z-0 pointer-events-none opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
            <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-[#00F0FF] rounded-full mix-blend-screen filter blur-[200px] opacity-20 animate-pulse pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[40%] h-[60%] bg-[#00FF66] rounded-full mix-blend-screen filter blur-[250px] opacity-10 pointer-events-none" />

            <div className="relative z-10 w-full flex flex-col items-center justify-center p-6 min-h-screen py-20">
                
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full max-w-md"
                >
                    <div className="flex flex-col items-center mb-10">
                        <div className="w-20 h-20 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(29,0,255,0.4)] mb-6 border border-white/10 bg-black/50 p-1 flex items-center justify-center backdrop-blur-md relative">
                            <Image src={Logo} alt="Logo" width={64} height={64} className="rounded-2xl" />
                        </div>
                        <h1 className={`text-4xl md:text-5xl font-black uppercase tracking-tighter text-center mb-3 ${bricolage.className}`}>
                            Initialize <span className="text-[#00F0FF]">Agent</span>
                        </h1>
                        <p className="text-white/50 text-center font-light text-lg">
                            Provide your primary identity data to access the creator network.
                        </p>
                    </div>

                    <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-8 rounded-[2rem] shadow-2xl relative overflow-hidden flex flex-col items-center">
                        <div className="absolute top-0 inset-x-0 h-px w-full bg-gradient-to-r from-transparent via-[#00F0FF] to-transparent opacity-50" />
                        <div className="w-full relative z-10">

                            {error && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="mb-8 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium text-center shadow-[0_0_20px_rgba(239,68,68,0.2)]"
                                >
                                    {error}
                                </motion.div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-white/60 pl-2">First Name</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <User className="w-4 h-4 text-white/30 group-focus-within:text-[#00F0FF] transition-colors" />
                                            </div>
                                            <input
                                                id="firstName"
                                                type="text"
                                                placeholder="Juan"
                                                value={firstName}
                                                onChange={(e) => setFirstName(e.target.value)}
                                                required
                                                disabled={loading}
                                                className="w-full h-14 pl-10 pr-4 bg-black/40 border border-white/10 rounded-2xl text-white placeholder:text-white/20 focus:outline-none focus:border-[#00F0FF]/50 focus:ring-1 focus:ring-[#00F0FF]/50 transition-all font-light"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-white/60 pl-2 flex justify-between">Middle <span className="text-white/30">Opt</span></label>
                                        <input
                                            id="middleName"
                                            type="text"
                                            placeholder="Santos"
                                            value={middleName}
                                            onChange={(e) => setMiddleName(e.target.value)}
                                            disabled={loading}
                                            className="w-full h-14 px-4 bg-black/40 border border-white/10 rounded-2xl text-white placeholder:text-white/20 focus:outline-none focus:border-[#00F0FF]/50 focus:ring-1 focus:ring-[#00F0FF]/50 transition-all font-light"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-white/60 pl-2">Last Name</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <User className="w-5 h-5 text-white/30 group-focus-within:text-[#00F0FF] transition-colors" />
                                        </div>
                                        <input
                                            id="lastName"
                                            type="text"
                                            placeholder="Dela Cruz"
                                            value={lastName}
                                            onChange={(e) => setLastName(e.target.value)}
                                            required
                                            disabled={loading}
                                            className="w-full h-14 pl-12 pr-4 bg-black/40 border border-white/10 rounded-2xl text-white placeholder:text-white/20 focus:outline-none focus:border-[#00F0FF]/50 focus:ring-1 focus:ring-[#00F0FF]/50 transition-all font-light"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between pl-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-white/60">Communication ID</label>
                                        <span className="text-xs font-bold text-white/30 uppercase tracking-widest">Optional</span>
                                    </div>
                                    <div className="relative flex gap-3">
                                        <div className="flex items-center gap-2 px-4 h-14 bg-black/60 border border-white/10 rounded-2xl shrink-0">
                                            <span className="text-sm font-bold text-white/80 tracking-widest">+63</span>
                                        </div>
                                        <div className="relative flex-1 group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <Phone className="w-5 h-5 text-white/30 group-focus-within:text-[#00F0FF] transition-colors" />
                                            </div>
                                            <input
                                                id="phone"
                                                type="tel"
                                                inputMode="numeric"
                                                maxLength={10}
                                                placeholder="912 345 4567"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                                                disabled={loading}
                                                className="w-full h-14 pl-12 pr-4 bg-black/40 border border-white/10 rounded-2xl text-white placeholder:text-white/20 focus:outline-none focus:border-[#00F0FF]/50 focus:ring-1 focus:ring-[#00F0FF]/50 transition-all font-light"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`w-full h-14 bg-[#1D00FF] hover:bg-[#2B10FF] disabled:opacity-50 text-white rounded-2xl font-bold uppercase tracking-widest text-sm transition-all shadow-[0_0_20px_rgba(29,0,255,0.3)] hover:shadow-[0_0_30px_rgba(29,0,255,0.5)] active:scale-[0.98] mt-4 flex items-center justify-center gap-3 ${bricolage.className}`}
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="animate-spin h-5 w-5" /> GENERATING KEY...
                                        </>
                                    ) : (
                                        <>
                                            Establish Profile <ArrowRight className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
