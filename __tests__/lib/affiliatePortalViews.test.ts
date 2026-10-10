import { useUser } from "@clerk/nextjs";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AffiliateAccountView, AffiliateHomeView, AffiliateReferralsView, AffiliateWalletView } from "@/app/affiliates/dashboard/_components/PortalViews";
import { affiliateLedger, type AffiliatePortal } from "@/app/affiliates/dashboard/_lib/portal";
import { EditProfileDrawer } from "@/app/profile/_components/EditProfileDrawer";
import { PasswordDrawer } from "@/app/profile/_components/PasswordDrawer";
import { PayoutDialog } from "@/app/wallet/_components/PayoutDialog";
import type { Doc, Id } from "@/convex/_generated/dataModel";

jest.mock("@/convex/_generated/api", () => ({ api: {} }));
jest.mock("@clerk/nextjs", () => ({ useUser: jest.fn(), SignOutButton: ({ children }: { children: ReactNode }) => children }));
jest.mock("@/app/profile/_components/EditProfileDrawer", () => ({ EditProfileDrawer: jest.fn(() => null) }));
jest.mock("@/app/profile/_components/PasswordDrawer", () => ({ PasswordDrawer: jest.fn(() => null) }));
jest.mock("@/app/wallet/_components/PayoutDialog", () => ({ PayoutDialog: jest.fn(() => null) }));

const account: Doc<"creators"> = {
    _id: "affiliate-id" as Id<"creators">, _creationTime: 100, clerkId: "clerk-affiliate",
    firstName: "Maria", lastName: "Cruz", email: "maria.private@example.com", phone: "09171234567",
    role: "affiliate", status: "active", affiliateHandle: "maria", referralCode: "MARIA1000",
    balance: 9000, wiseEmail: "maria.wise@example.com",
};

function portalData(): AffiliatePortal {
    return {
        summary: { balance: 0, totalEarned: 0, totalWithdrawn: 0, pendingCommission: 0, inFlight: 0 },
        earnings: [], withdrawals: [], referrals: [],
        referralStats: { total: 0, pending: 0, qualified: 0, paid: 0, totalEarned: 0 },
    };
}

function withdrawal(id: string, createdAt: number, status: Doc<"withdrawals">["status"]): Doc<"withdrawals"> {
    return { _id: id as Id<"withdrawals">, _creationTime: createdAt, creatorId: account._id,
        amount: 750, payoutMethod: "wise_email", accountDetails: account.wiseEmail!, status, createdAt };
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useUser).mockImplementation(() => { throw new Error("Read-only views must not mount Clerk hooks"); });
});

describe("affiliate portal view data", () => {
    it("keeps loading distinct from an authoritative zero balance", () => {
        const loading = renderToStaticMarkup(createElement(AffiliateWalletView, { account, portal: undefined }));
        expect(loading).toContain("Loading your affiliate wallet");
        expect(loading).not.toContain("₱0");
        expect(loading).not.toContain("₱9,000");

        const loaded = renderToStaticMarkup(createElement(AffiliateWalletView, { account, portal: portalData(), preview: true }));
        expect(loaded).toContain("₱0");
        expect(loaded).not.toContain("₱9,000");
        expect(loaded).toContain("disabled");
        expect(PayoutDialog).not.toHaveBeenCalled();
    });

    it("shows Home's available, pending and lifetime totals with preview-local shortcuts", () => {
        const portal = portalData();
        portal.summary = { balance: 1234, pendingCommission: 4321, totalEarned: 6543, totalWithdrawn: 50, inFlight: 10 };
        const html = renderToStaticMarkup(createElement(AffiliateHomeView, { account, portal, preview: true,
            hrefFor: (section) => `/admin/preview/affiliate?section=${section}` }));
        expect(html).toContain("₱1,234");
        expect(html).toContain("₱4,321");
        expect(html).toContain("₱6,543");
        expect(html).toContain('href="/admin/preview/affiliate?section=my-page"');
        expect(html).toContain('href="/admin/preview/affiliate?section=sales"');
        expect(html).toContain('href="/admin/preview/affiliate?section=wallet"');
        expect(html).not.toContain(account.email);
    });

    it("does not mount payout forms for suspended accounts or active previews", () => {
        const portal = portalData();
        portal.summary.balance = 1200;
        for (const props of [{ account, preview: true }, { account: { ...account, status: "suspended" }, preview: false }]) {
            const html = renderToStaticMarkup(createElement(AffiliateWalletView, { ...props, portal }));
            expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Withdraw<\/button>/);
            expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Change<\/button>/);
        }
        expect(PayoutDialog).not.toHaveBeenCalled();
    });

    it("scopes the live payout dialog to the supplied affiliate and authoritative balance", () => {
        const portal = portalData();
        portal.summary.balance = 125;
        renderToStaticMarkup(createElement(AffiliateWalletView, { account, portal }));
        expect(PayoutDialog).toHaveBeenCalledWith(expect.objectContaining({
            creator: account, balance: 125, payoutEmail: account.wiseEmail, step: null,
        }), undefined);
        expect(useUser).not.toHaveBeenCalled();
    });

    it("handles an active account without a Wise email", () => {
        const withoutWise = { ...account, wiseEmail: undefined };
        const html = renderToStaticMarkup(createElement(AffiliateWalletView, { account: withoutWise, portal: portalData() }));
        expect(html).toContain("No Wise email yet");
        expect(html).toContain("Set up");
        expect(PayoutDialog).toHaveBeenCalledWith(expect.objectContaining({ payoutEmail: null }), undefined);
    });
});

