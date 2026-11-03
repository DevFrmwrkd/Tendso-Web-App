"use client";

import { ErrorState } from "@/components/r1";
import { PaymentShell } from "@/components/shells/PaymentShell";

/**
 * The payment page threw (a Convex query failed). The Kit's error state, as in
 * app/error.tsx, but inside the funnel frame: someone who came from the payment
 * email keeps the wordmark and the way to Help. Reload is a full reload, which
 * is what reconnects a failed query.
 */
export default function PayError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <PaymentShell><div className="mx-auto max-w-[640px] py-8"><ErrorState what="This payment page" reference={error.digest ?? null} /></div></PaymentShell>
    );
}
