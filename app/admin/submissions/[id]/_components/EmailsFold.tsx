"use client";

/**
 * The emails the owner has had, inside the Details panel (board Review: the
 * "Emails sent" fold). This was /admin/submissions/[id]/emails; that route now
 * redirects here with the fold open.
 *
 * Same list as the page (see clientEmailsFor), same two actions per email:
 * Preview opens what the owner received (/api/preview-email), fetched when it is
 * asked for rather than every preview on arrival; Send again POSTs the email's
 * own endpoint, exactly as the page's "Send Email" button did.
 */

import { useState } from "react";
import { toast } from "sonner";

import { Button, Dialog, SkeletonText, Status } from "@/components/r1";

import { formatDate, type ClientEmail, type SubmissionDoc } from "./review";

const linkBtn =
    "inline-flex h-8 items-center border-0 bg-transparent p-0 text-[13px] font-medium text-r1-ink underline decoration-r1-ink-4 underline-offset-[3px] hover:decoration-r1-ink disabled:cursor-not-allowed disabled:opacity-45";

export function EmailsFold({ s, emails }: { s: SubmissionDoc; emails: ClientEmail[] }) {
    const [sendingType, setSendingType] = useState<string | null>(null);
    const [preview, setPreview] = useState<{ email: ClientEmail; html: string | null; error: string | null } | null>(null);

    async function handleSend(email: ClientEmail) {
        if (!email.sendEndpoint) return;
        setSendingType(email.type);
        try {
            const response = await fetch(email.sendEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    submissionId: s._id,
                    ...(email.sendType ? { type: email.sendType } : {}),
                }),
            });
            const json = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(json.error || `Failed (${response.status})`);
            }
            toast.success(`Sent to ${s.ownerEmail || "the business owner"}`, { description: email.label });
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Send failed", { description: email.label });
        } finally {
            setSendingType(null);
        }
    }

    async function openPreview(email: ClientEmail) {
        setPreview({ email, html: null, error: null });
        try {
            const response = await fetch(`/api/preview-email?submissionId=${s._id}&type=${email.type}`);
            if (!response.ok) throw new Error(`Failed to load ${email.label}`);
            const html = await response.text();
            setPreview((p) => (p && p.email.type === email.type ? { ...p, html } : p));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load the email preview";
            setPreview((p) => (p && p.email.type === email.type ? { ...p, error: message } : p));
        }
    }

    if (emails.length === 0) {
        return <p className="t-meta">No emails have gone to the owner yet.</p>;
    }

    return (
        <div className="flex flex-col">
            {emails.map((email) => {
                const meta = [
                    email.sentAt ? `Sent ${formatDate(email.sentAt)}` : email.type.startsWith("giveaway_") ? "Send not recorded" : null,
                    s.ownerEmail ? `to ${s.ownerEmail}` : "No owner email on file",
                ]
                    .filter(Boolean)
                    .join(" · ");
                return (
                    <div key={email.type} className="flex flex-col gap-1 border-b border-r1-line-3 py-2.5 last:border-b-0">
                        <div className="flex items-start justify-between gap-3">
                            <span className="flex min-w-0 flex-col gap-0.5">
                                <span className="text-sm leading-5 text-r1-ink-2">{email.label}</span>
                                <span className="t-meta break-words">{meta}</span>
                            </span>
                            {email.sentAt && <Status tone="done" word="Sent" />}
                        </div>
                        <div className="flex gap-4">
                            <button type="button" className={linkBtn} onClick={() => void openPreview(email)}>
                                Preview
                            </button>
                            {email.sendEndpoint ? <button
                                type="button"
                                className={linkBtn}
                                onClick={() => void handleSend(email)}
                                disabled={sendingType === email.type || !s.ownerEmail}
                                title={!s.ownerEmail ? "Business owner email is missing" : `Send to ${s.ownerEmail}`}
                            >
                                {sendingType === email.type ? "Sending…" : "Send again"}
                            </button> : null}
                        </div>
                    </div>
                );
            })}

            <Dialog
                open={!!preview}
                onClose={() => setPreview(null)}
                title={preview?.email.label ?? "Email"}
                className="w-[min(720px,calc(100vw_-_32px))]"
                footer={<Button onClick={() => setPreview(null)}>Close</Button>}
            >
                {preview && (
                    <>
                        <p className="t-meta">{preview.email.description}</p>
                        {preview.error ? (
                            <p className="t-error" role="alert">
                                {preview.error}
                            </p>
                        ) : preview.html === null ? (
                            <SkeletonText lines={5} />
                        ) : (
                            // The email exactly as the owner receives it. Sandboxed
                            // with no scripts: it is a document to read, not run.
                            <iframe
                                srcDoc={preview.html}
                                title={preview.email.label}
                                sandbox="allow-same-origin"
                                className="h-[60vh] w-full rounded-r1 border border-r1-line"
                            />
                        )}
                    </>
                )}
            </Dialog>
        </div>
    );
}
