"use client";

import { useQuery } from "convex/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { articleHref, categoryHref } from "@/app/knowledge/_components/model";
import { searchArticles, searchCategories } from "@/app/knowledge/_components/search";
import type { ArticleCard, Category, Faq, InitialHelp } from "@/app/knowledge/_components/types";
import { AskTendsoInline } from "@/components/v2/chat/AskTendso";
import { Button, Container } from "@/components/v2";
import { api } from "@/convex/_generated/api";
import { DISCORD_INVITE_URL, SUPPORT_EMAIL } from "@/lib/contact";

import { Reveal } from "./Reveal";
import { ArrowRightIcon, CloseIcon, PbPage, PlusIcon, copyWithToast, usePbToast } from "./shared";

/*
 * /v2/help: the Help Center front for the new site (pages/help.html).
 * Search, the Tendso AI answer, topics, short answers, and "Ask a person".
 *
 * Everything on it is read from the same Convex Help Center the /knowledge
 * routes use (categories, articles and FAQs through api.knowledge.*, with the
 * server's first paint as a fallback). Search is the Help Center's own scorer.
 * Full articles open on /knowledge/[slug], which keeps working as before.
 */

const POPULAR_FALLBACK = ["How much does it cost?", "How fast is my site ready?", "When do I pay?"];

export function HelpPage({ initial }: { initial: InitialHelp | null }) {
    const liveCats = useQuery(api.knowledge.listCategories, { workspace: "help" });
    const liveArts = useQuery(api.knowledge.listArticles, { workspace: "help" });
    const liveFaqs = useQuery(api.knowledge.listFaqs, { workspace: "help" });
    const categories: Category[] | undefined = liveCats ?? initial?.categories;
    const articles: ArticleCard[] | undefined = liveArts ?? initial?.articles;
    const faqs: Faq[] | undefined = liveFaqs ?? initial?.faqs;
    const { node: toast, show } = usePbToast();

    return (
        <PbPage
            nav={{
                secondary: <Button href="#contact" variant="ghost" size="sm">Ask a person</Button>,
            }}
        >
            <Hero categories={categories} articles={articles} />
            <Topics categories={categories} articles={articles} />
            <Answers categories={categories} articles={articles} faqs={faqs} />
            <ContactSection onCopy={(text, done) => void copyWithToast(text, done, show)} />
            {toast}
        </PbPage>
    );
}

/* ---- 1. Ask: search + the AI ------------------------------------------------ */

