import { affiliateSection } from "@/app/affiliates/dashboard/_lib/navigation";

import { AffiliateDashboardPreview } from "../_components/DashboardPreviews";

export default async function AffiliatePreviewPage({ searchParams }: { searchParams: Promise<{ section?: string | string[] }> }) {
    const { section } = await searchParams;
    return <AffiliateDashboardPreview section={affiliateSection(section)} />;
}
