import type { Metadata } from "next";

/**
 * The page itself is a client component, which cannot export metadata, and this
 * one needs it more than most: the link is shared in a video description and in
 * comments, where the preview card is the only thing most people see.
 */
export const metadata: Metadata = {
    title: "OTR viewers: 30% off your website — Tendso",
    description:
        "Scanned the code on Off The Record? Your business gets a real website for ₱699 instead of ₱999, paid once after it is live. No monthly fees.",
    alternates: { canonical: "/otr" },
};

export default function OtrLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
