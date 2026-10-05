"use client";

import { useMutation, useQueries } from "convex/react";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button, Loading, SkeletonText, Textarea } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";

import { asList, errorText, whenText, type NoteRow } from "./leadUtils";

/** Older notes fold behind one button; the latest few sit right above the box for the next one. */
const SHOWN = 3;

/**
 * A lead's running log (api.leadNotes): every call or message, so the next
 * admin knows where it stands. Creators add notes from the mobile CRM too,
 * so an author is whoever wrote it, looked up by id.
 */
export function LeadNotes({ leadId, meId, now }: { leadId: Id<"leads">; meId: Id<"creators"> | null; now: number }) {
    const addNote = useMutation(api.leadNotes.add);
    const headingId = useId();
    const draftId = useId();
    const [draft, setDraft] = useState("");
    const [busy, setBusy] = useState(false);
    const [showAll, setShowAll] = useState(false);

    const request = useMemo(() => ({ notes: { query: api.leadNotes.getByLead, args: { leadId } } }), [leadId]);
    const notes = asList<NoteRow>(useQueries(request).notes);

    // getByLead answers newest first; the log reads oldest to newest, like a thread.
    const ordered = [...(notes.data ?? [])].sort((a, b) => a.createdAt - b.createdAt);
    const hiddenCount = showAll ? 0 : Math.max(0, ordered.length - SHOWN);
    const shown = ordered.slice(hiddenCount);

    // One creators.getById per distinct author, usually one or two people.
    const authorKey = [...new Set(ordered.map((n) => String(n.creatorId)))].sort().join(",");
    const authorRequest = useMemo(
        () =>
            Object.fromEntries(
                (authorKey ? authorKey.split(",") : []).map((id) => [id, { query: api.creators.getById, args: { id: id as Id<"creators"> } }] as const),
            ),
        [authorKey],
    );
    const authors = useQueries(authorRequest);

    const authorName = (creatorId: string): string | null => {
        if (meId && creatorId === String(meId)) return "You";
        const c = authors[creatorId] as Doc<"creators"> | null | undefined | Error;
        if (!c || c instanceof Error) return null;
        return [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || c.email || null;
    };

    const submit = async () => {
        const content = draft.trim();
        if (!content) {
            toast("Write the note first");
            return;
        }
        setBusy(true);
        try {
            await addNote({ leadId, content });
            setDraft("");
            toast.success("Note added");
        } catch (err) {
            toast.error(errorText(err, "Could not add the note"));
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="flex flex-col gap-2" aria-labelledby={headingId}>
            <h3 className="flex items-baseline gap-1.5 text-sm font-semibold leading-5 text-r1-ink" id={headingId}>
                Notes
                {notes.data && <span className="t-count">{notes.data.length}</span>}
            </h3>

            {notes.error ? (
                <p className="t-meta" role="alert">
                    Notes failed to load. Close this lead and open it again to retry.
                </p>
            ) : notes.data === undefined ? (
                <Loading label="Loading notes">
                    <SkeletonText lines={2} />
                </Loading>
            ) : ordered.length === 0 ? (
                <p className="t-meta">No notes yet. Write down every call or message so the next admin knows where it stands.</p>
            ) : (
                <div className="flex flex-col">
                    {hiddenCount > 0 && (
                        <button type="button" className="t-link cursor-pointer self-start py-1 text-[13px]" onClick={() => setShowAll(true)}>
                            Show {hiddenCount} earlier {hiddenCount === 1 ? "note" : "notes"}
                        </button>
                    )}
                    {shown.map((n) => {
                        const by = authorName(String(n.creatorId));
                        return (
                            <div key={n._id} className="flex flex-col gap-1 border-b border-r1-line-3 py-3">
                                <p className="t-body whitespace-pre-wrap break-words text-r1-ink">{n.content}</p>
                                <p className="t-meta">{[by, whenText(n.createdAt, now)].filter(Boolean).join(" · ")}</p>
                            </div>
                        );
                    })}
                </div>
            )}

            <label className="sr-only" htmlFor={draftId}>
                New note
            </label>
            <Textarea
                id={draftId}
                className="min-h-[72px]"
                placeholder="What happened? For example: called, no answer."
                value={draft}
                maxLength={2000}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                    // Ctrl/⌘ + Enter adds the note; Enter alone is a new line.
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        void submit();
                    }
                }}
            />
            <div className="flex justify-end">
                <Button size="sm" onClick={() => void submit()} disabled={busy} aria-busy={busy}>
                    Add note
                </Button>
            </div>
        </section>
    );
}
