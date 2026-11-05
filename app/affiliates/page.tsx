import type { Metadata } from "next";
import { ProgramPage } from "@/components/v2/creators/ProgramPage";

export const metadata: Metadata = {
    title: "Tendso for creators",
    description: "Share Tendso online. Shops save with your code and you keep ₱1,750 per shop. Field agents who join through your link earn you 5% of their sales for 12 months.",
    alternates: { canonical: "/affiliates" },
    robots: { index: true, follow: true },
    openGraph: { type: "website", siteName: "Tendso", locale: "en_PH", url: "/affiliates", title: "Tendso for creators", description: "Share Tendso online. Shops save with your code and you keep ₱1,750 per shop. Field agents who join through your link earn you 5% of their sales for 12 months." },
    twitter: { card: "summary_large_image", title: "Tendso for creators", description: "Share Tendso online. Shops save with your code and you keep ₱1,750 per shop. Field agents who join through your link earn you 5% of their sales for 12 months." },
};

export default function AffiliatesPage() {
    return <ProgramPage />;
}
