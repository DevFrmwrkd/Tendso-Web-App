"use client";

import { SignIn, useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AUTH_BODY, AuthFrame } from "@/app/auth/_components/AuthFrame";
import { SigningIn } from "@/app/auth/_components/AuthParts";
import { AUTH_CLERK_APPEARANCE } from "@/app/auth/_components/authAppearance";
import { loginContinuationHref, type LoginReturnPath } from "@/app/auth/_components/loginReturnPath";
import styles from "@/app/auth/_components/AuthFrame.module.css";

/** One sign-in supports the methods already configured on each existing account. */
export default function LoginForm({ returnTo }: { returnTo: LoginReturnPath }) {
    const router = useRouter();
    const { isLoaded, isSignedIn } = useAuth();
    const next = loginContinuationHref(returnTo);

    useEffect(() => {
        if (isLoaded && isSignedIn) router.replace(next);
    }, [isLoaded, isSignedIn, next, router]);

    if (!isLoaded || isSignedIn) return <AuthFrame title="Opening your account" sub="We’ll take you to your Tendso workspace.">
        <SigningIn line="Checking your sign-in." escape={{ href: next, label: "Continue to my account" }} />
    </AuthFrame>;

    return <AuthFrame title="Sign in to Tendso" sub="Use the email connected to your Tendso account."
        foot={<p className={styles.accountSwitch}>New to Tendso? <Link href="/">Get started</Link></p>}>
        <div className={AUTH_BODY}>
            <SignIn appearance={AUTH_CLERK_APPEARANCE} routing="hash" forceRedirectUrl={next} signUpUrl="/signup"
                fallback={<div className={styles.loading} role="status">Loading sign-in…</div>} />
        </div>
    </AuthFrame>;
}
