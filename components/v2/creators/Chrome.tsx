import Link from "next/link";
import type { ReactNode } from "react";

import { Nav } from "../Nav";

/** The site links the mock's top nav carries. "For creators" is this section. */
export const CREATOR_NAV_LINKS = [
    { label: "How it works", href: "/v2#how" },
    { label: "For businesses", href: "/v2/business" },
    { label: "For field agents", href: "/v2/field-agents" },
    { label: "For creators", href: "/v2/creators" },
    { label: "About", href: "/v2/about" },
] as const;

/** Top nav of /v2/creators: the shared v2 nav with "Creator log in" and "Apply now". */
export function ProgramNav() {
    return (
        <Nav
            links={CREATOR_NAV_LINKS}
            secondaryAction={
                <Link className="btn btn--line btn--sm" href="/v2/creators/portal">
                    Creator log in
                </Link>
            }
            primaryAction={
                <Link className="btn btn--accent btn--sm" href="/v2/creators/signup">
                    Apply now
                </Link>
            }
        />
    );
}

/** The quiet bar on the standalone pages (sign-up, portal, link pages). */
export function SoloBar({ brandHref = "/v2/creators", right, children }: { brandHref?: string; right?: ReactNode; children?: ReactNode }) {
    return (
        <header className="cp-bar">
            <div className="wrap cp-bar-in">
                <Link className="brand" href={brandHref} aria-label="Tendso">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/v2/brand/mark-ink-256.png" alt="" width={26} height={26} />
                    tendso
                </Link>
                {children}
                {right ? <div className="cp-bar-r">{right}</div> : null}
            </div>
        </header>
    );
}

/** The small footer under the standalone pages. */
export function MiniFoot({ links, note }: { links: { label: string; href: string }[]; note?: string }) {
    return (
        <footer className="cp-mini-foot">
            <Link className="brand" href="/v2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/v2/brand/mark-ink-256.png" alt="" width={26} height={26} />
                tendso
            </Link>
            {links.map((l) => (
                <Link key={l.href + l.label} href={l.href}>
                    {l.label}
                </Link>
            ))}
            {note ? <span>{note}</span> : null}
        </footer>
    );
}

