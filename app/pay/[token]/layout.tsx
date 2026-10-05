import type { Metadata } from "next";

/**
 * Exists for the page's metadata (the page is a client component, which cannot
 * export it):
 *  - a tab title the owner can find again after switching to their bank or
 *    Wise app, instead of the homepage's marketing title;
 *  - noindex: the token in the path is the credential (see proxy.ts), so a
 *    payment link must never end up in search results.
 */
export const metadata: Metadata = {
    title: "Pay for your website — Tendso",
    robots: { index: false, follow: false },
};

export default function PayLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