describe("private affiliate history mapping", () => {
    it("builds history from the minimal earnings projection without submission details", () => {
        const portal = portalData();
        portal.earnings = [{ _id: "earning" as Id<"earnings">, amount: 500, type: "submission_approved", status: "available", createdAt: 20, businessName: "Corner Shop" }];
        portal.withdrawals = [withdrawal("old-failure", 10, "failed"), withdrawal("latest-failure", 30, "failed")];
        const rows = affiliateLedger(portal);
        expect(rows.map((row) => row.key)).toEqual(["w-latest-failure", "e-earning", "w-old-failure"]);
        expect(rows[0]).toMatchObject({ amount: "₱0", retry: { amount: 750, at: 30 } });
        expect(rows[1]).toMatchObject({ title: "Corner Shop", sub: "Your share of the sale", amount: "+₱500" });
        expect(rows[2].retry).toBeUndefined();
    });

    it("shows referral bonus copy without inventing a shop name", () => {
        const portal = portalData();
        portal.earnings = [{ _id: "bonus" as Id<"earnings">, amount: 1000, type: "referral_bonus", status: "available", createdAt: 20, businessName: "Unknown" }];
        expect(affiliateLedger(portal)[0]).toMatchObject({ title: "Referral bonus", sub: "A creator you invited had their first site paid for", amount: "+₱1,000" });
    });
});

describe("affiliate referrals and account", () => {
    it("only offers the affiliate's own code, bonus rule and invited creator statuses", () => {
        const portal = portalData();
        portal.referrals = [{ _id: "referral" as Id<"referrals">, referredName: "John Private Lastname", status: "pending", bonusAmount: 0, createdAt: 50 }];
        portal.referralStats = { total: 1, pending: 1, qualified: 0, paid: 0, totalEarned: 0 };
        const html = renderToStaticMarkup(createElement(AffiliateReferralsView, { account, portal }));
        expect(html).toContain("MARIA1000");
        expect(html).toContain('aria-label="Copy your creator referral code"');
        expect(html).toContain("₱1,000");
        expect(html).toContain("first website paid for by its owner");
        expect(html).toContain("John L.");
        expect(html).toContain("In progress");
        expect(html).not.toContain("Private Lastname");
        expect(html).not.toContain("<input");
        expect(html).not.toContain("Enter a code");
        expect(html).not.toContain(account.email);
    });

    it("renders an account preview with masked contact details and no Clerk or edit drawers", () => {
        const html = renderToStaticMarkup(createElement(AffiliateAccountView, { account, portal: portalData(), preview: true }));
        expect(html).toContain("Affiliate");
        expect(html).not.toContain(account.email);
        expect(html).not.toContain(account.phone);
        expect(html).toContain('href="/affiliates/dashboard/my-page"');
        expect(useUser).not.toHaveBeenCalled();
        expect(EditProfileDrawer).not.toHaveBeenCalled();
        expect(PasswordDrawer).not.toHaveBeenCalled();
    });
});
