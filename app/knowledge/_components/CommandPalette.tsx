"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Icon, Enso } from "./Icon";
import { Hi } from "./Highlight";
import { AnswerCard } from "./AnswerCard";
import { searchAll } from "./search";
import type { Article, Category, Faq, Workspace } from "./types";

const RECENT_KEY = "tendso.kb.recent.v1";
export function getRecent(): string[] {
    try {
        return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    } catch {
        return [];
    }
}
export function pushRecent(slug: string) {
    try {
        const r = getRecent().filter((x) => x !== slug);
        r.unshift(slug);
        localStorage.setItem(RECENT_KEY, JSON.stringify(r.slice(0, 5)));
    } catch {
        /* ignore */
    }
}

type Data = { articles: Article[]; categories: Category[]; faqs: Faq[] };
type Row =
    | { kind: "ai"; id: string }
    | { kind: "article"; id: string; item: Article }
    | { kind: "category"; id: string; item: Category }
    | { kind: "faq"; id: string; item: Faq };

export function CommandPalette({
    open,
    query,
    setQuery,
    onClose,
    workspace,
    data,
    onOpenArticle,
    onOpenCategory,
    onSeeAll,
}: {
    open: boolean;
    query: string;
    setQuery: (q: string) => void;
    onClose: () => void;
    workspace: Workspace;
    data: Data;
    onOpenArticle: (a: Article) => void;
    onOpenCategory: (c: Category) => void;
    onSeeAll: (q: string) => void;
}) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const bodyRef = useRef<HTMLDivElement | null>(null);
    const [active, setActive] = useState(0);
    const [mode, setMode] = useState<"list" | "ai">("list");
    const hasQuery = query.trim().length > 0;

    const catById = useMemo(() => new Map(data.categories.map((c) => [c._id, c])), [data.categories]);
    const articleBySlug = useMemo(() => new Map(data.articles.map((a) => [a.slug, a])), [data.articles]);

    const results = useMemo(() => searchAll(query, data), [query, data]);

    const { groups, flat } = useMemo(() => {
        const g: { label?: string; rows: Row[] }[] = [];
        if (hasQuery) {
            g.push({ rows: [{ kind: "ai", id: "__ai" }] });
            if (results.articles.length)
                g.push({ label: "Articles", rows: results.articles.map((a) => ({ kind: "article", item: a, id: a.slug })) });
            if (results.categories.length)
                g.push({ label: "Categories", rows: results.categories.map((c) => ({ kind: "category", item: c, id: c.slug })) });
            if (results.faqs.length)
                g.push({ label: "Questions", rows: results.faqs.map((f) => ({ kind: "faq", item: f, id: f._id })) });
        } else {
            const rec = getRecent()
                .map((slug) => articleBySlug.get(slug))
                .filter((a): a is Article => !!a);
            if (rec.length) g.push({ label: "Recent", rows: rec.map((a) => ({ kind: "article", item: a, id: a.slug })) });
            const pop = data.articles.filter((a) => a.popular).slice(0, 4);
            if (pop.length) g.push({ label: "Popular", rows: pop.map((a) => ({ kind: "article", item: a, id: a.slug })) });
            g.push({ label: "Browse", rows: data.categories.slice(0, 4).map((c) => ({ kind: "category", item: c, id: c.slug })) });
        }
        return { groups: g, flat: g.flatMap((x) => x.rows) };
    }, [results, hasQuery, data, articleBySlug]);

    useEffect(() => {
        if (open) {
            setActive(0);
            setMode("list");
        }
    }, [open, query, workspace]);

    useEffect(() => {
        if (open) {
            const t = setTimeout(() => inputRef.current?.focus(), 30);
            return () => clearTimeout(t);
        }
    }, [open]);

    useEffect(() => {
        setActive((a) => Math.max(0, Math.min(a, flat.length - 1)));
    }, [flat.length]);

    useLayoutEffect(() => {
        if (mode !== "list" || !bodyRef.current) return;
        const el = bodyRef.current.querySelector<HTMLElement>('.cmd-row[data-idx="' + active + '"]');
        if (!el) return;
        const c = bodyRef.current;
        const top = el.offsetTop;
        const bot = top + el.offsetHeight;
        if (top < c.scrollTop + 8) c.scrollTop = top - 8;
        else if (bot > c.scrollTop + c.clientHeight - 8) c.scrollTop = bot - c.clientHeight + 8;
    }, [active, mode]);

    function activate(row?: Row) {
        if (!row) return;
        if (row.kind === "ai") {
            setMode("ai");
            return;
        }
        if (row.kind === "article") {
            pushRecent(row.item.slug);
            onOpenArticle(row.item);
            onClose();
        } else if (row.kind === "category") {
            onOpenCategory(row.item);
            onClose();
        } else if (row.kind === "faq") {
            const a = row.item.linkArticleSlug ? articleBySlug.get(row.item.linkArticleSlug) : undefined;
            if (a) {
                pushRecent(a.slug);
                onOpenArticle(a);
            }
            onClose();
        }
    }

    function onKey(e: React.KeyboardEvent) {
        if (e.key === "Escape") {
            e.preventDefault();
            if (mode === "ai") setMode("list");
            else onClose();
            return;
        }
        if (mode === "ai") return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(flat.length - 1, a + 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
        } else if (e.key === "Enter") {
            e.preventDefault();
            activate(flat[active]);
        }
    }

    if (!open) return null;
    let idx = -1;

    return (
        <div className="tkb-cmd-scrim show" onMouseDown={onClose}>
            <div className="cmd" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Search">
                <div className="cmd-input">
                    <span className="ci">
                        <Icon name="search" size={20} />
                    </span>
                    <input
                        ref={inputRef}
                        value={query}
                        placeholder={"Search the " + (workspace === "help" ? "Help Center" : "wiki") + ", or ask a question…"}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setMode("list");
                        }}
                        onKeyDown={onKey}
                        spellCheck={false}
                    />
                    <span className="esc">esc</span>
                </div>

                {mode === "ai" ? (
                    <div className="cmd-body" ref={bodyRef}>
                        <button className="cmd-row" style={{ color: "var(--ink-3)", fontSize: 13 }} onClick={() => setMode("list")}>
                            <Icon name="chevLeft" size={16} /> Back to results
                        </button>
                        <AnswerCard
                            query={query}
                            workspace={workspace}
                            articles={data.articles}
                            compact
                            onOpen={(a) => {
                                pushRecent(a.slug);
                                onOpenArticle(a);
                                onClose();
                            }}
                        />
                        <button
                            className="cmd-row"
                            style={{ justifyContent: "center", color: "var(--accent-ink)", fontWeight: 500, fontSize: 13.5, marginTop: 4 }}
                            onClick={() => onSeeAll(query)}
                        >
                            Browse all matching articles <Icon name="arrowUR" size={14} />
                        </button>
                    </div>
                ) : flat.length === 0 ? (
                    <div className="cmd-body" ref={bodyRef}>
                        <div className="cmd-empty">
                            <div className="ico">
                                <Icon name="search" size={34} />
                            </div>
                            <div className="big">No matches for &ldquo;{query}&rdquo;</div>
                            <div>Try a different term, or ask Tendso AI in your own words.</div>
                        </div>
                    </div>
                ) : (
                    <div className="cmd-body" ref={bodyRef}>
                        {groups.map((g, gi) => (
                            <div key={gi}>
                                {g.label && <div className="cmd-group-label">{g.label}</div>}
                                {g.rows.map((row) => {
                                    idx++;
                                    const i = idx;
                                    const on = i === active;
                                    return (
                                        <RowView
                                            key={row.id}
                                            row={row}
                                            on={on}
                                            q={query}
                                            idx={i}
                                            catById={catById}
                                            onHover={() => setActive(i)}
                                            onClick={() => activate(row)}
                                        />
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                )}

                <div className="cmd-foot">
                    <span className="fk">
                        <span className="kbd">↵</span> open
                    </span>
                    <span className="fk">
                        <span className="kbd">↑</span>
                        <span className="kbd">↓</span> navigate
                    </span>
                    <span className="fk">
                        <span className="kbd">esc</span> close
                    </span>
                    <span className="sp">
                        <Enso size={15} color="var(--ink-3)" /> {workspace === "help" ? "Help Center" : "Internal Wiki"}
                    </span>
                </div>
            </div>
        </div>
    );
}

function RowView({
    row,
    on,
    q,
    idx,
    catById,
    onHover,
    onClick,
}: {
    row: Row;
    on: boolean;
    q: string;
    idx: number;
    catById: Map<string, Category>;
    onHover: () => void;
    onClick: () => void;
}) {
    if (row.kind === "ai") {
        return (
            <div className={"cmd-row ai" + (on ? " active" : "")} data-idx={idx} onMouseMove={onHover} onClick={onClick}>
                <span className="cr-ico">
                    <Enso size={18} color="var(--accent)" />
                </span>
                <div className="cr-main">
                    <div className="t">
                        Ask Tendso AI: <b>&ldquo;{q}&rdquo;</b>
                    </div>
                    <div className="s">Get a synthesized answer with sources</div>
                </div>
                <span className="cr-go">
                    <Icon name="enter" size={15} />
                </span>
            </div>
        );
    }
    if (row.kind === "category") {
        const c = row.item;
        return (
            <div className={"cmd-row" + (on ? " active" : "")} data-idx={idx} data-hue={c.hue} onMouseMove={onHover} onClick={onClick}>
                <span className="cr-ico">
                    <Icon name={c.icon} size={18} />
                </span>
                <div className="cr-main">
                    <div className="t">
                        <Hi text={c.title} q={q} />
                    </div>
                    <div className="s">{c.description}</div>
                </div>
                <span className="cr-tag">Category</span>
            </div>
        );
    }
    if (row.kind === "faq") {
        const f = row.item;
        return (
            <div className={"cmd-row" + (on ? " active" : "")} data-idx={idx} onMouseMove={onHover} onClick={onClick}>
                <span className="cr-ico" style={{ background: "var(--paper-2)", color: "var(--ink-3)" }}>
                    <Icon name="question" size={18} />
                </span>
                <div className="cr-main">
                    <div className="t">
                        <Hi text={f.question} q={q} />
                    </div>
                    <div className="s">{f.answer}</div>
                </div>
                <span className="cr-go">
                    <Icon name="chevRight" size={15} />
                </span>
            </div>
        );
    }
    const a = row.item;
    const c = catById.get(a.categoryId);
    return (
        <div className={"cmd-row" + (on ? " active" : "")} data-idx={idx} data-hue={c ? c.hue : "clay"} onMouseMove={onHover} onClick={onClick}>
            <span className="cr-ico">
                <Icon name={c ? c.icon : "doc"} size={18} />
            </span>
            <div className="cr-main">
                <div className="t">
                    <Hi text={a.title} q={q} />
                </div>
                <div className="s">
                    {c ? c.title : ""} · {a.readMin} min read
                </div>
            </div>
            <span className="cr-go">
                <Icon name="arrowUR" size={15} />
            </span>
        </div>
    );
}
