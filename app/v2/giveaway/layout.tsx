import type { Metadata } from "next";
import type { ReactNode } from "react";

import { PbRoot } from "@/components/v2/pages-b/PbRoot";
import { GIVEAWAY_VALUE } from "@/lib/giveaway";

export const metadata: Metadata = {
    title: "Off the Record: 100 free Tendso websites",
    description: `Off the Record is giving more than ${GIVEAWAY_VALUE} in free Tendso websites to 100 walk-in shops. Hang the poster, snap it, claim your site.`,
    alternates: { canonical: "/v2/giveaway" },
    robots: { index: false, follow: true },
};

export default function V2GiveawayLayout({ children }: { children: ReactNode }) {
    return <PbRoot>{children}</PbRoot>;
}
