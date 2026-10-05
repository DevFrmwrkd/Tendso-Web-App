import type { Metadata } from "next";

/**
 * Exists only to give the owner's pages their own tab title (the pages are
 * client components, which cannot export metadata). Without it the tab reads
 * the homepage's marketing title. Kept out of search: these are private pages
 * behind sign-in.
 */
export const metadata: Metadata = {
    title: "My website — Tendso",
    robots: { index: false, follow: false },
};

export default function MyBusinessLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
