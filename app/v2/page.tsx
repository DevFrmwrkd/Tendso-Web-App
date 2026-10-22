import type { Metadata } from "next";

import { Landing } from "@/components/landing-v2/Landing";

/**
 * The new landing page (design v2), on a parallel route until Theo approves the
 * swap for `/`. Kept out of search meanwhile so it does not compete with `/`.
 */
const description = "Talk into the app for 10 simple questions, take 10 guided photos, and your website is ready about 20 minutes later. See it first. Pay once to publish: ₱4,999.";

export const metadata: Metadata = {
    title: "Tendso — The thinking ends here.",
    description,
    openGraph: { description },
    twitter: { card: "summary_large_image", description },
    robots: { index: false, follow: false },
    alternates: { canonical: "/" },
};

export default function V2LandingPage() {
    return <Landing />;
}
