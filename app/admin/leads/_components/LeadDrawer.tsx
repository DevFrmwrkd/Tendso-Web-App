"use client";

import { useMutation } from "convex/react";
import { Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Button, ConfirmDialog, DefList, DefRow, Drawer, Field, Fold, Icon, Input, leadStatus, MoreMenu, PhoneInput, Textarea } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { LeadNotes } from "./LeadNotes";
import { SocialCardEditor } from "./SocialCardEditor";
import { StatusSelect } from "./StatusSelect";
import {
    cardSummary,
    creatorOf,
    EMPTY_FORM,
    errorText,
    leadName,
    leadWaiting,
    originLine,
    shortDate,
    siteOf,
    sourceWord,
    telHref,
    validateLeadForm,
    type LeadForm,
    type LeadFormErrors,
    type LeadRow,
    type LeadStatusValue,
} from "./leadUtils";

/**
 * A customer lead's details (board AdminLeads, lead drawer): status, message,
 * contact facts, notes and the social card, with Edit details in the foot
 * and Delete in the More menu beside it. Edit turns the same drawer into the
 * form, as the board draws it. The parent mounts one per open lead (keyed by
 * id), so a different lead never inherits a half-typed edit.
 */
export function LeadDrawer({
    lead,
    city,
    now,
    meId,
    onClose,
    onDeleted,
}: {
    lead: LeadRow;
    city: string | null;
    now: number;
    meId: Id<"creators"> | null;
    onClose: () => void;
    onDeleted: (name: string) => void;
}) {
    const updateStatus = useMutation(api.leads.updateStatus);
    const updateLead = useMutation(api.leads.update);
    const deleteLead = useMutation(api.leads.remove);

    const [mode, setMode] = useState<"view" | "edit">("view");
    const [form, setForm] = useState<LeadForm>(EMPTY_FORM);
    const [errors, setErrors] = useState<LeadFormErrors>({});
    const [saving, setSaving] = useState(false);
    // The status just picked, shown until the query catches up: a controlled
    // select would otherwise snap back to the old value for a moment.
    const [pendingStatus, setPendingStatus] = useState<LeadStatusValue | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const formId = useId();

    const name = leadName(lead);
    const site = siteOf(lead);
    const creator = creatorOf(lead);
    const siteLine = site ? [site, city].filter(Boolean).join(" · ") : null;
    const status = pendingStatus ?? lead.status;
    const received = shortDate(lead.createdAt, now);
    const waiting = leadWaiting({ status, createdAt: lead.createdAt }, now);
    const statusHelp = status === "new" && waiting.text !== "Just now" ? `Received ${received} · waiting ${waiting.text}` : `Received ${received}`;

    const changeStatus = async (next: LeadStatusValue) => {
        if (next === status) return;
        setPendingStatus(next);
        try {
            await updateStatus({ id: lead._id, status: next });
            toast.success(`Status changed to ${leadStatus(next).word}`);
        } catch (err) {
            toast.error(errorText(err, "Could not change the status"));
        } finally {
            setPendingStatus(null);
        }
    };

    const startEdit = () => {
        setForm({ name: lead.name ?? "", phone: lead.phone ?? "", email: lead.email || "", message: lead.message || "" });
        setErrors({});
        setMode("edit");
    };

    const saveEdit = async () => {
        const found = validateLeadForm(form);
        setErrors(found);
        if (Object.keys(found).length > 0) return;
        setSaving(true);
        try {
            await updateLead({
                id: lead._id,
                name: form.name.trim(),
                phone: form.phone.trim(),
                email: form.email.trim() || undefined,
                message: form.message.trim() || undefined,
            });
            setMode("view");
            toast.success("Lead updated");
        } catch (err) {
            toast.error(errorText(err, "Could not update the lead"));
        } finally {
            setSaving(false);
        }
    };

    const confirmDelete = async () => {
        setDeleting(true);
        try {
            await deleteLead({ id: lead._id });
            setConfirmOpen(false);
            onDeleted(name);
        } catch (err) {
            toast.error(errorText(err, "Could not delete the lead"));
        } finally {
            setDeleting(false);
        }
    };

    // Typing in a field clears that field's error, as the old forms did.
    const setField = (key: keyof LeadForm, value: string) => {
        setForm((f) => ({ ...f, [key]: value }));
        if (key !== "message") setErrors((e) => ({ ...e, [key]: undefined }));
    };

    const footer =
        mode === "view" ? (
            <div className="flex w-full items-center justify-between gap-2">
                <MoreMenu
                    label={`More actions for ${name}`}
                    align="start"
                    // The foot is the bottom of the screen, so the menu opens upward.
                    className="[&>.t-menu]:top-auto [&>.t-menu]:bottom-[calc(100%_+_6px)]"
                    items={[{ label: "Delete lead", danger: true, icon: <Icon icon={Trash2} />, onSelect: () => setConfirmOpen(true) }]}
                />
                <Button onClick={startEdit}>Edit details</Button>
            </div>
        ) : (
            <>
                <Button onClick={() => setMode("view")} disabled={saving}>
                    Cancel
                </Button>
                <Button type="submit" form={formId} variant="primary" disabled={saving} aria-busy={saving}>
                    {saving ? "Saving…" : "Save changes"}
                </Button>
            </>
        );

    return (
        <>
            <Drawer open onClose={onClose} title={name} meta={originLine(lead)} closeLabel="Close lead details" footer={footer}>
                {mode === "view" ? (
                    <>
                        <StatusSelect label="Status" value={status} help={statusHelp} onChange={(next) => void changeStatus(next)} />

                        <div className="flex flex-col gap-2">
                            <span className="t-label">Message</span>
                            <p className="whitespace-pre-wrap break-words rounded-r1 bg-r1-fill-2 px-4 py-3 text-sm leading-5 text-r1-ink">
                                {lead.message?.trim() || "No message"}
                            </p>
                        </div>

                        <DefList>
                            <DefRow term="Phone">
                                {lead.phone ? (
                                    <a className="t-link t-num" href={telHref(lead.phone)}>
                                        {lead.phone}
                                    </a>
                                ) : (
                                    "Not given"
                                )}
                            </DefRow>
                            <DefRow term="Email">
                                {lead.email ? (
                                    <a className="t-link" href={`mailto:${lead.email}`}>
                                        {lead.email}
                                    </a>
                                ) : (
                                    "Not given"
                                )}
                            </DefRow>
                            <DefRow term="Source">{sourceWord(lead.source)}</DefRow>
                            <DefRow term="Site">{siteLine ?? "Not linked to a site"}</DefRow>
                            {creator && <DefRow term="Creator">{creator}</DefRow>}
                            <DefRow term="Received">{received}</DefRow>
                        </DefList>

                        <LeadNotes leadId={lead._id} meId={meId} now={now} />

                        <Fold
                            title={
                                <span className="flex min-w-0 flex-col gap-0.5">
                                    <span>Social card</span>
                                    <span className="t-meta font-normal">{cardSummary(lead)}</span>
                                </span>
                            }
                        >
                            <SocialCardEditor
                                lead={{
                                    _id: lead._id,
                                    name,
                                    adminDescription: lead.adminDescription ?? null,
                                    externalPreviewUrl: lead.externalPreviewUrl ?? null,
                                    previewImageUrl: lead.previewImageUrl ?? null,
                                    previewImageStorageKey: lead.previewImageStorageKey ?? null,
                                }}
                            />
                        </Fold>
                    </>
                ) : (
                    <form
                        id={formId}
                        noValidate
                        className="flex flex-col gap-6"
                        onSubmit={(e) => {
                            e.preventDefault();
                            void saveEdit();
                        }}
                    >
                        {siteLine && <p className="t-meta">Linked to {siteLine}</p>}
                        <Field label="Name" required error={errors.name}>
                            <Input value={form.name} autoComplete="off" onChange={(e) => setField("name", e.target.value)} />
                        </Field>
                        <Field label="Phone" required help="Digits only, 7 to 15." error={errors.phone}>
                            <PhoneInput value={form.phone} maxLength={15} autoComplete="off" onValueChange={(v) => setField("phone", v)} />
                        </Field>
                        <Field
                            label={
                                <>
                                    Email <span className="t-meta font-normal">(optional)</span>
                                </>
                            }
                            error={errors.email}
                        >
                            <Input type="email" value={form.email} autoComplete="off" onChange={(e) => setField("email", e.target.value)} />
                        </Field>
                        <Field
                            label={
                                <>
                                    Message <span className="t-meta font-normal">(optional)</span>
                                </>
                            }
                        >
                            <Textarea value={form.message} onChange={(e) => setField("message", e.target.value)} />
                        </Field>
                    </form>
                )}
            </Drawer>

            <ConfirmDialog
                open={confirmOpen}
                onCancel={() => setConfirmOpen(false)}
                onConfirm={() => void confirmDelete()}
                title={`Delete the lead from ${name}?`}
                confirmLabel="Delete lead"
                cancelLabel="Keep lead"
                confirmIcon={<Icon icon={Trash2} />}
                busy={deleting}
            >
                <p className="t-meta">{[lead.phone, site ?? "No site linked"].filter(Boolean).join(" · ")}</p>
                <p>This can’t be undone. Its notes and social card are deleted too.</p>
            </ConfirmDialog>
        </>
    );
}
