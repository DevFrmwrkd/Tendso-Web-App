import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
    title: "Tendso",
    description: "A website for your shop, built from your photos and your words in about 20 minutes. See it first. Pay once to publish.",
};

/** /v2/a/<handle> and /v2/a/<handle>/earn: a creator's two links. Each page renders its own CreatorsRoot. */
export default function CreatorLinkLayout({ children }: { children: ReactNode }) {
    return children;
}
