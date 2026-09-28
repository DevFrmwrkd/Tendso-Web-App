import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./knowledge.css";


export const metadata: Metadata = {
    title: "Tendso — Knowledge Base",
    description:
        "Guides, answers, and field-agent playbooks — search or ask Tendso AI in plain words.",
};

export default function KnowledgeLayout({ children }: { children: ReactNode }) {
    // Fonts come from app/self-hosted-fonts.css (--font-kb-*), imported by the
    // root layout. knowledge.css maps them to --serif / --sans / --mono.
    return <div className="tkb">{children}</div>;
}
