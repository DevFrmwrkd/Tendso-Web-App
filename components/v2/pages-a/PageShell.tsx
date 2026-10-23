import type { ReactNode } from "react";

import { Button, Footer, Nav, V2Root, V2_ROUTES } from "@/components/v2";

import "./pages-a.css";
import { Reveals } from "./Reveals";

export type PageKey = "business" | "examples" | "agents" | "about" | "legal";

/**
 * The frame of every page in this stream: V2Root (+ the `pa` scope the page
 * styles hang off), the shared v2 Nav and Footer (components/v2/links.ts), and the reveal script. `nav` picks the
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
        <Button variant="ghost" size="sm" href={V2_ROUTES.hire}>
            Hire an agent
        </Button>
    );
    const primary = nav?.primary ?? (
        <Button size="sm" href={V2_ROUTES.download}>
            Download the app
        </Button>
    );
    return (
        <V2Root className={`pa pa-${page}${className ? ` ${className}` : ""}`}>
            <Nav secondaryAction={secondary} primaryAction={primary} />
            <main id="top">{children}</main>
            <Footer />
            <Reveals />
        </V2Root>
    );
}
