import type { Metadata } from "next";

import { AboutPage } from "@/components/v2/pages-a/AboutPage";

export const metadata: Metadata = {
    title: "About Tendso",
    description: "A mobile app that turns a conversation into a website, and real people who visit the shop.",
    robots: { index: false, follow: false },
};

export default function Page() {
    return <AboutPage />;
}
