import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { cache } from "react";

import { api } from "@/convex/_generated/api";
import { JsonLd } from "@/components/JsonLd";
import { knowledgeArticleGraph, abs } from "@/lib/seo";

import { categoryHref, pickRelated, type RelatedItem } from "../_components/model";
import { ArticleLayout, type Crumb } from "../_components/views";

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
 * ISR: revalidate hourly so edited articles refresh without a redeploy.
 */
export const revalidate = 3600;

// One read per render: the metadata and the page both ask for the article.
const getArticle = cache(async (slug: string) => {
    return await fetchQuery(api.knowledge.getArticleBySlug, { slug });
});

export async function generateStaticParams() {
    // Best-effort prerender list. If Convex is unreachable at build time (or the
    // function isn't deployed yet), return [] — pages still render on demand via
    // ISR (dynamicParams defaults to true), so the build never hard-fails on it.
    try {
        const slugs = await fetchQuery(api.knowledge.listPublishedHelpSlugs, {});
        return slugs.map((s) => ({ slug: s.slug }));
    } catch {
        return [];
    }
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const a = await getArticle(slug);
    if (!a) return { title: "Article not found — Tendso Help Center" };
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
    if (!a) notFound();

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
    let trail: Crumb[] = [];
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
            <ArticleLayout article={a} trail={trail} backHref={trail[0]?.href ?? "/knowledge"} related={related} />
        </>
    );
}
