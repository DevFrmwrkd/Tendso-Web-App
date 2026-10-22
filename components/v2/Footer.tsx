import Link from "next/link";
import type { ReactNode } from "react";

import { Container } from "./Layout";
import { V2_FOOTER_LINKS, type V2Link } from "./links";

/**
 * Footer shell: one line and two actions, a wordmark that bleeds to the page edges,
 * and a quiet bottom row (Help · Contact · Field agents · Privacy · Terms).
 * Pass `actions` to show the closing line + buttons; omit it on pages that already
 * close with their own call to action.
 */
export function Footer({
    line = "The thinking ends here.",
    actions,
    links = V2_FOOTER_LINKS,
}: {
    line?: string;
    actions?: ReactNode;
    links?: readonly V2Link[];
}) {
    return (
        <footer className="v2-foot">
            <Container>
                {actions && (
                    <div className="v2-foot-top">
                        <p className="v2-foot-line">{line}</p>
                        <div className="v2-foot-cta">{actions}</div>
                    </div>
                )}
            </Container>
            <p className="v2-foot-mark" aria-hidden="true">
                <span>tendso</span>
            </p>
            <Container>
                <div className="v2-foot-bottom">
                    <span>&copy; {new Date().getFullYear()} Tendso</span>
                    {links.map((l) => (
                        <Link key={l.href} href={l.href}>
                            {l.label}
                        </Link>
                    ))}
                </div>
            </Container>
        </footer>
    );
}
