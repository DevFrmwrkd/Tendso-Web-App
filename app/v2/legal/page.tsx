import type { Metadata } from "next";

import { LegalPage } from "@/components/v2/pages-a/LegalPage";

export const metadata: Metadata = {
    title: "Tendso legal",
    description: "Tendso's privacy policy and terms of service.",
    openGraph: { title: "Tendso legal", description: "Tendso's privacy policy and terms of service." },
    twitter: { card: "summary_large_image", title: "Tendso legal", description: "Tendso's privacy policy and terms of service." },
    robots: { index: false, follow: false },
};

export default function Page() {
    return <LegalPage initial="privacy" mode="hash" />;
}
