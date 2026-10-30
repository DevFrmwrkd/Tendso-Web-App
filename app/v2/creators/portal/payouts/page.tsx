import type { Metadata } from "next";

import { AffiliateSectionContent } from "@/app/affiliates/dashboard/_components/AffiliateSectionContent";
import { AffiliateDashboardBoundary } from "@/app/affiliates/dashboard/_components/AffiliateShell";

export const metadata: Metadata = {
    title: "Payouts — Your creator portal",
    robots: { index: false, follow: false },
};

/** The existing wallet owns all Wise setup, validation, withdrawal and retry behavior. */
export default function CreatorPortalPayouts() {
    return <AffiliateDashboardBoundary><AffiliateSectionContent section="wallet" /></AffiliateDashboardBoundary>;
}
