"use client";

import { useMutation } from "convex/react";
import { Send, User } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Avatar, Button, Field, Icon, Textarea } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { errorMessage, timeAgo } from "./leadUtils";

type Note = { _id: string; content: string; createdAt: number; creatorId: string | null };
type PendingNote = { tempId: string; content: string; createdAt: number };

/** Notes beyond this many wait behind "Show all" (kit: lists cap at 3–5 rows). */
const NOTES_SHOWN = 5;

/**
 * The lead's notes thread (board: Leads, drawer "Notes"), for an interviewed
 * lead and a prospect alike: field tips for whoever goes next.
 *
 * Mount it with key={leadId} so the draft and the pending notes belong to one
 * lead.
 */
export function LeadNotes({
    leadId,
    notes,
    me,
    authors,
}: {
    leadId: Id<"leads">;
    /** Newest first, as both detail queries return them. */
    notes: Note[];
    me: { id: string; name: string };
    /**
     * Display names the lead's own data already carries (the submitter, the
     * interviewers, the claimer), by creator id. The notes themselves only
     * carry a creator id, so anyone else reads "Someone on the team".
     */
    authors: Map<string, string>;
}) {
    // Spec contract: api.leadNotes.add({ leadId, content }); creatorId is
    // derived server-side from the Clerk identity.
    const addNote = useMutation(api.leadNotes.add);
    const [draft, setDraft] = useState("");
    const [posting, setPosting] = useState(false);
    // Optimistic notes: added locally on submit so the thread updates at once,
    // dropped as soon as the mutation resolves (the real note arrives through
    // the reactive query) or fails (the draft comes back for a retry).
    const [pending, setPending] = useState<PendingNote[]>([]);
    const [showAll, setShowAll] = useState(false);
    const headingId = useId();

    const post = async () => {
        const trimmed = draft.trim();
        if (!trimmed) return;
        const tempId = `pending-${Date.now()}-${Math.random()}`;
        setPending((prev) => [{ tempId, content: trimmed, createdAt: Date.now() }, ...prev]);
        setDraft("");
        setPosting(true);
        try {
            await addNote({ leadId, content: trimmed });
            setPending((prev) => prev.filter((n) => n.tempId !== tempId));
        } catch (err) {
            setPending((prev) => prev.filter((n) => n.tempId !== tempId));
            setDraft(trimmed);
            toast.error(errorMessage(err, "Couldn't post the note."));
        } finally {
            setPosting(false);
        }
    };

    const all = [
        ...pending.map((n) => ({ key: n.tempId, content: n.content, createdAt: n.createdAt, authorId: me.id, isPending: true })),
        ...notes.map((n) => ({ key: n._id, content: n.content, createdAt: n.createdAt, authorId: n.creatorId, isPending: false })),
    ];
    const visible = showAll ? all : all.slice(0, NOTES_SHOWN);

    return (
        <section className="flex flex-col gap-4" aria-labelledby={headingId}>
            <h3 id={headingId} className="t-h2 flex items-baseline gap-1.5">
                Notes <span className="t-count">{all.length}</span>
            </h3>

            {all.length === 0 ? (
                <p className="t-meta">No notes yet. Leave a tip for the next creator: when the owner is in, who to ask for.</p>
            ) : (
                <ol className="m-0 flex list-none flex-col gap-4 p-0">
                    {visible.map((n) => {
                        const mine = n.authorId === me.id;
                        const who = mine ? "You" : n.authorId ? authors.get(n.authorId) : undefined;
                        return (
                            <li key={n.key} className={n.isPending ? "flex gap-3 opacity-60" : "flex gap-3"}>
                                {mine ? (
                                    <Avatar name={me.name} />
                                ) : who ? (
                                    <Avatar name={who} />
                                ) : (
                                    <span className="t-avatar" aria-hidden="true">
                                        <Icon icon={User} size={14} />
                                    </span>
                                )}
                                <div className="flex min-w-0 flex-col gap-0.5">
                                    <p className="text-[13px] leading-[18px]">
                                        <span className="font-medium text-r1-ink">{who ?? "Someone on the team"}</span>{" "}
                                        <span className="t-meta">· {n.isPending ? "posting…" : timeAgo(n.createdAt)}</span>
                                    </p>
                                    <p className="t-body whitespace-pre-wrap [overflow-wrap:anywhere]">{n.content}</p>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}
            {all.length > NOTES_SHOWN && (
                <Button variant="ghost" size="sm" className="self-start" aria-expanded={showAll} onClick={() => setShowAll((s) => !s)}>
                    {showAll ? "Show fewer notes" : `Show all ${all.length} notes`}
                </Button>
            )}

            <Field label="Add a note">
                <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Leave a field note for the team…"
                    rows={3}
                    // leadNotes.add refuses anything longer.
                    maxLength={2000}
                    className="min-h-20"
                />
            </Field>
            <div className="-mt-2 flex justify-end">
                <Button size="sm" onClick={post} disabled={posting || !draft.trim()} aria-busy={posting}>
                    <Icon icon={Send} />
                    Post note
                </Button>
            </div>
        </section>
    );
}
