import type { FeedLead } from "@/app/dashboard/_lib/home";
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
    balance: 1100,
    totalEarnings: 1100,
    wiseEmail: "affiliate@example.com",
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