function Hero({ categories, articles }: { categories?: Category[]; articles?: ArticleCard[] }) {
    const router = useRouter();
    const [q, setQ] = useState("");
    const [active, setActive] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const matches = useMemo(() => (articles && q.trim() ? searchArticles(q, articles, 5) : []), [q, articles]);
    const topicMatches = useMemo(() => (categories && q.trim() ? searchCategories(q, categories, 2) : []), [q, categories]);
    const rows = [
        ...matches.map((a) => ({ key: a._id, title: a.title, label: categories?.find((c) => c._id === a.categoryId)?.title ?? "", href: articleHref(a) })),
        ...topicMatches.map((c) => ({ key: c._id, title: c.title, label: "Topic", href: categoryHref(c) })),
    ];
    const searching = q.trim().length > 0;
    const popular = (articles ?? []).filter((a) => a.popular).slice(0, 4);

    const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowDown" && rows.length) {
            setActive((i) => (i + 1) % rows.length);
            e.preventDefault();
        } else if (e.key === "ArrowUp" && rows.length) {
            setActive((i) => (i - 1 + rows.length) % rows.length);
            e.preventDefault();
        } else if (e.key === "Escape") {
            setQ("");
        } else if (e.key === "Enter" && rows[active]) {
            e.preventDefault();
            router.push(rows[active].href);
        }
    };

    return (
        <Container className="pb-hc-hero" aria-labelledby="hc-h" role="region">
            <div className="pb-hc-ask">
                <p className="pb-label">Help</p>
                <h1 className="pb-hc-h" id="hc-h">
                    How can we help?
                </h1>
                <div className="pb-hc-search" role="search">
                    <label className="pb-hc-search-box">
                        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                            <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                            <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                        <span className="sr-only">Search help</span>
                        <input
                            ref={inputRef}
                            type="search"
                            value={q}
                            onChange={(e) => {
                                setQ(e.target.value);
                                setActive(0);
                            }}
                            onKeyDown={onKey}
                            placeholder="Search the answers"
                            autoComplete="off"
                            enterKeyHint="search"
                            role="combobox"
                            aria-expanded={searching}
                            aria-controls="hc-results"
                            aria-autocomplete="list"
                        />
                        {searching && (
                            <button
                                type="button"
                                className="pb-hc-clear"
                                aria-label="Clear search"
                                onClick={() => {
                                    setQ("");
                                    inputRef.current?.focus();
                                }}
                            >
                                <CloseIcon />
                            </button>
                        )}
                    </label>
                    {searching && (
                        <div className="pb-hc-results" id="hc-results" role="listbox" aria-label="Matching answers">
                            {rows.length > 0 ? (
                                rows.map((r, i) => (
                                    <Link key={r.key} href={r.href} role="option" aria-selected={i === active} className={`pb-hc-res ${i === active ? "is-active" : ""}`}>
                                        <span className="pb-hc-res-q">{r.title}</span>
                                        <span className="pb-hc-res-t">{r.label}</span>
                                    </Link>
                                ))
                            ) : (
                                <div className="pb-hc-none">
                                    <b>{articles ? "No article for that yet." : "Looking…"}</b>
                                    {articles && <span>Ask Tendso on the right, or ask a person.</span>}
                                    {articles && (
                                        <a href="#contact" className="pb-link-arr">
                                            Ask a person <ArrowRightIcon />
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="pb-hc-pop">
                    <span className="pb-hc-pop-k">Most asked</span>
                    <div className="pb-hc-pop-chips">
                        {popular.length > 0
                            ? popular.map((a) => (
                                  <Link key={a._id} className="pb-hc-chip" href={articleHref(a)}>
                                      {a.title}
                                  </Link>
                              ))
                            : POPULAR_FALLBACK.map((s) => (
                                  <span key={s} className="pb-hc-chip">
                                      {s}
                                  </span>
                              ))}
                    </div>
                </div>
            </div>

            <AskTendsoInline className="pb-hc-answer" suggestions={popularQuestions(articles)} />
        </Container>
    );
}

/** The AI box's starter chips: the real questions people ask, from the popular articles. */
function popularQuestions(articles?: ArticleCard[]): string[] | undefined {
    const titles = (articles ?? []).filter((a) => a.popular && a.title.trim().endsWith("?")).slice(0, 3).map((a) => a.title);
    return titles.length >= 2 ? titles : undefined;
}

/* ---- 2. Topics ------------------------------------------------------------------ */

function Topics({ categories, articles }: { categories?: Category[]; articles?: ArticleCard[] }) {
    return (
        <Container className="pb-sec" aria-labelledby="topics-h" role="region">
            <Reveal>
                <div className="pb-sec-head">
                    <div>
                        <span className="pb-label">Topics</span>
                        <h2 className="pb-sec-h" id="topics-h">
                            Pick a topic.
                        </h2>
                    </div>
                </div>
            </Reveal>
            <div className="pb-hc-topics">
                {categories === undefined
                    ? Array.from({ length: 5 }, (_, i) => <div key={i} className="v2-tile v2-tile--quiet pb-hc-topic pb-hc-topic--wait" aria-hidden="true" />)
                    : categories.map((c, i) => {
                          const n = (articles ?? []).filter((a) => a.categoryId === c._id).length;
                          return (
                              <a
                                  key={c._id}
                                  className="v2-tile v2-tile--quiet pb-hc-topic"
                                  href="#answers"
                                  onClick={(e) => {
                                      e.preventDefault();
                                      selectTopic(c.slug);
                                  }}
                              >
                                  <span className="pb-hc-topic-n">{String(i + 1).padStart(2, "0")}</span>
                                  <span className="pb-hc-topic-name">{c.title}</span>
                                  <span className="pb-hc-topic-line">{c.description}</span>
                                  <span className="pb-hc-topic-count">
                                      <span className="pb-hc-topic-cn">{n === 1 ? "1 answer" : `${n} answers`}</span>
                                      <ArrowRightIcon />
                                  </span>
                              </a>
                          );
                      })}
            </div>
        </Container>
    );
}

/** The topic tiles and the filter chips share this: a tile sets the filter through a window event. */
const TOPIC_EVENT = "pb-help-topic";
function selectTopic(slug: string) {
    window.dispatchEvent(new CustomEvent(TOPIC_EVENT, { detail: slug }));
    document.getElementById("answers")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---- 3. Short answers ----------------------------------------------------------- */

type Row = { id: string; question: string; answer: string; href: string | null };

function Answers({ categories, articles, faqs }: { categories?: Category[]; articles?: ArticleCard[]; faqs?: Faq[] }) {
    const [topic, setTopic] = useState<string>("all");

    // A topic tile elsewhere on the page picks the filter.
    useTopicEvent(setTopic);

    const rows: Row[] = useMemo(() => {
        if (topic === "all") {
            return (faqs ?? []).map((f) => ({
                id: f._id,
                question: f.question,
                answer: f.answer,
                href: f.linkArticleSlug ? `/knowledge/${encodeURIComponent(f.linkArticleSlug)}` : null,
            }));
        }
        const cat = categories?.find((c) => c.slug === topic);
        return (articles ?? [])
            .filter((a) => a.categoryId === cat?._id)
            .map((a) => ({ id: a._id, question: a.title, answer: a.summary, href: articleHref(a) }));
    }, [topic, categories, articles, faqs]);

    const loading = faqs === undefined && articles === undefined;

    return (
        <Container className="pb-sec" id="answers" aria-labelledby="answers-h" role="region">
            <div className="pb-hc-ans">
                <div className="pb-hc-ans-side">
                    <span className="pb-label">Answers</span>
                    <h2 className="pb-sec-h" id="answers-h">
                        Short answers.
                    </h2>
                    <div className="pb-hc-filter" role="group" aria-label="Filter by topic">
                        <button type="button" className="pb-fchip" aria-pressed={topic === "all"} onClick={() => setTopic("all")}>
                            All
                        </button>
                        {(categories ?? []).map((c) => (
                            <button key={c._id} type="button" className="pb-fchip" aria-pressed={topic === c.slug} onClick={() => setTopic(c.slug)}>
                                {c.title}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="pb-faq pb-hc-faq">
                    {loading
                        ? Array.from({ length: 4 }, (_, i) => <div key={i} className="pb-qa pb-hc-qa-wait" aria-hidden="true" />)
                        : rows.length === 0
                          ? (
                                <p className="pb-hc-empty">
                                    Nothing here yet. Ask Tendso above, or <a href="#contact">ask a person</a>.
                                </p>
                            )
                          : rows.map((r) => (
                                <details key={r.id} className="pb-qa">
                                    <summary>
                                        {r.question}
                                        <span className="pb-qa-plus">
                                            <PlusIcon />
                                        </span>
                                    </summary>
                                    <div className="pb-qa-a">
                                        <p>{r.answer}</p>
                                        {r.href && (
                                            <Link className="pb-link-arr pb-hc-more" href={r.href}>
                                                Read the full answer <ArrowRightIcon />
                                            </Link>
                                        )}
                                    </div>
                                </details>
                            ))}
                </div>
            </div>
        </Container>
    );
}

function useTopicEvent(set: (slug: string) => void) {
    useEffect(() => {
        const on = (e: Event) => set((e as CustomEvent<string>).detail);
        window.addEventListener(TOPIC_EVENT, on);
        return () => window.removeEventListener(TOPIC_EVENT, on);
    }, [set]);
}

/* ---- 4. Ask a person -------------------------------------------------------------- */

function ContactSection({ onCopy }: { onCopy: (text: string, done: string) => void }) {
    return (
        <Container className="pb-sec" id="contact" aria-labelledby="contact-h" role="region">
            <Reveal>
            <div className="v2-tile v2-tile--quiet pb-hc-contact">
                <figure className="pb-hc-contact-photo">
                    <Image src="/v2/pages-b/12-salon.jpg" alt="A salon owner and a Tendso agent look at her new site" fill sizes="(max-width: 900px) 100vw, 40vw" />
                </figure>
                <div className="pb-hc-contact-body">
                    <span className="pb-label">Contact</span>
                    <h2 className="pb-hc-contact-h" id="contact-h">
                        Ask a person.
                    </h2>
                    <p className="pb-hc-contact-sub">We answer every email, usually within a day.</p>
                    <div className="pb-hc-rows">
                        <div className="pb-hc-row">
                            <span className="pb-hc-row-k">Email</span>
                            <a className="pb-hc-row-v" href={`mailto:${SUPPORT_EMAIL}`}>
                                {SUPPORT_EMAIL}
                            </a>
                            <Button variant="ghost" size="sm" onClick={() => onCopy(SUPPORT_EMAIL, "Email copied")}>
                                Copy
                            </Button>
                        </div>
                        <div className="pb-hc-row">
                            <span className="pb-hc-row-k">Discord</span>
                            <a className="pb-hc-row-v" href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer">
                                {DISCORD_INVITE_URL.replace(/^https?:\/\//, "")}
                            </a>
                            <Button variant="ghost" size="sm" onClick={() => onCopy(DISCORD_INVITE_URL, "Invite copied")}>
                                Copy
                            </Button>
                        </div>
                    </div>
                    <p className="pb-hc-contact-note">
                        <i />
                        Need a change on your live site? Edits are free for the first year. Email us what to change.
                    </p>
                    <p className="pb-hc-contact-fine">Press and partnerships: same inbox.</p>
                </div>
            </div>
            </Reveal>
            <div className="pb-hc-end" />
        </Container>
    );
}
