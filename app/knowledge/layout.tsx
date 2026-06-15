import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Newsreader, Schibsted_Grotesk, JetBrains_Mono } from "next/font/google";
import "./knowledge.css";

// Faithful to the design handoff: Newsreader (serif display), Schibsted Grotesk
// (sans body), JetBrains Mono (kbd/code). Exposed as --font-kb-* and mapped to
// --serif / --sans / --mono inside knowledge.css.
const kbSerif = Newsreader({
    variable: "--font-kb-serif",
    subsets: ["latin"],
    style: ["normal", "italic"],
    weight: ["400", "500", "600"],
    display: "swap",
});
const kbSans = Schibsted_Grotesk({
    variable: "--font-kb-sans",
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    display: "swap",
});
const kbMono = JetBrains_Mono({
    variable: "--font-kb-mono",
    subsets: ["latin"],
    weight: ["400", "500"],
    display: "swap",
});

export const metadata: Metadata = {
    title: "Tendso — Knowledge Base",
    description:
        "Guides, answers, and field-agent playbooks — search or ask Tendso AI in plain words.",
};

export default function KnowledgeLayout({ children }: { children: ReactNode }) {
    return <div className={`tkb ${kbSerif.variable} ${kbSans.variable} ${kbMono.variable}`}>{children}</div>;
}
