import { SUPPORT_EMAIL } from "@/lib/contact";
import { creatorDiscount, domainAddOnFor, isComped, type CreatorDiscount } from "@/lib/pricing";
import { isPaidInFull } from '@/convex/lib/ownerApp';

/*
 * What the payment page shows, worked out from the token and its submission.
 * Pure (no React), so every rule sits in one place.
 */

export type PayView = "pending" | "paid" | "expired" | "notfound";

/** A hosted checkout can have an earlier expiry than its payment link. */
export function checkoutExpiryAt(token: { expiresAt: number; xenditInvoiceId?: string; xenditExpiresAt?: number }): number {
    return token.xenditInvoiceId && typeof token.xenditExpiresAt === 'number' && Number.isFinite(token.xenditExpiresAt)
        ? Math.min(token.expiresAt, token.xenditExpiresAt) : token.expiresAt;
}

export function payView(
    token: { status: string; expiresAt: number; xenditInvoiceId?: string; xenditExpiresAt?: number } | null,
    submission: { status: string; pricingMode?: string | null; paidInFullAt?: number; depositPaidAt?: number;
        publishPolicy?: 'publish_first' | 'pay_then_publish' } | null,
    now: number,
): PayView {
    if (!token) return "notfound";
    if (token.status === "paid") return "paid";
    // An old link may remain pending after a different receipt or a legacy
    // team confirmation settles the order. Use the backend's receipt-aware
    // settlement rule so status-only updates cannot settle new pay-first orders.
    // A free grant is not evidence of a payment against this token.
    if (submission && !isComped(submission)
        && isPaidInFull({ ...submission, pricingMode: submission.pricingMode ?? undefined })) return "paid";
    // An admin cancelled the link (paymentTokens.markCancelled): it was
    // replaced, which is what the not-found page tells the visitor.
    if (token.status === "cancelled") return "notfound";
    // A hosted checkout can expire before the longer-lived payment token.
    // Show renewal immediately even if the provider callback has not arrived.
    if (token.xenditInvoiceId && typeof token.xenditExpiresAt === 'number'
        && Number.isFinite(token.xenditExpiresAt) && token.xenditExpiresAt <= now) return 'expired';
    if (token.status === "expired" || token.expiresAt <= now) return "expired";
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
 * a custom domain at the frozen owner charge, or its legacy real price/add-on,
 * and the website is the rest.
 */
export function priceSplit(
    amount: number,
    submission: { requestedDomain?: string | null; domainCostPHP?: number | null; domainChargedPHP?: number | null; websiteListPrice?: number | null } | null,
): PriceSplit {
    const domain = submission?.requestedDomain || null;
    const addOn = domain ? domainAddOnFor("with_custom_domain", submission?.domainCostPHP, submission?.domainChargedPHP) : 0;
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
