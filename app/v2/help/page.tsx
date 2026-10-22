import type { Metadata } from "next";

import { loadHelp } from "@/app/knowledge/_components/loadHelp";
import { HelpPage } from "@/components/v2/pages-b/HelpPage";

export const metadata: Metadata = {
    title: "Help — Tendso",
    description: "Short answers about Tendso websites: what it costs, when you pay, and changing your site. Ask Tendso, or ask a person.",
    alternates: { canonical: "/v2/help" },
    robots: { index: false, follow: true },
};

/**
 * The new Help front (it replaces /knowledge as the place people land; the
 * existing /knowledge routes keep working). The Help Center lists are read on the
 * server so the page arrives with its topics and answers already in the HTML.
 */
export default async function V2HelpPage() {
    const initial = await loadHelp();
    return <HelpPage initial={initial} />;
}
