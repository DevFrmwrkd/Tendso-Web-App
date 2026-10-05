"use client";

import type { LucideIcon } from "lucide-react";
import { Book, ChevronLeft, CircleQuestionMark, Clock, PanelsTopLeft, Search, Sparkles } from "lucide-react";
import { useAction, useQuery } from "convex/react";
import {
    useEffect,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent,
    type MouseEvent,
    type RefObject,
} from "react";

import { Button, Icon, Skeleton, Toaster, cx } from "@/components/r1";
import { api } from "@/convex/_generated/api";

import { AnswerPanel, type AiState } from "./AnswerCard";
import { CREATOR_FAQ_ITEMS } from "./creatorFaq";
import { CONTACT_HREF, CREATOR_FAQ_HREF, articleHref, articleLabel, categoryHref, countLabel } from "./model";
import { useHelpNav } from "./nav";
import { getRecent } from "./recent";
import { searchArticles, searchCategories, searchQuestions } from "./search";
import type { ArticleCard, Category, Faq, Workspace } from "./types";
import { useWikiAccess } from "./viewer";

/*
 * The ⌘K / Ctrl+K command palette (board: "Search palette"; kit: "Command
 * palette"). Empty, it offers Recent, Popular and questions to try. Typed, the
 * first row asks Tendso AI and the rest are instant client-side matches:
 * articles, then topics, then questions. Enter asks the AI unless the reader
 * has arrowed to a match.
 *
 * A certified creator searches the Help Center and the creator wiki together.
 * The AI answers from one workspace at a time (convex knowledgeAI.ask), so the
 * question goes to whichever one its best match lives in; with no match, to the
 * one the reader is browsing.
 *
 * It is a native <dialog> opened with showModal(), like the kit's overlays:
 * the platform traps focus and puts the scrim behind it.
 */

type HelpData = {
    access: boolean | undefined;
    helpCats: Category[] | undefined;
    helpArts: ArticleCard[] | undefined;
    helpFaqs: Faq[] | undefined;
    wikiCats: Category[] | undefined;
    wikiArts: ArticleCard[] | undefined;
    wikiFaqs: Faq[] | undefined;
};

export function CommandPalette({ open, seed, session, onClose }: { open: boolean; seed: string; session: number; onClose: () => void }) {
    // Subscribe only once someone has opened it: on a phone there is no ⌘K
    // and an article page never needs the whole knowledge base.
    const armed = session > 0;
    const access = useWikiAccess();
    const wikiOn = armed && access === true;
    const helpCats = useQuery(api.knowledge.listCategories, armed ? { workspace: "help" } : "skip");
    const helpArts = useQuery(api.knowledge.listArticles, armed ? { workspace: "help" } : "skip");
    const helpFaqs = useQuery(api.knowledge.listFaqs, armed ? { workspace: "help" } : "skip");
    const wikiCats = useQuery(api.knowledge.listCategories, wikiOn ? { workspace: "wiki" } : "skip");
    const wikiArts = useQuery(api.knowledge.listArticles, wikiOn ? { workspace: "wiki" } : "skip");
    const wikiFaqs = useQuery(api.knowledge.listFaqs, wikiOn ? { workspace: "wiki" } : "skip");

    const ref = useRef<HTMLDialogElement>(null);

    // Open and close in the same frame the body mounts or unmounts.
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (open && !el.open) el.showModal();
        else if (!open && el.open) el.close();
    }, [open]);

    // Unmounting while open must not leave the page inert.
    useEffect(() => {
        const el = ref.current;
        return () => {
            if (el?.open) el.close();
        };
    }, []);

    // A click on ::backdrop lands on the <dialog> itself, outside its box.
    const onBackdrop = (e: MouseEvent<HTMLDialogElement>) => {
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        if (!inside) onClose();
    };

    return (
        <dialog
            ref={ref}
            aria-label="Search the Help Center"
            className="r1 t-pal w-[min(680px,calc(100vw_-_32px))] max-sm:mt-4"
            // Esc closes the dialog natively (the body intercepts it while an
            // answer is showing); keep React's state in step however it closed,
            // including when the shell hid it because the reader left the page.
            onClose={onClose}
            onClick={onBackdrop}
        >
            {open && (
                <>
                    <PaletteBody
                        key={session}
                        dialogRef={ref}
                        seed={seed}
                        data={{ access, helpCats, helpArts, helpFaqs, wikiCats, wikiArts, wikiFaqs }}
                        onClose={onClose}
                    />
                    {/* The palette sits in the top layer and round1.css hides the
                        page's toaster while it is open, so the Copy toasts from
                        "Ask a person" need this one: see components/r1/Toaster.tsx. */}
                    <Toaster inOverlay />
                </>
            )}
        </dialog>
    );
}

