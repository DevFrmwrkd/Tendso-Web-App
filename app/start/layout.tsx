import type { Metadata } from "next";

import { WEBSITE_PRICE, formatPHP } from "@/lib/pricing";

/**
 * Exists only to give the funnel its own title and description — the pages
 * themselves are client components, which cannot export metadata.
 *
 * The tab title matters more than usual here: this is a long form on a phone,
 * and the owner will switch away from it to find their business permit or their
 * email password. It has to be findable when they come back.
 *
 * The price is the ordinary one (no campaign), read from lib/pricing like every
 * other figure on the funnel rather than typed into the sentence.
 */
export const metadata: Metadata = {
    title: "Get your website — Tendso",
    description: `Tell us about your business, answer a few questions, and send us photos. We build your website the same day, in about 20 minutes, and email it to you. ${formatPHP(WEBSITE_PRICE)}, or a down payment from ₱500. See it first, pay once to publish.`,
    alternates: { canonical: "/start" },
};

export default function StartLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
