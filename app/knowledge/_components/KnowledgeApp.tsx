"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Icon, Enso } from "./Icon";
import { CommandPalette } from "./CommandPalette";
import { Home, CategoryPage, ArticlePage, SearchResults, type Data } from "./views";
import type { Article, Category, Workspace } from "./types";

type View =
    | { name: "home" }
    | { name: "category"; category: Category }
    | { name: "article"; article: Article }
    | { name: "search"; query: string };

export default function KnowledgeApp() {
    const [workspace, setWorkspace] = useState<Workspace>("help");
    const [view, setView] = useState<View>({ name: "home" });
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [mounted, setMounted] = useState(false);
    const [pending, setPending] = useState<{ article?: string; cat?: string } | null>(null);

    const canWiki = useQuery(api.knowledge.canAccessWiki);
    const categories = useQuery(api.knowledge.listCategories, { workspace });
    const articles = useQuery(api.knowledge.listArticles, { workspace });
    const faqs = useQuery(api.knowledge.listFaqs, { workspace });

    const loading = categories === undefined || articles === undefined || faqs === undefined;
    const data: Data = { categories: categories ?? [], articles: articles ?? [], faqs: faqs ?? [] };

    // Deep-link from the URL on first mount (?ws=&article=&cat=).
    useEffect(() => {
        setMounted(true);
        const sp = new URLSearchParams(window.location.search);
        const ws = sp.get("ws");
        if (ws === "wiki" || ws === "help") setWorkspace(ws);
        const art = sp.get("article");
        const cat = sp.get("cat");
        if (art) setPending({ article: art });
        else if (cat) setPending({ cat });
    }, []);

    // Resolve the deep link once the workspace's data has loaded.
    useEffect(() => {
        if (!pending || loading) return;
        if (pending.article) {
            const a = data.articles.find((x) => x.slug === pending.article);
            if (a) setView({ name: "article", article: a });
        } else if (pending.cat) {
            const c = data.categories.find((x) => x.slug === pending.cat);
            if (c) setView({ name: "category", category: c });
        }
        setPending(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pending, loading, articles, categories]);

    // Keep the URL in sync with the current view (shareable links).
    useEffect(() => {
        if (!mounted) return;
        const sp = new URLSearchParams();
        sp.set("ws", workspace);
        if (view.name === "article") sp.set("article", view.article.slug);
        else if (view.name === "category") sp.set("cat", view.category.slug);
        window.history.replaceState(null, "", `?${sp.toString()}`);
    }, [workspace, view, mounted]);

    const openPalette = useCallback((seed = "") => {
        setQuery(seed);
        setPaletteOpen(true);
    }, []);
    const closePalette = useCallback(() => setPaletteOpen(false), []);

    const goHome = useCallback(() => {
        setView({ name: "home" });
        window.scrollTo(0, 0);
    }, []);
    const openCategory = useCallback((c: Category) => {
        setView({ name: "category", category: c });
        window.scrollTo(0, 0);
    }, []);
    const openArticle = useCallback((a: Article) => {
        setView({ name: "article", article: a });
        window.scrollTo(0, 0);
    }, []);
    const openSearch = useCallback((q: string) => {
        setQuery(q);
        setView({ name: "search", query: q });
        setPaletteOpen(false);
        window.scrollTo(0, 0);
    }, []);

    function switchWs(ws: Workspace) {
        if (ws === workspace) return;
        setWorkspace(ws);
        setView({ name: "home" });
        window.scrollTo(0, 0);
    }

    // Global shortcuts: ⌘K / Ctrl-K toggles, "/" opens.
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setPaletteOpen((o) => !o);
            } else if (
                e.key === "/" &&
                !paletteOpen &&
                !/INPUT|TEXTAREA/.test((document.activeElement as HTMLElement)?.tagName || "")
            ) {
                e.preventDefault();
                openPalette("");
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [paletteOpen, openPalette]);

    const wikiLocked = canWiki === false;
    const showGated = workspace === "wiki" && wikiLocked;

    const WsToggle = ({ className }: { className?: string }) => (
        <div className={"ws-toggle" + (className ? " " + className : "")} role="tablist">
            <button className={workspace === "help" ? "on" : ""} onClick={() => switchWs("help")}>
                Help Center
            </button>
            <button className={workspace === "wiki" ? "on" : ""} onClick={() => switchWs("wiki")}>
                Internal Wiki
                {wikiLocked && <Icon name="key" size={12} className="lock" />}
            </button>
        </div>
    );

    return (
        <div className="app">
            <header className="nav">
                <div className="wrap nav-in">
                    <Link href="/" className="brand">
                        <span className="mark">
                            <Enso size={30} color="var(--ink)" />
                        </span>
                        <span className="name">
                            <b>Tendso</b>
                        </span>
                    </Link>

                    <WsToggle className="desktop" />

                    <div className="nav-spacer" />

                    <button className="nav-search" onClick={() => openPalette("")} aria-label="Search">
                        <Icon name="search" size={17} style={{ color: "var(--ink-3)" }} />
                        <span className="ph">Search…</span>
                        <span className="kbd-row">
                            <span className="kbd">⌘</span>
                            <span className="kbd">K</span>
                        </span>
                    </button>

                    <button className="icon-btn" onClick={() => openPalette("")} aria-label="Search">
                        <Icon name="search" size={20} />
                    </button>
                    <Link href="/dashboard" className="avatar" title="Your account">
                        T
                    </Link>
                </div>
                <div className="mob-ws">
                    <WsToggle />
                </div>
            </header>

            <main style={{ flex: 1 }}>
                {showGated ? (
                    <GatedWiki />
                ) : view.name === "home" ? (
                    <Home
                        key={"home-" + workspace}
                        workspace={workspace}
                        data={data}
                        openPalette={openPalette}
                        onOpenCategory={openCategory}
                        onOpenArticle={openArticle}
                    />
                ) : view.name === "category" ? (
                    <CategoryPage
                        key={view.category._id}
                        category={view.category}
                        workspace={workspace}
                        data={data}
                        onOpenArticle={openArticle}
                        onOpenCategory={openCategory}
                        goHome={goHome}
                    />
                ) : view.name === "article" ? (
                    <ArticlePage
                        key={view.article._id}
                        article={view.article}
                        workspace={workspace}
                        data={data}
                        onOpenArticle={openArticle}
                        onOpenCategory={openCategory}
                        goHome={goHome}
                    />
                ) : view.name === "search" ? (
                    <SearchResults
                        key={"s-" + view.query}
                        query={view.query}
                        workspace={workspace}
                        data={data}
                        onOpenArticle={openArticle}
                        onOpenCategory={openCategory}
                        goHome={goHome}
                    />
                ) : null}
            </main>

            <footer className="foot">
                <div className="wrap foot-in">
                    <span className="brand" style={{ gap: 8 }}>
                        <Enso size={20} color="var(--ink-3)" />{" "}
                        <span style={{ fontFamily: "var(--serif)", fontSize: 16, color: "var(--ink-2)" }}>Tendso</span>
                    </span>
                    <span style={{ color: "var(--ink-3)" }}>© 2026 Tendso, Inc.</span>
                    <div className="links">
                        <Link href="/help-faq">Help &amp; FAQ</Link>
                        <Link href="/contact">Contact support</Link>
                        <Link href="/privacy-policy">Privacy</Link>
                    </div>
                </div>
            </footer>

            <CommandPalette
                open={paletteOpen}
                query={query}
                setQuery={setQuery}
                onClose={closePalette}
                workspace={workspace}
                data={data}
                onOpenArticle={openArticle}
                onOpenCategory={openCategory}
                onSeeAll={openSearch}
            />
        </div>
    );
}

function GatedWiki() {
    return (
        <div className="wrap">
            <div className="gated view-enter">
                <span className="gi">
                    <Icon name="key" size={26} />
                </span>
                <h2>The internal wiki is for field agents</h2>
                <p>
                    Runbooks, payout details, and field playbooks live here. Sign in as a certified Tendso creator to read them — or
                    switch to the Help Center for customer-facing guides.
                </p>
                <Link href="/login" className="btn btn-primary">
                    Sign in
                </Link>
            </div>
        </div>
    );
}
