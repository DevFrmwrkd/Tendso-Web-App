import type { Metadata } from "next";

import { STANDARD_PRICE, formatPHP } from "@/lib/pricing";

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
    description: `Tell us about your business, answer a few questions, and send us photos. We build your website and email it to you within 48–72 hours. ${formatPHP(STANDARD_PRICE)} one-time, paid only when it's live.`,
    alternates: { canonical: "/start" },
};

export default function StartLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
