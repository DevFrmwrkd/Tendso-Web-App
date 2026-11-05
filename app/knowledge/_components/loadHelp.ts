import { fetchQuery } from "convex/nextjs";
import { cache } from "react";

import { api } from "@/convex/_generated/api";

import type { ArticleCard, InitialHelp } from "./types";

/*
 * The public Help Center (categories, articles, FAQs) read on the server, so
 * /knowledge arrives with its topics, popular articles and FAQs in the HTML:
 * readable by crawlers and on screen before the live Convex queries connect.
 * Server only (app/knowledge/page.tsx).
 *
 * Read anonymously per request so a newly restricted article disappears from
 * public HTML immediately. Bodies are dropped: a
 * list never shows one (an article has its own page), and they would make up
 * most of the payload.
 */

const fetchHelp = async (): Promise<InitialHelp> => {
        const [categories, articles, faqs] = await Promise.all([
            fetchQuery(api.knowledge.listCategories, { workspace: "help" }),
            fetchQuery(api.knowledge.listArticles, { workspace: "help" }),
            fetchQuery(api.knowledge.listFaqs, { workspace: "help" }),
        ]);
        const cards: ArticleCard[] = articles.map((a) => {
            const { body, ...card } = a;
            void body;
            return card;
        });
        return { categories, articles: cards, faqs };
};

/** null when Convex cannot be reached: the page still renders and the client loads it live. */
export const loadHelp = cache(async (): Promise<InitialHelp | null> => {
    try {
        return await fetchHelp();
    } catch {
        return null;
    }
});
