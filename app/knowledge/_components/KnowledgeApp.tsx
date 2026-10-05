"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { BookOpen, ChevronRight, Lock, Search } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

import { ButtonLink, EmptyState, Icon, Loading, ShowAllList, Skeleton, SkeletonRows, buttonClass, cx } from "@/components/r1";
import { api } from "@/convex/_generated/api";

import { BackButton } from "./ArticleParts";
import { ContactCard } from "./ContactCard";
import { FaqFold, type FaqRow } from "./FaqFold";
import { HcLink } from "./HcLink";
import { useHelpPalette } from "./HelpCenterShell";
import {
    HELP_HOME,
    WIKI_DESCRIPTION,
    WIKI_HOME,
    WIKI_TITLE,
    articleHref,
    articleLabel,
    categoryHref,
    countLabel,
    pickRelated,
} from "./model";
import type { Article, ArticleCard, Category, Faq, InitialHelp } from "./types";
import { ArticleLayout, Crumbs, Rail, type Crumb } from "./views";
import { useViewer, useWikiAccess } from "./viewer";

/*
 * The Help Center at /knowledge (board: HelpCenter). One page, two workspaces
 * from convex/knowledge.ts:
 *  - "help": the public Help Center, for business owners and anyone curious;
 *  - "wiki": the creator wiki, readable by admins and certified creators only.
 *
 * The view comes from the query, so every view is a link that can be shared:
 *   /knowledge                        home
 *   /knowledge?cat=<slug>             a Help Center topic
 *   /knowledge?ws=wiki                the creator wiki (locked when signed out)
 *   /knowledge?ws=wiki&cat=<slug>     a wiki topic
 *   /knowledge?ws=wiki&article=<slug> a wiki article
 *   /knowledge?q=<text>               home with the search palette open
 * A Help Center article is its own crawlable page, /knowledge/[slug]; the old
 * ?article= links to one are redirected there by ./page.tsx. The wiki stays
 * in here because only the browser knows who is reading.
 *
 * The server hands over the public Help Center for the first paint (so the
 * home is in the HTML), and the live Convex queries take over once they answer.
 */

type Route =
    | { kind: "home" }
    | { kind: "category"; slug: string }
    | { kind: "wiki" }
    | { kind: "wikiCategory"; slug: string }
    | { kind: "wikiArticle"; slug: string };

function routeOf(sp: { get(name: string): string | null }): Route {
    const cat = sp.get("cat");
    if (sp.get("ws") === "wiki") {
        const article = sp.get("article");
        if (article) return { kind: "wikiArticle", slug: article };
        if (cat) return { kind: "wikiCategory", slug: cat };
        return { kind: "wiki" };
    }
    if (cat) return { kind: "category", slug: cat };
    return { kind: "home" };
}

type HelpLists = { categories: Category[] | undefined; articles: ArticleCard[] | undefined; faqs: Faq[] | undefined };

const SITE = "Tendso Help Center";

