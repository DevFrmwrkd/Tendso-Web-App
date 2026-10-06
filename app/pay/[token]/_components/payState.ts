import { SUPPORT_EMAIL } from "@/lib/contact";
import { creatorDiscount, domainAddOnFor, isComped, type CreatorDiscount } from "@/lib/pricing";

/*
 * What the payment page shows, worked out from the token and its submission.
 * Pure (no React), so every rule sits in one place.
 */

export type PayView = "pending" | "paid" | "expired" | "notfound";

/**
 * Submission statuses that mean the website is paid for: the Wise webhook's
 * match and an admin's Mark as paid both end in payments.creditCreatorForPayment
 * ("completed"); submissions.markPaid writes "paid".
 */
const SETTLED = new Set(["paid", "completed"]);

export function payView(
    token: { status: string; expiresAt: number } | null,
    submission: { status: string; pricingMode?: string | null } | null,
    now: number,
): PayView {
    if (!token) return "notfound";
    if (token.status === "paid") return "paid";
    // Only the Wise webhook marks the TOKEN paid. A transfer matched by hand
    // (this page's own fallback when the code is missing) goes through
    // admin.markPaid, which settles the submission and never touches the
    // token, so without this the page would keep asking someone who has paid
    // to pay. A promo (comped) site is settled with no payment, so it is not
    // "paid" and keeps the token's own state, as it did before.
    if (submission && SETTLED.has(submission.status) && !isComped(submission)) return "paid";
    // An admin cancelled the link (paymentTokens.markCancelled): it was
    // replaced, which is what the not-found page tells the visitor.
    if (token.status === "cancelled") return "notfound";
    if (token.status === "expired" || token.expiresAt < now) return "expired";
    return "pending";
}

export type PriceSplit = {
    /** The custom domain riding on the transfer, or null. */
    domain: string | null;
    addOn: number;
    /** The website half of the transfer. */
    websiteLine: number;
    /** The creator's discount on the website, when the sale carries a list price to strike. */
    discount: CreatorDiscount | null;
};

/**
 * The transfer split the way the payment email splits it (lib/email/templates.ts):
 * a custom domain at its real price, else the flat add-on, and the website is
 * the rest.
 */
export function priceSplit(
    amount: number,
    submission: { requestedDomain?: string | null; domainCostPHP?: number | null; websiteListPrice?: number | null } | null,
): PriceSplit {
    const domain = submission?.requestedDomain || null;
    const addOn = domain ? domainAddOnFor("with_custom_domain", submission?.domainCostPHP) : 0;
    const websiteLine = amount - addOn;
    return { domain, addOn, websiteLine, discount: creatorDiscount(websiteLine, submission?.websiteListPrice) };
}

/** When the money arrived, if anything recorded it: the webhook's match, else submissions.markPaid. admin.markPaid records no date. */
export function paidOnOf(token: { paymentReceivedAt?: number; usedAt?: number }, submission: { paidAt?: number } | null): number | null {
    return token.paymentReceivedAt ?? token.usedAt ?? submission?.paidAt ?? null;
}

const DAY = 24 * 60 * 60 * 1000;

/** How long the link was good for, from its own dates (paymentTokens.createPaymentToken gives 30 days). */
export function linkDays(token: { createdAt: number; expiresAt: number }): number {
    return Math.max(1, Math.round((token.expiresAt - token.createdAt) / DAY));
}

/** "Sep 2"; the year only when it is not this year. */
export function shortDate(ms: number, now: number): string {
    const d = new Date(ms);
    const thisYear = d.getFullYear() === new Date(now).getFullYear();
    return d.toLocaleDateString("en-PH", thisYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
}

/** "Sep 2, 2026", for the receipt. */
export function longDate(ms: number): string {
    return new Date(ms).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

/** The amount the way a transfer form takes it: two decimals, no ₱, no commas ("1499.00"). */
export function transferAmount(amount: number): string {
    return amount.toFixed(2);
}

/** The same amount to read: "1,499.00". */
export function transferAmountShown(amount: number): string {
    return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Everything the transfer needs, in one paste. */
export function paymentDetailsText(d: { wiseEmail: string; accountName: string; amount: number; referenceCode: string }): string {
    return [
        `Wise email: ${d.wiseEmail}`,
        `Account name: ${d.accountName}`,
        `Amount: ${transferAmount(d.amount)} PHP`,
        `Reference: ${d.referenceCode}`,
    ].join("\n");
}

/**
 * submissions.websiteUrl holds the published address once the site is deployed
 * (admin.markDeployed copies generatedWebsites.publishedUrl into it). Anything
 * that is not an absolute http(s) address is not a live site.
 */
export function liveUrlOf(url: string | null | undefined): string | null {
    return url && /^https?:\/\//i.test(url) ? url : null;
}

export function hostOf(url: string): string {
    try {
        return new URL(url).host || url;
    } catch {
        return url;
    }
}

/**
 * "Ask for a new link" as an email to Tendso, with what the team needs to find
 * the sale. There is no request-a-link function to call, so the visitor's own
 * mail app carries the request.
 */
export function newLinkMailto(businessName: string | null, referenceCode: string): string {
    const subject = businessName ? `New payment link for ${businessName}` : "New payment link";
    const body = [
        "Hi Tendso,",
        "",
        "My payment link expired. Please send me a new one.",
        "",
        ...(businessName ? [`Business: ${businessName}`] : []),
        `Old reference code: ${referenceCode}`,
        "",
    ].join("\n");
    return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
