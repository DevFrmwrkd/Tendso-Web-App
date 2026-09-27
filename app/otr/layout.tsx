import type { Metadata } from "next";

import { campaignListPrice, campaignSellPrice, formatPHP } from "@/lib/pricing";

const TITLE = "OTR viewers: 30% off your website — Tendso";
const DESCRIPTION = `Scanned the code on Off The Record? Your business gets a real website for ${formatPHP(
    campaignSellPrice("otr"),
)} instead of ${formatPHP(campaignListPrice("otr"))}, paid once after it is live. No monthly fees.`;

/**
 * The page itself is a client component, which cannot export metadata, and this
 * one needs it more than most: the link is shared in a video description and in
 * comments, where the preview card is the only thing most people see.
 *
 * The card is built from openGraph, not from `description`, so this sets its own.
 * Inheriting the root's would show the homepage's ₱999 price on an OTR link and
 * give its og:url as the homepage, which Facebook takes as the link to share.
 */
export const metadata: Metadata = {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "/otr" },
    openGraph: {
        type: "website",
        siteName: "Tendso",
        locale: "en_PH",
        url: "/otr",
        title: TITLE,
        description: DESCRIPTION,
    },
};

export default function OtrLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
