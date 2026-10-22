"use client";

import { hasAnyStoreLink } from "@/lib/v2/appLinks";
import { useStoreLinks } from "@/lib/v2/useStoreLinks";

import { STORE_AVAILABILITY } from "./content";

/**
 * "Coming soon on the App Store and Google Play" until a store link exists
 * (admin settings or NEXT_PUBLIC_*_URL, lib/v2/appLinks.ts), then the links.
 */
export function StoreStatus({ as: Tag = "span", className, role }: { as?: "span" | "p"; className?: string; role?: string }) {
    const links = useStoreLinks();
    if (!hasAnyStoreLink(links)) {
        return (
            <Tag className={className} role={role}>
                {STORE_AVAILABILITY}
            </Tag>
        );
    }
    return (
        <Tag className={className} role={role}>
            {links.appStore && (
                <a href={links.appStore} target="_blank" rel="noopener noreferrer">
                    App Store
                </a>
            )}
            {links.appStore && links.googlePlay && " · "}
            {links.googlePlay && (
                <a href={links.googlePlay} target="_blank" rel="noopener noreferrer">
                    Google Play
                </a>
            )}
        </Tag>
    );
}
