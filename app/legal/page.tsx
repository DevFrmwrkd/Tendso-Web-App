import type { Metadata } from "next";
import { LegalPage } from "@/components/v2/pages-a/LegalPage";

export const metadata: Metadata = {
    title: "Tendso legal",
    description: "Tendso's privacy policy and terms of service.",
    alternates: { canonical: "/legal" },
    robots: { index: false, follow: true },
    openGraph: { type: "website", siteName: "Tendso", locale: "en_PH", url: "/legal", title: "Tendso legal", description: "Tendso's privacy policy and terms of service." },
    twitter: { card: "summary_large_image", title: "Tendso legal", description: "Tendso's privacy policy and terms of service." },
};

/** Convenient combined view; dedicated policy and terms pages remain the indexable documents. */
export default function Page() {
    return <LegalPage initial="privacy" mode="hash" />;
}
