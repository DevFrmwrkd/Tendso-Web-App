import type { Metadata } from "next";
import type { ReactNode } from "react";

import { HelpCenterShell } from "./_components/HelpCenterShell";

export const metadata: Metadata = {
    title: "Help Center — Tendso",
    description: "Guides, answers, and creator playbooks. Search, or ask Tendso AI in plain words.",
};

export default function KnowledgeLayout({ children }: { children: ReactNode }) {
    // The Round 1 frame (app/round1.css via PublicPage): the public header,
    // the footer and the ⌘K palette, shared by /knowledge and every article.
    return <HelpCenterShell>{children}</HelpCenterShell>;
}
