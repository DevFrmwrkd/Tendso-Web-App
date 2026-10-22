"use client";

import { useAction } from "convex/react";
import { ConvexError } from "convex/values";
import { useCallback } from "react";

import { api } from "@/convex/_generated/api";

/**
 * The Xendit checkout (GCash, Maya, card) for /v2/pay/[token]: api.xendit.createCheckout
 * (docs/v2-api-owners.md §6) starts, or reuses, the hosted invoice for this page's pay
 * token, and the browser goes there. Xendit shows every method enabled on the account, so
 * the method tapped only says what the payer meant; it is not sent.
 *
 * The buttons stay "Coming soon" until NEXT_PUBLIC_XENDIT_ENABLED is "true". The backend
 * also answers `{ enabled: false }` until XENDIT_SECRET_KEY and XENDIT_CALLBACK_TOKEN are
 * set on Convex; the page then says so in one line.
 */
export type XenditMethod = "gcash" | "maya" | "card";

export const XENDIT_ENABLED = process.env.NEXT_PUBLIC_XENDIT_ENABLED === "true";

const OFF = "GCash, Maya and card are not switched on yet. Pay with Wise for now.";

/** A sentence to show for a failed start. */
export function xenditErrorMessage(error: unknown): string {
    if (error instanceof ConvexError && typeof error.data === "string") {
        // createCheckout runs as the payer: the owner, their field agent or an admin.
        if (/sign in/i.test(error.data)) return "Sign in with your email to pay with GCash, Maya or card. Or pay with Wise below.";
        return error.data;
    }
    if (error instanceof Error && error.message === OFF) return OFF;
    return "That did not work. Please try again, or pay with Wise.";
}

/** Returns `start(token, method)`: opens Xendit's page, or throws with a sentence to show. */
export function useXenditCheckout(): (token: string, method: XenditMethod) => Promise<void> {
    const createCheckout = useAction(api.xendit.createCheckout);
    return useCallback(
        async (token: string, method: XenditMethod) => {
            void method;
            const back = `${window.location.origin}/v2/pay/${encodeURIComponent(token)}`;
            const result = await createCheckout({ token, successRedirectUrl: back, failureRedirectUrl: back });
            if (!result.enabled) throw new Error(OFF);
            window.location.assign(result.checkoutUrl);
        },
        [createCheckout],
    );
}
