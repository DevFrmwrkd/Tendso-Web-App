/**
 * Return shapes of the creator-program Convex functions, copied from the
 * contract: docs/v2-api-creators.md on branch feat/v2-backend-creators.
 * Money is a plain number in ₱, dates are ms timestamps, "this month" is the
 * calendar month in Asia/Manila.
 */

/** The public face of a creator. No contact or payout data. */
export interface CreatorCard {
    /** "mika": links /a/mika and /a/mika/earn */
    handle: string;
    name: string;
    photo: string | null;
    /** What people type: "MIKA30". */
    code: string | null;
    listPrice: number;
    /** The creator's price for a shop, e.g. 3499. */
    price: number;
    /** listPrice - price, e.g. 1500 ("you save ₱1,500"). */
    saving: number;
    percentOff: number;
}

export type ShopStatus = "paid" | "paying" | "waiting" | "not_paid";

export interface PortalShop {
    submissionId: string;
    businessName: string;
    date: number;
    paidAt: number | null;
    listPrice: number;
    paid: number;
    kept: number;
    status: ShopStatus;
    /** Sample data only: "Tailor · Marikina". The API does not send it. */
    meta?: string;
}

export interface PortalRecruit {
    creatorId: string;
    name: string;
    area: string | null;
    joinedAt: number;
    salesThisMonth: number;
    overrideThisMonth: number;
    overrideTotal: number;
    endsAt: number;
    /** 0 when ended. */
    monthsLeft: number;
    earning: boolean;
}

export interface FunnelCounts {
    clicks: number;
    signUps: number;
    sales: number;
    /** Sample data only. The API does not count downloads; the portal hides the step when this is missing. */
    downloads?: number;
}

export interface PortalPayoutRow {
    withdrawalId: string;
    amount: number;
    status: "pending" | "processing" | "completed" | "failed";
    requestedAt: number;
    sentAt: number | null;
}

/** `creatorPortal.summary` */
export interface PortalSummary {
    creator: CreatorCard & { status: "active" | "suspended"; shopLink: string; earnLink: string };
    month: { start: number; end: number; label: string };
    rates: { overrideRate: number; overrideMonths: number };
    now: { thisMonth: number; shopsThisMonth: number; shops: PortalShop[] };
    monthly: { thisMonth: number; activeAgents: number; agentsInWindow: number; nextEndDate: number | null };
    funnel: { shop: FunnelCounts; earn: FunnelCounts };
    recruits: PortalRecruit[];
    shops: PortalShop[];
    payouts: {
        readyToSend: number;
        waitingForShops: number;
        waitingFromShops: number;
        waitingFromTeam: number;
        inFlight: number;
        history: PortalPayoutRow[];
    };
}

/** Photos for the sample portal only (real creators and recruits show initials until they have a photo). */
export interface PortalPictures {
    /** The creator's own face. */
    creator?: string | null;
    /** Recruit name to a face image. */
    recruits?: Record<string, string>;
    /** Shop name to a photo. */
    shops?: Record<string, string>;
}

/** `creatorProgram.myApplication` */
export type MyApplication =
    | { status: "signed_out" }
    | { status: "none" }
    | { status: "other_account" }
    | { status: "pending" | "active" | "suspended"; handle: string | null; code: string | null; appliedAt: number | null };

/** `creatorProgram.checkAvailability` */
export interface Availability {
    handle: { value: string; available: boolean; error: string | null } | null;
    code: { value: string; available: boolean; error: string | null } | null;
}

export type ApplyArgs = {
    firstName: string;
    lastName?: string;
    phone?: string;
    handle: string;
    code?: string;
    socials: { platform: "facebook" | "instagram" | "tiktok" | "youtube" | "x" | "other"; handle: string }[];
    audienceSize?: number;
};