export default function KnowledgeApp({ initial }: { initial: InitialHelp | null }) {
    const sp = useSearchParams();
    const route = routeOf(sp);
    const q = sp.get("q");
    const { openPalette } = useHelpPalette();

    // ?q= is where the site's search box in Google results sends people (the
    // WebSite SearchAction in lib/seo.ts): open the palette on their words.
    useEffect(() => {
        if (q) openPalette(q);
    }, [q, openPalette]);

    const access = useWikiAccess();
    const liveCats = useQuery(api.knowledge.listCategories, { workspace: "help" });
    const liveArts = useQuery(api.knowledge.listArticles, { workspace: "help" });
    const liveFaqs = useQuery(api.knowledge.listFaqs, { workspace: "help" });
    const help: HelpLists = {
        categories: liveCats ?? initial?.categories,
        articles: liveArts ?? initial?.articles,
        faqs: liveFaqs ?? initial?.faqs,
    };
    // The wiki is only asked for once Convex says this reader may read it.
    const wikiOn = access === true;
    const wikiCats = useQuery(api.knowledge.listCategories, wikiOn ? { workspace: "wiki" } : "skip");
    const wikiArts = useQuery(api.knowledge.listArticles, wikiOn ? { workspace: "wiki" } : "skip");
    const wikiFaqs = useQuery(api.knowledge.listFaqs, wikiOn ? { workspace: "wiki" } : "skip");

    const title = titleOf(route, help.categories, wikiCats, wikiArts);
    // A view change is a pushState, which leaves the tab title alone.
    useEffect(() => {
        document.title = title;
    }, [title]);

    switch (route.kind) {
        case "home":
            return <HomeView help={help} access={access} wikiCats={wikiCats} wikiArts={wikiArts} wikiFaqs={wikiFaqs} />;
        case "category":
            return <HelpTopicView slug={route.slug} help={help} access={access} />;
        default:
            return (
                <WikiView
                    route={route}
                    access={access}
                    helpCats={help.categories}
                    wikiCats={wikiCats}
                    wikiArts={wikiArts}
                />
            );
    }
}

function titleOf(route: Route, helpCats: Category[] | undefined, wikiCats: Category[] | undefined, wikiArts: Article[] | undefined): string {
    switch (route.kind) {
        case "home":
            return "Help Center — Tendso";
        case "category": {
            const c = helpCats?.find((x) => x.slug === route.slug);
            return c ? `${c.title} — ${SITE}` : `Help Center — Tendso`;
        }
        case "wiki":
            return `${WIKI_TITLE} — ${SITE}`;
        case "wikiCategory": {
            const c = wikiCats?.find((x) => x.slug === route.slug);
            return `${c ? c.title : WIKI_TITLE} — ${SITE}`;
        }
        case "wikiArticle": {
            const a = wikiArts?.find((x) => x.slug === route.slug);
            return `${a ? a.title : WIKI_TITLE} — ${SITE}`;
        }
    }
}

// ---------------- Home ----------------

