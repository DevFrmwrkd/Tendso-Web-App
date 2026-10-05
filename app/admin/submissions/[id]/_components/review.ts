import type { FunctionReturnType } from "convex/server";

import type { api } from "@/convex/_generated/api";
import { INTAKE_QUESTIONS, type IntakeQuestionKey } from "@/lib/narrativeFromQa";

/** The submission row with its creator joined (submissions.getByIdWithCreator). */
export type SubmissionDoc = NonNullable<FunctionReturnType<typeof api.submissions.getByIdWithCreator>>;
/** The generated website row (generatedWebsites.getBySubmissionId), htmlUrl resolved. */
export type WebsiteDoc = NonNullable<FunctionReturnType<typeof api.generatedWebsites.getBySubmissionId>>;

/** "Sep 28, 2026" */
export function formatDate(ts: number | null | undefined): string {
    if (!ts) return "";
    return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** "Sep 28, 2026, 2:14 PM" */
export function formatDateTime(ts: number | null | undefined): string {
    if (!ts) return "";
    return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

// ── The quality checklist ─────────────────────────────────────────────────
// The same five tests the page has always run, read straight off the row.
export function checklistFor(s: SubmissionDoc): { label: string; done: boolean }[] {
    return [
        { label: `Has photos (${s.photos?.length || 0})`, done: (s.photos?.length || 0) > 0 },
        { label: "Has audio or video", done: !!(s.audioStorageId || s.videoStorageId || s.audioUrl || s.videoUrl) },
        { label: "Has a transcript", done: !!s.transcript },
        {
            label: "Business info complete",
            done: !!(s.businessName && s.businessType && s.ownerName && s.ownerPhone && s.address && s.city),
        },
        { label: "Contact info complete", done: !!(s.ownerPhone && (s.ownerEmail || s.ownerPhone)) },
    ];
}

// ── The owner's typed answers ─────────────────────────────────────────────

export type QaPair = { q: string; a: string };

export type IntakeRow = {
    id: string;
    q: string;
    /** Empty string = nothing stored for this question. */
    a: string;
    /** From INTAKE_QUESTIONS. A blank optional answer is ordinary; a blank
     *  required one means something went missing between the form and the row. */
    optional: boolean;
};

/** Match a stored pair back to its canonical question, accepting either the
 *  machine key or the display text.
 *
 *  This is a deliberate local copy of the rule in lib/narrativeFromQa (which
 *  keeps its matcher private), and it is safe for the same reason
 *  submitOwnerIntake's copy is: pairs are STORED with the canonical display
 *  text, so every matcher only ever sees strings straight out of
 *  INTAKE_QUESTIONS. A reworded question orphans nothing — anything that fails
 *  to match is still rendered, see buildIntakeRows. */
function normalizeQuestion(q: string): string {
    return (q ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const QUESTION_KEY_LOOKUP: ReadonlyMap<string, IntakeQuestionKey> = new Map(
    INTAKE_QUESTIONS.flatMap((entry) => [
        [normalizeQuestion(entry.q), entry.key] as const,
        [normalizeQuestion(entry.key), entry.key] as const,
    ]),
);

/**
 * Pair every canonical question with what the owner actually typed.
 *
 * Walks INTAKE_QUESTIONS rather than the stored array on purpose: blank answers
 * are never written (convex/ownerIntake normalizeQa skips them), so a question
 * the owner skipped is simply absent from the row — and an absence that renders
 * as nothing is exactly what made a dropped answer invisible in the first place.
 * Unrecognised pairs are appended rather than discarded for the same reason.
 */
export function buildIntakeRows(qa: QaPair[]): IntakeRow[] {
    const answers = new Map<IntakeQuestionKey, string>();
    const extras: IntakeRow[] = [];

    qa.forEach((pair, index) => {
        const key = QUESTION_KEY_LOOKUP.get(normalizeQuestion(pair?.q));
        if (!key) {
            extras.push({
                id: `unmatched-${index}`,
                q: pair?.q || "Unlabelled question",
                a: pair?.a || "",
                optional: false,
            });
            return;
        }
        // First non-blank wins, matching buildNarrativeFromQa and normalizeQa.
        const answer = pair?.a ?? "";
        if (answer.trim().length > 0 && !answers.has(key)) answers.set(key, answer);
    });

    const rows = INTAKE_QUESTIONS.map<IntakeRow>((question) => ({
        id: question.key,
        q: question.q,
        a: answers.get(question.key) ?? "",
        optional: !!question.optional,
    }));

    return [...rows, ...extras];
}

// ── Emails sent to the owner ──────────────────────────────────────────────

export interface ClientEmail {
    /** The /api/preview-email `type`. */
    type: string;
    label: string;
    description: string;
    /** API endpoint to POST { submissionId } to in order to (re)send this email */
    sendEndpoint: string;
    /** Optional `type` body field forwarded to the send endpoint */
    sendType?: string;
    /** When the row records the send; most emails leave no timestamp. */
    sentAt?: number;
}

/**
 * Which emails the owner has had, as the old "Emails sent to client" page
 * listed them: inferred from the submission's status, because Convex keeps no
 * log of sent email. Where the row does record a send (the payment email's
 * sentEmailAt, the payment's paidAt) the date comes along.
 */
export function clientEmailsFor(s: SubmissionDoc): ClientEmail[] {
    const status = s.status;
    const hasCustomDomain = Boolean(s.requestedDomain);
    const list: ClientEmail[] = [];

    if (["pending_payment", "paid", "completed"].includes(status)) {
        list.push({
            type: "approval",
            label: "Website ready, with the payment link",
            description:
                "Sent when the website was deployed and shared with the client. Contains the website preview link and payment instructions.",
            sendEndpoint: "/api/send-website-email",
            sentAt: s.sentEmailAt,
        });
    }

    if (["paid", "completed"].includes(status)) {
        list.push({
            type: "payment_confirmation",
            label: "Payment confirmed",
            description: "Sent after the admin confirmed payment was received. Contains the payment confirmation and the live website link.",
            sendEndpoint: "/api/send-completed-website-email",
            sentAt: s.paidAt,
        });
    }

    // Completed-website email — available once the submission has been paid or
    // marked completed. Branches automatically based on whether a custom domain
    // is attached.
    if (["paid", "completed"].includes(status)) {
        list.push({
            type: "completed_website",
            label: hasCustomDomain ? "Website live on the custom domain" : "Website live",
            description: hasCustomDomain
                ? "Sent when the custom domain finishes provisioning. Includes the live URL and a year-1-paid renewal disclaimer for the business owner."
                : "Sent when the website is live on its own address. Contains the published link and a thank-you message.",
            sendEndpoint: "/api/send-completed-website-email",
        });
    }

    // Custom-domain-only emails: setup in progress + 30-day renewal reminder
    if (hasCustomDomain && ["paid", "completed"].includes(status)) {
        list.push({
            type: "domain_setup_progress",
            label: "Domain setup in progress",
            description:
                "Auto-sent when SSL provisioning starts. Tells the business owner the domain is registered and DNS is pointed, and that the SSL certificate is being issued by Cloudflare (2–10 min).",
            sendEndpoint: "/api/send-completed-website-email",
            sendType: "domain_setup_progress",
        });
        list.push({
            type: "domain_renewal_reminder",
            label: "Domain renewal reminder",
            description:
                "Auto-scheduled to send 30 days before the domain expires. Reminds the business owner that year 2 onwards is their responsibility.",
            sendEndpoint: "/api/send-completed-website-email",
            sendType: "domain_renewal_reminder",
        });
    }

    return list;
}
