"use client";

import { ArrowUpRight } from "lucide-react";

import { hostOf, siteMeta, useFeaturedSites, type FeaturedSite } from "@/components/landing/featuredSites";
import LiveSitePreview from "@/components/landing/LiveSitePreview";

/**
 * "Real Tendso sites": the same curated list the current landing shows (the admin's
 * Featured sites, read on the server and passed in as `initialSites`, with the
 * built-in sites as the fallback), drawn as v2 cards. Each opens the live site in a new tab.
 */
export function RealSites({ initialSites }: { initialSites?: FeaturedSite[] | null }) {
    const sites = useFeaturedSites(initialSites).slice(0, 4);
    return (
        <div className="real-grid">
            {sites.map((site, i) => (
                <a key={`${i}-${site.url}`} className="real-card" href={site.url} target="_blank" rel="noopener noreferrer" aria-label={`${site.name}. Opens in a new tab`}>
                    <span className="v2-browser">
                        <span className="v2-browser-bar" aria-hidden="true">
                            <span className="v2-browser-dots">
                                <i />
                                <i />
                                <i />
                            </span>
                            <span className="v2-browser-url">{hostOf(site.url)}</span>
                        </span>
                        <LiveSitePreview url={site.url} name={site.name} />
                    </span>
                    <span className="real-meta">
                        <b>
                            {site.name} <ArrowUpRight size={16} aria-hidden="true" style={{ display: "inline", verticalAlign: "-2px" }} />
                        </b>
                        <span>{siteMeta(site)}</span>
                    </span>
                </a>
            ))}
        </div>
    );
}