// ---------------- Body ----------------

type Question = { id: string; question: string; answer: string; href: string };

type Opt =
    | { kind: "ai" }
    | { kind: "article"; a: ArticleCard; recent?: boolean }
    | { kind: "more"; total: number }
    | { kind: "topic"; c: Category }
    | { kind: "question"; f: Question }
    | { kind: "try"; text: string };

type Group = { label?: string; count?: number; items: { opt: Opt; index: number }[] };

const TRY: Record<"public" | "creator", string[]> = {
    public: ["How much does a website cost?", "How fast can my website go live?"],
    creator: ["How do Wise payouts work?", "How do I raise my price ceiling?"],
};

/** The FAQs, each pointing at its article (or at the FAQ fold when the article is not published). */
function faqQuestions(faqs: Faq[] | undefined, articles: ArticleCard[] | undefined): Question[] {
    return (faqs ?? []).map((f) => {
        const a = f.linkArticleSlug ? articles?.find((x) => x.slug === f.linkArticleSlug) : undefined;
        return { id: f._id, question: f.question, answer: f.answer, href: a ? articleHref(a) : "/knowledge#faq" };
    });
}

function PaletteBody({
    dialogRef,
    seed,
    data,
    onClose,
}: {
    dialogRef: RefObject<HTMLDialogElement | null>;
    seed: string;
    data: HelpData;
    onClose: () => void;
}) {
    const go = useHelpNav();
    const ask = useAction(api.knowledgeAI.ask);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const listId = useId();
    const [query, setQuery] = useState(seed);
    const [mode, setMode] = useState<"list" | "ai">("list");
    const [active, setActive] = useState(0);
    const [showAll, setShowAll] = useState(false);
    const [ai, setAi] = useState<AiState | null>(null);
    const [recent] = useState(getRecent);

    const isCreator = data.access === true;
    const scope = isCreator ? "Help Center and creator wiki" : "Help Center";
    const hasQuery = query.trim().length > 0;

    const { categories, articles, questions } = useMemo(() => {
        const wiki = isCreator;
        return {
            categories: [...(data.helpCats ?? []), ...(wiki ? (data.wikiCats ?? []) : [])],
            articles: [...(data.helpArts ?? []), ...(wiki ? (data.wikiArts ?? []) : [])],
            questions: [
                ...faqQuestions(data.helpFaqs, data.helpArts),
                ...(wiki ? faqQuestions(data.wikiFaqs, data.wikiArts) : []),
                ...CREATOR_FAQ_ITEMS.map((i) => ({ id: `creator-${i.id}`, question: i.question, answer: i.answer, href: CREATOR_FAQ_HREF })),
            ],
        };
    }, [isCreator, data.helpCats, data.wikiCats, data.helpArts, data.wikiArts, data.helpFaqs, data.wikiFaqs]);

    const loading = data.helpArts === undefined;

    const groups = useMemo(() => {
        const raw: { label?: string; count?: number; opts: Opt[] }[] = [];
        if (!hasQuery) {
            const recentArts = recent
                .map((slug) => articles.find((a) => a.slug === slug))
                .filter((a): a is ArticleCard => !!a)
                .slice(0, 3);
            raw.push({ label: "Recent", opts: recentArts.map((a): Opt => ({ kind: "article", a, recent: true })) });
            raw.push({
                label: "Popular",
                opts: (data.helpArts ?? [])
                    .filter((a) => a.popular)
                    .slice(0, 4)
                    .map((a): Opt => ({ kind: "article", a })),
            });
            raw.push({ label: "Try asking", opts: TRY[isCreator ? "creator" : "public"].map((text): Opt => ({ kind: "try", text })) });
        } else {
            raw.push({ opts: [{ kind: "ai" }] });
            const matches = searchArticles(query, articles, Infinity);
            const shown: Opt[] = (showAll ? matches : matches.slice(0, 5)).map((a): Opt => ({ kind: "article", a }));
            if (!showAll && matches.length > 5) shown.push({ kind: "more", total: matches.length });
            raw.push({ label: "Articles", count: matches.length, opts: shown });
            raw.push({ label: "Topics", opts: searchCategories(query, categories, 3).map((c): Opt => ({ kind: "topic", c })) });
            raw.push({ label: "Questions", opts: searchQuestions(query, questions, 3).map((f): Opt => ({ kind: "question", f })) });
        }
        // Number the rows in reading order, so arrows and aria-activedescendant agree.
        const out: Group[] = [];
        let n = 0;
        for (const g of raw) {
            if (!g.opts.length) continue;
            const items: Group["items"] = [];
            for (const opt of g.opts) items.push({ opt, index: n++ });
            out.push({ label: g.label, count: g.count, items });
        }
        return out;
    }, [hasQuery, query, recent, articles, categories, questions, showAll, isCreator, data.helpArts]);

    const flat = groups.flatMap((g) => g.items.map((i) => i.opt));
    const activeIdx = Math.max(0, Math.min(active, flat.length - 1));
    const activeOpt = flat[activeIdx];
    const optId = (i: number) => `${listId}-o${i}`;

    // Focus the input once the dialog is up (showModal also tries; this makes sure).
    useEffect(() => {
        const el = inputRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
    }, []);

    // While an answer is showing, Esc goes back to the results instead of closing.
    useEffect(() => {
        const el = dialogRef.current;
        if (!el || mode !== "ai") return;
        const back = (e: Event) => {
            e.preventDefault();
            setMode("list");
        };
        el.addEventListener("cancel", back);
        return () => el.removeEventListener("cancel", back);
    }, [dialogRef, mode]);

    // Keep the highlighted row in view while arrowing.
    useEffect(() => {
        if (mode !== "list") return;
        listRef.current?.querySelector<HTMLElement>(`[data-opt="${activeIdx}"]`)?.scrollIntoView({ block: "nearest" });
    }, [activeIdx, mode]);

    const askWorkspace = (q: string): Workspace => {
        if (!isCreator) return "help";
        const best = searchArticles(q, articles, 1)[0];
        if (best) return best.workspace;
        return new URLSearchParams(window.location.search).get("ws") === "wiki" ? "wiki" : "help";
    };

    const runAsk = (raw: string) => {
        const q = raw.trim();
        if (!q) return;
        const workspace = askWorkspace(q);
        const key = `${workspace}\n${q}`;
        setMode("ai");
        // Asked already: show it again rather than asking (and logging) twice.
        if (ai && ai.key === key && ai.status !== "error") return;
        setAi({ key, question: q, workspace, status: "loading" });
        ask({ query: q, workspace, source: "web" })
            .then((result) => setAi((cur) => (cur?.key === key ? { key, question: q, workspace, status: "done", result } : cur)))
            .catch(() => setAi((cur) => (cur?.key === key ? { key, question: q, workspace, status: "error" } : cur)));
    };

    // Close first, then move: closing hands focus back to whatever opened the
    // palette, and doing that after the move would scroll the page back to it.
    const openHref = (href: string) => {
        onClose();
        setTimeout(() => go(href), 0);
    };

    const activate = (o: Opt | undefined) => {
        if (!o) return;
        switch (o.kind) {
            case "ai":
                runAsk(query);
                break;
            case "try":
                setQuery(o.text);
                setShowAll(false);
                runAsk(o.text);
                break;
            case "more":
                setShowAll(true);
                break;
            case "article":
                openHref(articleHref(o.a));
                break;
            case "topic":
                openHref(categoryHref(o.c));
                break;
            case "question":
                openHref(o.f.href);
                break;
        }
    };

    const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.nativeEvent.isComposing || mode !== "list") return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive(Math.min(flat.length - 1, activeIdx + 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive(Math.max(0, activeIdx - 1));
        } else if (e.key === "Enter") {
            e.preventDefault();
            activate(activeOpt);
        }
    };

    const labelOf = (a: ArticleCard) => articleLabel(a, categories);
    const verb =
        activeOpt?.kind === "ai" ? "Ask the AI" : activeOpt?.kind === "try" ? "Ask" : activeOpt?.kind === "more" ? "Show all" : "Open";
    const nothing = hasQuery && !loading && flat.length === 1;

    return (
        <>
            <div className="t-pal-top h-16 gap-3 pl-5 pr-3">
                <Icon icon={Search} size={18} />
                <label htmlFor={`${listId}-q`} className="sr-only">
                    Search, or ask a question
                </label>
                <input
                    ref={inputRef}
                    id={`${listId}-q`}
                    className="t-pal-input"
                    type="text"
                    role="combobox"
                    aria-expanded={mode === "list"}
                    aria-controls={mode === "list" ? listId : undefined}
                    aria-activedescendant={mode === "list" && activeOpt ? optId(activeIdx) : undefined}
                    aria-autocomplete="list"
                    autoComplete="off"
                    spellCheck={false}
                    enterKeyHint="search"
                    placeholder={isCreator ? "Search the Help Center and creator wiki, or ask a question" : "Search, or ask a question"}
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setMode("list");
                        setActive(0);
                        setShowAll(false);
                    }}
                    onKeyDown={onKeyDown}
                />
                <Button variant="ghost" className="shrink-0 px-2.5 text-[13px]" onClick={onClose}>
                    Close <span className="t-kbd max-sm:hidden">Esc</span>
                </Button>
            </div>

            {mode === "ai" && ai ? (
                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                    <button
                        type="button"
                        className="flex min-h-10 w-full items-center gap-3 rounded-r1 px-3 text-left text-[13px] text-r1-ink-3 hover:bg-r1-fill"
                        onClick={() => setMode("list")}
                    >
                        <Icon icon={ChevronLeft} />
                        Back to results
                    </button>
                    <AnswerPanel state={ai} onOpen={openHref} onRetry={() => runAsk(ai.question)} />
                </div>
            ) : (
                <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-2">
                    <div id={listId} role="listbox" aria-label="Results">
                        {groups.map((g, gi) => (
                            <div key={g.label ?? `g${gi}`} role="group" aria-labelledby={g.label ? `${listId}-g${gi}` : undefined}>
                                {g.label && (
                                    <p id={`${listId}-g${gi}`} className="t-label flex items-center gap-2 px-3 pb-1.5 pt-3">
                                        {g.label}
                                        {g.count != null && <span className="t-count">{g.count}</span>}
                                    </p>
                                )}
                                {g.items.map(({ opt, index }) => (
                                    <OptionRow
                                        key={optKey(opt)}
                                        opt={opt}
                                        id={optId(index)}
                                        index={index}
                                        selected={index === activeIdx}
                                        query={query.trim()}
                                        labelOf={labelOf}
                                        onHover={() => {
                                            if (index !== activeIdx) setActive(index);
                                        }}
                                        onPick={() => activate(opt)}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                    {/* Outside the listbox: a listbox may only hold options. */}
                    {loading && <LoadingRows />}
                    {nothing && (
                        <p className="t-meta p-3">
                            No articles match &ldquo;{query.trim()}&rdquo;. Ask the AI above, or{" "}
                            <button type="button" className="t-link" onClick={() => openHref(CONTACT_HREF)}>
                                ask a person
                            </button>
                            .
                        </p>
                    )}
                </div>
            )}

            <div className="t-pal-foot h-11">
                {mode === "list" ? (
                    <>
                        {flat.length > 1 && (
                            <span className="max-sm:hidden">
                                <span className="t-kbd">↑</span>
                                <span className="t-kbd">↓</span>
                                Move
                            </span>
                        )}
                        {activeOpt && (
                            <span className="max-sm:hidden">
                                <span className="t-kbd">Enter</span>
                                {verb}
                            </span>
                        )}
                        <span className="max-sm:hidden">
                            <span className="t-kbd">Esc</span>
                            Close
                        </span>
                    </>
                ) : (
                    <span className="max-sm:hidden">
                        <span className="t-kbd">Esc</span>
                        Back to results
                    </span>
                )}
                <span className="ml-auto">{scope}</span>
            </div>
        </>
    );
}

function optKey(o: Opt): string {
    switch (o.kind) {
        case "article":
            return `${o.recent ? "r" : "a"}:${o.a._id}`;
        case "topic":
            return `t:${o.c._id}`;
        case "question":
            return `q:${o.f.id}`;
        case "try":
            return `y:${o.text}`;
        default:
            return o.kind;
    }
}

function OptionRow({
    opt,
    id,
    index,
    selected,
    query,
    labelOf,
    onHover,
    onPick,
}: {
    opt: Opt;
    id: string;
    index: number;
    selected: boolean;
    query: string;
    labelOf: (a: ArticleCard) => string;
    onHover: () => void;
    onPick: () => void;
}) {
    if (opt.kind === "more") {
        return (
            <div
                role="option"
                id={id}
                data-opt={index}
                aria-selected={selected}
                onMouseMove={onHover}
                onClick={onPick}
                className="flex min-h-11 cursor-pointer items-center justify-center rounded-r1 px-3 text-[13px] font-medium text-r1-ink hover:bg-r1-fill aria-selected:bg-r1-fill"
            >
                Show all {countLabel(opt.total, "match", "matches")}
            </div>
        );
    }

    let icon: LucideIcon = Book;
    let title = "";
    let meta: string | null = null;
    let kbd: string | null = null;
    switch (opt.kind) {
        case "ai":
            icon = Sparkles;
            title = `Ask the AI: “${query}”`;
            meta = "Get a short answer with its sources";
            kbd = "Enter";
            break;
        case "try":
            icon = Sparkles;
            title = opt.text;
            meta = "Ask Tendso AI";
            break;
        case "article":
            icon = opt.recent ? Clock : Book;
            title = opt.a.title;
            meta = [labelOf(opt.a), `${opt.a.readMin} min read`].filter(Boolean).join(" · ");
            break;
        case "topic":
            icon = PanelsTopLeft;
            title = opt.c.title;
            meta = opt.c.workspace === "wiki" ? "Creator wiki topic" : "Topic";
            break;
        case "question":
            icon = CircleQuestionMark;
            title = opt.f.question;
            meta = opt.f.answer;
            break;
    }
    const isAi = opt.kind === "ai" || opt.kind === "try";

    return (
        <div
            role="option"
            id={id}
            data-opt={index}
            aria-selected={selected}
            onMouseMove={onHover}
            onClick={onPick}
            className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-r1 px-3 py-2 text-sm text-r1-ink hover:bg-r1-fill aria-selected:bg-r1-fill"
        >
            <span
                className={cx(
                    "inline-flex size-8 shrink-0 items-center justify-center rounded-r1",
                    isAi ? "bg-r1-gold-bg text-r1-gold-ink" : "bg-r1-fill text-r1-ink-2",
                )}
            >
                <Icon icon={icon} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-medium leading-5">{title}</span>
                {meta && <span className="t-meta truncate">{meta}</span>}
            </span>
            {kbd && <span className="t-kbd shrink-0 max-sm:hidden">{kbd}</span>}
        </div>
    );
}

function LoadingRows() {
    return (
        <div aria-hidden="true" className="flex flex-col gap-1 p-1">
            {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="flex min-h-[52px] items-center gap-3 px-2">
                    <Skeleton width={32} height={32} />
                    <span className="flex flex-1 flex-col gap-1.5">
                        <Skeleton width="55%" height={12} />
                        <Skeleton width="35%" height={10} />
                    </span>
                </div>
            ))}
        </div>
    );
}
