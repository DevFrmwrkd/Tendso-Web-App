import type { Metadata } from "next";
import type { ReactNode } from "react";

import { PbRoot } from "@/components/v2/pages-b/PbRoot";

/** The token in the path is the credential, so a payment link is never indexed. */
export const metadata: Metadata = {
    title: "Pay for your website — Tendso",
    robots: { index: false, follow: false },
};

export default function V2PayLayout({ children }: { children: ReactNode }) {
    return <PbRoot>{children}</PbRoot>;
}
