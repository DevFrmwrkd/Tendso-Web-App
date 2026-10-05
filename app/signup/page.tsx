"use client";

import { useSyncExternalStore } from "react";
import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

import { Loading, Skeleton } from "@/components/r1";
import { AUTH_BODY, AuthFrame, AuthTabs } from "@/app/auth/_components/AuthFrame";
import { COMMISSION_RATE } from "@/lib/pricing";

/**
 * Create a creator account (board: SignIn, "Create account" tab).
 *
 * The form itself is still Clerk's <SignUp>, with the props it always had:
 * hash routing, /onboarding after sign-up (where the creator record is made in
 * Convex), /login as the way to sign in. Clerk keeps owning what the board
 * does not draw: the email code, its own password rules, bot protection and
 * the Google hand-off. Its look is the Round 1 one, set for every Clerk screen
 * in components/providers/ConvexClerkProvider.tsx; the appearance below only
 * seats it inside the board's card.
 *
 * Two things the board shows that Clerk words its own way: the button says
 * "Continue", and the password hint is Clerk's rather than the four-bar meter.
 */

/**
 * The earnings line, from lib/pricing. No peso figure on purpose: what a
 * creator's half comes to depends on the price they sell at, and a number
 * here would read as a promise (the same rule /for-creators follows).
 */
const SUB = `For creators who visit shops and turn them into websites. You keep ${Math.round(COMMISSION_RATE * 100)}% of every sale.`;

/*
 * Which step Clerk's form is on. With routing="hash" it keeps its own route
 * after the "#" (#/verify-email-address for the email code, #/sso-callback on
 * the way back from Google), so the page can give each step the board's
 * heading. Only the first step has the tabs and the lines under the form. A
 * step this page does not recognise (#/continue, or a name Clerk changes one
 * day) keeps the first heading without them; the form itself is unaffected.
 */
type Step = "start" | "verify" | "finishing" | "more";

function subscribeToHash(onChange: () => void) {
    window.addEventListener("hashchange", onChange);
    window.addEventListener("popstate", onChange);
    return () => {
        window.removeEventListener("hashchange", onChange);
        window.removeEventListener("popstate", onChange);
    };
}

function useSignUpStep(): Step {
    const hash = useSyncExternalStore(subscribeToHash, () => window.location.hash, () => "");
    const path = hash.replace(/^#\/?/, "").split("?")[0];
    if (!path) return "start";
    // "includes": the code step can also sit under #/continue/verify-…
    if (path.includes("verify")) return "verify";
    if (path.startsWith("sso-callback")) return "finishing";
    return "more";
}

const HEADINGS: Record<Step, { title: string; sub: string }> = {
    start: { title: "Create a creator account", sub: SUB },
    // Clerk may send a code or a link, so the line names neither.
    verify: { title: "Check your email", sub: "We sent you an email to confirm the address." },
    // Back from Google. "5-question": the quiz in app/certification-quiz has five.
    finishing: { title: "Setting up your account", sub: "Next comes a short training and a 5-question quiz." },
    more: { title: "Create a creator account", sub: SUB },
};

/** The shape of Clerk's form while it loads: two names, email, password, the button, Google. */
function FormSkeleton() {
    const field = (label: string) => (
        <div className="flex flex-col gap-1.5">
            <Skeleton width={label} height={12} />
            <Skeleton height={40} />
        </div>
    );
    return (
        <Loading label="Loading the sign-up form">
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                    {field("60%")}
                    {field("60%")}
                </div>
                {field("25%")}
                {field("35%")}
                <Skeleton height={48} />
                <Skeleton height={48} />
            </div>
        </Loading>
    );
}

export default function SignupPage() {
    const step = useSignUpStep();
    const { title, sub } = HEADINGS[step];
    const start = step === "start";

    return (
        <AuthFrame
            title={title}
            sub={sub}
            tabs={start ? <AuthTabs current="create" /> : undefined}
            foot={
                start ? (
                    <p className="t-meta">
                        Own a business? You don&apos;t need an account.{" "}
                        <Link href="/start" className="t-link">
                            Get a website
                        </Link>
                    </p>
                ) : undefined
            }
        >
            <div className={AUTH_BODY}>
                <SignUp
                    appearance={{
                        // No logo (the header has it) and no second card or
                        // heading (the page has them): Clerk's form sits in the
                        // board's card as its body. Only the title and subtitle
                        // are hidden, as before, not Clerk's whole header: on the
                        // email-code step it can carry the address and its edit
                        // button, the way back to fix a mistyped email.
                        layout: { logoPlacement: "none" },
                        elements: {
                            rootBox: { width: "100%" },
                            cardBox: { width: "100%", maxWidth: "none", border: "none", borderRadius: "0", boxShadow: "none" },
                            card: { width: "100%", padding: "0", gap: "16px", border: "none", borderRadius: "0", boxShadow: "none", backgroundColor: "transparent" },
                            headerTitle: { display: "none" },
                            headerSubtitle: { display: "none" },
                            main: { gap: "16px" },
                            form: { gap: "16px" },
                            // The board draws Google's G in ink, like the button on /login.
                            socialButtonsProviderIcon__google: { filter: "grayscale(1) brightness(0)" },
                            // Hide TikTok specifically — keep Google + others
                            socialButtonsBlockButton__tiktok: { display: "none" },
                            socialButtonsIconButton__tiktok: { display: "none" },
                            socialButtonsProviderIcon__tiktok: { display: "none" },
                        },
                    }}
                    routing="hash"
                    forceRedirectUrl="/onboarding"
                    signInUrl="/login"
                    fallback={<FormSkeleton />}
                />
                {start && (
                    <p className="t-meta text-center">
                        By creating an account you agree to the{" "}
                        <Link href="/terms-of-service" className="t-link">
                            Terms
                        </Link>{" "}
                        and{" "}
                        <Link href="/privacy-policy" className="t-link">
                            Privacy Policy
                        </Link>
                        .
                    </p>
                )}
            </div>
        </AuthFrame>
    );
}
