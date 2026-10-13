"use client";

import { useState } from "react";
import type { FunctionReturnType } from "convex/server";
import Image from "next/image";
import { toast } from "sonner";

import { Button } from "@/components/r1/Button";
import { Field, Textarea } from "@/components/r1/Field";
import { api } from "@/convex/_generated/api";

type Queue = FunctionReturnType<typeof api.giveaway.reviewQueue>;
type Application = Queue["applications"][number];
type Actions = {
    onApprove: (id: Application["id"]) => Promise<void>;
    onReject: (id: Application["id"], reason: string) => Promise<void>;
};
type Filter = "pending" | "approved" | "rejected";
const FILTERS: { key: Filter; label: string }[] = [
    { key: "pending", label: "Needs review" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
];

export function ReviewBoard({
    queue,
    onApprove,
    onReject,
}: { queue: Queue } & Actions) {
    const [filter, setFilter] = useState<Filter>("pending");
    const counts = { pending: 0, approved: 0, rejected: 0 };
    for (const application of queue.applications)
        counts[
            application.canReview
                ? "pending"
                : application.status === "rejected"
                  ? "rejected"
                  : "approved"
        ]++;
    const applications = queue.applications.filter((application) =>
        filter === "pending"
            ? application.canReview
            : filter === "rejected"
              ? application.status === "rejected"
              : !application.canReview && application.status !== "rejected",
    );

    return (
        <div className="space-y-6">
            <div className="max-w-2xl space-y-2">
                <p className="t-label">An Off the Record community gift</p>
                <h1 className="t-h1">Giveaway applications</h1>
                <p className="t-body">
                    Check that the business has hung the Off the Record poster.
                    Approve eligible applications here; Tendso will build and
                    deliver their free website.
                </p>
            </div>
            <dl className="grid grid-cols-3 gap-2 sm:gap-4">
                {[
                    { label: "Need review", value: counts.pending },
                    { label: "Slots available", value: queue.slotsLeft },
                    { label: "Sites given", value: queue.given },
                ].map(({ label, value }) => (
                    <div key={label} className="t-card min-w-0 p-3 sm:p-5">
                        <dt className="t-meta">{label}</dt>
                        <dd className="mt-2 text-2xl font-semibold sm:text-3xl">
                            {value}
                        </dd>
                    </div>
                ))}
            </dl>
            <p className="t-meta">
                {queue.held} of {queue.cap} slots reserved.{" "}
                {queue.open
                    ? "Applications are open."
                    : "New applications are closed."}{" "}
                A rejected application releases its slot.
            </p>
            <div
                className="flex gap-2 overflow-x-auto pb-1"
                aria-label="Filter applications"
            >
                {FILTERS.map(({ key, label }) => (
                    <Button
                        key={key}
                        aria-pressed={filter === key}
                        variant={filter === key ? "primary" : "secondary"}
                        onClick={() => setFilter(key)}
                        className="shrink-0"
                    >
                        {label} ({counts[key]})
                    </Button>
                ))}
            </div>
            <div aria-live="polite" className="space-y-4">
                {applications.length === 0 ? (
                    <div className="t-card p-6">
                        <h2 className="t-h2">
                            {filter === "pending"
                                ? "You’re all caught up"
                                : "No applications here yet"}
                        </h2>
                        <p className="t-body mt-2">
                            {filter === "pending"
                                ? "New giveaway applications will appear here for OTR to review."
                                : "Applications appear here after a review decision."}
                        </p>
                    </div>
                ) : (
                    applications.map((application) => (
                        <ApplicationCard
                            key={application.id}
                            application={application}
                            onApprove={onApprove}
                            onReject={onReject}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

function ApplicationCard({
    application,
    onApprove,
    onReject,
}: { application: Application } & Actions) {
    const [confirmed, setConfirmed] = useState(false);
    const [rejecting, setRejecting] = useState(false);
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const submitted = new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeZone: "Asia/Manila",
    }).format(application.submittedAt);
    const decide = async (decision: "approve" | "reject") => {
        if (busy) return;
        if (
            decision === "approve" &&
            (!confirmed || !application.posterPhotoUrl)
        )
            return;
        if (decision === "reject" && !reason.trim()) {
            setError("Explain what the owner needs to fix.");
            return;
        }
        setBusy(true);
        setError("");
        try {
            if (decision === "approve") await onApprove(application.id);
            else await onReject(application.id, reason.trim());
            toast.success(
                decision === "approve"
                    ? `${application.businessName} approved for a free website.`
                    : `${application.businessName} rejected. The owner will receive your reason by email.`,
            );
        } catch {
            setError(
                "The decision could not be saved. Check your connection and review access, then try again. Another reviewer may have already handled this application.",
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <article className="t-card overflow-hidden">
            <div className="grid md:grid-cols-2">
                <div className="min-w-0 space-y-4 p-5 sm:p-6">
                    <div>
                        <p className="t-meta">Submitted {submitted}</p>
                        <h2 className="t-h2 mt-1 break-words">
                            {application.businessName}
                        </h2>
                        <p className="t-meta mt-1">
                            {application.businessType} · {application.city}
                        </p>
                    </div>
                    <dl className="space-y-3 text-sm">
                        <div>
                            <dt className="t-meta">Business address</dt>
                            <dd className="break-words">
                                {application.address}, {application.city}
                            </dd>
                        </div>
                        <div>
                            <dt className="t-meta">Owner</dt>
                            <dd>{application.ownerName}</dd>
                        </div>
                        <div>
                            <dt className="t-meta">Mobile</dt>
                            <dd>
                                <a
                                    href={`tel:${application.ownerPhone}`}
                                    className="t-link"
                                >
                                    {application.ownerPhone}
                                </a>
                            </dd>
                        </div>
                        {application.ownerEmail ? (
                            <div>
                                <dt className="t-meta">Email</dt>
                                <dd className="break-all">
                                    <a
                                        href={`mailto:${application.ownerEmail}`}
                                        className="t-link"
                                    >
                                        {application.ownerEmail}
                                    </a>
                                </dd>
                            </div>
                        ) : null}
                    </dl>
                    {!application.canReview ? (
                        <div className="rounded-lg bg-[var(--r1-fill-2)] p-4">
                            <p className="font-medium">
                                {application.status === "rejected"
                                    ? "Rejected"
                                    : application.givenFree
                                      ? "Website given free"
                                      : "Approved · Tendso is handling the website"}
                            </p>
                            {application.rejectionReason ? (
                                <p className="t-body mt-2 whitespace-pre-wrap">
                                    {application.rejectionReason}
                                </p>
                            ) : null}
                        </div>
                    ) : null}
                </div>
                <figure className="min-w-0 border-t border-[var(--r1-line)] bg-[var(--r1-fill-2)] p-5 sm:p-6 md:border-l md:border-t-0">
                    <figcaption className="t-label mb-3">
                        Poster photo submitted by the business
                    </figcaption>
                    {application.posterPhotoUrl ? (
                        <a
                            href={application.posterPhotoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                        >
                            <Image
                                src={application.posterPhotoUrl}
                                alt={`Off the Record poster photo from ${application.businessName}`}
                                width={800}
                                height={600}
                                unoptimized
                                className="max-h-80 w-full rounded-lg object-contain"
                            />
                            <span className="t-link mt-3 block text-sm">
                                Open full-size photo ↗
                            </span>
                        </a>
                    ) : (
                        <p className="t-body py-10">
                            No poster photo was submitted. Request a clear photo
                            before approving.
                        </p>
                    )}
                </figure>
            </div>
            {application.canReview ? (
                <div className="space-y-4 border-t border-[var(--r1-line)] p-5 sm:p-6">
                    {rejecting ? (
                        <>
                            <Field
                                label="What does the owner need to fix?"
                                required
                                help="This reason will be emailed to the owner. Be specific about the poster or eligibility issue."
                            >
                                <Textarea
                                    maxLength={500}
                                    rows={3}
                                    value={reason}
                                    onChange={(event) =>
                                        setReason(event.target.value)
                                    }
                                    disabled={busy}
                                />
                            </Field>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="danger"
                                    onClick={() => void decide("reject")}
                                    disabled={busy || !reason.trim()}
                                >
                                    {busy
                                        ? "Saving…"
                                        : "Reject and email owner"}
                                </Button>
                                <Button
                                    onClick={() => {
                                        setRejecting(false);
                                        setError("");
                                    }}
                                    disabled={busy}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </>
                    ) : (
                        <>
                            <label className="flex cursor-pointer items-start gap-3 text-sm">
                                <input
                                    type="checkbox"
                                    className="mt-1 h-4 w-4 shrink-0 accent-black"
                                    checked={confirmed}
                                    onChange={(event) =>
                                        setConfirmed(event.target.checked)
                                    }
                                    disabled={
                                        busy || !application.posterPhotoUrl
                                    }
                                />
                                <span>
                                    I checked the photo: an Off the Record
                                    poster is visibly hung at this business, and
                                    the business qualifies for the giveaway.
                                </span>
                            </label>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="primary"
                                    onClick={() => void decide("approve")}
                                    disabled={
                                        busy ||
                                        !confirmed ||
                                        !application.posterPhotoUrl
                                    }
                                >
                                    {busy ? "Saving…" : "Approve free website"}
                                </Button>
                                <Button
                                    onClick={() => {
                                        setRejecting(true);
                                        setError("");
                                    }}
                                    disabled={busy}
                                >
                                    Reject application
                                </Button>
                            </div>
                        </>
                    )}
                    {error ? (
                        <p role="alert" className="t-error">
                            {error}
                        </p>
                    ) : null}
                </div>
            ) : null}
        </article>
    );
}
