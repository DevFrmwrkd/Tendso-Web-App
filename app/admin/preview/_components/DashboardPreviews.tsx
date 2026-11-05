"use client";

import type { AffiliateSection } from "@/app/affiliates/dashboard/_lib/navigation";
import { CreatorHomeView } from "@/app/dashboard/_components/CreatorHome";
import { CreatorShellView } from "@/components/shells/CreatorShell";

import { sampleCreator, sampleLeads, sampleSubmissions, sampleWithdrawals } from "../_lib/samples";
import { AffiliatePortalPreview } from './AffiliatePortalPreview';
import { PreviewNotice } from './PreviewNotice';
import { PreviewGuard } from './PreviewGuard';

export function AffiliateDashboardPreview({ section = "home" }: { section?: AffiliateSection }) {
    return (
        <PreviewGuard role="affiliate"><AffiliatePortalPreview section={section} /></PreviewGuard>
    );
}

export function CreatorDashboardPreview() {
    return (
        <PreviewGuard role="creator">
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
        </PreviewGuard>
    );
}
