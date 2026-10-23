import type { Metadata } from "next";
import type { ReactNode } from "react";

import { PbRoot } from "@/components/v2/pages-b/PbRoot";

/**
 * The tab title matters here: this is a long form on a phone, and the owner will switch away
 * from it to find a permit or an email password. It has to be findable when they come back.
 */
export const metadata: Metadata = {
    title: "Start your website — Tendso",
    description: "Start your Tendso website. About 20 minutes. See it first. Pay once to publish.",
    alternates: { canonical: "/v2/start" },
    robots: { index: false, follow: true },
};

export default function V2StartLayout({ children }: { children: ReactNode }) {
    return <PbRoot>{children}</PbRoot>;
}
