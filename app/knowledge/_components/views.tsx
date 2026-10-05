import { ChevronRight } from "lucide-react";
import { Fragment, type ReactNode } from "react";

import { Icon } from "@/components/r1";

import { ArticleFeedback, ArticleToc, BackButton, RecentMark } from "./ArticleParts";
import { HcLink } from "./HcLink";
import { articleMeta, headingsOf, slugifyHeading, type RelatedItem } from "./model";
import type { Block } from "./types";

/*
 * Server-safe Help Center pieces: no hooks, no browser. The crawlable article
 * route renders them on the server, and the client app renders the same ones
 * for a wiki article, so both look alike. Interactive parts are client islands
 * from ./ArticleParts.
 */

// ---------------- Article body ----------------
// The typed kbBlock body from convex/schema.ts. Keep the two in step.

const PROSE = "text-[15px] leading-6 text-r1-ink-2";

function BlockView({ b }: { b: Block }) {
    switch (b.t) {
        case "p":
            return <p className={PROSE}>{b.text}</p>;
        case "h2":
            // scroll-mt clears the sticky header when a #link or "On this page" jumps here.
            return (
                <h2 id={slugifyHeading(b.text)} className="t-h2 scroll-mt-24 pt-2">
                    {b.text}
                </h2>
            );
        case "ul":
            return (
                <ul className={`${PROSE} list-disc space-y-2 pl-[22px] marker:text-r1-ink-3`}>
                    {b.items.map((x, i) => (
                        <li key={i}>{x}</li>
                    ))}
                </ul>
            );
        case "ol":
            return (
                <ol className={`${PROSE} list-decimal space-y-2 pl-[22px] marker:text-r1-ink-3`}>
                    {b.items.map((x, i) => (
                        <li key={i}>{x}</li>
                    ))}
                </ol>
            );
        case "callout":
            return (
                <div role="note" className={`${PROSE} flex flex-col gap-1 rounded-r1-card bg-r1-fill-2 px-[18px] py-4`}>
                    {b.kind === "warn" && <span className="t-label t-hl-label">Important</span>}
                    {b.text}
                </div>
            );
        case "code":
            return (
                <pre className="overflow-x-auto rounded-r1 bg-r1-fill-2 px-4 py-3 font-r1-mono text-[13px] leading-5 text-r1-ink">
                    <code>
                        {b.text.split("\n").map((ln, i) => (
                            <span key={i} className={ln.trim().startsWith("#") ? "block text-r1-ink-3" : "block"}>
                                {ln || " "}
                            </span>
                        ))}
                    </code>
                </pre>
            );
        case "quote":
            return (
                <blockquote className="flex flex-col gap-1 border-l-2 border-r1-line-2 pl-4">
                    <p className={PROSE}>&ldquo;{b.text}&rdquo;</p>
                    <cite className="t-meta not-italic">{b.who}</cite>
                </blockquote>
            );
        case "image":
            // The content model carries only the caption, never an image file.
            return (
                <figure>
                    <figcaption className="t-meta">{b.caption}</figcaption>
                </figure>
            );
        default:
            return null;
    }
}

export function ArticleBody({ blocks }: { blocks: Block[] }) {
    return (
        <>
            {blocks.map((b, i) => (
                <BlockView key={i} b={b} />
            ))}
        </>
    );
}

// ---------------- Breadcrumb ----------------

export type Crumb = { label: string; href: string };

const CRUMB_LINK = "inline-flex h-10 shrink-0 items-center rounded-r1 px-2.5 text-[13px] text-r1-ink-2 hover:bg-r1-fill hover:text-r1-ink";

