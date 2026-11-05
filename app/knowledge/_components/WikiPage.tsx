"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { Button, Container } from "@/components/v2";
import { PbPage } from "@/components/v2/pages-b/shared";
import { api } from "@/convex/_generated/api";
import { useKnowledgeSession } from "@/components/v2/chat/useKnowledgeSession";

import { KnowledgeArticle } from "./KnowledgeArticle";
import { articleHref, articleMeta, categoryHref, pickRelated } from "./model";

export function WikiPage() {
    return <Suspense fallback={<WikiState title="Opening the field agent wiki…" />}><WikiContent /></Suspense>;
}

function WikiContent() {
    const session = useKnowledgeSession();
    const access = session.ready ? session.viewer?.canAccessWiki : undefined;
    const params = useSearchParams();
    const library = useQuery(api.knowledge.libraryForViewer, access === true ? { workspace: "wiki" } : "skip");
    const paired = session.ready && library?.viewer.clerkId === session.userId && library?.viewer.audience === session.viewer?.audience && library?.viewer.canAccessWiki === true;
    const categories = paired ? library.categories : undefined;
    const articles = paired ? library.articles : undefined;
    if (access === undefined || (access && (!categories || !articles))) return <WikiState title="Opening the field agent wiki…" />;
    if (!access) return <WikiState title="Your field guide, after certification." message="This wiki is for certified field agents and the Tendso team. Sign in with your approved account to read the guides.">
        <Button href="/login?redirect_url=%2Fknowledge%3Fws%3Dwiki">Sign in</Button><Button href="/help" variant="ghost">Go to public help</Button>
    </WikiState>;
    if (!categories || !articles) return null;

    const slug = params.get("article");
    const categorySlug = params.get("cat");
    if (slug) {
        const article = articles.find(item => item.slug === slug);
        if (!article) return <WikiState title="That guide isn’t here." message="It may have moved or is no longer published."><Button href="/knowledge?ws=wiki">All field guides</Button></WikiState>;
        const category = categories.find(item => item._id === article.categoryId);
        return <KnowledgeArticle article={article} wiki trail={category ? [{ label: category.title, href: categoryHref(category) }] : []} related={pickRelated(article, articles, categories)} />;
    }
    const category = categorySlug ? categories.find(item => item.slug === categorySlug) : undefined;
    if (categorySlug && !category) return <WikiState title="That topic isn’t here." message="Browse the field guides to find what you need."><Button href="/knowledge?ws=wiki">All field guides</Button></WikiState>;
    const shown = category ? articles.filter(item => item.categoryId === category._id) : articles;
    return <PbPage nav={{ secondary: <Button href="/help" variant="ghost" size="sm">Public help</Button> }}>
        <Container className="kh-page kh-wiki">
            <header className="kh-wiki-head"><p className="pb-label">For certified field agents</p><h1>{category?.title ?? "Good work starts here."}</h1><p className="kh-lead">{category?.description ?? "Field guides, payout details, and practical answers for your next shop visit."}</p></header>
            <nav className="kh-topic-list" aria-label="Field guide topics"><Link className="pb-fchip" href="/knowledge?ws=wiki" aria-current={!category ? "page" : undefined}>All guides</Link>{categories.map(item => <Link key={item._id} className="pb-fchip" href={categoryHref(item)} aria-current={category?._id === item._id ? "page" : undefined}>{item.title}</Link>)}</nav>
            <section className="kh-guide-list" aria-label="Field guides">{shown.length ? shown.map(article => <Link key={article._id} href={articleHref(article)} className="kh-guide v2-tile v2-tile--quiet"><span className="pb-label">{categories.find(item => item._id === article.categoryId)?.title ?? "Field guide"}</span><h2>{article.title}</h2><p>{article.summary}</p><span className="kh-meta">{articleMeta(article)} <span aria-hidden="true">↗</span></span></Link>) : <p>No guides in this topic yet. Choose another topic, or ask the team.</p>}</section>
        </Container>
    </PbPage>;
}

function WikiState({ title, message, children }: { title: string; message?: string; children?: ReactNode }) {
    return <PbPage><Container className="kh-page kh-state"><p className="pb-label">Field agent wiki</p><h1>{title}</h1>{message && <p className="kh-lead">{message}</p>}<div className="kh-actions">{children}</div></Container></PbPage>;
}
