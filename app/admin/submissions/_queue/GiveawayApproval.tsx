import { Status } from "@/components/r1"
import { giveawayReview } from "@/lib/giveawayReview"
import type { GiveawayReviewRecord } from "@/lib/giveawayReview"

/** Eligibility is independent of the website's build and publishing progress. */
export function GiveawayApproval({ submission }: {
    submission: GiveawayReviewRecord & { rejectionReason?: string }
}) {
    const review = giveawayReview(submission)
    if (!review) return null
    const reviewedAt = review.reviewedAt === null ? null : new Date(review.reviewedAt)
    const reviewedDate = reviewedAt?.toLocaleString(undefined, {
        month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
    })
    return (
        <div role="group" aria-label="Giveaway approval" className="flex min-w-0 flex-col gap-1.5 rounded-r1 border border-r1-line bg-r1-fill p-4">
            <p className="t-field-label">Giveaway approval</p>
            <Status tone={review.tone} word={review.word} className="whitespace-normal break-words text-[14px] leading-5" />
            {(review.reviewer || reviewedDate) && (
                <p className="t-meta break-words">
                    {review.reviewer ? `Reviewed by ${review.reviewer}` : "Reviewed"}
                    {reviewedDate && reviewedAt && <> · <time dateTime={reviewedAt.toISOString()}>{reviewedDate}</time></>}
                </p>
            )}
            {review.state === "rejected" && submission.rejectionReason?.trim() && (
                <p className="t-body whitespace-pre-wrap break-words text-r1-red">Reason: {submission.rejectionReason.trim()}</p>
            )}
            <p className="t-help break-words">{review.nextStep}</p>
        </div>
    )
}
