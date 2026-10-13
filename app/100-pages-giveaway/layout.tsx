import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
    title: "Off the Record: 100 free Tendso websites",
    description: "Off the Record is giving its community 100 free Tendso websites. Hang an Off the Record poster in your business, send a photo, and apply while slots remain.",
    alternates: { canonical: "/100-pages-giveaway" },
    openGraph: {
        type: "website",
        siteName: "Off the Record",
        title: "Off the Record is giving 100 businesses a free Tendso website",
        description: "A one-time gift from Off the Record to its community. Hang the OTR poster, submit proof, and get a free Tendso website if eligible.",
        url: "/100-pages-giveaway",
    },
    twitter: {
        card: "summary",
        title: "Off the Record: 100 free Tendso websites",
        description: "Hang an Off the Record poster in your business and apply for a free Tendso website. One-time giveaway for the first 100 eligible businesses.",
    },
};

export default function GiveawayLayout({ children }: { children: ReactNode }) {
    return children;
}
