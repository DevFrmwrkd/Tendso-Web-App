"use client"

import { useState, useEffect } from "react"
import { useUser } from "@clerk/nextjs"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import Logo from "@/public/tendso-logo.png"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2, CheckCircle, XCircle, Trophy, RotateCcw, Award } from "lucide-react"

const QUIZ_QUESTIONS = [
    {
        category: "Lighting", color: "bg-yellow-100 text-yellow-700",
        question: "What is the best position for your light source when filming?",
        options: ["Behind the subject", "In front of/facing the subject", "Directly above", "It doesn't matter"],
        correctIndex: 1,
    },
    {
        category: "Audio", color: "bg-blue-100 text-blue-700",
        question: "What should you do before starting an interview recording?",
        options: ["Jump right in to save time", "Test your microphone first", "Play background music", "Use the speakerphone"],
        correctIndex: 1,
    },
    {
        category: "Portrait", color: "bg-teal-100 text-teal-700",
        question: "How should you frame the business owner in a portrait shot?",
        options: ["Full body from far away", "Just their face close-up", "Chest up at eye level", "From below looking up"],
        correctIndex: 2,
    },
    {
        category: "Interview", color: "bg-purple-100 text-purple-700",
        question: "What makes a great opening interview question?",
        options: ["Ask about their revenue", "Ask about their origin story", "Ask yes/no questions only", "Read from a script word-for-word"],
        correctIndex: 1,
    },
    {
        category: "Requirements", color: "bg-pink-100 text-pink-700",
        question: "Which 3 photo types are required for every submission?",
        options: [
            "Selfie, food photo, sunset",
            "Portrait of owner, business location, craft/product",
            "Logo, menu, parking lot",
            "Any 3 random photos",
        ],
        correctIndex: 1,
    },
]

const LETTERS = ["A", "B", "C", "D"]

function CertificateCard({ name, date }: { name: string; date: string }) {
    return (
        <div className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-zinc-100">
            {/* Green top banner */}
            <div className="bg-amber-500 py-4 px-6 text-center">
                <div className="flex justify-center">
                    <Image src={Logo} alt="Tendso" width={130} height={23} />
                </div>
            </div>

            {/* Certificate body */}
            <div className="px-6 py-8 text-center space-y-5">
                {/* Badge icon */}
                <div className="flex justify-center">
                    <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center">
                        <Award className="w-7 h-7 text-amber-500" />
                    </div>
                </div>

                {/* Title */}
                <div>
                    <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-[0.2em] mb-1">Certificate of Completion</p>
                    <h2 className="text-xl font-bold text-zinc-900">Certified Creator</h2>
                </div>

                {/* Divider */}
                <div className="flex justify-center">
                    <div className="w-12 h-0.5 bg-amber-400 rounded-full" />
                </div>

                {/* Name */}
                <div>
                    <p className="text-xs text-zinc-400 mb-2">This certifies that</p>
                    <div className="inline-block bg-zinc-800 text-white px-6 py-2.5 rounded-lg">
                        <p className="font-bold text-sm tracking-wide uppercase">{name}</p>
                    </div>
                </div>

                {/* Description */}
                <p className="text-xs text-zinc-500 leading-relaxed max-w-[260px] mx-auto">
                    has demonstrated proficiency in <span className="font-semibold text-zinc-700">Local Business Digitization</span> and is authorized to provide verified digital services to MSMEs in the Philippines.
                </p>

                {/* Date */}
                <div className="pt-2">
                    <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-[0.15em]">Date Issued</p>
                    <p className="text-sm font-bold text-zinc-900">{date}</p>
                </div>
            </div>

            {/* Green bottom banner */}
            <div className="bg-amber-500 py-3 text-center">
                <p className="text-white text-xs font-bold">You can now start earning!</p>
            </div>
        </div>
    )
}

