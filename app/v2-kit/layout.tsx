import type { Metadata } from "next";
import type { ReactNode } from "react";

import { V2Root } from "@/components/v2";

/**
 * Review page for the Tendso v2 design system. Not linked from anywhere and kept
 * out of search.
 */
export const metadata: Metadata = {
    title: "Tendso v2 kit",
    description: "Tokens and components of the Tendso v2 design system.",
    robots: { index: false, follow: false },
};

export default function V2KitLayout({ children }: { children: ReactNode }) {
    return <V2Root>{children}</V2Root>;
}
