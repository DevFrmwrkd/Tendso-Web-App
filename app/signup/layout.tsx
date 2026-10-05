import type { Metadata } from "next";

/**
 * Exists only to give the page its own tab title: the page is a client
 * component, which cannot export metadata, and without this the tab read the
 * homepage's tagline.
 */
export const metadata: Metadata = {
    title: "Create a creator account — Tendso",
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
