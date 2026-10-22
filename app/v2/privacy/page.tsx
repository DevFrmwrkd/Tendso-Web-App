import type { Metadata } from "next";

import { LegalPage } from "@/components/v2/pages-a/LegalPage";

export const metadata: Metadata = {
    title: "Privacy policy — Tendso",
    description: "Your privacy matters to us. How Tendso collects, uses, and protects your personal information.",
    openGraph: { title: "Privacy policy — Tendso", description: "Your privacy matters to us. How Tendso collects, uses, and protects your personal information." },
    twitter: { card: "summary_large_image", title: "Privacy policy — Tendso", description: "Your privacy matters to us. How Tendso collects, uses, and protects your personal information." },
    robots: { index: false, follow: false },
};

export default function Page() {
    return <LegalPage initial="privacy" mode="path" />;
}
