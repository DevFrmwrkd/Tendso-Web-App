import { SUPPORT_EMAIL } from "@/lib/contact";

/** Where "Message us" goes: an email to the team with the question filled in. */
export function messageUsHref(question?: string): string {
    const subject = "A question about Tendso";
    const body = question ? `Hi Tendso,\n\n${question}\n` : "Hi Tendso,\n\n";
    return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Where a source opens: the article's own crawlable page (the Help Center keeps these routes). */
export function sourceHref(slug: string): string {
    return `/knowledge/${encodeURIComponent(slug)}`;
}

const SHORT_MAX = 340;

/** Plain text, no markdown, and a short version that ends on a sentence. */
export function tidy(answer: string): { short: string; full: string; clipped: boolean } {
    const full = answer
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/^\s*[-*]\s+/gm, "• ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    if (full.length <= SHORT_MAX) return { short: full, full, clipped: false };
    const head = full.slice(0, SHORT_MAX);
    const cut = Math.max(head.lastIndexOf(". "), head.lastIndexOf(".\n"), head.lastIndexOf("? "), head.lastIndexOf("! "));
    const short = (cut > 120 ? head.slice(0, cut + 1) : head.replace(/\s+\S*$/, "") + "…").trim();
    return { short, full, clipped: short.length < full.length };
}
