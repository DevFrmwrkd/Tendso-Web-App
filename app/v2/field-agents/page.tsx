import type { Metadata } from "next";

import { AgentsPage } from "@/components/v2/pages-a/AgentsPage";

export const metadata: Metadata = {
    title: "Tendso for field agents",
    description: "Visit shops near you with the Tendso app. About 30 minutes per visit. You set the price, you keep half.",
    robots: { index: false, follow: false },
};

export default function Page() {
    return <AgentsPage />;
}
