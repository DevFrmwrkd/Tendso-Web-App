import type { ReactNode } from "react";

import { Button, Footer, Nav, V2Root } from "@/components/v2";

import "./pages-a.css";
import { PA_FOOTER_LINKS, PA_NAV_LINKS } from "./data";
import { Reveals } from "./Reveals";

export type PageKey = "business" | "examples" | "agents" | "about" | "legal";

/**
 * The frame of every page in this stream: V2Root (+ the `pa` scope the page
 * styles hang off), the v2 Nav and Footer, and the reveal script. `nav` picks the
 * two nav actions; the defaults are the owner ones (Hire an agent, Download the app).
 */
export function PageShell({
    page,
    nav,
    className,
    children,
}: {
    page: PageKey;
    nav?: { secondary?: ReactNode; primary?: ReactNode };
    className?: string;
    children: ReactNode;
}) {
    const secondary = nav?.secondary ?? (
        <Button variant="ghost" size="sm" href="/v2#hire">
            Hire an agent
        </Button>
    );
    const primary = nav?.primary ?? (
        <Button size="sm" href="#download">
            Download the app
        </Button>
    );
    return (
        <V2Root className={`pa pa-${page}${className ? ` ${className}` : ""}`}>
            <Nav homeHref="/v2" links={PA_NAV_LINKS} secondaryAction={secondary} primaryAction={primary} />
            <main id="top">{children}</main>
            <Footer links={PA_FOOTER_LINKS} />
            <Reveals />
        </V2Root>
    );
}
