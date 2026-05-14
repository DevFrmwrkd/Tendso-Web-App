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
        <div className="min-h-screen flex flex-col items-center justify-center bg-white text-neutral-900 px-6 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-4 shadow-sm">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            </div>
            <p
                style={{ fontFamily: "var(--font-fraunces)" }}
                className="text-xl font-semibold text-neutral-900"
            >
                Redirecting…
            </p>
            <p className="text-sm text-neutral-600 mt-1">Taking you to the password reset page.</p>
        </div>
    );
}
