"use client"

import { useUser } from "@clerk/nextjs"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Sun, Mic, User, MessageSquare, Camera, Loader2, ArrowRight } from "lucide-react"

const TIPS = [
    { icon: Sun, color: "text-yellow-500 bg-yellow-50", label: "Lighting", desc: "Face the light source" },
    { icon: Mic, color: "text-blue-500 bg-blue-50", label: "Audio", desc: "Test your mic first" },
    { icon: User, color: "text-teal-500 bg-teal-50", label: "Portrait", desc: "Chest up, eye level" },
    { icon: MessageSquare, color: "text-purple-500 bg-purple-50", label: "Interview", desc: "Let them tell their story" },
    { icon: Camera, color: "text-pink-500 bg-pink-50", label: "Requirements", desc: "3 required photo types" },
]

export default function TrainingPage() {
    const router = useRouter()
    const { user, isLoaded } = useUser()
    const creator = useQuery(api.creators.getByClerkId, user ? { clerkId: user.id } : "skip")
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        if (isLoaded && !user) router.push("/login")
    }, [isLoaded, user, router])

    useEffect(() => {
        if (creator && (creator.certifiedAt || creator.role === 'admin')) router.push("/dashboard")
    }, [creator, router])

    // Trigger fade-up animations after mount
    useEffect(() => {
        const timer = setTimeout(() => setMounted(true), 50)
        return () => clearTimeout(timer)
    }, [])

    if (!isLoaded || creator === undefined) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ed-paper)" }}>
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--ed-accent)" }} />
            </div>
        )
    }

    return (
        <div
            className="editorial min-h-screen pb-12"
            style={{ background: "var(--ed-paper)", color: "var(--ed-ink)", fontFamily: "var(--ed-sans)" }}
        >
            <header className="px-4 pt-6 pb-2">
                <Link href="/dashboard" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-zinc-200 text-zinc-600 hover:text-zinc-900 transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
            </header>

            <main className="px-4">
                {/* Hero */}
                <div
                    className={`text-center py-8 transition-all duration-700 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
                >
                    <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Camera className="w-10 h-10 text-emerald-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-zinc-900 mb-2">Become a Certified Creator</h1>
                    <p className="text-sm text-zinc-500 max-w-xs mx-auto">
                        Learn the essentials of capturing great business content before you start submitting.
                    </p>
                </div>

                {/* Tips - staggered fade up */}
                <div className="space-y-3 mb-8">
                    {TIPS.map((tip, i) => (
                        <div
                            key={tip.label}
                            className={`flex items-center gap-4 p-4 bg-white rounded-xl border border-zinc-100 shadow-sm transition-all duration-500 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
                            style={{ transitionDelay: `${300 + i * 100}ms` }}
                        >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tip.color}`}>
                                <tip.icon className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm text-zinc-900">{tip.label}</h3>
                                <p className="text-xs text-zinc-500">{tip.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div
                    className={`transition-all duration-500 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
                    style={{ transitionDelay: '800ms' }}
                >
                    <Button
                        onClick={() => router.push("/training-lessons")}
                        className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/20"
                    >
                        Start Training
                        <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                </div>
            </main>
        </div>
    )
}
