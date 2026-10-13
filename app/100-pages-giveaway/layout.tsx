import type { Metadata } from "next";
import type { ReactNode } from "react";

import { GIVEAWAY_VALUE } from "@/lib/giveaway";

export const metadata: Metadata = {
    title: "Off the Record: 100 free Tendso websites",
    description: `Off the Record is giving away more than ${GIVEAWAY_VALUE} in free Tendso websites to 100 local businesses. Hang an Off the Record poster in your business, send a photo, and apply while slots remain.`,
    alternates: { canonical: "/100-pages-giveaway" },
    openGraph: {
        type: "website",
        siteName: "Off the Record",
        title: `Off the Record is giving away more than ${GIVEAWAY_VALUE} in free websites`,
        description: "A one-time gift from Off the Record to its community: 100 free websites built by Tendso. Hang the OTR poster, submit proof, and get a free Tendso website if eligible.",
        url: "/100-pages-giveaway",
    },
    twitter: {
        card: "summary",
        title: "Off the Record: 100 free Tendso websites",
        description: `More than ${GIVEAWAY_VALUE} in free websites. Hang an Off the Record poster in your business and apply for a free Tendso website. One-time giveaway for the first 100 eligible businesses.`,
    },
};

export default function GiveawayLayout({ children }: { children: ReactNode }) {
    return children;
}
