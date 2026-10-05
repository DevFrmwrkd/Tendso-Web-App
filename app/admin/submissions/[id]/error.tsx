"use client";

import { ArrowLeft } from "lucide-react";

import { ButtonLink, ErrorState, Icon } from "@/components/r1";

/**
 * The review workspace failed to load (a Convex query threw while rendering).
 * Says so with the kit's error state instead of a blank screen, and keeps the
 * one way out the workspace header would have offered.
 */
export default function SubmissionReviewError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <div className="r1 flex min-h-dvh flex-col bg-r1-paper">
            <div className="flex h-16 flex-none items-center border-b border-r1-line px-3">
                <ButtonLink variant="ghost" href="/admin/submissions" className="px-2.5">
                    <Icon icon={ArrowLeft} />
                    Submissions
                </ButtonLink>
            </div>
            <div className="flex flex-1 items-center justify-center p-4">
                <ErrorState what="This submission" reference={error.digest ?? null} />
            </div>
        </div>
    );
}
