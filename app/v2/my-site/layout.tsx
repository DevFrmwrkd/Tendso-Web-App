import type { Metadata } from "next";
import type { ReactNode } from "react";

import { V2Root } from "@/components/v2";

/** The shop owner's editor: private, behind sign-in, never in search. */
export const metadata: Metadata = {
    title: "Edit my site · Tendso",
    robots: { index: false, follow: false },
};

export default function MySiteLayout({ children }: { children: ReactNode }) {
    return <V2Root>{children}</V2Root>;
}
