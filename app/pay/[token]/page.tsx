"use client";

/**
 * Complete payment — the page payment emails link to. A payer can open it
 * without an account, so the
 * route is public (proxy.ts): the token in the path is the credential, and
 * paymentTokens.getByToken takes it and nothing else.
 *
 * The board draws it as a funnel, not inside the owner's frame: the wordmark
 * and one quiet exit to Help, for everyone, signed in or not.
 *
 * Four states, all live through Convex (no polling): pending, paid, expired,
 * not found. Which one shows is decided in ./_components/payState.ts, including
 * a payment an admin matched by hand, which settles the submission but leaves
 * the token pending.
 */

import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";

import { PaymentShell } from "@/components/shells/PaymentShell";
import { api } from "@/convex/_generated/api";
import { useOwnerAuth } from "@/hooks/useOwnerAuth";
import { getPaymentConfig } from "@/lib/payment/config";

import { ExpiredView, NotFoundView, PaidView, PayLoading, PendingView } from "./_components/PayViews";
import { payView } from "./_components/payState";
import { useNow } from "./_components/useNow";

const paymentConfig = getPaymentConfig();

export default function PaymentPage() {
    const params = useParams();
    const token = params.token as string;
    const now = useNow();
    // Only to send a signed-in owner's "See my website" to My website; it
    // gates nothing here.
    const { isOwner } = useOwnerAuth();

    // Fetch payment token
    const paymentToken = useQuery(api.paymentTokens.getByToken, { token });

    // Fetch submission details
    const submission = useQuery(api.paymentTokens.getSubmissionByToken, paymentToken ? { token } : "skip");
    const publication = useQuery(api.paymentTokens.getPublicationByToken, paymentToken ? { token } : "skip");

    const wiseEmail = paymentConfig.wiseEmail || "";

    // Wait for the submission too: its status decides "paid" when an admin
    // matched the transfer by hand, so deciding on the token alone would flash
    // the pay instructions at someone who has already paid.
    const loading = paymentToken === undefined || (paymentToken !== null && (submission === undefined || publication === undefined));

    let content: ReactNode;
    if (loading) {
        content = <PayLoading />;
    } else if (!paymentToken) {
        content = <NotFoundView />;
    } else {
        const props = { token: paymentToken, submission: submission ?? null, now, publishedUrl: publication?.liveUrl ?? null, ownerHome: isOwner };
        const view = payView(paymentToken, submission ?? null, now);
        content =
            view === "paid" ? (
                <PaidView {...props} />
            ) : view === "expired" ? (
                <ExpiredView {...props} />
            ) : view === "notfound" ? (
                <NotFoundView />
            ) : (
                <PendingView {...props} wiseEmail={wiseEmail} />
            );
    }

    return (
        <PaymentShell>{content}</PaymentShell>
    );
}
