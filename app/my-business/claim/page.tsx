"use client";

/**
 * Claim landing — the target of the "Edit my website" email button.
 * URL: /my-business/claim?token=<64hex>
 *
 * Flow: the owner must be signed in (Clerk passwordless, with the email the site
 * was sold to). claimWebsite enforces that the signed-in email matches the
 * submission's ownerEmail server-side — a leaked link is useless otherwise.
 */

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

function ClaimInner() {
    const params = useSearchParams();
    const token = params.get("token") ?? "";
    const router = useRouter();
    const { isLoaded, isSignedIn } = useUser();

    const tokenInfo = useQuery(api.businessOwners.getClaimToken, token ? { token } : "skip");
    const claim = useMutation(api.businessOwners.claimWebsite);

    const [error, setError] = useState<string | null>(null);
    const [claiming, setClaiming] = useState(false);

    // Not signed in → send to login, returning here afterward.
    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            router.replace(`/login?redirect_url=${encodeURIComponent(`/my-business/claim?token=${token}`)}`);
        }
    }, [isLoaded, isSignedIn, router, token]);

    // Auto-redeem once signed in and the token is usable.
    useEffect(() => {
        if (!isSignedIn || !tokenInfo || claiming) return;
        if (!tokenInfo.usable) return;
        setClaiming(true);
        claim({ token })
            .then((res) => router.replace(`/my-business/${res.submissionId}`))
            .catch((e) => {
                setError(e instanceof Error ? e.message : "Could not claim this website.");
                setClaiming(false);
            });
    }, [isSignedIn, tokenInfo, claim, token, router, claiming]);

    if (!token) {
        return <ClaimMessage icon="error" title="Invalid link" body="This claim link is missing its token." />;
    }
    if (!isLoaded || tokenInfo === undefined || (isSignedIn && tokenInfo?.usable && !error)) {
        return <ClaimMessage icon="spinner" title="Claiming your website…" body="One moment." />;
    }
    if (tokenInfo === null || !tokenInfo.usable) {
        return (
            <ClaimMessage
                icon="error"
                title="This link can't be used"
                body="It may have expired or already been used. Open the latest email from Tendso, or ask us to resend your link."
            />
        );
    }
    if (error) {
        return <ClaimMessage icon="error" title="Couldn't claim this website" body={error} />;
    }
    return <ClaimMessage icon="spinner" title="Almost there…" body="Verifying your account." />;
}

function ClaimMessage({ icon, title, body }: { icon: "spinner" | "ok" | "error"; title: string; body: string }) {
    return (
        <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#FBF3E0", color: "#5C3A0F" }}>
            <div className="max-w-md text-center space-y-4">
                {icon === "spinner" && <Loader2 className="w-10 h-10 mx-auto animate-spin" style={{ color: "#E4B05E" }} />}
                {icon === "ok" && <CheckCircle2 className="w-10 h-10 mx-auto" style={{ color: "#E4B05E" }} />}
                {icon === "error" && <AlertCircle className="w-10 h-10 mx-auto" style={{ color: "#dc2626" }} />}
                <h1 className="text-2xl font-bold">{title}</h1>
                <p style={{ color: "#C89548" }}>{body}</p>
            </div>
        </div>
    );
}

export default function ClaimPage() {
    return (
        <Suspense fallback={<ClaimMessage icon="spinner" title="Loading…" body="" />}>
            <ClaimInner />
        </Suspense>
    );
}
