import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";

import { CAROUSEL_SITES } from "./landingData";

/**
 * The real client sites the public pages show as proof: the landing's "Real
 * sites" grid and the "Real shops, live now" row on /for-creators.
 *
 * The list is curated by an admin (Featured sites, the Convex setting
 * `featured_sites`, each {name, category, city, url}). The pages read it on the
 * server too (loadFeaturedSites) and pass it in as `initial`, so the curated
 * sites are in the HTML before the live query answers. When it is unset, empty,
 * or could not be read, the four built-in sites from landingData stand in, so
 * the pages always carry real proof and never ship an empty grid. Every entry
 * is a business we actually built for; nothing here is a mockup.
 */
export type FeaturedSite = { name: string; category: string; city: string; url: string };

const BUILT_IN: FeaturedSite[] = CAROUSEL_SITES.map((s) => ({
    name: s.name,
    category: s.category,
    city: s.city,
    url: s.url as string,
}));

/** The site the landing's hero frames. Fixed rather than read from Convex, so the first screen never waits on a query. */
export const HERO_SITE: FeaturedSite | undefined = BUILT_IN[0];

export function useFeaturedSites(initial?: FeaturedSite[] | null): FeaturedSite[] {
    const live = useQuery(api.settings.get, { key: "featured_sites" }) as FeaturedSite[] | null | undefined;
    // Until the live query answers, show what the server read, which is also
    // what the server rendered, so hydration matches.
    const featured = live === undefined ? initial : live;
    // A curated entry with no URL has nothing to preview or open.
    const curated = Array.isArray(featured) ? featured.filter((s) => !!s?.url) : [];
    return curated.length > 0 ? curated : BUILT_IN;
}

/** "https://hapag.pages.dev/" → "hapag.pages.dev", for the address bar drawn over a preview. */
export function hostOf(url: string): string {
    return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** Category and city, whichever exist: "Restaurant · Meycauayan, Bulacan". */
export function siteMeta(site: FeaturedSite): string {
    return [site.category, site.city].filter(Boolean).join(" · ");
}
