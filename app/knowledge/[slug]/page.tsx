import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { cache } from "react";

import { api } from "@/convex/_generated/api";
import { JsonLd } from "@/components/JsonLd";
import { knowledgeArticleGraph, abs } from "@/lib/seo";

import { categoryHref, pickRelated, type RelatedItem } from "../_components/model";
import { KnowledgeArticle, type ArticleCrumb } from "../_components/KnowledgeArticle";
import { PrivateKnowledgeArticle } from "../_components/PrivateKnowledgeArticle";

/**
 * SSR per-article Help Center route — the crawlable counterpart to the
 * client app at /knowledge, and the only place a Help Center article opens.
 *
 * Why this exists: AI crawlers (GPTBot, OAI-SearchBot, PerplexityBot, etc.) and
 * Google AI Overviews do NOT execute JavaScript. The /knowledge app is invisible
 * to them. This route emits the full article text + Article/FAQ/Breadcrumb
 * JSON-LD in the initial server HTML, so the corpus becomes citable.
 *
 * It wears the Help Center frame (app/knowledge/layout.tsx) and the board's
 * article view; the feedback, "On this page" and Back are client islands
 * around server-rendered text.
 *
 * Public reads are fresh per request. Private bodies mount only after the
 * client pairs an authorized article response with the active account.
 */
export const dynamic = "force-dynamic";

// One read per render: the metadata and the page both ask for the article.
const getArticle = cache(async (slug: string) => {
    return await fetchQuery(api.knowledge.getArticleBySlug, { slug });
});

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const a = await getArticle(slug);
    if (!a) return { title: "Help article — Tendso", robots: { index: false, follow: false } };
    const url = abs(`/knowledge/${slug}`);
    return {
        title: `${a.title} — Tendso Help Center`,
        description: a.summary,
        keywords: a.keywords,
        alternates: { canonical: url },
        openGraph: {
            type: "article",
            url,
            title: a.title,
            description: a.summary,
            siteName: "Tendso",
            locale: "en_PH",
        },
        twitter: { card: "summary_large_image", title: a.title, description: a.summary },
    };
}

export default async function KnowledgeArticlePage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const a = await getArticle(slug);
    if (!a) return <PrivateKnowledgeArticle slug={slug} />;

    const jsonLd = knowledgeArticleGraph({
        slug: a.slug,
        title: a.title,
        summary: a.summary,
        keywords: a.keywords,
        createdAtMs: a.createdAt,
        updatedAtMs: a.updatedAt,
        // faqs[] not on the article yet (P1.7) — FAQPage stays absent until then.
    });

    // The breadcrumb's topic and the Related cards come from the article's own
    // workspace. Best effort: if Convex fails here the article still renders,
    // just without them.
    let trail: ArticleCrumb[] = [];
    let related: RelatedItem[] = [];
    try {
        const [categories, articles] = await Promise.all([
            fetchQuery(api.knowledge.listCategories, { workspace: a.workspace }),
            fetchQuery(api.knowledge.listArticles, { workspace: a.workspace }),
        ]);
        const category = categories.find((c) => c._id === a.categoryId);
        if (category) trail = [{ label: category.title, href: categoryHref(category) }];
        related = pickRelated(a, articles, categories);
    } catch {
        /* render without the crumb topic and Related */
    }

    return (
        <>
            <JsonLd data={jsonLd} />
            <KnowledgeArticle article={a} trail={trail} related={related} />
        </>
    );
}
