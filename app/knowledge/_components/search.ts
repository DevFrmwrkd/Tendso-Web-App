import type { ArticleCard, Category } from "./types";

/* Client-side instant search for the command palette. The grounded *AI*
   answer is a separate path (CommandPalette → convex knowledgeAI.ask). The
   scorer is the one the Help Center has always used: title, then keywords,
   then summary, then body. */

const STOP = new Set(
    "the a an to my of for is in on at it as how do i can what where when why with your you our we".split(" "),
);

export function terms(q: string): string[] {
    return (q || "")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 2 && !STOP.has(t));
}

function bodyText(a: ArticleCard): string {
    return (a.body ?? [])
        .map((b) => ("text" in b ? b.text : "items" in b ? b.items.join(" ") : ""))
        .join(" ")
        .toLowerCase();
}

function scoreArticle(a: ArticleCard, ts: string[]): number {
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

/** Articles that match, best first. */
export function searchArticles<T extends ArticleCard>(q: string, articles: T[], limit = 8): T[] {
    const ts = terms(q);
    if (!ts.length) return [];
    return articles
        .map((a) => ({ item: a, score: scoreArticle(a, ts) }))
        .filter((r) => r.score > 0)
        .sort((x, y) => y.score - x.score)
        .slice(0, limit)
        .map((r) => r.item);
}

/** Categories (topics) that match, best first. */
export function searchCategories(q: string, categories: Category[], limit = 3): Category[] {
    const ts = terms(q);
    if (!ts.length) return [];
    return categories
        .map((c) => {
            const title = c.title.toLowerCase();
            const txt = `${title} ${c.description.toLowerCase()}`;
            let s = 0;
            for (const t of ts) {
                if (title.includes(t)) s += 5;
                if (txt.includes(t)) s += 2;
            }
            return { item: c, score: s };
        })
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((r) => r.item);
}

/** Questions (the FAQs, and the creator questions that came from /help-faq) that match, best first. */
export function searchQuestions<T extends { question: string; answer: string }>(q: string, items: T[], limit = 3): T[] {
    const ts = terms(q);
    if (!ts.length) return [];
    return items
        .map((f) => {
            const question = f.question.toLowerCase();
            const txt = `${question} ${f.answer.toLowerCase()}`;
            let s = 0;
            for (const t of ts) {
                if (question.includes(t)) s += 4;
                if (txt.includes(t)) s += 2;
            }
            return { item: f, score: s };
        })
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((r) => r.item);
}
