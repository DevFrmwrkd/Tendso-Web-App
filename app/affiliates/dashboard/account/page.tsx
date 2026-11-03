import type { Metadata } from "next";
import { AffiliateSectionContent } from "../_components/AffiliateSectionContent";
import { AffiliateDashboardBoundary } from "../_components/AffiliateShell";

export const metadata: Metadata = { title: "Account — Your creator portal", alternates: { canonical: "/affiliates/dashboard/account" }, robots: { index: false, follow: false } };

export default function AffiliateAccountPage() {
    return <AffiliateDashboardBoundary section="account"><AffiliateSectionContent section="account" /></AffiliateDashboardBoundary>;
}
