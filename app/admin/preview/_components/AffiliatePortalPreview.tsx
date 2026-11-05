"use client";

import { useEffect } from "react";
import { DashboardContent } from "@/app/affiliates/dashboard/_components/Dashboard";
import { AffiliateAccountView, AffiliateWalletView } from "@/app/affiliates/dashboard/_components/PortalViews";
import { affiliateHref, affiliateSection, type AffiliateSection } from "@/app/affiliates/dashboard/_lib/navigation";
import { CreatorsRoot } from "@/components/v2/creators/CreatorsRoot";
import { PortalFrame } from "@/components/v2/creators/PortalFrame";
import { PortalView } from "@/components/v2/creators/PortalView";
import { firstName, fmtMonthName } from "@/lib/v2/creatorProgram";
import { SAMPLE_PICTURES } from "@/lib/v2/creatorSample";
import { AFFILIATE_PREVIEW_ACCOUNT, AFFILIATE_PREVIEW_PORTAL, AFFILIATE_PREVIEW_WALLET } from "../_lib/affiliatePreviewData";
import { PreviewNotice } from "./PreviewNotice";

const BASE = "/admin/preview/affiliate";

/** The actual redesigned portal and settings, supplied only local sample data. */
export function AffiliatePortalPreview({ section = "home" }: { section?: AffiliateSection }) {
    const currentPage = section === "my-page" ? "my-page" : section === "account" ? "account" : section === "wallet" ? "payouts" : "home";
    useEffect(() => {
        const target = section === "sales" ? "pt-shops" : section === "referrals" ? "pt-agents" : null;
        if (target) document.getElementById(target)?.scrollIntoView({ block: "start" });
    }, [section]);
    const hrefFor = (value: string) => affiliateHref(affiliateSection(value), true);
    return <CreatorsRoot solo portal>
        <PortalFrame identity={{ name: AFFILIATE_PREVIEW_PORTAL.creator.name, photo: SAMPLE_PICTURES.creator }} currentPage={currentPage} sample previewBaseHref={BASE}>
            <PreviewNotice view="Affiliate" />
            {section === "my-page" ? <DashboardContent account={AFFILIATE_PREVIEW_ACCOUNT} preview />
                : section === "wallet" ? <div className="pt-settings"><AffiliateWalletView account={AFFILIATE_PREVIEW_ACCOUNT} portal={AFFILIATE_PREVIEW_WALLET} preview hrefFor={hrefFor} title="Payouts" /></div>
                    : section === "account" ? <div className="pt-settings"><AffiliateAccountView account={AFFILIATE_PREVIEW_ACCOUNT} portal={AFFILIATE_PREVIEW_WALLET} preview hrefFor={hrefFor} /></div>
                        : <>
                            <div className="pt-hi"><div><h1>Hi, {firstName(AFFILIATE_PREVIEW_PORTAL.creator.name)}.</h1><p>Your earnings for {fmtMonthName(AFFILIATE_PREVIEW_PORTAL.month.start)}. Sample data.</p></div></div>
                            <PortalView data={AFFILIATE_PREVIEW_PORTAL} pictures={SAMPLE_PICTURES} sample compactIncome payoutTo="mika.preview@example.com" samplePageEditorHref={`${BASE}?section=my-page`} />
                        </>}
        </PortalFrame>
    </CreatorsRoot>;
}
