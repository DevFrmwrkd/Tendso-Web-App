/**
 * The status words the app uses, and nothing else (ComponentKit, "Status").
 *
 * A status is a small dot plus a word: never colour alone, never a filled
 * pill. Five tones:
 *
 *   attn      Needs you      action required from the person looking
 *   progress  In progress    waiting on someone else
 *   done      Done           live, paid, approved, came
 *   bad       Problem        failed, rejected, no-show
 *   off       Off            draft, inactive, cancelled, lost
 *
 * Map raw backend values through these functions so every list, drawer and
 * card says the same word for the same state. Pure: no React, safe in tests.
 */

export type Tone = "attn" | "progress" | "done" | "bad" | "off";
export type StatusWord = { tone: Tone; word: string };

/** Who is looking. The same submission needs the admin and waits on the creator. */
export type Viewer = "creator" | "admin" | "owner";

function humanize(raw: string): string {
    const s = raw.replace(/_/g, " ").trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Unknown";
}

/** submissions.status */
export function submissionStatus(status: string | null | undefined, viewer: Viewer = "creator"): StatusWord {
    switch (status) {
        case "draft":
            return { tone: "off", word: "Draft" };
        case "pending":
        case "submitted":
        case "in_review":
            return viewer === "admin" ? { tone: "attn", word: "Needs review" } : { tone: "progress", word: "In review" };
        case "approved":
        case "website_generated":
            return { tone: "progress", word: "Site generated" };
        case "deployed":
        case "pending_payment":
            return { tone: "progress", word: "Live — awaiting payment" };
        case "paid":
        case "completed":
            return { tone: "done", word: "Paid" };
        case "rejected":
            return { tone: "bad", word: "Rejected" };
        case "unpublished":
            return { tone: "off", word: "Unpublished" };
        default:
            return { tone: "off", word: humanize(status ?? "") };
    }
}

/** withdrawals.status. Payouts shows Wise's own state as the one status; the raw Wise value belongs in a fold. */
export function withdrawalStatus(status: string | null | undefined): StatusWord {
    switch (status) {
        case "pending":
        case "processing":
            return { tone: "progress", word: "Processing" };
        case "completed":
            return { tone: "done", word: "Paid out" };
        case "failed":
            return { tone: "bad", word: "Failed" };
        default:
            return { tone: "off", word: humanize(status ?? "") };
    }
}

/**
 * A creator's certification state, read from the timestamps the approval flow
 * writes (rejectedAt and certifiedAt are mutually exclusive; quizPassedAt is
 * set when the quiz is passed and the admin has not decided yet).
 */
export function creatorStatus(
    c: { certifiedAt?: number | null; quizPassedAt?: number | null; rejectedAt?: number | null },
    viewer: Viewer = "admin",
): StatusWord {
    if (c.rejectedAt) return { tone: "bad", word: "Rejected" };
    if (c.certifiedAt) return { tone: "done", word: "Certified" };
    if (c.quizPassedAt) {
        return viewer === "admin"
            ? { tone: "attn", word: "Waiting for approval" }
            : { tone: "progress", word: "Waiting for approval" };
    }
    return { tone: "off", word: "In training" };
}

/** leads.status */
export function leadStatus(status: string | null | undefined): StatusWord {
    switch (status) {
        case "new":
            return { tone: "attn", word: "New" };
        case "contacted":
            return { tone: "progress", word: "Contacted" };
        case "qualified":
            return { tone: "progress", word: "Qualified" };
        case "converted":
            return { tone: "done", word: "Converted" };
        case "lost":
            return { tone: "off", word: "Lost" };
        default:
            return { tone: "off", word: humanize(status ?? "") };
    }
}

/**
 * A field-agent call booking (native_bookings): its status, plus the
 * attendance an admin marks after the call.
 */
export function bookingStatus(
    b: { status: string; attendance?: string | null; startMs?: number | null },
    now: number = Date.now(),
): StatusWord {
    if (b.status === "cancelled") return { tone: "off", word: "Cancelled" };
    if (b.status === "failed") return { tone: "bad", word: "Failed" };
    if (b.status === "held") return { tone: "progress", word: "Holding the slot" };
    if (b.attendance === "attended") return { tone: "done", word: "Came" };
    if (b.attendance === "no_show") return { tone: "bad", word: "No-show" };
    if (b.startMs != null && b.startMs < now) return { tone: "attn", word: "Not answered yet" };
    return { tone: "progress", word: "Booked" };
}

/** submissions.customDomainStatus */
export function domainStatus(status: string | null | undefined): StatusWord {
    switch (status) {
        case "pending_payment":
            return { tone: "progress", word: "Awaiting payment" };
        case "registering":
        case "configuring_dns":
        case "provisioning_ssl":
            return { tone: "progress", word: "Setting up" };
        case "live":
            return { tone: "done", word: "Live" };
        case "failed":
            return { tone: "bad", word: "Failed" };
        default:
            return { tone: "off", word: humanize(status ?? "") };
    }
}
