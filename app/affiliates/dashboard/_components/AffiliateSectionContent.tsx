"use client";

import { useQuery } from "convex/react";

import { PageHeader } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

import { affiliateHref, affiliateSection, type AffiliateSection } from "../_lib/navigation";
import type { AffiliatePortal } from "../_lib/portal";
import { useAffiliateAccount } from "./AffiliateShell";
import { DashboardContent } from "./Dashboard";
import { AffiliateAccountView, AffiliateHomeView, AffiliateReferralsView, AffiliateWalletView } from "./PortalViews";
import { Sales, type AffiliateSale } from "./Sales";

/** Only financial sections subscribe to the account's private portal data. */
export function AffiliateSectionContent({ section }: { section: AffiliateSection }) {
    const account = useAffiliateAccount();
    const portal = useQuery(api.affiliates.portal, ["home", "wallet", "referrals"].includes(section) ? {} : "skip");
    return <AffiliateSectionView section={section} account={account} portal={portal} />;
}

export function AffiliateSectionView({ section, account, portal, preview = false, sampleSales }: {
    section: AffiliateSection;
    account: Doc<"creators">;
    portal?: AffiliatePortal;
    preview?: boolean;
    sampleSales?: readonly AffiliateSale[];
}) {
    const props = { account, portal, preview, hrefFor: (value: string) => affiliateHref(affiliateSection(value), preview) };
    switch (section) {
        case "my-page": return <DashboardContent key={account._id} account={account} preview={preview} />;
        case "sales": return <><PageHeader title="Sales" sub="Orders through your page, with the price and commission agreed at checkout." /><Sales sampleSales={preview ? sampleSales ?? [] : undefined} /></>;
        case "wallet": return <AffiliateWalletView {...props} />;
        case "referrals": return <AffiliateReferralsView {...props} />;
        case "account": return <AffiliateAccountView {...props} />;
        default: return <AffiliateHomeView {...props} />;
    }
}
