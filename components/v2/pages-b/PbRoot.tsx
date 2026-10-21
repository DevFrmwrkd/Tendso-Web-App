import type { ReactNode } from "react";

import { V2Root } from "@/components/v2";

import "./pages-b.css";

/** The v2 scope plus the `pb-sp` page scope, and the styles of the pages in this folder. Used by every route's layout. */
export function PbRoot({ children }: { children: ReactNode }) {
    return (
        <V2Root>
            <div className="pb-sp">{children}</div>
        </V2Root>
    );
}
