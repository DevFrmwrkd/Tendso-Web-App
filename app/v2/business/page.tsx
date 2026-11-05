import type { Metadata } from "next";

import { BusinessPage } from "@/components/v2/pages-a/BusinessPage";

export const metadata: Metadata = {
    title: "Tendso for businesses",
    description: "Your website, finished before you pay. Talk about your shop, add photos, pick a design. Done in about 20 minutes.",
    openGraph: { title: "Tendso for businesses", description: "Your website, finished before you pay. Talk about your shop, add photos, pick a design. Done in about 20 minutes." },
    twitter: { card: "summary_large_image", title: "Tendso for businesses", description: "Your website, finished before you pay. Talk about your shop, add photos, pick a design. Done in about 20 minutes." },
    alternates: { canonical: "/for-business" },
    robots: { index: false, follow: true },
};

export default function Page() {
    return <BusinessPage />;
}
