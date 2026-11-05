import type { Metadata } from "next";
import { AffiliateSectionContent } from "../_components/AffiliateSectionContent";
import { AffiliateDashboardBoundary } from "../_components/AffiliateShell";

export const metadata: Metadata = { title: "My page — Your creator portal", alternates: { canonical: "/affiliates/dashboard/my-page" }, robots: { index: false, follow: false } };

export default function AffiliateMyPage() {
    return <AffiliateDashboardBoundary section="my-page"><AffiliateSectionContent section="my-page" /></AffiliateDashboardBoundary>;
}
