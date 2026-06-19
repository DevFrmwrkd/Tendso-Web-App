"use client";

/**
 * Creator "application under review" gate — web equivalent of mobile's
 * /pending-review. A creator who passed the onboarding quiz (quizPassedAt set)
 * but isn't approved yet (certifiedAt unset) lands here. The ONLY escape is
 * sign out; an admin approving/rejecting auto-routes them off this page in
 * real time via the Convex live query (no refresh).
 *
 * See docs/changes/CREATOR-PENDING-APPROVAL-PAGE.md.
 * Routes are flat on web (/pending, /dashboard, /verification-rejected) — the
 * brief's /creator/* prefix does not apply here.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2, Clock, CheckCircle2, LogOut } from "lucide-react";

function timeAgo(ms?: number): string {
    if (!ms) return "";
    const diff = Date.now() - ms;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
    const days = Math.floor(hrs / 24);
    return `${days} day${days > 1 ? "s" : ""} ago`;
}

export default function PendingPage() {
    const { user, isLoaded, isSignedIn } = useUser();
    const { signOut } = useClerk();
    const router = useRouter();

    const creator = useQuery(
        api.creators.getByClerkId,
        user ? { clerkId: user.id } : "skip",
    );

    // Not signed in → login.
    useEffect(() => {
        if (isLoaded && !isSignedIn) router.replace("/login");
    }, [isLoaded, isSignedIn, router]);

    // Live auto-route the moment an admin acts (Convex live query fires ~1s).
    useEffect(() => {
        if (creator === undefined || creator === null) return;
        if (creator.role === "admin" || creator.certifiedAt) {
            router.replace("/dashboard");
        } else if (creator.rejectedAt) {
            router.replace("/verification-rejected");
        } else if (!creator.quizPassedAt) {
            // Hasn't passed the quiz — they don't belong on the pending gate.
            router.replace("/training");
        }
    }, [creator, router]);

    // Spinner while loading or while a redirect condition is resolving.
    const pending =
        creator &&
        creator.role !== "admin" &&
        creator.quizPassedAt &&
        !creator.certifiedAt &&
        !creator.rejectedAt;

    if (!isLoaded || !isSignedIn || creator === undefined || !pending) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "#FBF3E0" }}>
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#E4B05E" }} />
            </div>
        );
    }

    const firstName = creator.firstName?.trim();

    return (
        <div
            className="min-h-screen flex flex-col"
            style={{ background: "#FBF3E0", color: "#5C3A0F", fontFamily: "var(--font-onest, sans-serif)" }}
        >
            {/* Header — sign out is the only action */}
            <header className="flex justify-end p-4">
                <button
                    onClick={() => signOut(() => router.replace("/login"))}
                    className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full hover:bg-white/60 transition-colors"
                    style={{ color: "#C89548" }}
                >
                    <LogOut className="w-4 h-4" />
                    Sign out
                </button>
            </header>

            <main className="flex-1 flex items-center justify-center px-6 pb-12">
                <div className="w-full max-w-md text-center space-y-8">
                    {/* Hero — document-under-review card */}
                    <div className="relative mx-auto" style={{ width: 240, height: 200 }}>
                        <div
                            className="absolute inset-x-0 mx-auto"
                            style={{
                                width: 240, height: 180, borderRadius: 28, background: "#fff",
                                boxShadow: "0 18px 40px rgba(228,176,94,0.18)",
                            }}
                        >
                            {/* pale gold radial accent */}
                            <div
                                className="absolute"
                                style={{ width: 140, height: 140, top: -20, right: -10, borderRadius: "50%", background: "rgba(245,228,192,0.5)" }}
                            />
                            {/* document mock-up */}
                            <div
                                className="absolute"
                                style={{
                                    width: 120, height: 90, top: 38, left: 60, background: "#fff",
                                    border: "2px solid #E4B05E", borderRadius: 12, padding: 12,
                                }}
                            >
                                <div style={{ width: 50, height: 6, background: "#F5E4C0", borderRadius: 3, marginBottom: 10 }} />
                                {[0, 1, 2].map((i) => (
                                    <div key={i} className="flex items-center gap-2" style={{ marginBottom: 6, animation: `pendFade 1.8s ${i * 0.2}s ease-in-out infinite` }}>
                                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: "#E4B05E" }} />
                                        <div style={{ width: 60, height: 4, background: "#a7f3d0", borderRadius: 2 }} />
                                    </div>
                                ))}
                            </div>
                            {/* rotating search glyph */}
                            <div className="absolute" style={{ top: 18, right: 24, animation: "pendWobble 4s ease-in-out infinite" }}>
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C89548" strokeWidth="2">
                                    <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" strokeLinecap="round" />
                                </svg>
                            </div>
                            {/* sparkles */}
                            <span className="absolute" style={{ top: 6, right: 60, fontSize: 14, animation: "pendTwinkle 2.2s ease-in-out infinite" }}>✨</span>
                            <span className="absolute" style={{ top: 30, right: 8, fontSize: 10, animation: "pendTwinkle 2.6s 0.5s ease-in-out infinite" }}>✨</span>
                            <span className="absolute" style={{ top: 0, right: 30, fontSize: 12, animation: "pendTwinkle 3s 1s ease-in-out infinite" }}>✨</span>
                        </div>
                        {/* avatars peeking over the bottom edge */}
                        <div className="absolute flex justify-center gap-3 inset-x-0" style={{ bottom: 0 }}>
                            {["#E4B05E", "#C89548", "#C89548"].map((bg, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-center"
                                    style={{
                                        width: 40, height: 40, borderRadius: "50%", background: bg,
                                        border: "3px solid #fff", boxShadow: "0 6px 14px rgba(228,176,94,0.3)",
                                        animation: `pendBob 2.4s ${i * 0.3}s ease-in-out infinite`,
                                    }}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></svg>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Headline */}
                    <div>
                        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-instrument-serif, serif)", color: "#5C3A0F" }}>
                            We&apos;re reviewing your application
                        </h1>
                        <p className="mt-3 text-base" style={{ color: "#C89548" }}>
                            {firstName ? `Hi ${firstName}, ` : ""}our team is carefully going through your quiz results. You&apos;re almost ready to start interviewing businesses.
                        </p>
                    </div>

                    {/* ETA card */}
                    <div className="bg-white rounded-2xl p-5 flex items-center gap-4 text-left" style={{ border: "1px solid #F5E4C0" }}>
                        <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: "#F5E4C0" }}>
                            <Clock className="w-5 h-5" style={{ color: "#C89548" }} />
                        </div>
                        <div>
                            <p className="text-[11px] font-medium tracking-wide uppercase" style={{ color: "#71717a", fontFamily: "var(--font-mono, monospace)" }}>
                                Estimated review time
                            </p>
                            <p className="text-lg font-bold" style={{ color: "#5C3A0F" }}>Within 24 hours</p>
                        </div>
                    </div>

                    {/* Progress checklist */}
                    <div className="bg-white rounded-2xl p-5 space-y-4 text-left" style={{ border: "1px solid #F5E4C0" }}>
                        <div className="flex items-center gap-3">
                            <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "#E4B05E" }} />
                            <div>
                                <p className="text-sm font-semibold" style={{ color: "#5C3A0F" }}>Quiz passed</p>
                                <p className="text-xs" style={{ color: "#71717a" }}>{timeAgo(creator.quizPassedAt)}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="w-5 h-5 rounded-full shrink-0" style={{ background: "#fbbf24", animation: "pendPulse 1.6s ease-in-out infinite" }} />
                            <div>
                                <p className="text-sm font-semibold" style={{ color: "#5C3A0F" }}>Admin review in progress</p>
                                <p className="text-xs" style={{ color: "#71717a" }}>Our team is verifying your account</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 opacity-50">
                            <span className="w-5 h-5 rounded-full shrink-0" style={{ border: "2px solid #d4d4d8" }} />
                            <div>
                                <p className="text-sm font-semibold" style={{ color: "#5C3A0F" }}>Account activated</p>
                                <p className="text-xs" style={{ color: "#71717a" }}>Start submitting &amp; earning</p>
                            </div>
                        </div>
                    </div>

                    {/* Reassurance footer */}
                    <div className="flex gap-3 text-left rounded-xl p-3.5" style={{ background: "#FBF3E0", borderLeft: "3px solid #E4B05E" }}>
                        <span style={{ fontSize: 18 }}>💌</span>
                        <p className="text-xs leading-relaxed" style={{ color: "#C89548" }}>
                            We&apos;ll email you the moment you&apos;re approved. You can close this tab — we&apos;ll let you know when you&apos;re in.
                        </p>
                    </div>
                </div>
            </main>

            <style>{`
                @keyframes pendFade { 0%,100%{opacity:.4} 50%{opacity:1} }
                @keyframes pendWobble { 0%,100%{transform:rotate(-6deg)} 50%{transform:rotate(6deg)} }
                @keyframes pendTwinkle { 0%,100%{opacity:.2} 50%{opacity:1} }
                @keyframes pendBob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
                @keyframes pendPulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.25);opacity:.6} }
                @media (prefers-reduced-motion: reduce) {
                    [style*="animation"] { animation: none !important; }
                }
            `}</style>
        </div>
    );
}
