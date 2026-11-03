import type { Metadata } from "next";
import { loadHelp } from "@/app/knowledge/_components/loadHelp";
import { HelpPage } from "@/components/v2/pages-b/HelpPage";
import { helpViewParams, type HelpSearchParams } from "@/app/knowledge/routing";

export const metadata: Metadata = {
    title: "Help — Tendso",
    description: "Short answers about Tendso websites: what it costs, when you pay, and changing your site. Ask Tendso, or ask a person.",
    alternates: { canonical: "/help" },
    robots: { index: true, follow: true },
    openGraph: { type: "website", siteName: "Tendso", locale: "en_PH", url: "/help", title: "Help — Tendso", description: "Short answers about Tendso websites: what it costs, when you pay, and changing your site. Ask Tendso, or ask a person." },
    twitter: { card: "summary_large_image", title: "Help — Tendso", description: "Short answers about Tendso websites: what it costs, when you pay, and changing your site. Ask Tendso, or ask a person." },
};

/** The initial help answers stay in server HTML, including shared search/topic views. */
export default async function Page({ searchParams }: { searchParams: Promise<HelpSearchParams> }) {
    const [initial, params] = await Promise.all([loadHelp(), searchParams]);
    return <HelpPage initial={initial} {...helpViewParams(params)} />;
}
