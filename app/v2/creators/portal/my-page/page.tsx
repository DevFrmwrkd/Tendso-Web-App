import type { Metadata } from "next";

import { AffiliateSectionContent } from "@/app/affiliates/dashboard/_components/AffiliateSectionContent";
import { AffiliateDashboardBoundary } from "@/app/affiliates/dashboard/_components/AffiliateShell";

export const metadata: Metadata = {
    title: "My page — Your creator portal",
    robots: { index: false, follow: false },
};

/** Reuse the verified affiliate gate and editor; only the canonical portal address is new. */
export default function CreatorPortalMyPage() {
    return <AffiliateDashboardBoundary>
        <AffiliateSectionContent section="my-page" />
    </AffiliateDashboardBoundary>;
}
