import type { Metadata } from "next";
import { Suspense } from "react";

import { CreatorsRoot } from "@/components/v2/creators/CreatorsRoot";
import { SignupFlow } from "@/components/v2/creators/SignupFlow";

export const metadata: Metadata = {
    title: "Become a creator",
    description: "Free to join. No password: we email you a code.",
    robots: { index: false, follow: false },
};

export default function CreatorSignupPage() {
    return (
        <CreatorsRoot solo>
            <Suspense>
                <SignupFlow />
            </Suspense>
        </CreatorsRoot>
    );
}
