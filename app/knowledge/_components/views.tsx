"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Icon } from "./Icon";
import { Hi } from "./Highlight";
import { AnswerCard } from "./AnswerCard";
import { searchArticles } from "./search";
import type { Article, Block, Category, Faq, Workspace } from "./types";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDate(ts: number) {
    const d = new Date(ts);
    return `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
function slugify(t: string) {
    return t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export type Data = { articles: Article[]; categories: Category[]; faqs: Faq[] };

const catOf = (id: string, cats: Category[]) => cats.find((c) => c._id === id);
const artsIn = (catId: string, arts: Article[]) => arts.filter((a) => a.categoryId === catId);

function Breadcrumb({ items }: { items: { label: string; onClick?: () => void }[] }) {
    return (
        <nav className="crumb">
            {items.map((it, i) => (
                <Fragment key={i}>
                    {i > 0 && (
                        <span className="sep">
                            <Icon name="chevRight" size={13} />
                        </span>
                    )}
                    {it.onClick ? (
                        <a
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                it.onClick!();
                            }}
                        >
                            {it.label}
                        </a>
                    ) : (
                        <span className="cur">{it.label}</span>
                    )}
                </Fragment>
            ))}
        </nav>
    );
}

// ---------------- HOME ----------------
export function Home({
    workspace,
    data,
    openPalette,
    onOpenCategory,
    onOpenArticle,
}: {
    workspace: Workspace;
    data: Data;
    openPalette: (seed?: string) => void;
    onOpenCategory: (c: Category) => void;
    onOpenArticle: (a: Article) => void;
}) {
    const cats = data.categories;
    const popular = data.articles.filter((a) => a.popular).slice(0, 5);
    const faqs = data.faqs;
    const [openF, setOpenF] = useState<string | null>(null);

    const suggests: [string, string][] =
        workspace === "help"
            ? [
                  ["How much does a website cost?", "card"],
                  ["What happens in the interview?", "book"],
                  ["How fast can it go live?", "clock"],
                  ["Is my information safe?", "shield"],
              ]
            : [
                  ["How do payouts work?", "card"],
                  ["The 12-shot photo list", "palette"],
                  ["Claim a prospect", "chart"],
                  ["Raise my price ceiling", "star"],
              ];

    return (
        <div className="view-enter">
            <section className="hero">
                <div className="wrap">
                    <div className="eyebrow">
                        <span className="dot" /> <span>Tendso {workspace === "help" ? "Help Center" : "Internal Wiki"}</span>
                    </div>
                    <h1>
                        {workspace === "help" ? (
                            <>
                                How can we <em>help</em>?
                            </>
                        ) : (
                            <>
                                Find what you <em>need</em>.
                            </>
                        )}
                    </h1>
                    <p className="sub">
                        {workspace === "help"
                            ? "Search guides, answers, and policies — or ask a question in plain words and let Tendso AI find it."
                            : "Runbooks, playbooks, and field guides for creators. Ask anything; we'll search the wiki for you."}
                    </p>
                    <div
                        className="bigsearch"
                        onClick={() => openPalette("")}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openPalette("")}
                    >
                        <span className="si">
                            <Icon name="search" size={22} />
                        </span>
                        <span className="ph">Search or ask a question…</span>
                        <span className="go">
                            <span className="kbd-row">
                                <span className="kbd">⌘</span>
                                <span className="kbd">K</span>
                            </span>
                        </span>
                    </div>
                    <div className="suggests">
                        <span className="lbl">Popular:</span>
                        {suggests.map(([q, ic]) => (
                            <button key={q} className="chip" onClick={() => openPalette(q)}>
                                <span className="ic">
                                    <Icon name={ic} size={15} />
                                </span>
                                {q}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <section className="section">
                <div className="wrap">
                    <div className="section-head">
                        <h2>Browse by topic</h2>
                        <span className="meta">
                            {cats.length} categor{cats.length === 1 ? "y" : "ies"}
                        </span>
                    </div>
                    <div className="cat-grid">
                        {cats.map((c) => {
                            const n = artsIn(c._id, data.articles).length;
                            return (
                                <button key={c._id} className="cat-card" data-hue={c.hue} onClick={() => onOpenCategory(c)}>
                                    <span className="cat-ico">
                                        <Icon name={c.icon} size={22} />
                                    </span>
                                    <h3>{c.title}</h3>
                                    <p>{c.description}</p>
                                    <span className="count">
                                        {n} article{n !== 1 ? "s" : ""}
                                        <span className="arrow">
                                            <Icon name="arrowUR" size={15} />
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="section">
                <div className="wrap">
                    <div className="two-col">
                        <div>
                            <div className="section-head">
                                <h2>Popular articles</h2>
                            </div>
                            <div className="alist">
                                {popular.map((a) => {
                                    const c = catOf(a.categoryId, data.categories);
                                    return (
                                        <button key={a._id} className="arow" data-hue={c?.hue} onClick={() => onOpenArticle(a)}>
                                            <span className="ar-ico">
                                                <Icon name={c?.icon ?? "doc"} size={18} />
                                            </span>
                                            <span className="ar-main">
                                                <h4>{a.title}</h4>
                                                <p>{a.summary}</p>
                                            </span>
                                            <span className="ar-meta">{a.readMin} min</span>
                                            <span className="ar-go">
                                                <Icon name="chevRight" size={18} />
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div>
                            <div className="section-head">
                                <h2>Frequently asked</h2>
                            </div>
                            <div className="faq-list">
                                {faqs.map((f) => (
                                    <div key={f._id} className={"faq-item" + (openF === f._id ? " open" : "")}>
                                        <button className="faq-q" onClick={() => setOpenF(openF === f._id ? null : f._id)}>
                                            {f.question}
                                            <span className="qi">
                                                <Icon name="chevDown" size={18} />
                                            </span>
                                        </button>
                                        <div className="faq-a">
                                            <p>
                                                {f.answer}{" "}
                                                {f.linkArticleSlug && (
                                                    <a
                                                        href="#"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            const a = data.articles.find((x) => x.slug === f.linkArticleSlug);
                                                            if (a) onOpenArticle(a);
                                                        }}
                                                    >
                                                        Read more →
                                                    </a>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}

// ---------------- CATEGORY ----------------
export function CategoryPage({
    category,
    workspace,
    data,
    onOpenArticle,
    onOpenCategory,
    goHome,
}: {
    category: Category;
    workspace: Workspace;
    data: Data;
    onOpenArticle: (a: Article) => void;
    onOpenCategory: (c: Category) => void;
    goHome: () => void;
}) {
    const arts = artsIn(category._id, data.articles);
    const others = data.categories.filter((c) => c._id !== category._id);
    return (
        <div className="page view-enter">
            <div className="wrap">
                <Breadcrumb
                    items={[{ label: workspace === "help" ? "Help Center" : "Wiki", onClick: goHome }, { label: category.title }]}
                />
                <div className="cat-hero" data-hue={category.hue}>
                    <span className="big-ico">
                        <Icon name={category.icon} size={28} />
                    </span>
                    <div>
                        <h1>{category.title}</h1>
                        <p>{category.description}</p>
                        <div className="ct-count">
                            {arts.length} article{arts.length !== 1 ? "s" : ""}
                        </div>
                    </div>
                </div>
                <div className="page-grid">
                    <div className="alist">
                        {arts.map((a) => (
                            <button key={a._id} className="arow" data-hue={category.hue} onClick={() => onOpenArticle(a)}>
                                <span className="ar-ico">
                                    <Icon name="doc" size={18} />
                                </span>
                                <span className="ar-main">
                                    <h4>{a.title}</h4>
                                    <p>{a.summary}</p>
                                </span>
                                <span className="ar-meta">
                                    <Icon name="clock" size={13} /> {a.readMin} min
                                </span>
                                <span className="ar-go">
                                    <Icon name="chevRight" size={18} />
                                </span>
                            </button>
                        ))}
                    </div>
                    <aside className="side">
                        <h5>Other topics</h5>
                        <nav className="side-nav">
                            {others.map((c) => (
                                <button key={c._id} data-hue={c.hue} onClick={() => onOpenCategory(c)}>
                                    <span className="dot" style={{ background: "var(--chip-ink)" }} />
                                    {c.title}
                                </button>
                            ))}
                        </nav>
                    </aside>
                </div>
            </div>
        </div>
    );
}

// ---------------- ARTICLE ----------------
function BlockView({ b }: { b: Block }) {
    switch (b.t) {
        case "p":
            return <p>{b.text}</p>;
        case "h2":
            return <h2 id={slugify(b.text)}>{b.text}</h2>;
        case "ul":
            return (
                <ul>
                    {b.items.map((x, i) => (
                        <li key={i}>{x}</li>
                    ))}
                </ul>
            );
        case "ol":
            return (
                <ol>
                    {b.items.map((x, i) => (
                        <li key={i}>{x}</li>
                    ))}
                </ol>
            );
        case "callout":
            return (
                <div className={"callout " + b.kind}>
                    <span className="ci">
                        <Icon name={b.kind === "warn" ? "bolt" : "question"} size={18} />
                    </span>
                    <div>{b.text}</div>
                </div>
            );
        case "code":
            return (
                <pre>
                    {b.text.split("\n").map((ln, i) => (
                        <div key={i} className={ln.trim().startsWith("#") ? "cm" : ""}>
                            {ln || " "}
                        </div>
                    ))}
                </pre>
            );
        case "quote":
            return (
                <blockquote>
                    <div className="bq">&ldquo;{b.text}&rdquo;</div>
                    <div className="who">{b.who}</div>
                </blockquote>
            );
        case "image":
            return (
                <figure className="fig">
                    <div className="ph">
                        <Icon name="palette" size={30} />
                    </div>
                    <figcaption>{b.caption}</figcaption>
                </figure>
            );
        default:
            return null;
    }
}

export function ArticlePage({
    article,
    workspace,
    data,
    onOpenArticle,
    onOpenCategory,
    goHome,
}: {
    article: Article;
    workspace: Workspace;
    data: Data;
    onOpenArticle: (a: Article) => void;
    onOpenCategory: (c: Category) => void;
    goHome: () => void;
}) {
    const c = catOf(article.categoryId, data.categories);
    const recordFeedback = useMutation(api.knowledge.recordFeedback);
    const headings = useMemo(
        () =>
            (article.body as Block[])
                .filter((b): b is Extract<Block, { t: "h2" }> => b.t === "h2")
                .map((b) => ({ id: slugify(b.text), text: b.text })),
        [article],
    );
    const [activeH, setActiveH] = useState(headings[0]?.id);
    const [fb, setFb] = useState<"yes" | "no" | null>(null);

    // ArticlePage is keyed by article id in the parent, so it remounts per
    // article — `fb` resets via initial state; we only need to scroll up.
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [article]);

    // scroll spy
    useEffect(() => {
        if (!headings.length) return;
        const obs = new IntersectionObserver(
            (entries) => {
                const vis = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (vis[0]) setActiveH(vis[0].target.id);
            },
            { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
        );
        headings.forEach((h) => {
            const el = document.getElementById(h.id);
            if (el) obs.observe(el);
        });
        return () => obs.disconnect();
    }, [headings, article]);

    const related = useMemo(() => {
        let r = artsIn(article.categoryId, data.articles)
            .filter((a) => a._id !== article._id)
            .slice(0, 3);
        if (r.length < 3) {
            r = r.concat(
                data.articles
                    .filter((a) => a.popular && a._id !== article._id && !r.includes(a))
                    .slice(0, 3 - r.length),
            );
        }
        return r.slice(0, 3);
    }, [article, data.articles]);

    function jump(id: string) {
        const el = document.getElementById(id);
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 82, behavior: "smooth" });
    }

    function submitFeedback(helpful: boolean) {
        setFb(helpful ? "yes" : "no");
        void recordFeedback({ slug: article.slug, helpful });
    }

    return (
        <div className="page view-enter">
            <div className="wrap">
                <Breadcrumb
                    items={[
                        { label: workspace === "help" ? "Help Center" : "Wiki", onClick: goHome },
                        { label: c?.title ?? "", onClick: c ? () => onOpenCategory(c) : undefined },
                        { label: article.title },
                    ]}
                />
                <div className="page-grid">
                    <article className="article">
                        <div className="a-title-wrap">
                            <h1 className="a-title">{article.title}</h1>
                            <div className="a-meta">
                                <span className="who">
                                    <span className="mini-av" /> {article.author}
                                </span>
                                <span className="sep" />
                                <span>
                                    <Icon name="calendar" size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
                                    Updated {fmtDate(article.updatedAt)}
                                </span>
                                <span className="sep" />
                                <span>
                                    <Icon name="clock" size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
                                    {article.readMin} min read
                                </span>
                            </div>
                        </div>
                        <div className="prose">
                            {(article.body as Block[]).map((b, i) => (
                                <BlockView key={i} b={b} />
                            ))}
                        </div>

                        {fb ? (
                            <div className="feedback done">
                                <Icon name="check" size={18} /> Thanks for the feedback — it helps us improve this article.
                            </div>
                        ) : (
                            <div className="feedback">
                                <span className="ft">Was this article helpful?</span>
                                <div className="fb-btns">
                                    <button className="fb-btn" onClick={() => submitFeedback(true)}>
                                        <Icon name="thumbUp" size={16} /> Yes
                                    </button>
                                    <button className="fb-btn" onClick={() => submitFeedback(false)}>
                                        <Icon name="thumbDown" size={16} /> No
                                    </button>
                                </div>
                            </div>
                        )}

                        {related.length > 0 && (
                            <div className="related">
                                <h3>Related articles</h3>
                                <div className="rel-grid">
                                    {related.map((r) => {
                                        const rc = catOf(r.categoryId, data.categories);
                                        return (
                                            <button key={r._id} className="rel-card" data-hue={rc?.hue} onClick={() => onOpenArticle(r)}>
                                                <span className="rc-cat">{rc?.title}</span>
                                                <h4>{r.title}</h4>
                                                <p>
                                                    {r.readMin} min read <Icon name="arrowUR" size={13} />
                                                </p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </article>

                    <aside className="side toc-side">
                        {headings.length > 0 && (
                            <>
                                <h5>On this page</h5>
                                <nav className="toc">
                                    {headings.map((h) => (
                                        <a
                                            key={h.id}
                                            href={"#" + h.id}
                                            className={activeH === h.id ? "on" : ""}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                jump(h.id);
                                            }}
                                        >
                                            {h.text}
                                        </a>
                                    ))}
                                </nav>
                            </>
                        )}
                    </aside>
                </div>
            </div>
        </div>
    );
}

// ---------------- SEARCH RESULTS ----------------
export function SearchResults({
    query,
    workspace,
    data,
    onOpenArticle,
    goHome,
}: {
    query: string;
    workspace: Workspace;
    data: Data;
    onOpenArticle: (a: Article) => void;
    onOpenCategory: (c: Category) => void;
    goHome: () => void;
}) {
    const results = useMemo(() => searchArticles(query, data.articles, 12), [query, data.articles]);
    function snippet(a: Article) {
        const firstP = (a.body as Block[]).find((b): b is Extract<Block, { t: "p" }> => b.t === "p");
        return (firstP ? firstP.text : a.summary).slice(0, 180);
    }
    return (
        <div className="page view-enter">
            <div className="wrap">
                <Breadcrumb items={[{ label: workspace === "help" ? "Help Center" : "Wiki", onClick: goHome }, { label: "Search" }]} />
                <div className="sr-head">
                    <h1>
                        Results for <q>{query}</q>
                    </h1>
                    <div className="cnt">
                        {results.length} article{results.length !== 1 ? "s" : ""} found
                    </div>
                </div>
                <div style={{ margin: "18px 0 28px", maxWidth: 760 }}>
                    <AnswerCard query={query} workspace={workspace} articles={data.articles} onOpen={(a) => onOpenArticle(a)} />
                </div>
                <div className="section-head" style={{ maxWidth: 760 }}>
                    <h2 style={{ fontSize: 22 }}>All results</h2>
                </div>
                <div className="sr-results" style={{ maxWidth: 760 }}>
                    {results.map((a) => {
                        const c = catOf(a.categoryId, data.categories);
                        return (
                            <button key={a._id} className="sr-item" onClick={() => onOpenArticle(a)}>
                                <div className="sc" data-hue={c?.hue} style={{ color: "var(--chip-ink)" }}>
                                    <Icon name={c?.icon ?? "doc"} size={13} /> {c?.title}
                                </div>
                                <h3>
                                    <Hi text={a.title} q={query} />
                                </h3>
                                <p>
                                    <Hi text={snippet(a)} q={query} />…
                                </p>
                            </button>
                        );
                    })}
                    {results.length === 0 && (
                        <div className="cmd-empty" style={{ textAlign: "left", padding: "20px 0" }}>
                            <div className="big">No articles matched.</div>
                            Try the AI answer above, or browse categories from the home page.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
