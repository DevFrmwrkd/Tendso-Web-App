import type { Metadata } from "next";

import { AffiliateSectionContent } from "@/app/affiliates/dashboard/_components/AffiliateSectionContent";
import { AffiliateDashboardBoundary } from "@/app/affiliates/dashboard/_components/AffiliateShell";

export const metadata: Metadata = {
    title: "Account — Your creator portal",
    alternates: { canonical: "/affiliates/dashboard/account" },
    robots: { index: false, follow: false },
};

export default function CreatorPortalAccount() {
    return <AffiliateDashboardBoundary><AffiliateSectionContent section="account" /></AffiliateDashboardBoundary>;
}
