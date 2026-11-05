import type { Metadata } from "next";
import { AffiliateSectionContent } from "../_components/AffiliateSectionContent";
import { AffiliateDashboardBoundary } from "../_components/AffiliateShell";

export const metadata: Metadata = { title: "Payouts — Your creator portal", alternates: { canonical: "/affiliates/dashboard/payouts" }, robots: { index: false, follow: false } };

export default function AffiliatePayouts() {
    return <AffiliateDashboardBoundary section="wallet"><AffiliateSectionContent section="wallet" /></AffiliateDashboardBoundary>;
}