export default function CertificationQuizPage() {
    const router = useRouter()
    const { user, isLoaded } = useUser()
    const creator = useQuery(api.creators.getByClerkId, user ? { clerkId: user.id } : "skip")
    const certify = useMutation(api.creators.certify)

    const [currentQ, setCurrentQ] = useState(0)
    const [selected, setSelected] = useState<number | null>(null)
    const [answered, setAnswered] = useState(false)
    const [answers, setAnswers] = useState<number[]>([])
    const [phase, setPhase] = useState<"quiz" | "pass" | "fail">("quiz")
    const [certifying, setCertifying] = useState(false)
    const [passAnimated, setPassAnimated] = useState(false)

    useEffect(() => {
        if (isLoaded && !user) router.push("/login")
    }, [isLoaded, user, router])

    // Redirect admins to admin dashboard — they don't need certification
    useEffect(() => {
        if (creator && creator.role === 'admin') router.push("/admin")
    }, [creator, router])

    if (!isLoaded || creator === undefined) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ed-paper)" }}>
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--ed-accent)" }} />
            </div>
        )
    }

    const q = QUIZ_QUESTIONS[currentQ]
    const finalScore = answers.filter((a, i) => a === QUIZ_QUESTIONS[i].correctIndex).length

    const handleSelect = (index: number) => {
        if (answered) return
        setSelected(index)
    }

    const handleConfirm = () => {
        if (selected === null) return
        setAnswered(true)
    }

    const handleNext = async () => {
        const newAnswers = [...answers, selected!]
        setAnswers(newAnswers)

        if (currentQ < QUIZ_QUESTIONS.length - 1) {
            setCurrentQ(currentQ + 1)
            setSelected(null)
            setAnswered(false)
        } else {
            const score = newAnswers.filter((a, i) => a === QUIZ_QUESTIONS[i].correctIndex).length
            if (score >= 4) {
                setCertifying(true)
                try {
                    if (creator?._id) await certify({ id: creator._id })
                } catch (e) {
                    console.error("Certification failed:", e)
                }
                setCertifying(false)
                setPhase("pass")
                setTimeout(() => setPassAnimated(true), 50)
            } else {
                setPhase("fail")
            }
        }
    }

    // Get formatted date for certificate
    const certDate = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    const creatorName = creator ? `${creator.firstName || ''} ${creator.lastName || ''}`.trim() : 'Creator'

    // ==================== PASS SCREEN ====================
    if (phase === "pass") {
        return (
            <div
                className="editorial min-h-screen py-8 px-4 overflow-y-auto"
                style={{ background: "var(--ed-paper)", color: "var(--ed-ink)", fontFamily: "var(--ed-sans)" }}
            >
                {/* Success header */}
                <div
                    className={`text-center mb-8 transition-all duration-700 ease-out ${passAnimated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
                >
                    <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Trophy className="w-8 h-8 text-amber-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-zinc-900 mb-1">Congratulations!</h1>
                    <p className="text-zinc-500 text-sm">You passed with a score of <span className="font-bold text-amber-600">{finalScore}/5</span></p>
                </div>

                {/* Certificate */}
                <div
                    className={`mb-8 transition-all duration-700 ease-out ${passAnimated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                    style={{ transitionDelay: '300ms' }}
                >
                    <CertificateCard name={creatorName} date={certDate} />
                </div>

                {/* Action button */}
                <div
                    className={`max-w-sm mx-auto transition-all duration-500 ease-out ${passAnimated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
                    style={{ transitionDelay: '600ms' }}
                >
                    <Button
                        onClick={() => router.push("/dashboard")}
                        className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/20"
                    >
                        Go to Dashboard
                    </Button>
                </div>
            </div>
        )
    }

    // ==================== FAIL SCREEN ====================
    if (phase === "fail") {
        return (
            <div
                className="editorial min-h-screen flex flex-col items-center justify-center px-4 text-center"
                style={{ background: "var(--ed-paper)", color: "var(--ed-ink)", fontFamily: "var(--ed-sans)" }}
            >
                <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center mb-6">
                    <RotateCcw className="w-10 h-10 text-zinc-400" />
                </div>
                <h1 className="text-2xl font-bold text-zinc-900 mb-2">Not quite there yet!</h1>
                <p className="text-zinc-500 mb-2">Review the training lessons and try again.</p>
                <p className="text-3xl font-bold text-red-500 mb-8">{finalScore}/5</p>
                <Button
                    onClick={() => router.push("/training-lessons")}
                    className="w-full max-w-xs h-12 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded-xl"
                >
                    Review Lessons
                </Button>
            </div>
        )
    }

    // ==================== QUIZ SCREEN ====================
    return (
        <div
            className="editorial min-h-screen pb-12"
            style={{ background: "var(--ed-paper)", color: "var(--ed-ink)", fontFamily: "var(--ed-sans)" }}
        >
            <header className="px-4 pt-6 pb-4">
                <div className="flex items-center gap-3 mb-4">
                    <Link href="/training-lessons" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-zinc-200 text-zinc-600 hover:text-zinc-900 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex-1">
                        <p className="text-xs font-medium text-zinc-500">Question {currentQ + 1} of {QUIZ_QUESTIONS.length}</p>
                    </div>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-zinc-100 rounded-full h-2">
                    <div
                        className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${((currentQ + 1) / QUIZ_QUESTIONS.length) * 100}%` }}
                    />
                </div>
            </header>

            <main className="px-4">
                <div className="mb-3">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${q.color}`}>
                        {q.category}
                    </span>
                </div>

                <h2 className="text-lg font-bold text-zinc-900 mb-6">{q.question}</h2>

                <div className="space-y-3 mb-8">
                    {q.options.map((opt, i) => {
                        let style = "bg-white border-zinc-200 hover:border-zinc-300"
                        if (answered) {
                            if (i === q.correctIndex) style = "bg-amber-50 border-amber-300"
                            else if (i === selected && i !== q.correctIndex) style = "bg-red-50 border-red-300"
                        } else if (i === selected) {
                            style = "bg-amber-50 border-amber-400 ring-1 ring-amber-400"
                        }

                        return (
                            <button
                                key={i}
                                onClick={() => handleSelect(i)}
                                disabled={answered}
                                className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${style}`}
                            >
                                <span className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-bold text-zinc-600 shrink-0">
                                    {LETTERS[i]}
                                </span>
                                <span className="text-sm text-zinc-800">{opt}</span>
                                {answered && i === q.correctIndex && <CheckCircle className="w-5 h-5 text-amber-500 ml-auto shrink-0" />}
                                {answered && i === selected && i !== q.correctIndex && <XCircle className="w-5 h-5 text-red-500 ml-auto shrink-0" />}
                            </button>
                        )
                    })}
                </div>

                {!answered ? (
                    <Button
                        onClick={handleConfirm}
                        disabled={selected === null}
                        className="w-full h-12 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded-xl disabled:opacity-40"
                    >
                        Confirm Answer
                    </Button>
                ) : (
                    <Button
                        onClick={handleNext}
                        disabled={certifying}
                        className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl"
                    >
                        {certifying ? <Loader2 className="h-5 w-5 animate-spin" /> : currentQ < QUIZ_QUESTIONS.length - 1 ? "Next Question" : "See Results"}
                    </Button>
                )}
            </main>
        </div>
    )
}
