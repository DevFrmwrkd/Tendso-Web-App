import type { Metadata } from "next";

import { loadFeaturedSites } from "@/components/landing/loadFeaturedSites";
import { ExamplesPage } from "@/components/v2/pages-a/ExamplesPage";

export const metadata: Metadata = {
    title: "Tendso examples",
    description: "Browse finished Tendso sites by kind of business. Sample designs, no sign-up.",
    robots: { index: false, follow: false },
};

// The real-sites strip reads the admin's Featured sites; loadFeaturedSites caches for five minutes.
export const revalidate = 300;

export default async function Page() {
    const featuredSites = await loadFeaturedSites();
    return <ExamplesPage featuredSites={featuredSites} />;
}
