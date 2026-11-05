import type { Metadata } from "next";
import type { ReactNode } from "react";

import { PbRoot } from "@/components/v2/pages-b/PbRoot";

import "./knowledge.css";

export const metadata: Metadata = {
    title: "Help Center — Tendso",
    description: "Guides, answers, and creator playbooks. Search, or ask Tendso AI in plain words.",
};

export default function KnowledgeLayout({ children }: { children: ReactNode }) {
    return <PbRoot>{children}</PbRoot>;
}
