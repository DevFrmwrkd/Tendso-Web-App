"use client";

import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Creator-facing form to add / replace / remove their own Gemini key.
 * Server-side, convex/aiKeys.addMyGeminiKey requires an authenticated creator,
 * encrypts the key at rest (AES-256-GCM), and listMyGeminiKeys returns masked
 * keys only — the raw key never leaves the server. addMyGeminiKey is an action
 * (encryption needs a random IV, which mutations can't do). This page is also
 * gated to logged-in users by middleware.ts.
 */
export default function ConnectAiForm() {
    const keys = useQuery(api.aiKeys.listMyGeminiKeys, {});
    const addKey = useAction(api.aiKeys.addMyGeminiKey);
    const removeKey = useMutation(api.aiKeys.removeMyGeminiKey);

    const [value, setValue] = useState("");
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

    const hasKey = !!keys && keys.length > 0;

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        const key = value.trim();
        if (!key || saving) return;
        setSaving(true);
        setMsg(null);
        try {
            const res = await addKey({ key });
            setMsg({ ok: true, text: res.replaced ? `Updated your key (${res.label}). Thanks!` : `Saved your key (${res.label}). Thanks for powering Tendso AI!` });
            setValue("");
        } catch (err) {
            setMsg({ ok: false, text: err instanceof Error ? err.message : "Couldn't save that key." });
        } finally {
            setSaving(false);
        }
    }

    async function onRemove(id: Id<"aiKeys">) {
        await removeKey({ id });
        setMsg({ ok: true, text: "Key removed." });
    }

    return (
        <div className="card" style={{ padding: 28 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>
                Your Gemini key
            </div>

            {keys && keys.length > 0 && (
                <div style={{ marginBottom: 16, display: "grid", gap: 8 }}>
                    {keys.map((k) => {
                        const live = k.active && !k.onCooldown;
                        return (
                            <div
                                key={k._id}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                    padding: "10px 16px",
                                    border: "1px solid var(--neo-rule)",
                                    borderRadius: "var(--neo-r-pill, 999px)",
                                    background: "var(--neo-paper-3)",
                                }}
                            >
                                <span
                                    className="live-dot"
                                    style={live ? undefined : { background: "var(--neo-ink-3)", animation: "none" }}
                                />
                                <span style={{ fontFamily: "var(--neo-mono)", fontSize: 14 }}>{k.label}</span>
                                <span className="label" style={{ color: "var(--neo-ink-3)" }}>
                                    {!k.active ? "retired" : k.onCooldown ? "cooling down" : "active"}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => onRemove(k._id)}
                                    className="label"
                                    style={{
                                        marginLeft: "auto",
                                        background: "none",
                                        border: 0,
                                        color: "var(--neo-ink-3)",
                                        cursor: "pointer",
                                        textDecoration: "underline",
                                    }}
                                >
                                    Remove
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            <form onSubmit={onSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                    type="password"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Paste your Gemini API key (AIza…)"
                    autoComplete="off"
                    spellCheck={false}
                    aria-label="Gemini API key"
                    style={{
                        flex: 1,
                        minWidth: 240,
                        border: "1px solid var(--neo-rule)",
                        background: "var(--neo-paper-3)",
                        color: "var(--neo-ink)",
                        padding: "12px 16px",
                        borderRadius: "var(--neo-r-pill, 999px)",
                        fontFamily: "var(--neo-mono)",
                        fontSize: 14,
                        outline: "none",
                    }}
                />
                <button
                    type="submit"
                    disabled={!value.trim() || saving}
                    className="door door-creator"
                    style={{ display: "inline-flex", textDecoration: "none", opacity: !value.trim() || saving ? 0.5 : 1 }}
                >
                    {saving ? "Saving…" : hasKey ? "Replace key" : "Save key"}
                </button>
            </form>

            {msg && (
                <p style={{ marginTop: 12, fontSize: 14, color: msg.ok ? "var(--neo-creator-ink)" : "#b3261e" }}>{msg.text}</p>
            )}

            <p style={{ marginTop: 16, fontSize: 13, color: "var(--neo-ink-3)", lineHeight: 1.6 }}>
                🔒 Your key is stored securely on our servers, never shown publicly, and never shared. We use it only to generate AI
                answers for the Tendso knowledge base. You can remove it here anytime, or revoke it from Google AI Studio.
            </p>
        </div>
    );
}
