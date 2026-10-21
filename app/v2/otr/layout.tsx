import type { Metadata } from "next";
import type { ReactNode } from "react";

import { PbRoot } from "@/components/v2/pages-b/PbRoot";
import { campaignListPrice, campaignSellPrice, formatPHP } from "@/lib/pricing";

const DESCRIPTION = `For Off the Record viewers: your Tendso website for ${formatPHP(campaignSellPrice("otr"))} instead of ${formatPHP(campaignListPrice("otr"))}, paid once. See it first.`;

export const metadata: Metadata = {
    title: "Off the Record viewers: 30% off your website — Tendso",
    description: DESCRIPTION,
    alternates: { canonical: "/v2/otr" },
    robots: { index: false, follow: true },
};

export default function V2OtrLayout({ children }: { children: ReactNode }) {
    return <PbRoot>{children}</PbRoot>;
}
