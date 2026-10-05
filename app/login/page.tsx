"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useSignIn, useSignUp, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button, ButtonLink, Field, Input, PasswordInput } from "@/components/r1";
import { AUTH_BODY, AuthFrame, AuthTabs } from "@/app/auth/_components/AuthFrame";
import { AuthAlert, ButtonSpinner, GoogleButton, OrDivider, SigningIn } from "@/app/auth/_components/AuthParts";
import { clerkCode, clerkLongMessage, clerkMessage, emailProblem } from "@/app/auth/_components/authLogic";

/**
 * Sign in (board: SignIn, "Sign in" tab).
 *
 * The Round 1 look over the same Clerk calls as before: a password sign-in
 * through useSignIn, and Google through signIn (or signUp, for an email Clerk
 * has not seen) with the redirect to /auth/sso-callback. Every successful
 * sign-in lands on /dashboard, which sends each role on from there (admin to
 * /admin, a new account to /onboarding, an uncertified creator to its step).
 * This page does not read the redirect_url that proxy.ts adds when it bounces
 * a signed-out visitor here; it never has.
 */
export default function LoginPage() {
    const router = useRouter();
    const { isSignedIn } = useAuth();
    const { signIn, setActive, isLoaded } = useSignIn();
    const { signUp } = useSignUp();

    useEffect(() => {
        if (isSignedIn) {
            router.replace("/dashboard");
        }
    }, [isSignedIn, router]);

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [oauthLoading, setOauthLoading] = useState(false);
    // Clerk's message for a failed call, shown in the box at the top.
    const [error, setError] = useState<string | null>(null);
    // The one failure the board words itself: the password does not match.
    const [wrongPassword, setWrongPassword] = useState(false);
    // The board's own checks, under each field, before Clerk is asked.
    const [emailError, setEmailError] = useState<string>();
    const [passwordError, setPasswordError] = useState<string>();
    // The session is active and the dashboard is loading.
    const [signedIn, setSignedIn] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        // Empty or malformed fields never reach Clerk; the browser's own
        // bubbles used to stop them, the board's inline errors do now.
        const emailIssue = emailProblem(email);
        const passwordIssue = password ? "" : "Enter your password.";
        if (emailIssue || passwordIssue) {
            setEmailError(emailIssue || undefined);
            setPasswordError(passwordIssue || undefined);
            setError(null);
            setWrongPassword(false);
            return;
        }
        if (!isLoaded || !signIn) return;
        setError(null);
        setWrongPassword(false);
        setLoading(true);

        try {
            const result = await signIn.create({
                identifier: email,
                password,
            });

            if (result.status === "complete" && result.createdSessionId) {
                await setActive({ session: result.createdSessionId });
                // The form gives way to "Signing you in" while the full load
                // below runs, so the button cannot be pressed a second time.
                setSignedIn(true);
                // Hard navigation (not router.push): a soft client transition can
                // race Clerk's session propagation, so /dashboard mounts before
                // useUser() reports isSignedIn and its gate bounces back to
                // /login — a silent redirect loop. A full load lands with the
                // session cookie already set, so the gate sees a signed-in user.
                window.location.assign("/dashboard");
                return;
            }

            // Any non-complete status (needs_first_factor, needs_second_factor,
            // etc.) previously fell through silently — no redirect, no error,
            // leaving the user stuck on the page. Surface it instead.
            if (result.status === "needs_second_factor") {
                setError("This account needs a verification code. Please sign in from the app to finish two-factor setup.");
            } else {
                setError("We couldn't complete sign-in. Double-check your email and password, or reset your password.");
            }
        } catch (err) {
            // A wrong password gets the board's sentence and a way to reset it;
            // every other failure (no such account, too many tries…) shows
            // Clerk's own message, as it always has.
            if (clerkCode(err) === "form_password_incorrect") {
                setWrongPassword(true);
            } else {
                setError(clerkMessage(err, "Invalid email or password"));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleOAuth = async () => {
        if (!isLoaded || !signIn || !signUp) return;
        setOauthLoading(true);
        setError(null);
        setWrongPassword(false);
        setEmailError(undefined);
        setPasswordError(undefined);

        try {
            const result = await signIn.create({
                strategy: "oauth_google",
                redirectUrl: window.location.origin + "/auth/sso-callback",
                actionCompleteRedirectUrl: "/dashboard",
            });

            const url = result.firstFactorVerification.externalVerificationRedirectURL;
            if (url) {
                window.location.href = url.toString();
                return;
            }
        } catch (err) {
            try {
                const result = await signUp.create({
                    strategy: "oauth_google",
                    redirectUrl: window.location.origin + "/auth/sso-callback",
                    actionCompleteRedirectUrl: "/dashboard",
                });

                const url = result.verifications?.externalAccount?.externalVerificationRedirectURL;
                if (url) {
                    window.location.href = url.toString();
                    return;
                }
            } catch (signUpErr) {
                setError(clerkLongMessage(signUpErr) || clerkLongMessage(err) || "Google sign-in failed");
            }
        }
        setOauthLoading(false);
    };

    // Signed in here, or already signed in when the page opened: either way
    // the dashboard is on its way, so say so instead of offering the form.
    if (signedIn || isSignedIn) {
        return (
            <AuthFrame title="Signing you in" sub="This takes a few seconds.">
                <SigningIn line="Checking your details. Opening Tendso." escape={{ href: "/dashboard", label: "Not moving? Go to Home" }} />
            </AuthFrame>
        );
    }

    return (
        <AuthFrame title="Sign in to Tendso" sub="Use the email you signed up with." tabs={<AuthTabs current="signin" />}>
            <form onSubmit={handleSubmit} noValidate className={AUTH_BODY}>
                {wrongPassword && (
                    <AuthAlert>
                        That email and password don&apos;t match. Try again, or{" "}
                        <Link href="/forgot-password" className="underline underline-offset-[3px]">
                            reset your password
                        </Link>
                        .
                    </AuthAlert>
                )}
                {error && <AuthAlert>{error}</AuthAlert>}

                <Field label="Email" error={emailError}>
                    <Input
                        type="email"
                        autoComplete="email"
                        placeholder="you@gmail.com"
                        value={email}
                        onChange={(e) => {
                            setEmail(e.target.value);
                            setEmailError(undefined);
                            setWrongPassword(false);
                        }}
                        disabled={loading}
                        required
                    />
                </Field>

                <Field label="Password" error={passwordError}>
                    <PasswordInput
                        autoComplete="current-password"
                        placeholder="Your password"
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value);
                            setPasswordError(undefined);
                            setWrongPassword(false);
                        }}
                        disabled={loading}
                        required
                    />
                </Field>

                <Button type="submit" variant="primary" size="lg" block disabled={loading}>
                    {loading ? (
                        <>
                            <ButtonSpinner />
                            Signing in…
                        </>
                    ) : (
                        "Sign in"
                    )}
                </Button>
                <ButtonLink href="/forgot-password" variant="ghost" className="self-center">
                    Forgot password?
                </ButtonLink>

                <OrDivider />

                <GoogleButton onClick={handleGoogleOAuth} busy={oauthLoading} disabled={oauthLoading || loading} />
            </form>
        </AuthFrame>
    );
}
