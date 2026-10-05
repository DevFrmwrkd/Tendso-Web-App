"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button, ConfirmDialog, Field, Icon, Input, Skeleton, Status, type StatusWord } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { AccountCard, Line } from "./parts";

/**
 * The AI key section of Account (board Account, "AI key"). This was the
 * /connect-ai page; the route now redirects to /profile?edit=ai#ai-key, which
 * opens the fold below and brings the card into view.
 *
 * Same Convex calls as that page's form (ConnectAiForm, folded in here):
 * convex/aiKeys.addMyGeminiKey requires an authenticated creators row,
 * encrypts the key at rest (AES-256-GCM) and returns only a masked label;
 * listMyGeminiKeys returns masked keys only, so the raw key never comes back
 * to the browser. addMyGeminiKey is an action because encryption needs a
 * random IV, which mutations cannot use.
 */

type KeyRow = { _id: Id<"aiKeys">; label: string; active: boolean; onCooldown: boolean };

/** A key's state in the pool, in words (convex/aiKeys.reportKeyResult sets these). */
function keyStatus(k: KeyRow): StatusWord & { note?: string } {
    if (!k.active) return { tone: "bad", word: "Retired", note: "Google refused this key, so the help AI stopped using it. Add a new one below." };
    if (k.onCooldown) return { tone: "progress", word: "Cooling down", note: "It used up its free quota for now and comes back on its own." };
    return { tone: "done", word: "Active" };
}

// A Gemini key starts with AIza and is 39 characters long. The server checks
// again (convex/aiKeys.addMyGeminiKey); this only catches a wrong paste early.
function keyProblem(key: string): string | undefined {
    if (!key.startsWith("AIza") || key.length < 30) return "That does not look like a Gemini key. It starts with AIza and is about 39 characters.";
    return undefined;
}

