import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";

import KnowledgeApp from "./_components/KnowledgeApp";
import { loadHelp } from "./_components/loadHelp";

// The Tendso Help Center (board: HelpCenter), rebuilt in the Round 1 look.
// Two workspaces (the public Help Center + the creator wiki, gated to
// certified creators), a ⌘K command palette, and grounded "Tendso AI" answers
// (Convex + Gemini RAG). The views live in ./_components/KnowledgeApp; the
// frame (header, footer, palette) is ./layout.tsx.
//
// Rendered per request: it reads its query, both to redirect old article links
// and so a shared ?cat= link arrives as that topic, not as the home.

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const HOME_DESCRIPTION =
    "Answers about Tendso websites: what they cost, how payment works, and changing your live site. Search, or ask Tendso AI in plain words.";

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
    const sp = await searchParams;
    // The wiki is gated: nothing in it should be indexed.
    if (first(sp.ws) === "wiki") {
        return { title: "Creator wiki — Tendso Help Center", robots: { index: false, follow: true } };
    }
    const cat = first(sp.cat);
    if (cat) {
        const c = (await loadHelp())?.categories.find((x) => x.slug === cat);
        if (c) {
            return {
                title: `${c.title} — Tendso Help Center`,
                description: c.description,
                alternates: { canonical: `/knowledge?cat=${encodeURIComponent(c.slug)}` },
            };
        }
    }
    return { title: "Help Center — Tendso", description: HOME_DESCRIPTION, alternates: { canonical: "/knowledge" } };
}

export default async function KnowledgePage({ searchParams }: { searchParams: SearchParams }) {
    const sp = await searchParams;
    const article = first(sp.article);
    // Before the redesign a Help Center article opened inside this page as
    // ?ws=help&article=<slug>, and those links are still out there: the landing
    // ChatBot, Tendso AI escalations and Discord replies build them. The article
    // is its own crawlable page now, so send them there for good, keeping any
    // other tags. Wiki articles stay in here (?ws=wiki&article=): only the
    // browser knows whether the reader may see them.
    if (article && first(sp.ws) !== "wiki") {
        const rest = new URLSearchParams();
        for (const [k, v] of Object.entries(sp)) {
            if (k === "article" || k === "ws" || k === "cat" || v === undefined) continue;
            for (const one of Array.isArray(v) ? v : [v]) rest.append(k, one);
        }
        const qs = rest.toString();
        permanentRedirect(`/knowledge/${encodeURIComponent(article)}${qs ? `?${qs}` : ""}`);
    }

    return <KnowledgeApp initial={await loadHelp()} />;
}
