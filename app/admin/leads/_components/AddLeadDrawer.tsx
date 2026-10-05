"use client";

import { useMutation, useQueries, type RequestForQueries } from "convex/react";
import { Search } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button, Drawer, Field, Icon, Input, PhoneInput, Textarea } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

import { EMPTY_FORM, errorText, validateLeadForm, type LeadForm, type LeadFormErrors, type Loaded, type SubmissionRow } from "./leadUtils";

/** How many matching submissions the picker lists at once. */
const MAX_RESULTS = 6;

/**
 * Add a lead (board AdminLeads, "Add a lead"): for someone who reached a
 * business by phone, walk-in or chat, not through its site. Opens in the
 * 480px drawer, which is a full-screen sheet on a phone and keeps Cancel and
 * Add lead in view while the form scrolls.
 *
 * Same call as the old modal: leads.create with source "direct", linked to a
 * submission (and so to its creator, who gets the "New Lead!" notification)
 * only when one is picked. Esc or the scrim close the drawer and keep what
 * was typed; Cancel clears it.
 */
export function AddLeadDrawer({
    open,
    onClose,
    submissions,
    onAdded,
}: {
    open: boolean;
    onClose: () => void;
    submissions: Loaded<SubmissionRow[]>;
    onAdded: (name: string) => void;
}) {
    const createLead = useMutation(api.leads.create);
    const formId = useId();
    const searchId = useId();
    const searchHelpId = useId();

    const [form, setForm] = useState<LeadForm>(EMPTY_FORM);
    const [errors, setErrors] = useState<LeadFormErrors>({});
    const [query, setQuery] = useState("");
    const [linked, setLinked] = useState<SubmissionRow | null>(null);
    const [busy, setBusy] = useState(false);

    // The creator a linked submission credits: submissions.getAll carries only their id.
    const linkedCreatorId = linked?.creatorId ?? null;
    const creatorRequest = useMemo(() => {
        const request: RequestForQueries = {};
        if (linkedCreatorId) request.creator = { query: api.creators.getById, args: { id: linkedCreatorId } };
        return request;
    }, [linkedCreatorId]);
    const linkedCreator = useQueries(creatorRequest).creator as Doc<"creators"> | null | undefined | Error;
    const creatorName =
        linkedCreator && !(linkedCreator instanceof Error) ? [linkedCreator.firstName, linkedCreator.lastName].filter(Boolean).join(" ").trim() : "";

    const q = query.trim().toLowerCase();
    const results = q && submissions.data ? submissions.data.filter((s) => s.businessName?.toLowerCase().includes(q)).slice(0, MAX_RESULTS) : [];

    const reset = () => {
        setForm(EMPTY_FORM);
        setErrors({});
        setQuery("");
        setLinked(null);
    };

    // Typing in a field clears that field's error, as the old form did.
    const setField = (key: keyof LeadForm, value: string) => {
        setForm((f) => ({ ...f, [key]: value }));
        if (key !== "message") setErrors((e) => ({ ...e, [key]: undefined }));
    };

    const pick = (s: SubmissionRow) => {
        setLinked(s);
        setQuery("");
    };

    const submit = async () => {
        const found = validateLeadForm(form);
        setErrors(found);
        if (Object.keys(found).length > 0) return;
        setBusy(true);
        try {
            const name = form.name.trim();
            await createLead({
                name,
                phone: form.phone.trim(),
                email: form.email.trim() || undefined,
                message: form.message.trim() || undefined,
                source: "direct",
                // Only link to a submission if one was selected
                submissionId: linked?._id,
                creatorId: linked?.creatorId,
            });
            reset();
            onAdded(name);
        } catch (err) {
            toast.error(errorText(err, "Could not add the lead"));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Drawer
            open={open}
            onClose={onClose}
            title="Add a lead"
            meta="For someone who reached a business by phone, walk-in or chat, not through its site."
            closeLabel="Close"
            footer={
                <>
                    <Button
                        disabled={busy}
                        onClick={() => {
                            reset();
                            onClose();
                        }}
                    >
                        Cancel
                    </Button>
                    <Button type="submit" form={formId} variant="primary" disabled={busy} aria-busy={busy}>
                        {busy ? "Adding…" : "Add lead"}
                    </Button>
                </>
            }
        >
            <form
                id={formId}
                noValidate
                className="flex flex-col gap-6"
                onSubmit={(e) => {
                    e.preventDefault();
                    void submit();
                }}
            >
                <div className="t-field">
                    {linked ? (
                        <>
                            <span className="t-field-label">
                                Link to a submission <span className="t-meta font-normal">(optional)</span>
                            </span>
                            <div className="flex items-center justify-between gap-3 rounded-r1 border border-r1-line bg-r1-fill-2 px-3 py-2.5">
                                <span className="flex min-w-0 flex-col gap-0.5">
                                    <span className="truncate text-sm font-medium leading-5 text-r1-ink">{linked.businessName}</span>
                                    <span className="t-meta">{[linked.businessType, linked.city].filter(Boolean).join(" · ")}</span>
                                    {creatorName && <span className="t-meta">Credited to {creatorName}</span>}
                                </span>
                                <Button size="sm" variant="ghost" onClick={() => setLinked(null)}>
                                    Remove
                                </Button>
                            </div>
                        </>
                    ) : (
                        <>
                            <label className="t-field-label" htmlFor={searchId}>
                                Link to a submission <span className="t-meta font-normal">(optional)</span>
                            </label>
                            <div className="t-input-wrap">
                                <span className="t-ico-l">
                                    <Icon icon={Search} />
                                </span>
                                <input
                                    id={searchId}
                                    type="search"
                                    className="t-input"
                                    placeholder="Search a business name"
                                    autoComplete="off"
                                    value={query}
                                    aria-describedby={searchHelpId}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        // Enter picks the first match instead of submitting the form.
                                        if (e.key !== "Enter") return;
                                        e.preventDefault();
                                        if (results[0]) pick(results[0]);
                                    }}
                                />
                            </div>
                            <p className="t-help" id={searchHelpId}>
                                Linking credits the lead to that site and its creator.
                            </p>
                            {q &&
                                (submissions.error ? (
                                    <p className="t-meta" role="alert">
                                        Submissions failed to load, so a site cannot be linked right now. The lead can still be added without one.
                                    </p>
                                ) : submissions.data === undefined ? (
                                    <p className="t-meta">Loading submissions…</p>
                                ) : results.length === 0 ? (
                                    <p className="t-meta">No submission matches that name.</p>
                                ) : (
                                    <div className="flex flex-col overflow-hidden rounded-r1 border border-r1-line">
                                        {results.map((s) => (
                                            <button
                                                key={s._id}
                                                type="button"
                                                className="flex min-h-11 w-full cursor-pointer flex-col items-start justify-center gap-0.5 border-b border-r1-line-3 bg-r1-paper px-3 py-1.5 text-left last:border-b-0 hover:bg-r1-fill-row"
                                                onClick={() => pick(s)}
                                            >
                                                <span className="text-sm font-medium leading-5 text-r1-ink">{s.businessName}</span>
                                                <span className="t-meta">
                                                    {[s.businessType, s.city, s.ownerName ? `${s.ownerName} (owner)` : null].filter(Boolean).join(" · ")}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                ))}
                        </>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Name" required error={errors.name}>
                        <Input placeholder="Contact name" autoComplete="off" value={form.name} onChange={(e) => setField("name", e.target.value)} />
                    </Field>
                    <Field label="Phone" required help="Digits only, 7 to 15." error={errors.phone}>
                        <PhoneInput placeholder="09XXXXXXXXX" maxLength={15} autoComplete="off" value={form.phone} onValueChange={(v) => setField("phone", v)} />
                    </Field>
                </div>

                <Field
                    label={
                        <>
                            Email <span className="t-meta font-normal">(optional)</span>
                        </>
                    }
                    error={errors.email}
                >
                    <Input type="email" placeholder="name@example.com" autoComplete="off" value={form.email} onChange={(e) => setField("email", e.target.value)} />
                </Field>

                <Field
                    label={
                        <>
                            Message <span className="t-meta font-normal">(optional)</span>
                        </>
                    }
                >
                    <Textarea
                        className="min-h-20"
                        placeholder="What did they ask for?"
                        value={form.message}
                        onChange={(e) => setField("message", e.target.value)}
                    />
                </Field>
            </form>
        </Drawer>
    );
}
