"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ArrowRight, Sun, Mic, User, MessageSquare, Camera, ChevronDown } from "lucide-react"

const LESSONS = [
    {
        icon: Sun,
        color: "bg-yellow-50 text-yellow-500 border-yellow-200",
        title: "Lighting",
        tips: [
            "Position the subject facing the light source — never shoot with the light behind them",
            "Avoid backlighting from windows or bright backgrounds that create silhouettes",
            "The golden hour (early morning or late afternoon) provides the most flattering natural light",
        ],
        action: "Before filming, check where the main light source is and position your subject facing it.",
    },
    {
        icon: Mic,
        color: "bg-blue-50 text-blue-500 border-blue-200",
        title: "Audio",
        tips: [
            "Always test your microphone before starting the actual recording",
            "Minimize background noise — turn off fans, music, and move away from busy streets",
            "Keep your phone close to the subject (within arm's length) for clear audio capture",
        ],
        action: "Do a 10-second test recording and play it back before the real interview.",
    },
    {
        icon: User,
        color: "bg-teal-50 text-teal-500 border-teal-200",
        title: "Portrait",
        tips: [
            "Frame the shot from chest up — not too close, not too far",
            "Hold the camera at the subject's eye level for a natural, professional look",
            "Make sure nothing obstructs the subject's face — no hats covering eyes, no objects in front",
        ],
        action: "Ask the subject to stand in a well-lit area and frame them from chest up at eye level.",
    },
    {
        icon: MessageSquare,
        color: "bg-purple-50 text-purple-500 border-purple-200",
        title: "Interview",
        tips: [
            "Warm up with casual conversation before recording — help the subject feel comfortable",
            "Start with their origin story: \"How did you start this business?\" — this gets the best responses",
            "Speak slowly and clearly, and give the subject time to answer without rushing",
        ],
        action: "Start every interview by asking about how the business began — it's the most engaging story.",
    },
    {
        icon: Camera,
        color: "bg-pink-50 text-pink-500 border-pink-200",
        title: "Requirements",
        tips: [
            "Portrait of the owner — a clear, well-lit photo of the business owner (chest up, at eye level)",
            "Business location/exterior — shows the storefront, signage, or the area where the business operates",
            "Craft or product shot — their signature product, a dish they serve, or the service in action",
        ],
        action: "Every submission needs at least these 3 photo types. Check your photos before submitting.",
    },
]

export default function TrainingLessonsPage() {
    const router = useRouter()
    const [openIndex, setOpenIndex] = useState(0)

    return (
        <div
            className="editorial min-h-screen pb-12"
            style={{ background: "var(--ed-paper)", color: "var(--ed-ink)", fontFamily: "var(--ed-sans)" }}
        >
            <header className="px-4 pt-6 pb-4">
                <div className="flex items-center gap-3 mb-4">
                    <Link href="/training" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-zinc-200 text-zinc-600 hover:text-zinc-900 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-xl font-bold text-zinc-900">Creator Training</h1>
                </div>
                <p className="text-sm text-zinc-500">Complete all 5 lessons, then take the quiz.</p>
            </header>

            <main className="px-4 space-y-3">
                {LESSONS.map((lesson, i) => {
                    const isOpen = openIndex === i
                    return (
                        <div key={i} className={`rounded-xl border overflow-hidden shadow-sm ${isOpen ? lesson.color.split(' ')[2] || 'border-zinc-100' : 'border-zinc-100'}`}>
                            <button
                                onClick={() => setOpenIndex(isOpen ? -1 : i)}
                                className={`w-full flex items-center justify-between p-4 text-left transition-colors ${isOpen ? lesson.color.split(' ')[0] : 'bg-white hover:bg-zinc-50'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${lesson.color.split(' ').slice(0, 2).join(' ')}`}>
                                        <lesson.icon className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <span className="font-bold text-sm text-zinc-900">Lesson {i + 1}: {lesson.title}</span>
                                    </div>
                                </div>
                                <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                            </button>
                            <div className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                <div className="px-4 pb-4 space-y-3 bg-white">
                                    <ul className="space-y-2">
                                        {lesson.tips.map((tip, j) => (
                                            <li key={j} className="flex gap-2 text-sm text-zinc-600">
                                                <span className="text-amber-500 font-bold shrink-0">•</span>
                                                {tip}
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-100">
                                        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Action Tip</p>
                                        <p className="text-sm text-zinc-700">{lesson.action}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}

                <div className="pt-4">
                    <Button
                        onClick={() => router.push("/certification-quiz")}
                        className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/20"
                    >
                        Start Certification Quiz
                        <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                </div>
            </main>
        </div>
    )
}
