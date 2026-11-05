import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
    title: "Your creator portal — Tendso",
    alternates: { canonical: "/affiliates/dashboard" },
    robots: { index: false, follow: false },
};

/** Home has the portal's own verified session gate; settings pages use the shared affiliate boundary. */
export default function AffiliateDashboardLayout({ children }: { children: ReactNode }) {
    return children;
}
