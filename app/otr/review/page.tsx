import type { Metadata } from "next";

import GiveawayReview from "./_components/GiveawayReview";

export const metadata: Metadata = {
    title: "Off the Record · Giveaway review",
    description:
        "Review applications for Off the Record’s free Tendso website giveaway.",
    robots: { index: false, follow: false },
    alternates: { canonical: "/otr/review" },
    openGraph: {
        title: "Off the Record · Giveaway review",
        description: "Review Off the Record’s free website applications.",
        url: "/otr/review",
    },
    twitter: {
        card: "summary",
        title: "Off the Record · Giveaway review",
        description: "Review Off the Record’s free website applications.",
    },
};

export default function GiveawayReviewPage() {
    return <GiveawayReview />;
}
