"use client"

import { useQuery } from "convex/react"
import Link from "next/link"

import { Dot, Folds, Loading, Skeleton, SkeletonRows } from "@/components/r1"
import { api } from "@/convex/_generated/api"

import { keyLine } from "../_lib/train"
import BulkFold from "./BulkFold"
import KeyBanner from "./KeyBanner"
import TrainedSection from "./TrainedSection"
import UnansweredSection from "./UnansweredSection"

/**
 * The body of Train AI (board TrainAI), top to bottom: the key banner when no
 * key works, the questions the AI could not answer, "Add many at once", the
 * trained answers, and the state of the key pool. Each section holds its own
 * queries; the ones they share (listTrainingQA, poolStats) are one
 * subscription each in the Convex client.
 */
export default function TrainAiScreen() {
    // AI-key health: the page can't run the AI without a usable Gemini key.
    const poolStats = useQuery(api.aiKeys.poolStats, {})
    const trained = useQuery(api.knowledgeTraining.listTrainingQA, {})

    const hasUsableKey = poolStats ? poolStats.usableNow > 0 : undefined // undefined while loading
    const learning = trained?.filter((t) => !t.embedded).length ?? 0

    return (
        <>
            {poolStats && !hasUsableKey && <KeyBanner stats={poolStats} learning={learning} />}

            <UnansweredSection hasUsableKey={hasUsableKey} />

            <Folds>
                <BulkFold hasUsableKey={hasUsableKey} />
            </Folds>

            <TrainedSection />

            {poolStats && (
                <p className="flex flex-wrap items-center gap-2 text-[13px] leading-[18px] text-r1-ink-3">
                    <Dot tone={poolStats.usableNow > 0 ? "done" : "bad"} />
                    <span>{keyLine(poolStats)}</span>
                    {/* The Account page's AI key section (what /connect-ai redirects to). */}
                    <Link className="t-link" href="/profile?edit=ai#ai-key">
                        Add a key
                    </Link>
                </p>
            )}
        </>
    )
}

/** The body's shape while the admin check loads. */
export function TrainAiSkeleton() {
    return (
        <Loading label="Loading Train AI">
            <div className="flex flex-col gap-8 lg:gap-10" aria-hidden="true">
                <div className="flex flex-col gap-4">
                    <Skeleton width="45%" height={16} />
                    <Skeleton width="80%" height={12} />
                    <SkeletonRows count={4} />
                </div>
                <Skeleton height={52} />
                <div className="flex flex-col gap-4">
                    <Skeleton width="30%" height={16} />
                    <SkeletonRows count={4} />
                </div>
            </div>
        </Loading>
    )
}
