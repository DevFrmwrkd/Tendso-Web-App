"use client"

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs"

import { AuthFrame } from "@/app/auth/_components/AuthFrame"
import { SigningIn } from "@/app/auth/_components/AuthParts"
import { loginContinuationHref, loginHrefForReturn, type LoginReturnPath } from "@/app/auth/_components/loginReturnPath"

/**
 * Legacy Google callback links also enter the shared, verified workspace
 * routing after Clerk completes authentication.
 */
export default function SSOCallback({ returnTo }: { returnTo: LoginReturnPath }) {
    const next = loginContinuationHref(returnTo)
    return (
        <AuthFrame title="Signing you in" sub="This takes a few seconds.">
            <SigningIn line="Google confirmed it is you. Opening Tendso." escape={{ href: next, label: "Continue to my account" }} cancelHref={loginHrefForReturn(returnTo)} />
            <AuthenticateWithRedirectCallback
                signInForceRedirectUrl={next}
                signUpForceRedirectUrl={next}
            />
        </AuthFrame>
    )
}
