"use client";

import { SignOutButton, useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AUTH_BODY, AuthFrame } from "@/app/auth/_components/AuthFrame";
import { SigningIn } from "@/app/auth/_components/AuthParts";
import { loginContinuationHref, loginHrefForReturn } from "@/app/auth/_components/loginReturnPath";
import { Button } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { signInDestination } from "@/lib/signInDestination";

/** Clerk and Convex must identify the same actor before choosing a private workspace. */
export function SignInContinue({ returnTo }: { returnTo: string }) {
    const router = useRouter();
    const { user, isLoaded, isSignedIn } = useUser();
    const { isLoading, isAuthenticated } = useConvexAuth();
    const ready = isLoaded && isSignedIn && !!user && !isLoading && isAuthenticated;
    const session = useQuery(api.adminAccess.me, ready ? {} : "skip");
    const result = signInDestination({ clerkLoaded: isLoaded, userId: isSignedIn ? user?.id ?? null : null,
        convexLoading: isLoading, convexAuthenticated: isAuthenticated, session, returnTo });
    const loginHref = loginHrefForReturn(returnTo);
    const target = result.status === "ready" ? result.href : result.status === "signed_out" ? loginHref : null;

    useEffect(() => { if (target) router.replace(target); }, [router, target]);

    if (result.status === "blocked") return <AuthFrame title="We couldn’t open your account" sub={result.message}>
        <div className={AUTH_BODY}><p>Need help? Contact <a className="t-link" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
            <SignOutButton redirectUrl="/login"><Button block>Sign out</Button></SignOutButton>
        </div>
    </AuthFrame>;
    return <AuthFrame title="Opening your account" sub="We’ll take you to your Tendso workspace.">
        <SigningIn line="Checking your account." escape={{ href: target ?? loginContinuationHref(returnTo), label: "Continue to my account" }} cancelHref="/" />
    </AuthFrame>;
}
