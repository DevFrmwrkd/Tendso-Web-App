import type { FeedLead } from "@/app/dashboard/_lib/home";
import type { AffiliateSale } from "@/app/affiliates/dashboard/_components/Sales";
import type { AffiliatePortal } from "@/app/affiliates/dashboard/_lib/portal";
import type { Doc, Id } from "@/convex/_generated/dataModel";

// Display-only fixtures. These ids must never be sent to Convex.
const createdAt = Date.UTC(2026, 9, 5, 2);
const creatorId = "preview-creator" as Id<"creators">;

export const sampleAffiliate: Doc<"creators"> = {
    _id: "preview-affiliate" as Id<"creators">,
    _creationTime: createdAt,
    clerkId: "preview-affiliate",
    email: "affiliate@example.com",
    firstName: "Alex",
    lastName: "Santos",
    role: "affiliate",
    status: "active",
    affiliateHandle: "preview",
    affiliateDisplayName: "Alex Santos",
    affiliateMessage: "Let's get your shop online. Get a website your customers can visit anytime.",
    affiliatePrice: 1999,
    referralCode: "SAMPLE-A",
    balance: 1600,
    totalEarnings: 2600,
    totalWithdrawn: 500,
    wiseEmail: "affiliate@example.com",
};

export const sampleAffiliateSales: readonly AffiliateSale[] = [
    { _id: "demo-sale-paid" as AffiliateSale["_id"], businessName: "Luna's Salon", price: 2200, commission: 1100, status: "completed", createdAt: Date.UTC(2026, 9, 8, 3) },
    { _id: "demo-sale-pending" as AffiliateSale["_id"], businessName: "Corner Coffee", price: 1999, commission: 1000, status: "pending_payment", createdAt: Date.UTC(2026, 9, 7, 6) },
    { _id: "demo-sale-review" as AffiliateSale["_id"], businessName: "Maya's Flower Shop", price: 1499, commission: 750, status: "submitted", createdAt: Date.UTC(2026, 9, 6, 1) },
];

export const sampleAffiliatePortal: AffiliatePortal = {
    summary: { balance: 1600, totalEarned: 2600, totalWithdrawn: 500, pendingCommission: 1000, inFlight: 500 },
    earnings: [
        { _id: "preview-affiliate-sale" as Id<"earnings">, amount: 1100, type: "website_sale", status: "available", createdAt: Date.UTC(2026, 9, 8, 3), businessName: "Luna's Salon" },
        { _id: "preview-affiliate-referral" as Id<"earnings">, amount: 1000, type: "referral_bonus", status: "available", createdAt: Date.UTC(2026, 9, 7, 3), businessName: "Unknown" },
        { _id: "preview-affiliate-earlier-sale" as Id<"earnings">, amount: 500, type: "website_sale", status: "available", createdAt: Date.UTC(2026, 9, 4, 3), businessName: "Sunrise Bakery" },
    ],
    withdrawals: [
        { _id: "preview-affiliate-moving" as Id<"withdrawals">, _creationTime: createdAt, creatorId: sampleAffiliate._id, amount: 500, payoutMethod: "wise_email", accountDetails: "affiliate@example.com", wiseEmail: "affiliate@example.com", status: "processing", createdAt: Date.UTC(2026, 9, 9, 2) },
        { _id: "preview-affiliate-paid" as Id<"withdrawals">, _creationTime: createdAt, creatorId: sampleAffiliate._id, amount: 500, payoutMethod: "wise_email", accountDetails: "affiliate@example.com", wiseEmail: "affiliate@example.com", status: "completed", createdAt: Date.UTC(2026, 9, 6, 2) },
    ],
    referrals: [
        { _id: "preview-referral-paid" as Id<"referrals">, referredName: "Sam Reyes", status: "paid", bonusAmount: 1000, createdAt: Date.UTC(2026, 9, 6, 2) },
        { _id: "preview-referral-pending" as Id<"referrals">, referredName: "Jamie Cruz", status: "pending", bonusAmount: 0, createdAt: Date.UTC(2026, 9, 5, 2) },
    ],
    referralStats: { total: 2, pending: 1, qualified: 0, paid: 1, totalEarned: 1000 },
};

export const sampleCreator: Doc<"creators"> = {
    _id: creatorId,
    _creationTime: createdAt,
    clerkId: "preview-creator",
    email: "creator@example.com",
    firstName: "Sam",
    lastName: "Reyes",
    role: "creator",
    status: "active",
    certifiedAt: createdAt,
    referralCode: "SAMPLE-C",
    balance: 1500,
    totalEarnings: 2500,
    wiseEmail: "creator@example.com",
};

function submission(id: string, businessName: string, status: string, at: number): Doc<"submissions"> {
    return {
        _id: id as Id<"submissions">,
        _creationTime: at,
        creatorId,
        businessName,
        businessType: "Shop",
        ownerName: "Maria Santos",
        ownerPhone: "",
        address: "Sample address",
        city: "Quezon City",
        status,
        amount: 1999,
        creatorPayout: 1000,
        ...(status === "pending_payment" ? { sentEmailAt: at } : {}),
        ...(status === "completed" ? { paidAt: at, creatorPaidAt: at } : {}),
    };
}

export const sampleSubmissions = [
    submission("preview-review", "Maya's Flower Shop", "in_review", Date.UTC(2026, 9, 9, 2)),
    submission("preview-payment", "Corner Coffee", "pending_payment", Date.UTC(2026, 9, 8, 3)),
    submission("preview-complete", "Luna's Salon", "completed", Date.UTC(2026, 9, 7, 4)),
];

export const sampleWithdrawals: Doc<"withdrawals">[] = [{
    _id: "preview-withdrawal" as Id<"withdrawals">,
    _creationTime: createdAt,
    creatorId,
    amount: 1000,
    payoutMethod: "wise_email",
    accountDetails: "creator@example.com",
    wiseEmail: "creator@example.com",
    status: "completed",
    createdAt,
    processedAt: Date.UTC(2026, 9, 6, 2),
}];

export const sampleLeads: FeedLead[] = [{
    _id: "preview-lead" as Id<"leads">,
    _creationTime: createdAt,
    name: "Sample shop owner",
    phone: "",
    email: null,
    source: "outscraper",
    status: "new",
    createdAt,
    businessName: "Sunrise Bakery",
    businessType: "Bakery",
    businessCity: "Quezon City",
    businessAddress: "Sample address",
    businessLatitude: null,
    businessLongitude: null,
    businessGooglePlaceId: null,
    ownerName: null,
    ownerPhone: null,
    interviewerCount: 0,
    websiteUrl: null,
    submissionStatus: null,
    isHot: false,
    submittedBy: null,
    isMine: false,
    adminDescription: null,
    previewImageUrl: null,
    externalPreviewUrl: null,
    hasEnrichedContent: false,
}];
