import Link from "next/link";
import { Fragment } from "react";

import { Button, Container } from "@/components/v2";
import { PbPage } from "@/components/v2/pages-b/shared";

import { KnowledgeArticleActions } from "./KnowledgeArticleActions";
import { articleMeta, headingsOf, slugifyHeading, type RelatedItem } from "./model";
import type { Block } from "./types";

export type ArticleCrumb = { label: string; href: string };
type Article = { slug: string; title: string; summary: string; author: string; updatedAt: number; readMin: number; body: Block[] };

/** The same server-rendered article body in the new public site's frame. */
export function KnowledgeArticle({ article, trail = [], related = [], wiki = false }: {
    article: Article;
    trail?: ArticleCrumb[];
    related?: RelatedItem[];
    wiki?: boolean;
}) {
    const headings = headingsOf(article.body);
    const home = wiki ? "/knowledge?ws=wiki" : "/help";
    return (
        <PbPage nav={{ secondary: <Button href="/help#contact" variant="ghost" size="sm">Ask a person</Button> }}>
            <Container className="kh-page">
                <nav className="kh-breadcrumb" aria-label="Breadcrumb">
                    <Link href={home}>{wiki ? "Field agent wiki" : "Help"}</Link>
                    {trail.map(crumb => <Fragment key={crumb.href}><span aria-hidden="true">/</span><Link href={crumb.href}>{crumb.label}</Link></Fragment>)}
                </nav>
                <div className="kh-article-grid">
                    <article className="kh-article">
                        <header className="kh-article-head">
                            <p className="pb-label">{wiki ? "Field guide" : "The full answer"}</p>
                            <h1>{article.title}</h1>
                            <p className="kh-lead">{article.summary}</p>
                            <p className="kh-meta">{articleMeta(article)}</p>
                        </header>
                        <div className="kh-prose"><KnowledgeBody blocks={article.body} /></div>
                        <KnowledgeArticleActions key={article.slug} slug={article.slug} />
                        {related.length > 0 && <section className="kh-related" aria-labelledby="kh-related-title">
                            <p className="pb-label" id="kh-related-title">Keep reading</p>
                            <div className="kh-related-grid">{related.map(item => <Link className="v2-tile v2-tile--quiet kh-related-card" key={item.key} href={item.href}>
                                <span className="kh-meta">{item.label}</span><h2>{item.title}</h2><span className="kh-meta">{item.readMin} min read <span aria-hidden="true">↗</span></span>
                            </Link>)}</div>
                        </section>}
                    </article>
                    {headings.length > 0 && <aside className="kh-toc" aria-label="On this page">
                        <p className="pb-label">On this page</p>
                        {headings.map(heading => <a href={`#${heading.id}`} key={heading.id}>{heading.text}</a>)}
                        <Button href={home} variant="ghost" size="sm">All {wiki ? "field guides" : "answers"}</Button>
                    </aside>}
                </div>
            </Container>
        </PbPage>
    );
}

function KnowledgeBody({ blocks }: { blocks: Block[] }) {
    return blocks.map((block, index) => {
        switch (block.t) {
            case "p": return <p key={index}>{block.text}</p>;
            case "h2": return <h2 key={index} id={slugifyHeading(block.text)}>{block.text}</h2>;
            case "ul": return <ul key={index}>{block.items.map((text, i) => <li key={i}>{text}</li>)}</ul>;
            case "ol": return <ol key={index}>{block.items.map((text, i) => <li key={i}>{text}</li>)}</ol>;
            case "callout": return <div key={index} className="kh-callout" role="note">{block.kind === "warn" && <strong>Important</strong>}<p>{block.text}</p></div>;
            case "code": return <pre key={index}><code>{block.text}</code></pre>;
            case "quote": return <blockquote key={index}><p>{block.text}</p><cite>{block.who}</cite></blockquote>;
            case "image": return <figure key={index}><figcaption>{block.caption}</figcaption></figure>;
            default: return null;
        }
    });
}
