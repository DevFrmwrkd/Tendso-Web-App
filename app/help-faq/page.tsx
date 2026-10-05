import { permanentRedirect } from "next/navigation";

// /help-faq is now part of the Help Center: "FAQ lives in the Help Center
// (one place to look)". Its questions were not in the knowledge base, so they
// moved with it (app/knowledge/_components/creatorFaq.ts) and sit under "For
// creators" in the home's "Frequently asked" fold, which this anchor opens.
//
// The route stays as a permanent redirect because links to it are out there:
// the creator Profile menu, the old site footer, bookmarks. The query string
// comes along so campaign tags (?src=…) survive the hop.
export default async function HelpFaqRedirect({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const sp = await searchParams;
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
        if (v === undefined) continue;
        for (const one of Array.isArray(v) ? v : [v]) qs.append(k, one);
    }
    const query = qs.toString();
    permanentRedirect(`/knowledge${query ? `?${query}` : ""}#creator-faq`);
}
