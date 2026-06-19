"use client";

/**
 * Creator "application not approved" screen — the bounce target when an admin
 * sets rejectedAt. Shows the stored rejectionReason. Minimal by design (the
 * brief scopes resubmission as separate follow-up work); only escape is sign out
 * or contacting support. Auto-routes away if the admin later re-approves/clears.
 *
 * See docs/changes/CREATOR-PENDING-APPROVAL-PAGE.md.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2, XCircle, LogOut } from "lucide-react";

export default function VerificationRejectedPage() {
    const { user, isLoaded, isSignedIn } = useUser();
    const { signOut } = useClerk();
    const router = useRouter();

    const creator = useQuery(
        api.creators.getByClerkId,
        user ? { clerkId: user.id } : "skip",
    );

    useEffect(() => {
        if (isLoaded && !isSignedIn) router.replace("/login");
    }, [isLoaded, isSignedIn, router]);

    // If the admin re-approves or clears the rejection, route them onward.
    useEffect(() => {
        if (creator === undefined || creator === null) return;
        if (creator.role === "admin" || creator.certifiedAt) {
            router.replace("/dashboard");
        } else if (!creator.rejectedAt) {
            // Rejection cleared (admin reset) → back to the normal flow.
            router.replace(creator.quizPassedAt ? "/pending" : "/training");
        }
    }, [creator, router]);

    const rejected = creator && creator.role !== "admin" && creator.rejectedAt;

    if (!isLoaded || !isSignedIn || creator === undefined || !rejected) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "#FBF3E0" }}>
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#E4B05E" }} />
            </div>
        );
    }

    const firstName = creator.firstName?.trim();
    const reason = (creator as { rejectionReason?: string }).rejectionReason;

    return (
        <div
            className="min-h-screen flex flex-col"
            style={{ background: "#FBF3E0", color: "#5C3A0F", fontFamily: "var(--font-onest, sans-serif)" }}
        >
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
                <div className="w-full max-w-md text-center space-y-6">
                    <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center" style={{ background: "#fde2e2" }}>
                        <XCircle className="w-10 h-10" style={{ color: "#dc2626" }} />
                    </div>

                    <div>
                        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-instrument-serif, serif)", color: "#5C3A0F" }}>
                            Application not approved
                        </h1>
                        <p className="mt-3 text-base" style={{ color: "#C89548" }}>
                            {firstName ? `${firstName}, ` : ""}we weren&apos;t able to approve your creator account this time.
                        </p>
                    </div>

                    {reason && (
                        <div className="bg-white rounded-2xl p-5 text-left" style={{ border: "1px solid #F5E4C0" }}>
                            <p className="text-[11px] font-medium tracking-wide uppercase mb-1" style={{ color: "#71717a", fontFamily: "var(--font-mono, monospace)" }}>
                                Reason
                            </p>
                            <p className="text-sm" style={{ color: "#5C3A0F" }}>{reason}</p>
                        </div>
                    )}

                    <div className="flex gap-3 text-left rounded-xl p-3.5" style={{ background: "#FBF3E0", borderLeft: "3px solid #E4B05E" }}>
                        <span style={{ fontSize: 18 }}>✉️</span>
                        <p className="text-xs leading-relaxed" style={{ color: "#C89548" }}>
                            Think this is a mistake? Reach out to the Tendso team and we&apos;ll take another look.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
