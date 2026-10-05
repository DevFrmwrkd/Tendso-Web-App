"use client"

import { ErrorState } from "@/components/r1"

/**
 * A step that throws (a failing Convex query throws during render) shows the
 * kit's error state inside the creator's frame instead of a blank page. The
 * draft itself is safe: every step saves before it moves on.
 */
export default function SubmitError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
    return <ErrorState what="New submission" reference={error.digest ?? null} />
}
