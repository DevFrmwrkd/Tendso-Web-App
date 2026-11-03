import type { ReactNode } from "react";
import { PbRoot } from "@/components/v2/pages-b/PbRoot";

export default function HelpLayout({ children }: { children: ReactNode }) {
    return <PbRoot>{children}</PbRoot>;
}
