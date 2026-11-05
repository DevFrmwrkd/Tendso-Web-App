import Link from "next/link";
import type { ReactNode } from "react";

import { Nav } from "../Nav";

/** The creator program shares the same Sign in entry as every public page. */
export function ProgramNav() {
    return (
        <Nav
            primaryAction={
                <Link className="btn btn--accent btn--sm" href="/affiliates/join">
                    Apply now
                </Link>
            }
        />
    );
}

/** The quiet bar on the standalone pages (sign-up, portal, link pages). */
export function SoloBar({ brandHref = "/affiliates", right, children }: { brandHref?: string; right?: ReactNode; children?: ReactNode }) {
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
export function MiniFoot({ links, note, brandHref = "/" }: { links: { label: string; href: string }[]; note?: string; brandHref?: string }) {
    return (
        <footer className="cp-mini-foot">
            <Link className="brand" href={brandHref}>
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

