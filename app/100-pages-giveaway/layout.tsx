import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
    title: "100 free websites for business owners | Tendso",
    description: "Print our poster, hang it in your walk-in business, and apply. The first 100 eligible business owners get a free website with a Tendso web address.",
    alternates: { canonical: "/100-pages-giveaway" },
    openGraph: {
        title: "We're giving away more than ₱300,000 in websites | Tendso",
        description: "A free website for the first 100 eligible walk-in businesses. Download the poster and apply while slots last.",
        url: "/100-pages-giveaway",
    },
};

export default function GiveawayLayout({ children }: { children: ReactNode }) {
    return children;
}
