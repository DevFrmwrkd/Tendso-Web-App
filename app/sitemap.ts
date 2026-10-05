import type { MetadataRoute } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { SITE_URL } from "@/lib/seo";

/**
 * sitemap.xml for tendso.com — static marketing pages + published KB articles.
 *
 * Business-profile URLs (/businesses/[slug]) are intentionally NOT here yet:
 * they need the generatedWebsites.slug field + content gate (Track B / D-E-F),
 * and listing thin/unvetted pages in the sitemap is a scaled-content risk.
 *
 * Revalidates hourly. If the KB query fails, fall back to static-only rather
 * than throwing (a broken sitemap is worse than a partial one).
 */
export const revalidate = 3600;

const STATIC_PATHS: Array<{ path: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
    // /for-business is gone (308 → "/", see next.config.ts). A redirecting URL
    // in a sitemap is a crawl error, and "/" below is the page it became.
    //
    // /start is deliberately NOT listed either: it is a four-step intake form
    // with nothing to index, it is linked from the navbar of every page so
    // crawlers cannot miss it, and ranking it would land cold search traffic in
    // a form instead of on the page that explains the offer.
    //
    // The Round 1 redesign merged /about into "/", /for-field-agents (and the
    // old /creators) into /for-creators, and /help-faq and /contact into the
    // Help Center. Those routes now 308 to their new home, so they are not
    // listed either: their content is reachable at the URLs below.
    { path: "/", priority: 1, freq: "weekly" },
    { path: "/for-creators", priority: 0.8, freq: "monthly" },
    { path: "/knowledge", priority: 0.9, freq: "daily" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((s) => ({
        url: `${SITE_URL}${s.path}`,
        changeFrequency: s.freq,
        priority: s.priority,
        lastModified: new Date(),
    }));

    let articleEntries: MetadataRoute.Sitemap = [];
    try {
        const slugs = await fetchQuery(api.knowledge.listPublishedHelpSlugs, {});
        articleEntries = slugs.map((a) => ({
            url: `${SITE_URL}/knowledge/${a.slug}`,
            lastModified: new Date(a.updatedAt),
            changeFrequency: "weekly" as const,
            priority: 0.7,
        }));
    } catch {
        // Convex unreachable at build/revalidate — ship static-only.
    }

    return [...staticEntries, ...articleEntries];
}
