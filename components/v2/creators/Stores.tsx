"use client";

import { useStoreLinks } from "@/lib/v2/creatorData";

import { AppleIcon, PlayIcon } from "./icons";

/** The two store buttons (black, as Apple and Google ask). Links come from the admin settings, then lib/v2/appLinks.ts. */
export function StoreRow() {
    const links = useStoreLinks();
    return (
        <div className="cp-store-row">
            <a className="store" href={links.appStore} target="_blank" rel="noopener noreferrer">
                <AppleIcon />
                <span>
                    <small>Download on the</small>
                    <b>App Store</b>
                </span>
            </a>
            <a className="store" href={links.googlePlay} target="_blank" rel="noopener noreferrer">
                <PlayIcon />
                <span>
                    <small>Get it on</small>
                    <b>Google Play</b>
                </span>
            </a>
        </div>
    );
}
