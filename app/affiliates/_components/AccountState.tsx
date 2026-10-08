"use client";

import { useClerk } from "@clerk/nextjs";
import { useState } from "react";

import { AUTH_BODY, AuthFrame } from "@/app/auth/_components/AuthFrame";
import { AuthAlert } from "@/app/auth/_components/AuthParts";
import { Button, ButtonLink, Loading, Skeleton } from "@/components/r1";

export function AffiliateAccountLoading() {
    return (
        <AuthFrame title="Your affiliate account">
            <Loading label="Loading your account" className={AUTH_BODY}>
                <Skeleton height={40} />
                <Skeleton height={40} />
                <Skeleton height={40} />
            </Loading>
        </AuthFrame>
    );
}

export function DifferentAccount({ role }: { role?: string }) {
    const { signOut } = useClerk();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string>();

    async function useDifferentEmail() {
        if (busy) return;
        setBusy(true);
        setError(undefined);
        try {
            await signOut({ redirectUrl: "/affiliates/join" });
        } catch {
            setError("We could not sign you out. Please try again.");
            setBusy(false);
        }
    }

    return (
        <AuthFrame title="Use a different email" sub="Each login has one account type.">
            <div className={AUTH_BODY}>
                <p className="t-body">This email already has a {role === "owner" ? "business owner" : role === "admin" || role === "staff" ? "team" : "creator"} account. Create your affiliate account with a different email.</p>
                {error && <AuthAlert>{error}</AuthAlert>}
                <Button variant="primary" size="lg" block onClick={useDifferentEmail} disabled={busy} aria-busy={busy}>
                    {busy ? "Signing out…" : "Use a different email"}
                </Button>
                <ButtonLink variant="ghost" href={role === "owner" ? "/my-business" : "/dashboard"} block>Back to my account</ButtonLink>
            </div>
        </AuthFrame>
    );
}
