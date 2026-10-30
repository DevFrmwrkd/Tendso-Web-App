"use client";

import { useQuery } from "convex/react";
import { usePathname } from "next/navigation";

import { PageHeader } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { CREATOR_ACCOUNT_HREF, CREATOR_PAGE_EDITOR_HREF, CREATOR_PAYOUTS_HREF, CREATOR_PORTAL_HREF } from "@/lib/v2/creatorPortalNavigation";

import { affiliateHref, affiliateSection, type AffiliateSection } from "../_lib/navigation";
import type { AffiliatePortal } from "../_lib/portal";
import { useAffiliateAccount } from "./AffiliateShell";
import { DashboardContent } from "./Dashboard";
import { AffiliateAccountView, AffiliateHomeView, AffiliateReferralsView, AffiliateWalletView } from "./PortalViews";
import { Sales, type AffiliateSale } from "./Sales";

/** Only financial sections subscribe to the account's private portal data. */
export function AffiliateSectionContent({ section }: { section: AffiliateSection }) {
    const account = useAffiliateAccount();
    const pathname = usePathname();
    const canonical = [CREATOR_ACCOUNT_HREF, CREATOR_PAGE_EDITOR_HREF, CREATOR_PAYOUTS_HREF].includes(pathname?.replace(/\/$/, "") ?? "");
    const portal = useQuery(api.affiliates.portal, ["home", "wallet", "referrals"].includes(section) ? {} : "skip");
    return <AffiliateSectionView section={section} account={account} portal={portal} canonical={canonical} />;
}

export function AffiliateSectionView({ section, account, portal, preview = false, sampleSales, canonical = false }: {
    section: AffiliateSection;
    account: Doc<"creators">;
    portal?: AffiliatePortal;
    preview?: boolean;
    sampleSales?: readonly AffiliateSale[];
    canonical?: boolean;
}) {
    const portalHrefs: Record<AffiliateSection, string> = {
        home: CREATOR_PORTAL_HREF, "my-page": CREATOR_PAGE_EDITOR_HREF,
        sales: `${CREATOR_PORTAL_HREF}#pt-shops`, wallet: CREATOR_PAYOUTS_HREF,
        referrals: `${CREATOR_PORTAL_HREF}#pt-agents`, account: CREATOR_ACCOUNT_HREF,
    };
    const props = { account, portal, preview, hrefFor: (value: string) => canonical && !preview ? portalHrefs[affiliateSection(value)] : affiliateHref(affiliateSection(value), preview) };
    switch (section) {
        case "my-page": return <DashboardContent key={account._id} account={account} preview={preview} />;
        case "sales": return <><PageHeader title="Sales" sub="Orders through your page, with the price and commission agreed at checkout." /><Sales sampleSales={preview ? sampleSales ?? [] : undefined} /></>;
        case "wallet": return <AffiliateWalletView {...props} title={canonical ? "Payouts" : undefined} />;
        case "referrals": return <AffiliateReferralsView {...props} />;
        case "account": return <AffiliateAccountView {...props} signOutHref={canonical ? "/v2/creators" : undefined} />;
        default: return <AffiliateHomeView {...props} />;
    }
}
