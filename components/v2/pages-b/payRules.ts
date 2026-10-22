/**
 * What /v2/pay/[token] says, decided in one pure place so it can be tested.
 *
 * The rule from the brief: never claim the site is already up, unless the sale is a field
 * agent's (their site is published first, so it is live while the owner decides). Then the page
 * says "Your site is live. Pay to keep it live." Every other sale says "See it first. Pay once to
 * publish."
 */

/** submissions.contentSource: "owner_intake" is the web form, "owner_app" the owner's own app; anything else was built in the shop by a field agent. */
export function isFieldAgentSale(submission: { contentSource?: string | null } | null): boolean {
    if (!submission) return false;
    return submission.contentSource !== "owner_intake" && submission.contentSource !== "owner_app";
}

export type PendingCopy = {
    state: string;
    title: string;
    sub: string;
    priceLabel: string;
    preview: string;
    after: string;
};

export function pendingCopy({ agentSale, live }: { agentSale: boolean; live: boolean }): PendingCopy {
    if (agentSale && live) {
        return {
            state: "Live, waiting for payment",
            title: "Your site is live.",
            sub: "Pay to keep it live.",
            priceLabel: "Pay once to keep it live",
            preview: "Live · pay to keep it up",
            after: "Your site stays live.",
        };
    }
    return {
        state: "Ready to publish",
        title: "Your site is ready.",
        sub: "See it first. Then pay once to publish.",
        priceLabel: "Pay once to publish",
        preview: "Preview · not public yet",
        after: "Your site goes live and this page becomes your receipt.",
    };
}