function HomeView({
    help,
    access,
    wikiCats,
    wikiArts,
    wikiFaqs,
}: {
    help: HelpLists;
    access: boolean | undefined;
    wikiCats: Category[] | undefined;
    wikiArts: Article[] | undefined;
    wikiFaqs: Faq[] | undefined;
}) {
    const { isSignedIn } = useAuth();
    const isCreator = access === true;
    const { categories, articles } = help;
    const ready = categories !== undefined && articles !== undefined;

    // Board: the first three topics as cards (a certified creator also gets
    // the wiki as a fourth), the rest as links under them.
    const main = categories?.slice(0, 3) ?? [];
    const more = categories?.slice(3) ?? [];
    const countIn = (c: Category) => countLabel(articles?.filter((a) => a.categoryId === c._id).length ?? 0, "article");
    const popular = articles?.filter((a) => a.popular).slice(0, 4) ?? [];

    // The FAQ list follows the reader, as on the board: owners' questions for
    // the public, the wiki's for a certified creator.
    const faqSource = isCreator ? wikiFaqs : help.faqs;
    const faqPool = isCreator ? wikiArts : articles;
    const faqRows: FaqRow[] | undefined = faqSource?.map((f) => {
        const a = f.linkArticleSlug ? faqPool?.find((x) => x.slug === f.linkArticleSlug) : undefined;
        return { id: f._id, question: f.question, answer: f.answer, href: a ? articleHref(a) : null };
    });

    return (
        <div className="flex flex-col gap-10 lg:gap-12">
            <section className="flex flex-col gap-5 lg:gap-6">
                <div className="flex flex-col gap-1.5">
                    <h1 className="t-h1">Help Center</h1>
                    <p className="t-sub">What do you want to know?</p>
                </div>
                <SearchTrigger />
            </section>

            <section aria-labelledby="hc-topics-h" className="flex flex-col gap-4">
                <h2 id="hc-topics-h" className="t-h2">
                    Browse by topic
                </h2>
                {ready && main.length === 0 && !isCreator ? (
                    <p className="t-meta">No topics yet. Search above, or ask a person below.</p>
                ) : ready ? (
                    <>
                        <div className={cx("grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4", isCreator ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
                            {main.map((c) => (
                                <TopicCard key={c._id} href={categoryHref(c)} title={c.title} description={c.description} count={countIn(c)} />
                            ))}
                            {isCreator && (
                                <TopicCard
                                    href={WIKI_HOME}
                                    title={WIKI_TITLE}
                                    description={WIKI_DESCRIPTION}
                                    count={wikiCats ? countLabel(wikiCats.length, "topic") : null}
                                />
                            )}
                        </div>
                        {more.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1">
                                <span className="t-meta pr-1.5">More topics</span>
                                {more.map((c) => (
                                    <HcLink
                                        key={c._id}
                                        href={categoryHref(c)}
                                        className="inline-flex h-10 items-center gap-1.5 rounded-r1 px-2.5 text-[13px] text-r1-ink-2 hover:bg-r1-fill hover:text-r1-ink"
                                    >
                                        {c.title}
                                        <Icon icon={ChevronRight} />
                                    </HcLink>
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <Loading label="Loading topics">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4" aria-hidden="true">
                            {Array.from({ length: 3 }, (_, i) => (
                                <div key={i} className="flex flex-col gap-2.5 rounded-r1-card border border-r1-line p-5 sm:min-h-[148px]">
                                    <Skeleton width="50%" height={16} />
                                    <Skeleton width="85%" height={12} />
                                    <Skeleton width="30%" height={10} className="mt-auto" />
                                </div>
                            ))}
                        </div>
                    </Loading>
                )}
                {/* Until Convex knows who is reading, assume the public: most readers are. */}
                {!isCreator && <WikiLockRow signedIn={!!isSignedIn} />}
            </section>

            <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
                {!ready ? (
                    <div className="flex flex-col gap-4">
                        <h2 className="t-h2">Popular</h2>
                        <Loading label="Loading popular articles">
                            <SkeletonRows count={4} />
                        </Loading>
                    </div>
                ) : (
                    popular.length > 0 && (
                        <div className="flex flex-col gap-4">
                            <h2 className="t-h2">Popular</h2>
                            <div className="t-card overflow-hidden">
                                <div className="t-list">
                                    {popular.map((a) => (
                                        <ArticleRow
                                            key={a._id}
                                            href={articleHref(a)}
                                            title={a.title}
                                            sub={articleLabel(a, categories ?? [])}
                                            meta={`${a.readMin} min`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )
                )}
                <ContactCard className={cx(ready && popular.length === 0 && "lg:col-start-2")} />
            </section>

            <FaqFold faqs={faqRows} />
        </div>
    );
}

// The shortcut hint reads ⌘ on Apple keyboards and Ctrl elsewhere; the
// server cannot know which, so it renders Ctrl and the browser corrects it.
const subscribeNever = () => () => {};

function SearchTrigger() {
    const { openPalette } = useHelpPalette();
    const mod = useSyncExternalStore(
        subscribeNever,
        () => (/Mac|iPhone|iPad/i.test(navigator.userAgent) ? "⌘" : "Ctrl"),
        () => "Ctrl",
    );
    // A button that looks like the board's search field: it opens the palette,
    // where the typing happens, so a phone raises its keyboard only once.
    return (
        <button
            type="button"
            aria-haspopup="dialog"
            aria-keyshortcuts="Control+K Meta+K"
            onClick={() => openPalette()}
            className="flex h-12 w-full max-w-[760px] items-center gap-3 rounded-r1-card border border-r1-line-2 bg-r1-paper px-4 text-left text-base text-r1-ink-3 hover:border-r1-ink-4 sm:h-14 sm:pl-[18px]"
        >
            <Icon icon={Search} size={18} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">Search, or ask a question</span>
            <span className="flex shrink-0 items-center gap-1 max-lg:hidden" aria-hidden="true">
                <span className="t-kbd">{mod}</span>
                <span className="t-kbd">K</span>
            </span>
        </button>
    );
}

function TopicCard({ href, title, description, count }: { href: string; title: string; description: string; count: string | null }) {
    return (
        <HcLink
            href={href}
            className="flex min-w-0 flex-col items-start gap-1.5 rounded-r1-card border border-r1-line bg-r1-paper p-5 text-left hover:bg-r1-fill-row sm:min-h-[148px]"
        >
            <span className="text-base font-semibold leading-6 text-r1-ink">{title}</span>
            <span className="t-meta">{description}</span>
            {count && <span className="t-label t-num mt-auto pt-2">{count}</span>}
        </HcLink>
    );
}

function WikiLockRow({ signedIn }: { signedIn: boolean }) {
    return (
        <HcLink
            href={WIKI_HOME}
            className="flex w-full items-center gap-3 rounded-r1-card border border-r1-line bg-r1-fill-2 px-4 py-3 text-left text-sm text-r1-ink-2 hover:bg-r1-fill sm:min-h-[52px]"
        >
            <span className="flex shrink-0 text-r1-ink-3">
                <Icon icon={Lock} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
                <span className="font-medium text-r1-ink">{WIKI_TITLE}</span>
                <span className="t-meta">
                    Runbooks and payout details for certified creators. {signedIn ? "It opens once you are certified." : "Sign in to read."}
                </span>
            </span>
            <span className="flex shrink-0 text-r1-ink-4">
                <Icon icon={ChevronRight} />
            </span>
        </HcLink>
    );
}

type RowData = { key: string; href: string; title: string; sub?: string; meta?: string };

/** A list row that opens an article: the whole row is the link. */
function ArticleRow({ href, title, sub, meta }: Omit<RowData, "key">) {
    return (
        <HcLink href={href} className="t-row">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium leading-5 text-r1-ink">{title}</span>
                {sub && <span className="t-meta truncate">{sub}</span>}
            </span>
            {meta && <span className="t-meta t-num shrink-0">{meta}</span>}
            <span className="flex shrink-0 text-r1-ink-4">
                <Icon icon={ChevronRight} />
            </span>
        </HcLink>
    );
}

// ---------------- Topic pages ----------------

type RailGroup = { label: string; links: { href: string; label: string }[] };

function TopicView({
    backHref,
    trail,
    title,
    description,
    count,
    rows,
    rails,
}: {
    backHref: string;
    trail: Crumb[];
    title: string;
    description: string;
    count: string;
    rows: RowData[];
    rails: RailGroup[];
}) {
    return (
        <div className="flex flex-col gap-6">
            <Crumbs backHref={backHref} trail={trail} current={title} />
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start lg:gap-16">
                <div className="flex min-w-0 flex-col gap-6">
                    <header className="flex flex-col gap-1.5">
                        <h1 className="t-h1">{title}</h1>
                        {description && <p className="t-sub">{description}</p>}
                        <p className="t-meta t-num">{count}</p>
                    </header>
                    {rows.length > 0 ? (
                        <ShowAllList items={rows} initial={5} renderItem={(r) => <ArticleRow key={r.key} href={r.href} title={r.title} sub={r.sub} meta={r.meta} />} />
                    ) : (
                        <EmptyState
                            className="t-card"
                            icon={<Icon icon={BookOpen} size={18} />}
                            title="No articles here yet"
                            body="Search the Help Center, or ask a person: the card on the Help Center home has every way to reach us."
                            action={
                                <HcLink href={HELP_HOME} className={buttonClass()}>
                                    Back to Help Center
                                </HcLink>
                            }
                        />
                    )}
                </div>
                {rails.length > 0 && (
                    <div className="flex flex-col gap-6 lg:pt-1">
                        {rails.map((g) => (
                            <Rail key={g.label} label={g.label}>
                                <nav aria-label={g.label} className="flex flex-col gap-0.5">
                                    {g.links.map((l) => (
                                        <HcLink
                                            key={l.href}
                                            href={l.href}
                                            className="flex min-h-10 items-center rounded-r1 px-3 py-1 text-[13px] leading-[18px] text-r1-ink-3 hover:bg-r1-fill hover:text-r1-ink"
                                        >
                                            {l.label}
                                        </HcLink>
                                    ))}
                                </nav>
                            </Rail>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function ViewSkeleton({ label }: { label: string }) {
    return (
        <Loading label={label}>
            <div className="flex flex-col gap-6" aria-hidden="true">
                <Skeleton width={220} height={16} />
                <div className="flex flex-col gap-3">
                    <Skeleton width="45%" height={36} />
                    <Skeleton width="65%" height={14} />
                </div>
                <SkeletonRows count={5} />
            </div>
        </Loading>
    );
}

function NotHere({ title, backHref, backLabel }: { title: string; backHref: string; backLabel: string }) {
    return (
        <div className="flex flex-col gap-6">
            <Crumbs backHref={backHref} trail={[]} />
            <EmptyState
                icon={<Icon icon={Search} size={18} />}
                title={title}
                body="It may have been renamed or taken down. Search for it, or start from the list."
                action={
                    <HcLink href={backHref} className={buttonClass()}>
                        {backLabel}
                    </HcLink>
                }
            />
        </div>
    );
}

function HelpTopicView({ slug, help, access }: { slug: string; help: HelpLists; access: boolean | undefined }) {
    const { categories, articles } = help;
    if (!categories || !articles) return <ViewSkeleton label="Loading the topic" />;
    const c = categories.find((x) => x.slug === slug);
    if (!c) return <NotHere title="We could not find that topic" backHref={HELP_HOME} backLabel="Back to Help Center" />;

    const inTopic = articles.filter((a) => a.categoryId === c._id);
    const others = categories.filter((x) => x._id !== c._id).map((x) => ({ href: categoryHref(x), label: x.title }));
    if (access === true) others.push({ href: WIKI_HOME, label: WIKI_TITLE });
    return (
        <TopicView
            backHref={HELP_HOME}
            trail={[]}
            title={c.title}
            description={c.description}
            count={countLabel(inTopic.length, "article")}
            rows={inTopic.map((a) => ({ key: a._id, href: articleHref(a), title: a.title, sub: a.summary, meta: `${a.readMin} min` }))}
            rails={others.length ? [{ label: "Other topics", links: others }] : []}
        />
    );
}

// ---------------- Creator wiki ----------------

function WikiView({
    route,
    access,
    helpCats,
    wikiCats,
    wikiArts,
}: {
    route: Exclude<Route, { kind: "home" } | { kind: "category" }>;
    access: boolean | undefined;
    helpCats: Category[] | undefined;
    wikiCats: Category[] | undefined;
    wikiArts: Article[] | undefined;
}) {
    if (access === undefined) return <ViewSkeleton label="Loading the creator wiki" />;
    if (access === false) return <GatedView />;
    if (!wikiCats || !wikiArts) return <ViewSkeleton label="Loading the creator wiki" />;

    const topicTitle = (a: ArticleCard) => wikiCats.find((c) => c._id === a.categoryId)?.title;
    const helpTopics = { label: "Other topics", links: (helpCats ?? []).map((c) => ({ href: categoryHref(c), label: c.title })) };

    if (route.kind === "wikiArticle") {
        const a = wikiArts.find((x) => x.slug === route.slug);
        if (!a) return <NotHere title="We could not find that article" backHref={WIKI_HOME} backLabel="Back to the creator wiki" />;
        return (
            <ArticleLayout
                article={a}
                trail={[{ label: WIKI_TITLE, href: WIKI_HOME }]}
                backHref={WIKI_HOME}
                related={pickRelated(a, wikiArts, wikiCats)}
            />
        );
    }

    if (route.kind === "wikiCategory") {
        const c = wikiCats.find((x) => x.slug === route.slug);
        if (!c) return <NotHere title="We could not find that topic" backHref={WIKI_HOME} backLabel="Back to the creator wiki" />;
        const inTopic = wikiArts.filter((a) => a.categoryId === c._id);
        const otherTopics = wikiCats.filter((x) => x._id !== c._id).map((x) => ({ href: categoryHref(x), label: x.title }));
        return (
            <TopicView
                backHref={WIKI_HOME}
                trail={[{ label: WIKI_TITLE, href: WIKI_HOME }]}
                title={c.title}
                description={c.description}
                count={countLabel(inTopic.length, "article")}
                rows={inTopic.map((a) => ({ key: a._id, href: articleHref(a), title: a.title, sub: a.summary, meta: `${a.readMin} min` }))}
                rails={[{ label: "Wiki topics", links: otherTopics }, helpTopics].filter((g) => g.links.length > 0)}
            />
        );
    }

    // The whole wiki, as on the board: every article, its topic in front of its summary.
    return (
        <TopicView
            backHref={HELP_HOME}
            trail={[]}
            title={WIKI_TITLE}
            description={WIKI_DESCRIPTION}
            count={countLabel(wikiCats.length, "topic")}
            rows={wikiArts.map((a) => {
                const topic = topicTitle(a);
                return { key: a._id, href: articleHref(a), title: a.title, sub: topic ? `${topic} · ${a.summary}` : a.summary, meta: `${a.readMin} min` };
            })}
            rails={[{ label: "Wiki topics", links: wikiCats.map((x) => ({ href: categoryHref(x), label: x.title })) }, helpTopics].filter(
                (g) => g.links.length > 0,
            )}
        />
    );
}

/** The wiki, locked: signed out (the board's gated view), or signed in but not certified yet. */
function GatedView() {
    const { isSignedIn } = useAuth();
    const viewer = useViewer();
    const signedIn = !!isSignedIn;
    // Their home by role (lib/creatorGate): training, waiting for approval…
    const home = viewer.status === "signedIn" ? viewer.home : "/dashboard";
    return (
        <div className="flex flex-col gap-6">
            <nav aria-label="Breadcrumb">
                <BackButton fallbackHref={HELP_HOME} />
            </nav>
            <div className="mx-auto flex w-full max-w-[600px] flex-col items-center gap-4 rounded-r1-card border border-r1-line px-5 py-8 text-center sm:mt-6 sm:p-10">
                <span className="t-icon-disc size-12">
                    <Icon icon={Lock} size={20} />
                </span>
                <h1 className="t-h1">The creator wiki is for certified creators</h1>
                <p className="t-body max-w-[460px]">
                    {signedIn
                        ? "Runbooks, payout details, and field playbooks live here. They open once your creator account is certified; until then, keep browsing the Help Center."
                        : "Runbooks, payout details, and field playbooks live here. Sign in as a certified Tendso creator to read them, or keep browsing the Help Center."}
                </p>
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                    {signedIn ? (
                        <ButtonLink variant="primary" href={home}>
                            Go to my home
                        </ButtonLink>
                    ) : (
                        <ButtonLink variant="primary" href="/login">
                            Sign in
                        </ButtonLink>
                    )}
                    <HcLink href={HELP_HOME} className={buttonClass()}>
                        Back to Help Center
                    </HcLink>
                </div>
                {!signedIn && (
                    <p className="t-meta">
                        Not a creator yet?{" "}
                        <Link href="/for-creators" className="t-link">
                            See how creators earn
                        </Link>
                    </p>
                )}
            </div>
        </div>
    );
}
