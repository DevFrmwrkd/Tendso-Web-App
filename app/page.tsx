import type { Metadata } from "next";
import { Landing } from "@/components/landing-v2/Landing";

const title = "Tendso — The thinking ends here.";
const description = "Talk into the app for 10 simple questions, take 10 guided photos, and your website is ready about 20 minutes later. See it first. Pay once to publish: ₱4,999.";

export const metadata: Metadata = {
    title,
    description,
    alternates: { canonical: "/" },
    robots: { index: true, follow: true },
    openGraph: { type: "website", siteName: "Tendso", locale: "en_PH", url: "/", title, description },
    twitter: { card: "summary_large_image", title, description },
};

/** The approved landing design is the public homepage. /v2 remains a compatible alias. */
export default function Home() {
    return <Landing />;
}
