import Link from "next/link";
import type { ReactNode } from "react";

import { Container } from "./Layout";
import { cx } from "./cx";
import { V2_FOOTER_LINKS, type V2Link } from "./links";
import styles from "./Footer.module.css";

/**
 * Footer shell: one line and two actions, a wordmark that bleeds to the page edges,
 * and a quiet bottom row (the /v2 site map, components/v2/links.ts).
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
        <footer className={cx("v2-foot", styles.footer)}>
            <Container>
                {actions && (
                    <div className={cx("v2-foot-top", styles.top)}>
                        <p className="v2-foot-line">{line}</p>
                        <div className="v2-foot-cta">{actions}</div>
                    </div>
                )}
            </Container>
            <p className={cx("v2-foot-mark", styles.mark)} aria-hidden="true">
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
