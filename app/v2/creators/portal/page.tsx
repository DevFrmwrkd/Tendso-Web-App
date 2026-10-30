import type { Metadata } from "next";

import { CreatorsRoot } from "@/components/v2/creators/CreatorsRoot";
import { PortalPage } from "@/components/v2/creators/PortalPage";

export const metadata: Metadata = {
    title: "Your creator portal",
    robots: { index: false, follow: false },
};

export default function CreatorPortalPage() {
    return (
        <CreatorsRoot solo portal>
            <PortalPage />
        </CreatorsRoot>
    );
}
