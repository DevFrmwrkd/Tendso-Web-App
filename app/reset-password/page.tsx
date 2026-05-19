"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// Legacy redirect — password reset is now handled in /forgot-password
export default function ResetPasswordPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/forgot-password");
    }, [router]);

    return (
        <div
            className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
            style={{ background: "var(--khaki)", color: "var(--ink)" }}
        >
            <div className="w-14 h-14 rounded-full bg-[var(--khaki-deep)] border border-[var(--rust)]/30 flex items-center justify-center mb-4 shadow-sm">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--rust)]" />
            </div>
            <p
                style={{ fontFamily: "var(--font-playfair)" }}
                className="text-xl font-bold text-[var(--ink)]"
            >
                Redirecting…
            </p>
            <p
                className="text-sm text-[var(--ink)]/65 mt-1 italic"
                style={{ fontFamily: "var(--font-playfair)" }}
            >
                Taking you to the password reset page.
            </p>
        </div>
    );
}
