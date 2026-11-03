import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { AffiliatePortal } from "@/app/affiliates/dashboard/_lib/portal";
import { SAMPLE_PICTURES, SAMPLE_PORTAL, SAMPLE_TODAY } from "@/lib/v2/creatorSample";
import type { PortalSummary } from "@/lib/v2/creatorTypes";
import { sampleAffiliate } from "./samples";

/** Display-only fixtures. The live portal and page editor never receive these ids. */
export const AFFILIATE_PREVIEW_PORTAL: PortalSummary = {
    ...SAMPLE_PORTAL,
    creator: { ...SAMPLE_PORTAL.creator, code: "MIKA30", photo: SAMPLE_PICTURES.creator ?? null,
        message: "I can help you bring your shop online. Explore Tendso, preview your website, and use my code before you pay.",
        socialLinks: { instagram: "https://www.instagram.com/tendso/", youtube: "https://www.youtube.com/@tendso" } },
    shops: [
        ...SAMPLE_PORTAL.shops.map(shop => ({ ...shop, workflowStatus: "completed", paymentStatus: "paid_in_full" as const, commissionCredited: true })),
        { submissionId: "preview-shop-balance", businessName: "Corner Coffee", date: SAMPLE_TODAY - 86_400_000, paidAt: null,
            listPrice: 4999, paid: 3499, kept: 0, status: "paying", workflowStatus: "completed", paymentStatus: "partially_paid", commissionCredited: false, meta: "Coffee shop · Marikina" },
        { submissionId: "preview-shop-review", businessName: "Maya’s Flower Shop", date: SAMPLE_TODAY - 2 * 86_400_000, paidAt: null,
            listPrice: 4999, paid: 3499, kept: 0, status: "waiting", workflowStatus: "submitted", paymentStatus: "unpaid", commissionCredited: false, meta: "Flower shop · Pasig" },
    ],
};

const withdrawn = SAMPLE_PORTAL.payouts.history.reduce((total, row) => total + row.amount, 0);
export const AFFILIATE_PREVIEW_ACCOUNT: Doc<"creators"> = {
    ...sampleAffiliate,
    firstName: "Mika", lastName: "Santos", email: "mika.preview@example.com", phone: "09000000000", wiseEmail: "mika.preview@example.com",
    affiliateHandle: "mika", affiliateDisplayName: "Mika Santos", affiliatePhoto: SAMPLE_PICTURES.creator ?? undefined,
    affiliateMessage: AFFILIATE_PREVIEW_PORTAL.creator.message ?? undefined,
    affiliateSocialLinks: AFFILIATE_PREVIEW_PORTAL.creator.socialLinks,
    affiliatePrice: AFFILIATE_PREVIEW_PORTAL.creator.price, referralCode: "MIKA30",
    balance: SAMPLE_PORTAL.payouts.readyToSend, totalEarnings: withdrawn + SAMPLE_PORTAL.payouts.readyToSend, totalWithdrawn: withdrawn,
};

export const AFFILIATE_PREVIEW_WALLET: AffiliatePortal = {
    month: SAMPLE_PORTAL.month,
    income: { directThisMonth: SAMPLE_PORTAL.now.thisMonth, teamThisMonth: SAMPLE_PORTAL.monthly.thisMonth,
        totalThisMonth: SAMPLE_PORTAL.now.thisMonth + SAMPLE_PORTAL.monthly.thisMonth },
    summary: { balance: SAMPLE_PORTAL.payouts.readyToSend, totalEarned: withdrawn + SAMPLE_PORTAL.payouts.readyToSend,
        totalWithdrawn: withdrawn, pendingCommission: SAMPLE_PORTAL.payouts.waitingForShops, inFlight: SAMPLE_PORTAL.payouts.inFlight },
    earnings: [
        { _id: "preview-ready" as Id<"earnings">, amount: SAMPLE_PORTAL.payouts.readyToSend, type: "website_sale", status: "available", createdAt: SAMPLE_TODAY, businessName: "Sample website commissions" },
        ...SAMPLE_PORTAL.payouts.history.map((row, index) => ({ _id: `preview-earned-${index}` as Id<"earnings">,
            amount: row.amount, type: "website_sale" as const, status: "withdrawn" as const, createdAt: row.requestedAt - 86_400_000, businessName: "Earlier sample commissions" })),
    ],
    withdrawals: SAMPLE_PORTAL.payouts.history.map(row => ({ _id: row.withdrawalId as Id<"withdrawals">, _creationTime: row.requestedAt,
        creatorId: AFFILIATE_PREVIEW_ACCOUNT._id, amount: row.amount, payoutMethod: "wise_email", accountDetails: "mika.preview@example.com",
        wiseEmail: "mika.preview@example.com", status: row.status, createdAt: row.requestedAt })),
    referrals: [],
    referralStats: { total: 0, pending: 0, qualified: 0, paid: 0, totalEarned: 0 },
    recruits: SAMPLE_PORTAL.recruits.map(row => ({ _id: row.creatorId as Id<"creators">, referredName: row.name,
        createdAt: row.joinedAt, endsAt: row.endsAt, earning: row.earning, totalEarned: row.overrideTotal, photo: null,
        monthsLeft: row.monthsLeft, monthEarned: row.overrideThisMonth })),
    recruitStats: { total: SAMPLE_PORTAL.recruits.length, earning: SAMPLE_PORTAL.recruits.filter(row => row.earning).length,
        totalEarned: SAMPLE_PORTAL.recruits.reduce((total, row) => total + row.overrideTotal, 0) },
};
