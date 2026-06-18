import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { JsonLd } from "@/components/JsonLd";
import { knowledgeArticleGraph, abs } from "@/lib/seo";

/**
 * SSR per-article Knowledge Base route — the crawlable counterpart to the
 * client SPA at /knowledge.
 *
 * Why this exists: AI crawlers (GPTBot, OAI-SearchBot, PerplexityBot, etc.) and
 * Google AI Overviews do NOT execute JavaScript. The /knowledge SPA is invisible
 * to them. This route emits the full article text + Article/FAQ/Breadcrumb
 * JSON-LD in the initial server HTML, so the corpus becomes citable.
 *
 * ISR: revalidate hourly so edited articles refresh without a redeploy.
 */
export const revalidate = 3600;

type Block = NonNullable<Awaited<ReturnType<typeof getArticle>>>["body"][number];

async function getArticle(slug: string) {
    return await fetchQuery(api.knowledge.getArticleBySlug, { slug });
}

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
    if (!a) return { title: "Article not found — Tendso Knowledge Base" };
    const url = abs(`/knowledge/${slug}`);
    return {
        title: `${a.title} — Tendso Knowledge Base`,
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

function slugifyHeading(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** Server-safe renderer for the typed kbBlock body (mirrors the SPA's BlockView). */
function BlockView({ b }: { b: Block }) {
    switch (b.t) {
        case "p":
            return <p>{b.text}</p>;
        case "h2":
            return <h2 id={slugifyHeading(b.text)}>{b.text}</h2>;
        case "ul":
            return <ul>{b.items.map((x, i) => <li key={i}>{x}</li>)}</ul>;
        case "ol":
            return <ol>{b.items.map((x, i) => <li key={i}>{x}</li>)}</ol>;
        case "callout":
            return (
                <div className={"kb-callout " + b.kind} role="note">
                    {b.text}
                </div>
            );
        case "code":
            return <pre><code>{b.text}</code></pre>;
        case "quote":
            return (
                <blockquote>
                    <p>&ldquo;{b.text}&rdquo;</p>
                    <cite>{b.who}</cite>
                </blockquote>
            );
        case "image":
            return <figure><figcaption>{b.caption}</figcaption></figure>;
        default:
            return null;
    }
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

    return (
        <main className="mx-auto max-w-3xl px-6 py-12">
            <JsonLd data={jsonLd} />

            <nav aria-label="Breadcrumb" className="text-sm text-gray-500 mb-6">
                <Link href="/" className="hover:underline">Home</Link>
                {" / "}
                <Link href="/knowledge" className="hover:underline">Knowledge Base</Link>
                {" / "}
                <span className="text-gray-700">{a.title}</span>
            </nav>

            <article>
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">{a.title}</h1>
                    {/* Answer-first lead: the summary doubles as the extractable answer for AI engines. */}
                    <p className="text-lg text-gray-600 mt-3">{a.summary}</p>
                    <p className="text-xs text-gray-400 mt-2">
                        {a.readMin} min read · Updated {new Date(a.updatedAt).toLocaleDateString("en-PH")}
                    </p>
                </header>

                <div className="kb-article-body prose prose-neutral max-w-none">
                    {a.body.map((b, i) => (
                        <BlockView key={i} b={b} />
                    ))}
                </div>
            </article>

            <footer className="mt-12 pt-6 border-t border-gray-100">
                <Link href="/knowledge" className="text-amber-600 hover:underline">
                    ← Back to the Knowledge Base
                </Link>
            </footer>
        </main>
    );
}
