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

import { PayPage } from "@/components/v2/pages-b/PayPage";

export default function PaymentPage() {
    return <PayPage />;
}
