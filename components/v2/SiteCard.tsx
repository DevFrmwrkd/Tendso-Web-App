import { ArrowUpRight } from "lucide-react";
import Image from "next/image";

import { cx } from "./cx";

/**
 * A showcase capture: a browser frame around a screenshot of a finished Tendso
 * site, with name and place underneath. It always opens in a new tab, and says so
 * to assistive tech. The address in the bar is decorative.
 */
export function SiteCard({
    href,
    name,
    kind,
    city,
    host,
    image,
    priority,
    className,
}: {
    href: string;
    name: string;
    kind?: string;
    city?: string;
    /** Shown in the fake address bar, e.g. "vulca.tendso.site". */
    host: string;
    image: { src: string; alt?: string };
    priority?: boolean;
    className?: string;
}) {
    return (
        <a
            className={cx("v2-sitecard", className)}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${name}${kind ? `, ${kind}` : ""}${city ? `, ${city}` : ""}. Opens in a new tab`}
        >
            <span className="v2-browser">
                <span className="v2-browser-bar" aria-hidden="true">
                    <span className="v2-browser-dots">
                        <i />
                        <i />
                        <i />
                    </span>
                    <span className="v2-browser-url">{host}</span>
                </span>
                <span className="v2-browser-view">
                    <Image
                        src={image.src}
                        alt={image.alt ?? `${name} website`}
                        fill
                        sizes="(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 420px"
                        priority={priority}
                    />
                </span>
            </span>
            <span className="v2-sitecard-meta">
                <b>{name}</b>
                <span>
                    {city}
                    <ArrowUpRight size={16} aria-hidden="true" />
                </span>
            </span>
            {kind && <span className="v2-sitecard-kind">{kind}</span>}
        </a>
    );
}
