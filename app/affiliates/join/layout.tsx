import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Create an affiliate account — Tendso",
    robots: { index: false, follow: false },
};

export default function AffiliateJoinLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
