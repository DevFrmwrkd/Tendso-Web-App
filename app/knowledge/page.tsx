import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";

import { WikiPage } from "./_components/WikiPage";
import { publicHelpDestination, type HelpSearchParams } from "./routing";

// Public help uses the redesigned /help front. The private wiki keeps its
// access-checked route and uses the same new public-site frame as full articles.

type SearchParams = Promise<HelpSearchParams>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const HOME_DESCRIPTION =
    "Answers about Tendso websites: what they cost, how payment works, and changing your live site. Search, or ask Tendso AI in plain words.";

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
    const sp = await searchParams;
    // The wiki is gated: nothing in it should be indexed.
    if (first(sp.ws) === "wiki") {
        return { title: "Field agent wiki — Tendso", robots: { index: false, follow: true } };
    }
    return { title: "Help — Tendso", description: HOME_DESCRIPTION, alternates: { canonical: "/help" } };
}

export default async function KnowledgePage({ searchParams }: { searchParams: SearchParams }) {
    const sp = await searchParams;
    const destination = publicHelpDestination(sp);
    if (destination) permanentRedirect(destination);
    return <WikiPage />;
}
