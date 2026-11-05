import type { Metadata } from "next";

import { LegalPage } from "@/components/v2/pages-a/LegalPage";

export const metadata: Metadata = {
    title: "Terms of service — Tendso",
    description: "The operational guidelines governing your use of the Tendso Creator Network.",
    openGraph: { title: "Terms of service — Tendso", description: "The operational guidelines governing your use of the Tendso Creator Network." },
    twitter: { card: "summary_large_image", title: "Terms of service — Tendso", description: "The operational guidelines governing your use of the Tendso Creator Network." },
    alternates: { canonical: "/terms-of-service" },
    robots: { index: false, follow: true },
};

export default function Page() {
    return <LegalPage initial="terms" mode="path" />;
}
