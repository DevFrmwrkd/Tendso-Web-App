"use client";

import { hasAnyStoreLink } from "@/lib/v2/appLinks";
import { useStoreLinks } from "@/lib/v2/useStoreLinks";

import { STORE_AVAILABILITY } from "./content";
import { AppleIcon, PlayIcon } from "./icons";

/**
 * The landing's store buttons: "Coming soon on the App Store and Google Play"
 * until a store link exists (admin settings or NEXT_PUBLIC_*_URL,
 * lib/v2/appLinks.ts), then the mock's buttons for the listed stores.
 *  - "icons": the two round icon buttons next to the hero CTA;
 *  - "badges": the black store badges in the Download path.
 */
export function StoreStatus({ variant }: { variant: "icons" | "badges" }) {
    const links = useStoreLinks();
    if (!hasAnyStoreLink(links)) {
        return variant === "icons" ? <span className="hero-stores hero-stores--soon">{STORE_AVAILABILITY}</span> : <p role="status">{STORE_AVAILABILITY}</p>;
    }
    if (variant === "icons") {
        return (
            <span className="hero-stores">
                {links.appStore && (
                    <a href={links.appStore} target="_blank" rel="noopener noreferrer" aria-label="Download on the App Store">
                        <AppleIcon />
                    </a>
                )}
                {links.googlePlay && (
                    <a href={links.googlePlay} target="_blank" rel="noopener noreferrer" aria-label="Get it on Google Play">
                        <PlayIcon />
                    </a>
                )}
            </span>
        );
    }
    return (
        <div className="stores">
            {links.appStore && (
                <a className="store" href={links.appStore} target="_blank" rel="noopener noreferrer" aria-label="Download on the App Store">
                    <AppleIcon />
                    <b>App Store</b>
                </a>
            )}
            {links.googlePlay && (
                <a className="store" href={links.googlePlay} target="_blank" rel="noopener noreferrer" aria-label="Get it on Google Play">
                    <PlayIcon />
                    <b>Google Play</b>
                </a>
            )}
        </div>
    );
}
