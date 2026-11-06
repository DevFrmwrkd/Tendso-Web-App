import type { Metadata } from "next";
import { Suspense } from "react";
import { CreatorsRoot } from "@/components/v2/creators/CreatorsRoot";
import { SignupFlow } from "@/components/v2/creators/SignupFlow";

export const metadata: Metadata = {
    title: "Become an affiliate — Tendso",
    description: "Free to join. Sign in with an email code, then choose your affiliate page and code.",
    alternates: { canonical: "/affiliates/join" },
    robots: { index: false, follow: false },
};

export default function AffiliateJoinPage() {
    return <CreatorsRoot solo><Suspense><SignupFlow /></Suspense></CreatorsRoot>;
}
