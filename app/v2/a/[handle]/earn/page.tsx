import type { Metadata } from "next";

import { CreatorsRoot } from "@/components/v2/creators/CreatorsRoot";
import { EarnLinkPage } from "@/components/v2/creators/EarnLinkPage";

type PageProps = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { handle } = await params;
    return {
        title: "Join the team — Tendso",
        description: "Visit shops near you with the Tendso app. Build their website. Keep half of every sale.",
        alternates: { canonical: `/a/${encodeURIComponent(handle)}/earn` },
        robots: { index: false, follow: true },
    };
}

export default async function EarnLink({ params }: PageProps) {
    const { handle } = await params;
    return (
        <CreatorsRoot solo>
            <EarnLinkPage handle={decodeURIComponent(handle)} />
        </CreatorsRoot>
    );
}
