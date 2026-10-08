import { fetchQuery } from "convex/nextjs";
import { unstable_cache } from "next/cache";

import { api } from "@/convex/_generated/api";

import type { FeaturedSite } from "./featuredSites";

/*
 * The admin's curated Featured sites, read on the server, so the public pages
 * arrive with the real client sites already in their HTML. Without this the
 * server render shows the built-in fallback and the curated list only appears
 * once the live query connects in the browser, which is after a crawler has
 * read the page: the sites we host were linked from nowhere a search engine
 * could see. Server only (app/page.tsx, app/for-creators/page.tsx,
 * app/sitemap.ts).
 *
 * Returned as the raw setting, exactly what the live query answers, so
 * useFeaturedSites stays the one place that decides what to show.
 *
 * Kept five minutes in Next's data cache. fetchQuery always fetches with
 * no-store, and outside a cache scope that would make the landing render on
 * every request instead of being served prerendered.
 */

const fetchFeatured = unstable_cache(
    async () => (await fetchQuery(api.settings.get, { key: "featured_sites" })) as FeaturedSite[] | null,
    ["featured-sites-v1"],
    { revalidate: 300 },
);

/** null when nothing is saved or Convex cannot be reached: the page falls back to the built-in sites. */
export async function loadFeaturedSites(): Promise<FeaturedSite[] | null> {
    try {
        return await fetchFeatured();
    } catch {
        return null;
    }
}
