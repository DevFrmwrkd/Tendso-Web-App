import type { ReactNode } from "react";

import { PbRoot } from "@/components/v2/pages-b/PbRoot";

export default function V2HelpLayout({ children }: { children: ReactNode }) {
    return <PbRoot>{children}</PbRoot>;
}
