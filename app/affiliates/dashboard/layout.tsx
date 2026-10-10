import type { Metadata } from "next";

import { AffiliateDashboardBoundary } from "./_components/AffiliateShell";

export const metadata: Metadata = {
    title: "Affiliate dashboard — Tendso",
    robots: { index: false, follow: false },
};

export default function AffiliateDashboardLayout({ children }: { children: React.ReactNode }) {
    return <AffiliateDashboardBoundary>{children}</AffiliateDashboardBoundary>;
}
