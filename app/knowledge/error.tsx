"use client";

import { ErrorState } from "@/components/r1";

/**
 * A Help Center page that throws while rendering (a failing Convex query
 * throws during render) shows the kit's error state inside the Help Center
 * frame, so the header and footer stay. Reload is a full reload, like the
 * app-wide app/error.tsx.
 */
export default function KnowledgeError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
    return <ErrorState what="The Help Center" reference={error.digest ?? null} />;
}
