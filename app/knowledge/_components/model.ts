import type { ArticleCard, Block, Category, Workspace } from "./types";

/*
 * Pure Help Center helpers: URLs, labels, dates, headings, related articles.
 * No React, no browser: the server article route and the client app share them.
 */

// ---- URLs ----
// A help article has its own crawlable route (/knowledge/[slug]). Everything
// else is a view of /knowledge chosen by its query: ?cat=, ?ws=wiki, and
// ?ws=wiki&article= for the gated wiki, which the server cannot render because
// it does not know who is reading.

export const HELP_HOME = "/knowledge";
export const WIKI_HOME = "/knowledge?ws=wiki";
/** The "Ask a person" card on the Help Center home. /contact redirects here. */
export const CONTACT_HREF = "/knowledge#contact";
/** The creator questions that used to be /help-faq. /help-faq redirects here. */
export const CREATOR_FAQ_HREF = "/knowledge#creator-faq";

export function articleHref(a: { slug: string; workspace: Workspace }): string {
    return a.workspace === "wiki"
        ? `/knowledge?ws=wiki&article=${encodeURIComponent(a.slug)}`
        : `/knowledge/${encodeURIComponent(a.slug)}`;
}

export function categoryHref(c: { slug: string; workspace: Workspace }): string {
    return c.workspace === "wiki"
        ? `/knowledge?ws=wiki&cat=${encodeURIComponent(c.slug)}`
        : `/knowledge?cat=${encodeURIComponent(c.slug)}`;
}

// ---- Labels ----

export const WIKI_TITLE = "Creator wiki";
export const WIKI_DESCRIPTION = "Runbooks, payout details, and field playbooks for certified creators.";

/** "3 articles", "1 article". */
export function countLabel(n: number, one: string, many = `${one}s`): string {
    return `${n} ${n === 1 ? one : many}`;
}

/** The line that says where an article lives: its category, or "Creator wiki · Topic". */
export function articleLabel(a: { categoryId: string; workspace: Workspace }, categories: Category[]): string {
    const c = categories.find((x) => x._id === a.categoryId);
    if (a.workspace === "wiki") return c ? `${WIKI_TITLE} · ${c.title}` : WIKI_TITLE;
    return c?.title ?? "";
}

// Manila time on the server and in every browser, so a date never differs
// between the server render and the reader's screen.
const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" });

export function formatDate(ms: number): string {
    return DATE.format(ms);
}

/** "Tendso Team · Updated Aug 12, 2026 · 3 min read" */
export function articleMeta(a: { author: string; updatedAt: number; readMin: number }): string {
    return [a.author, `Updated ${formatDate(a.updatedAt)}`, `${a.readMin} min read`].filter(Boolean).join(" · ");
}

// ---- Headings ----

/** Heading anchors. Same rule as before the redesign, so shared #links keep working. */
export function slugifyHeading(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}

export type Heading = { id: string; text: string };

export function headingsOf(body: Block[]): Heading[] {
    return body
        .filter((b): b is Extract<Block, { t: "h2" }> => b.t === "h2")
        .map((b) => ({ id: slugifyHeading(b.text), text: b.text }));
}

// ---- Related ----

export type RelatedItem = { key: string; href: string; title: string; label: string; readMin: number };

/** Three related articles from the same workspace: the same category first, then popular ones, then the rest. */
export function pickRelated(
    article: { _id: string; categoryId: string; workspace: Workspace },
    articles: ArticleCard[],
    categories: Category[],
): RelatedItem[] {
    const pool = articles.filter((a) => a._id !== article._id && a.workspace === article.workspace);
    const same = pool.filter((a) => a.categoryId === article.categoryId);
    const popular = pool.filter((a) => a.categoryId !== article.categoryId && a.popular);
    const rest = pool.filter((a) => a.categoryId !== article.categoryId && !a.popular);
    return [...same, ...popular, ...rest].slice(0, 3).map((a) => ({
        key: a._id,
        href: articleHref(a),
        title: a.title,
        label: articleLabel(a, categories),
        readMin: a.readMin,
    }));
}
