import type { Metadata } from "next";
import { loadFeaturedSites } from "@/components/landing/loadFeaturedSites";
import { ExamplesPage } from "@/components/v2/pages-a/ExamplesPage";

export const metadata: Metadata = {
    title: "Tendso examples",
    description: "Browse finished Tendso sites by kind of business. Sample designs, no sign-up.",
    alternates: { canonical: "/examples" },
    robots: { index: true, follow: true },
    openGraph: { type: "website", siteName: "Tendso", locale: "en_PH", url: "/examples", title: "Tendso examples", description: "Browse finished Tendso sites by kind of business. Sample designs, no sign-up." },
    twitter: { card: "summary_large_image", title: "Tendso examples", description: "Browse finished Tendso sites by kind of business. Sample designs, no sign-up." },
};

export const revalidate = 300;
export default async function Page() {
    const featuredSites = await loadFeaturedSites();
    return <ExamplesPage featuredSites={featuredSites} />;
}
