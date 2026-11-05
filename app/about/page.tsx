import type { Metadata } from "next";
import { AboutPage } from "@/components/v2/pages-a/AboutPage";

export const metadata: Metadata = {
    title: "About Tendso",
    description: "A mobile app that turns a conversation into a website, and real people who visit the shop.",
    alternates: { canonical: "/about" },
    robots: { index: true, follow: true },
    openGraph: { type: "website", siteName: "Tendso", locale: "en_PH", url: "/about", title: "About Tendso", description: "A mobile app that turns a conversation into a website, and real people who visit the shop." },
    twitter: { card: "summary_large_image", title: "About Tendso", description: "A mobile app that turns a conversation into a website, and real people who visit the shop." },
};

/** The redesigned public page, served at its default URL. */
export default function Page() {
    return <AboutPage />;
}
