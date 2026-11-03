"use client"

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs"

import { AuthFrame } from "@/app/auth/_components/AuthFrame"
import { SigningIn } from "@/app/auth/_components/AuthParts"
import type { LoginReturnPath } from "@/app/auth/_components/loginReturnPath"

/**
 * Where Google sends someone back to after "Continue with Google" on /login
 * (board: SignIn, "Signing you in"). Clerk's callback does the work and, as
 * before, sends both a returning account and a brand-new one to /dashboard,
 * which routes each role from there. The callback draws nothing itself; the
 * page around it is the board's.
 */
export default function SSOCallback({ returnTo }: { returnTo: LoginReturnPath }) {
    return (
        <AuthFrame title="Signing you in" sub="This takes a few seconds.">
            <SigningIn line="Google confirmed it is you. Opening Tendso." escape={{ href: returnTo, label: returnTo === "/dashboard" ? "Not moving? Go to Home" : "Open the wiki" }} cancelHref={returnTo === "/dashboard" ? "/login" : `/login?redirect_url=${encodeURIComponent(returnTo)}`} />
            <AuthenticateWithRedirectCallback
                signInForceRedirectUrl={returnTo}
                signUpForceRedirectUrl={returnTo}
            />
        </AuthFrame>
    )
}