/** Back | Help Center › … › current. Back walks the reader's own history (see BackButton). */
export function Crumbs({ backHref, trail, current }: { backHref: string; trail: Crumb[]; current?: string }) {
    return (
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-[13px] text-r1-ink-3">
            <BackButton fallbackHref={backHref} />
            <span className="mx-1 h-5 w-px shrink-0 bg-r1-line sm:mx-2" aria-hidden="true" />
            <HcLink href="/knowledge" className={CRUMB_LINK}>
                Help Center
            </HcLink>
            {trail.map((c) => (
                <Fragment key={c.href}>
                    <Chevron />
                    <HcLink href={c.href} className={`${CRUMB_LINK} min-w-0 shrink`}>
                        <span className="truncate">{c.label}</span>
                    </HcLink>
                </Fragment>
            ))}
            {current && (
                <>
                    <Chevron />
                    <span aria-current="page" className="min-w-0 truncate px-2.5 text-r1-ink">
                        {current}
                    </span>
                </>
            )}
        </nav>
    );
}

function Chevron() {
    return (
        <span className="flex shrink-0 text-r1-ink-4">
            <Icon icon={ChevronRight} size={14} />
        </span>
    );
}

// ---------------- Article page ----------------

export type ArticleView = {
    slug: string;
    title: string;
    summary: string;
    author: string;
    updatedAt: number;
    readMin: number;
    body: Block[];
};

/** Right-hand rail (topics on a category page, "On this page" on an article). Below the content on a phone. */
export function Rail({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
    return (
        <div className={`flex flex-col gap-2 ${className ?? ""}`}>
            <p className="t-label px-3">{label}</p>
            {children}
        </div>
    );
}

/** An article: the board's article view. Used by the crawlable route and by the wiki inside the client app. */
export function ArticleLayout({
    article,
    trail,
    backHref,
    related,
}: {
    article: ArticleView;
    trail: Crumb[];
    backHref: string;
    related: RelatedItem[];
}) {
    const headings = headingsOf(article.body);
    return (
        <div className="flex flex-col gap-6">
            <Crumbs backHref={backHref} trail={trail} />
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start lg:gap-16">
                <article className="flex min-w-0 flex-col gap-8">
                    <header className="flex max-w-[680px] flex-col gap-3">
                        <h1 className="t-h1">{article.title}</h1>
                        {/* Answer-first lead: the summary doubles as the extractable answer for AI engines. */}
                        <p className="t-sub">{article.summary}</p>
                        <p className="t-meta">{articleMeta(article)}</p>
                    </header>
                    <hr className="t-divider w-full max-w-[680px]" />
                    <div className="flex max-w-[680px] flex-col gap-4">
                        <ArticleBody blocks={article.body} />
                    </div>
                    <ArticleFeedback key={article.slug} slug={article.slug} />
                    {related.length > 0 && <RelatedSection items={related} />}
                    <RecentMark slug={article.slug} />
                </article>
                {headings.length > 0 && (
                    // On a phone the reader is already in the text; the jump list is a desk aid.
                    <aside className="max-lg:hidden lg:sticky lg:top-24">
                        <Rail label="On this page">
                            <ArticleToc key={article.slug} headings={headings} />
                        </Rail>
                    </aside>
                )}
            </div>
        </div>
    );
}

function RelatedSection({ items }: { items: RelatedItem[] }) {
    return (
        <section aria-labelledby="hc-related-h" className="flex flex-col gap-4">
            <h2 id="hc-related-h" className="t-h2">
                Related
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                {items.map((r) => (
                    <HcLink
                        key={r.key}
                        href={r.href}
                        className="flex min-w-0 flex-col items-start gap-1.5 rounded-r1-card border border-r1-line bg-r1-paper p-4 text-left hover:bg-r1-fill-row sm:min-h-28"
                    >
                        <span className="t-label">{r.label}</span>
                        <span className="text-sm font-medium leading-5 text-r1-ink">{r.title}</span>
                        <span className="mt-auto pt-1 text-xs leading-4 text-r1-ink-3">{r.readMin} min read</span>
                    </HcLink>
                ))}
            </div>
        </section>
    );
}
