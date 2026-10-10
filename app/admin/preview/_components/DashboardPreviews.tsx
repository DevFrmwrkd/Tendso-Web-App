"use client";

import type { MouseEvent } from "react";
import { toast } from "sonner";

import { AffiliateSectionView } from "@/app/affiliates/dashboard/_components/AffiliateSectionContent";
import { AffiliateShellView } from "@/app/affiliates/dashboard/_components/AffiliateShell";
import type { AffiliateSection } from "@/app/affiliates/dashboard/_lib/navigation";
import { CreatorHomeView } from "@/app/dashboard/_components/CreatorHome";
import { CreatorShellView } from "@/components/shells/CreatorShell";

import { sampleAffiliate, sampleAffiliatePortal, sampleAffiliateSales, sampleCreator, sampleLeads, sampleSubmissions, sampleWithdrawals } from "../_lib/samples";

function PreviewNotice({ view }: { view: "Affiliate" | "Creator" }) {
    return (
        <aside className="t-card t-card-pad flex flex-col gap-1 border-r1-gold-line bg-r1-gold-bg" aria-label={`${view} preview information`}>
            <p className="t-label">{view} preview · Sample data</p>
            <p className="t-body">{view === "Affiliate"
                ? "Explore Home, My page, Sales, Wallet, Referrals, and Account. Page editor changes are discarded when you leave; photo uploads, link sharing, account changes, and withdrawals are disabled."
                : "See the creator's home, navigation, submissions, and earnings. Links stay in this preview."}</p>
            <p className="t-meta">Use View as above to return to your admin dashboard.</p>
        </aside>
    );
}

export function AffiliateDashboardPreview({ section = "home" }: { section?: AffiliateSection }) {
    return (
        <AffiliateShellView account={sampleAffiliate} preview section={section}>
            <PreviewNotice view="Affiliate" />
            <AffiliateSectionView section={section} account={sampleAffiliate} portal={sampleAffiliatePortal} sampleSales={sampleAffiliateSales} preview />
        </AffiliateShellView>
    );
}

export function CreatorDashboardPreview() {
    function keepPreview(event: MouseEvent<HTMLDivElement>) {
        const link = (event.target as HTMLElement).closest("a");
        if (!link) return;
        event.preventDefault();
        toast.info("This is a dashboard preview. Open a creator account to use this action.");
    }

    return (
        <div onClickCapture={keepPreview} onAuxClickCapture={keepPreview}>
            <CreatorShellView name="Sam Reyes" open={2} unread={2} preview>
                <PreviewNotice view="Creator" />
                <CreatorHomeView
                    creator={sampleCreator}
                    submissions={sampleSubmissions}
                    leads={sampleLeads}
                    withdrawals={sampleWithdrawals}
                    referrals={{ pending: 2, qualified: 0, paid: 1 }}
                    preview
                />
            </CreatorShellView>
        </div>
    );
}
