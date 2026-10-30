import { notFound } from "next/navigation";

import { SampleOwnerEditor } from "@/components/v2/owner-editor/sample";

/** Development and review only: the editor on a local sample site. */
export default function SampleMySitePage() {
    if (process.env.NODE_ENV === "production") notFound();
    return <SampleOwnerEditor />;
}
