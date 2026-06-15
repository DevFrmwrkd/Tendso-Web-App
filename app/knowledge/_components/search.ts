import type { Article, Category, Faq } from "./types";

/* Client-side instant search (palette + results page). Mirrors the design
   prototype's search.jsx scorer. The grounded *AI* answer is a separate path
   (AnswerCard → convex knowledgeAI.ask). */

const STOP = new Set(
    "the a an to my of for is in on at it as how do i can what where when why with your you our we".split(" "),
);

export function terms(q: string): string[] {
    return (q || "")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 2 && !STOP.has(t));
}

function bodyText(a: Article): string {
    return a.body
        .map((b) => ("text" in b ? b.text : "items" in b ? b.items.join(" ") : ""))
        .join(" ")
        .toLowerCase();
}

function scoreArticle(a: Article, ts: string[]): number {
    const title = a.title.toLowerCase();
    const sum = a.summary.toLowerCase();
    const kw = (a.keywords || []).join(" ").toLowerCase();
    const bt = bodyText(a);
    let s = 0;
    for (const t of ts) {
        if (title.includes(t)) s += 6;
        if (title.startsWith(t)) s += 3;
        if (kw.includes(t)) s += 4;
        if (sum.includes(t)) s += 2;
        if (bt.includes(t)) s += 1;
    }
    if (a.popular) s += 0.4;
    return s;
}

export function searchArticles(q: string, articles: Article[], limit = 8): Article[] {
    const ts = terms(q);
    if (!ts.length) return [];
    return articles
        .map((a) => ({ item: a, score: scoreArticle(a, ts) }))
        .filter((r) => r.score > 0)
        .sort((x, y) => y.score - x.score)
        .slice(0, limit)
        .map((r) => r.item);
}

export function searchAll(
    q: string,
    data: { articles: Article[]; categories: Category[]; faqs: Faq[] },
): { articles: Article[]; categories: Category[]; faqs: Faq[] } {
    const ts = terms(q);
    if (!ts.length) return { articles: [], categories: [], faqs: [] };

    const articles = searchArticles(q, data.articles, 6);

    const categories = data.categories
        .map((c) => {
            const txt = (c.title + " " + c.description).toLowerCase();
            let s = 0;
            for (const t of ts) {
                if (c.title.toLowerCase().includes(t)) s += 5;
                if (txt.includes(t)) s += 2;
            }
            return { item: c, score: s };
        })
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
        .map((r) => r.item);

    const faqs = data.faqs
        .map((f) => {
            const txt = (f.question + " " + f.answer).toLowerCase();
            let s = 0;
            for (const t of ts) {
                if (f.question.toLowerCase().includes(t)) s += 4;
                if (txt.includes(t)) s += 2;
            }
            return { item: f, score: s };
        })
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((r) => r.item);

    return { articles, categories, faqs };
}

/** Split text into matched/unmatched parts for <mark> highlighting. */
export function highlightParts(text: string, q: string): { m: boolean; text: string }[] {
    const ts = terms(q);
    if (!ts.length) return [{ m: false, text }];
    const re = new RegExp("(" + ts.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "ig");
    const parts = text.split(re);
    return parts
        .filter((p) => p !== "")
        .map((p) => ({ m: ts.includes(p.toLowerCase()), text: p }));
}
