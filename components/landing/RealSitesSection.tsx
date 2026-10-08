"use client";

import { ArrowUpRight } from "lucide-react";

import { Icon } from "@/components/r1";

import { siteMeta, useFeaturedSites, type FeaturedSite } from "./featuredSites";
import { useT } from "./i18n";
import { LANDING_BAND, LANDING_BAND_IN, SectionHead } from "./layout";
import SiteFrame from "./SiteFrame";

/**
 * Real sites (board: Landing, #sites) — the landing's one honest proof band.
 *
 * Everything here is TRUE: each card is a real client site, shown as a LIVE
 * preview of the actual page and opening it in a new tab. The list is the
 * admin's curated Featured sites, read on the server (`initialSites`) so the
 * links are in the HTML, with the four built-in sites standing in when it is
 * unset (see featuredSites.ts).
 *
 * The old band's counters (live sites from generatedWebsites.countPublished,
 * creators from creators.count) are gone with the old layout: the board has
 * no place for a number here, and the grid is the proof.
 */
export default function RealSitesSection({ initialSites }: { initialSites?: FeaturedSite[] | null }) {
    const { t } = useT();
    const sites = useFeaturedSites(initialSites);

    return (
        <section id="sites" aria-labelledby="sites-title" className={LANDING_BAND}>
            <div className={LANDING_BAND_IN}>
                <SectionHead id="sites-title" title={t("r1.landing.sites.title")} sub={t("r1.landing.sites.sub")} />
                <ul className="grid gap-x-6 gap-y-8 sm:grid-cols-2 xl:grid-cols-4">
                    {sites.map((site, i) => (
                        <li key={`${i}-${site.url}`} className="min-w-0">
                            <a href={site.url} target="_blank" rel="noreferrer" className="group flex flex-col gap-3 text-r1-ink">
                                <SiteFrame url={site.url} name={site.name} className="transition-colors group-hover:border-r1-line-2" />
                                <span className="flex flex-col gap-0.5">
                                    <span className="inline-flex items-start gap-1.5 text-[15px] font-semibold leading-[22px] underline-offset-[3px] group-hover:underline">
                                        {site.name}
                                        <Icon icon={ArrowUpRight} className="mt-[3px] flex-none text-r1-ink-3" />
                                    </span>
                                    <span className="t-meta">{siteMeta(site)}</span>
                                </span>
                                <span className="sr-only">({t("r1.landing.sites.newTab")})</span>
                            </a>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