export function AiKeyCard({ autoOpen }: { autoOpen: boolean }) {
    const keys = useQuery(api.aiKeys.listMyGeminiKeys, {});
    const addKey = useAction(api.aiKeys.addMyGeminiKey);
    const removeKey = useMutation(api.aiKeys.removeMyGeminiKey);

    const foldId = useId();
    const inputRef = useRef<HTMLInputElement>(null);

    // Open when the visitor came for it: ?edit=ai (the /connect-ai redirect)
    // or a plain #ai-key link. This card only mounts in the browser, after the
    // account has loaded, so reading the hash here is safe.
    const [startOpen] = useState(() => autoOpen || (typeof window !== "undefined" && window.location.hash === "#ai-key"));
    const [open, setOpen] = useState(startOpen);
    const [draft, setDraft] = useState("");
    const [error, setError] = useState<string>();
    const [saving, setSaving] = useState(false);
    const [confirm, setConfirm] = useState<KeyRow | null>(null);
    const [removing, setRemoving] = useState(false);

    // Bring the card into view and put the cursor in the key field, once,
    // when the keys have loaded (the fold's words depend on them). Then tidy
    // the URL back to /profile, so a refresh after saving does not reopen it.
    const arrived = useRef(false);
    useEffect(() => {
        if (!startOpen || arrived.current || keys === undefined) return;
        arrived.current = true;
        document.getElementById("ai-key")?.scrollIntoView({ block: "start" });
        inputRef.current?.focus({ preventScroll: true });
        const params = new URLSearchParams(window.location.search);
        if (params.get("edit") === "ai" || window.location.hash === "#ai-key") {
            if (params.get("edit") === "ai") params.delete("edit");
            const qs = params.toString();
            window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
        }
    }, [startOpen, keys]);

    const hasKey = !!keys && keys.length > 0;

    const onSave = async (e: FormEvent) => {
        e.preventDefault();
        if (saving) return;
        const key = draft.trim();
        const problem = keyProblem(key);
        if (problem) {
            setError(problem);
            inputRef.current?.focus();
            return;
        }
        setSaving(true);
        setError(undefined);
        try {
            const res = await addKey({ key });
            toast.success(res.replaced ? "Key replaced" : "Key saved. Thanks for powering the help AI.");
            setDraft("");
            setOpen(false);
        } catch (err) {
            setError(err instanceof Error && err.message ? err.message : "Couldn't save that key.");
        } finally {
            setSaving(false);
        }
    };

    const onRemove = async () => {
        if (!confirm || removing) return;
        setRemoving(true);
        try {
            await removeKey({ id: confirm._id });
            toast.success("Key removed");
            setConfirm(null);
            setOpen(false);
        } catch (err) {
            toast.error(err instanceof Error && err.message ? err.message : "The key was not removed. Try again.");
        } finally {
            setRemoving(false);
        }
    };

    return (
        <AccountCard
            id="ai-key"
            className="scroll-mt-20"
            title="AI key"
            meta="Optional. A free Google Gemini key keeps the help AI and Discord /ask answering for the whole team, about 500 questions a day, at no cost to you."
        >
            {keys === undefined ? (
                <Line label="Your key">
                    <Skeleton width={160} height={12} className="my-1" />
                </Line>
            ) : keys.length === 0 ? (
                <Line label="Your key">
                    <Status tone="off" word="Not added (optional)" />
                </Line>
            ) : (
                keys.map((k) => {
                    const s = keyStatus(k);
                    return (
                        <Line key={k._id} label="Your key">
                            <Status tone={s.tone}>
                                {s.word} · <span className="t-mono">{k.label}</span>
                            </Status>
                            {s.note && <span className="t-meta">{s.note}</span>}
                        </Line>
                    );
                })
            )}

            {keys !== undefined && (
                <div className="t-fold mx-4 sm:mx-6">
                    <button
                        type="button"
                        className="t-fold-btn"
                        aria-expanded={open}
                        aria-controls={foldId}
                        onClick={() => {
                            setOpen((o) => !o);
                            setError(undefined);
                        }}
                    >
                        {hasKey ? "Replace or remove your key" : "Use your own Gemini key"}
                        <span className="t-fold-chev">
                            <Icon icon={ChevronDown} />
                        </span>
                    </button>
                    <div id={foldId} hidden={!open} className="flex flex-col gap-4 pb-6">
                        <ol className="t-body flex list-decimal flex-col gap-1.5 pl-5">
                            <li>
                                Go to{" "}
                                <a className="t-link" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
                                    aistudio.google.com/apikey
                                </a>{" "}
                                and sign in with any Google account. It is free, no card needed.
                            </li>
                            <li>Click “Create API key” and copy it. It starts with AIza.</li>
                            <li>Paste it below and save.</li>
                        </ol>
                        <form onSubmit={onSave} noValidate className="flex flex-col gap-4">
                            <Field
                                label="Gemini API key"
                                error={error}
                                help="Stored encrypted and never shown in full. Remove it here, or revoke it in Google AI Studio, any time."
                            >
                                <Input
                                    ref={inputRef}
                                    type="password"
                                    autoComplete="off"
                                    spellCheck={false}
                                    placeholder="AIza…"
                                    value={draft}
                                    onChange={(e) => {
                                        setDraft(e.target.value);
                                        setError(undefined);
                                    }}
                                />
                            </Field>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button type="submit" disabled={saving} aria-busy={saving}>
                                    {saving ? "Saving…" : hasKey ? "Replace key" : "Save key"}
                                </Button>
                                {keys.map((k) => (
                                    <Button key={k._id} variant="danger" onClick={() => setConfirm(k)}>
                                        {keys.length > 1 ? `Remove ${k.label}` : "Remove key"}
                                    </Button>
                                ))}
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={!!confirm}
                onCancel={() => setConfirm(null)}
                onConfirm={onRemove}
                title="Remove your AI key?"
                confirmLabel="Remove key"
                busy={removing}
            >
                <p>The help AI stops using {confirm?.label ?? "it"}. You can add a key again any time.</p>
            </ConfirmDialog>
        </AccountCard>
    );
}
