import type { Metadata } from "next";

import { LanguageProvider } from "@/components/landing/i18n";
import { loadFeaturedSites } from "@/components/landing/loadFeaturedSites";
import { OPERATOR } from "@/lib/contact";
import { BASE_PRICE, COMMISSION_RATE, PRICE_CEILING, formatPHP } from "@/lib/pricing";

import ForCreators from "./_components/ForCreators";

const TITLE = "Get paid to put local shops online — Tendso for creators";
// The same three money facts the page states, and no more (see the Earn
// section): the share, the website price and how low a creator may go. No
// peso earnings, on purpose.
const DESCRIPTION = `Visit a local shop, interview the owner, and keep ${Math.round(
    COMMISSION_RATE * 100,
)}% of every website you sell. A website is ${formatPHP(PRICE_CEILING)}, and you can discount your offer to as low as ${formatPHP(
    BASE_PRICE,
)}. Free to apply, no quota, paid through Wise. Operated by ${OPERATOR}.`;

/**
 * Metadata of its own, which this page never had: as a client component it
 * could not export any, so it inherited the root layout's — the homepage's
 * title and owner price, and a canonical of "/", which told search engines this
 * page was a copy of the homepage. /for-field-agents, which had a title and a
 * canonical of its own, now redirects here, so this page carries them (without
 * the peso earnings that page quoted). The page body is the client component
 * next to it; this file stays a server component so it can export this.
 */
export const metadata: Metadata = {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "/for-creators" },
    openGraph: {
        type: "website",
        siteName: "Tendso",
        locale: "en_PH",
        url: "/for-creators",
        title: TITLE,
        description: DESCRIPTION,
    },
    twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

// Prerendered, refreshed every five minutes like the landing: the curated sites
// are read here so their links are in the HTML (see loadFeaturedSites).
export const revalidate = 300;

/** /for-creators (board: ForCreators). Bilingual: EN/TL through LanguageProvider, copy in components/landing/strings/forCreators.ts. */
export default async function ForCreatorsPage() {
    const featuredSites = await loadFeaturedSites();
    return (
        <LanguageProvider>
            <ForCreators initialSites={featuredSites} />
        </LanguageProvider>
    );
}
