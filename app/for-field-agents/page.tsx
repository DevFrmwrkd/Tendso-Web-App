import type { Metadata } from "next";
import { AgentsPage } from "@/components/v2/pages-a/AgentsPage";

export const metadata: Metadata = {
    title: "Tendso for field agents",
    description: "Visit shops near you with the Tendso app. About 30 minutes per visit. You set the price, you keep half.",
    alternates: { canonical: "/for-field-agents" },
    robots: { index: true, follow: true },
    openGraph: { type: "website", siteName: "Tendso", locale: "en_PH", url: "/for-field-agents", title: "Tendso for field agents", description: "Visit shops near you with the Tendso app. About 30 minutes per visit. You set the price, you keep half." },
    twitter: { card: "summary_large_image", title: "Tendso for field agents", description: "Visit shops near you with the Tendso app. About 30 minutes per visit. You set the price, you keep half." },
};

/** The redesigned public page, served at its default URL. */
export default function Page() {
    return <AgentsPage />;
}
