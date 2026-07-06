"use client";

/**
 * Admin "Train the AI" — paste questions, the AI writes + embeds the answers.
 * The questions become retrievable knowledge for the /knowledge chatbot AND the
 * Discord /ask bot. See docs/changes/ADMIN-KB-TRAINING-PLAN.md.
 */

import { useState } from "react";
import { useAction, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAdminAuth } from "@/hooks/useAdmin";
import AdminLayout from "../components/AdminLayout";
import { Loader2, Sparkles, CheckCircle2, AlertTriangle, Trash2, ArrowRight, KeyRound, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type Workspace = "help" | "wiki";
type TrainResult = { question: string; answer: string; grounded: boolean };

export default function AdminTrainAiPage() {
    const { isAdmin, loading } = useAdminAuth();
    // Enqueue (fast) — server processes questions one at a time so a big batch
    // can't time out the client ("Connection lost while action was in flight").
    const enqueueTraining = useMutation(api.knowledgeTraining.enqueueTraining);
    const trainQAPairs = useMutation(api.knowledgeTraining.trainQAPairs);
    const resetDailyLimit = useMutation(api.knowledgeTraining.resetTrainingDailyLimit);
    const trainingJobs = useQuery(api.knowledgeTraining.listTrainingJobs, isAdmin ? {} : "skip");
    const clearJobs = useMutation(api.knowledgeTraining.clearFinishedTrainingJobs);
    const trained = useQuery(api.knowledgeTraining.listTrainingQA, isAdmin ? {} : "skip");
    const unanswered = useQuery(api.knowledgeTraining.listUnansweredQueries, isAdmin ? {} : "skip");
    const remove = useMutation(api.knowledgeTraining.deleteTrainingQA);
    const purgeAll = useMutation(api.knowledgeTraining.purgeAllTrainedQA);
    const purgeUngrounded = useMutation(api.knowledgeTraining.purgeUngroundedQA);
    const clearUnanswered = useMutation(api.knowledgeTraining.clearUnansweredQueries);
    const reEmbedPending = useMutation(api.knowledgeTraining.reEmbedPendingQA);

    // AI-key health: the page can't run the AI without a usable Gemini key.
    const poolStats = useQuery(api.aiKeys.poolStats, isAdmin ? {} : "skip");
    const addKey = useAction(api.aiKeys.addMyGeminiKey);
    const clearCooldowns = useMutation(api.aiKeys.clearGeminiCooldowns);

    const [text, setText] = useState("");
    const [workspace, setWorkspace] = useState<Workspace>("help");
    // "pairs" = admin pastes "Question? Answer" lines, saved verbatim (no RAG, no
    // daily limit). "generate" = paste questions, AI drafts answers from the KB.
    const [mode, setMode] = useState<"pairs" | "generate">("pairs");
    const [running, setRunning] = useState(false);
    const [results, setResults] = useState<TrainResult[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Key-setup card state
    const [keyInput, setKeyInput] = useState("");
    const [savingKey, setSavingKey] = useState(false);
    const [keyMsg, setKeyMsg] = useState<string | null>(null);
    const [keyErr, setKeyErr] = useState<string | null>(null);

    const hasUsableKey = poolStats ? poolStats.usableNow > 0 : undefined; // undefined while loading

    const handleSaveKey = async () => {
        const key = keyInput.trim();
        if (key.length < 20) {
            setKeyErr("That does not look like a valid Gemini API key.");
            return;
        }
        setSavingKey(true);
        setKeyErr(null);
        setKeyMsg(null);
        try {
            const res = await addKey({ key });
            setKeyMsg(`Key ${res.label} saved. The AI is ready.`);
            setKeyInput("");
        } catch (e) {
            setKeyErr(e instanceof Error ? e.message : "Could not save the key.");
        } finally {
            setSavingKey(false);
        }
    };

    const handleClearCooldowns = async () => {
        setSavingKey(true);
        setKeyErr(null);
        setKeyMsg(null);
        try {
            const res = await clearCooldowns({});
            setKeyMsg(res.cleared > 0 ? `Reactivated ${res.cleared} key(s).` : "No keys needed clearing.");
        } catch (e) {
            setKeyErr(e instanceof Error ? e.message : "Could not clear cooldowns.");
        } finally {
            setSavingKey(false);
        }
    };

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                </div>
            </AdminLayout>
        );
    }
    if (!isAdmin) {
        return <AdminLayout><p className="p-6 text-red-600">Forbidden: admin access required.</p></AdminLayout>;
    }

    const questions = text.split("\n").map((q) => q.trim()).filter(Boolean);

    const handleTrain = async () => {
        if (questions.length === 0) return;
        if (hasUsableKey === false) {
            setError("No usable Gemini key — add one below before training, or the AI can't answer.");
            return;
        }
        setRunning(true);
        setError(null);
        setResults(null);
        try {
            if (mode === "pairs") {
                // Save admin-provided "Question? Answer" pairs verbatim. No RAG,
                // no daily limit — instant, uses your exact answers.
                const res = await trainQAPairs({ text, workspace });
                if (res.saved === 0) {
                    setError(res.skipped > 0
                        ? `Nothing saved — all ${res.skipped} were duplicates.`
                        : "No valid 'Question? Answer' pairs found. Each line needs a '?' then the answer.");
                } else {
                    setText("");
                    toast.success(
                        `${res.saved} answer${res.saved === 1 ? "" : "s"} learned!` +
                        (res.skipped > 0 ? ` (${res.skipped} duplicate${res.skipped === 1 ? "" : "s"} skipped)` : ""),
                        { description: "The AI is now studying them — they'll be ready to answer in a few seconds." }
                    );
                }
            } else {
                // Generate mode: enqueue questions; server drafts answers from the KB.
                const res = await enqueueTraining({ questions, workspace });
                setText("");
                if (res.count === 0) {
                    setError(res.note ?? "Nothing queued — all duplicates or a limit was hit.");
                } else if (res.skipped > 0) {
                    setError(`Queued ${res.count}. Skipped ${res.skipped} (duplicates or daily/queue limit).${res.note ? " " + res.note : ""}`);
                }
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not train.");
        } finally {
            setRunning(false);
        }
    };

    // Live queue state derived from the jobs table.
    const queuedCount = trainingJobs?.filter((j) => j.status === "queued" || j.status === "processing").length ?? 0;
    const isProcessing = queuedCount > 0;

    return (
        <AdminLayout>
            <div className="max-w-3xl mx-auto p-6 space-y-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Sparkles className="h-6 w-6 text-amber-500" /> Train the AI
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Paste questions (one per line). The AI writes a grounded answer for each from the knowledge base,
                        then learns it — so the Help Center chatbot and the Discord <code>/ask</code> bot can answer them.
                    </p>
                </div>

                {/* AI-key setup — only when there's no usable key. The page can't
                    answer without one; surfacing the input here keeps it self-contained
                    so an admin never has to hunt through the Convex dashboard. */}
                {hasUsableKey === false && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-3">
                        <div className="flex items-center gap-2">
                            <KeyRound className="h-5 w-5 text-red-600" />
                            <h2 className="text-sm font-semibold text-red-800">The AI has no usable key</h2>
                        </div>
                        <p className="text-sm text-red-700">
                            Training needs a working Google Gemini API key. Paste one below — it&apos;s encrypted at
                            rest and shared by the chatbot, Discord <code>/ask</code>, and this page. Get a free key at{" "}
                            <a
                                href="https://aistudio.google.com/apikey"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline font-medium"
                            >
                                aistudio.google.com/apikey
                            </a>
                            .
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <input
                                type="password"
                                value={keyInput}
                                onChange={(e) => setKeyInput(e.target.value)}
                                placeholder="AIza…"
                                className="flex-1 px-3 py-2 border border-red-300 rounded-lg text-gray-900 font-mono text-sm bg-white"
                            />
                            <button
                                onClick={handleSaveKey}
                                disabled={savingKey || keyInput.trim().length < 20}
                                className="inline-flex items-center justify-center gap-2 h-10 px-5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg disabled:opacity-50"
                            >
                                {savingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                                Save key
                            </button>
                        </div>
                        {/* When the only key(s) are on cooldown (rate-limited, not invalid),
                            offer a one-click reactivate instead of forcing a new key. */}
                        {poolStats && poolStats.onCooldown > 0 && (
                            <button
                                onClick={handleClearCooldowns}
                                disabled={savingKey}
                                className="inline-flex items-center gap-1.5 text-xs text-red-700 hover:text-red-900 underline disabled:opacity-50"
                            >
                                <RefreshCw className="h-3.5 w-3.5" />
                                {poolStats.onCooldown} key(s) on cooldown — reactivate now
                            </button>
                        )}
                        {keyMsg && <p className="text-sm text-green-700">{keyMsg}</p>}
                        {keyErr && <p className="text-sm text-red-700">{keyErr}</p>}
                    </div>
                )}

                {/* Paste box */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                    {/* Mode toggle */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setMode("pairs")}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${mode === "pairs" ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-600"}`}
                        >
                            Q&A pairs (I provide answers)
                        </button>
                        <button
                            onClick={() => setMode("generate")}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${mode === "generate" ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-600"}`}
                        >
                            AI generates answers
                        </button>
                    </div>
                    <p className="text-xs text-gray-500">
                        {mode === "pairs"
                            ? "One per line: the question, a “?”, then your answer. Saved exactly as written — instant, no AI answer-generation, no daily limit."
                            : "One question per line. The AI drafts a grounded answer from the existing knowledge base (uses the daily AI budget)."}
                    </p>
                    <div className="flex items-center gap-3">
                        <label className="text-sm font-medium text-gray-700">Workspace</label>
                        <select
                            value={workspace}
                            onChange={(e) => setWorkspace(e.target.value as Workspace)}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                        >
                            <option value="help">Help Center (public + chatbot + Discord)</option>
                        </select>
                        <button
                            onClick={async () => { const r = await resetDailyLimit({}); setError(`Daily AI limit reset (${r.reset} cleared).`); }}
                            className="ml-auto text-xs text-gray-500 hover:text-amber-600 underline"
                            title="Reset the daily AI answer-generation limit"
                        >
                            Reset daily limit
                        </button>
                    </div>
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        rows={8}
                        placeholder={mode === "pairs"
                            ? "How much does a website cost? ₱999, with an optional custom domain add-on.\nWhere does the business pay? Via a Wise payment link sent by email."
                            : "How do I get paid?\nHow long does a website take to build?\nCan I use my own domain?"}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-mono text-sm"
                    />
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">{questions.length} line{questions.length === 1 ? "" : "s"}</span>
                        <button
                            onClick={handleTrain}
                            disabled={running || questions.length === 0 || (mode === "generate" && hasUsableKey === false)}
                            title={mode === "generate" && hasUsableKey === false ? "Add a Gemini key above first" : undefined}
                            className="inline-flex items-center gap-2 h-11 px-6 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl disabled:opacity-50"
                        >
                            {running
                                ? <><Loader2 className="h-5 w-5 animate-spin" /> {mode === "pairs" ? "Saving…" : "Queuing…"}</>
                                : <><Sparkles className="h-5 w-5" /> {mode === "pairs" ? "Save Q&A" : "Train"}</>}
                        </button>
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    {mode === "generate" && (
                        <p className="text-xs text-gray-400">
                            Questions are processed in the background one at a time — you can leave this page; results appear below as they finish.
                        </p>
                    )}
                </div>

                {/* Live processing queue */}
                {trainingJobs && trainingJobs.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin text-amber-500" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
                                {isProcessing ? `Processing… ${queuedCount} left in queue` : "Queue idle"}
                            </h2>
                            <button onClick={() => clearJobs({})} className="text-xs text-gray-500 hover:text-red-600">Clear finished</button>
                        </div>
                        <div className="space-y-1 max-h-72 overflow-y-auto">
                            {trainingJobs.map((j) => (
                                <div key={j._id} className="flex items-start gap-2 text-sm py-1">
                                    {j.status === "done" && j.grounded ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                                        : j.status === "done" ? <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                        : j.status === "error" ? <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                                        : <Loader2 className="h-4 w-4 text-gray-400 animate-spin shrink-0 mt-0.5" />}
                                    <div className="min-w-0">
                                        <p className="text-gray-900 truncate">{j.question}</p>
                                        <p className="text-xs text-gray-500">
                                            {j.status === "queued" ? "queued"
                                                : j.status === "processing" ? "processing…"
                                                : j.status === "error" ? `error: ${j.error}`
                                                : j.grounded ? "learned ✓" : "not grounded — not saved"}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Results of the last run */}
                {results && (
                    <div className="space-y-3">
                        <h2 className="text-sm font-semibold text-gray-700">Just taught the AI</h2>
                        {results.map((r, i) => (
                            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
                                <div className="flex items-start gap-2">
                                    {r.grounded ? (
                                        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                                    ) : (
                                        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                                    )}
                                    <div>
                                        <p className="font-medium text-gray-900">{r.question}</p>
                                        <p className="text-sm text-gray-600 mt-1">{r.answer}</p>
                                        {!r.grounded && (
                                            <p className="text-xs text-amber-600 mt-1">
                                                ⚠️ The AI couldn&apos;t ground this in existing knowledge, so it was <strong>not saved</strong> (a guessed answer would poison the KB). Write a real article for this topic, then re-train.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Questions people asked that the AI couldn't answer */}
                {unanswered && unanswered.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-sm font-semibold text-amber-800">Questions the AI couldn&apos;t answer</h2>
                            <button
                                onClick={async () => { const r = await clearUnanswered({}); setError(`Cleared ${r.removed} unanswered question(s).`); }}
                                className="inline-flex items-center gap-1.5 text-xs text-amber-700 hover:text-red-600"
                            >
                                <Trash2 className="h-3.5 w-3.5" /> Clear
                            </button>
                        </div>
                        <p className="text-xs text-amber-700 mb-3">Click to drop one into the box above, then Train.</p>
                        <div className="space-y-1">
                            {unanswered.map((u, i) => (
                                <button
                                    key={i}
                                    onClick={() => setText((t) => (t ? `${t}\n${u.query}` : u.query))}
                                    className="w-full text-left text-sm text-amber-900 hover:bg-amber-100 rounded px-2 py-1.5 flex items-center justify-between gap-2"
                                >
                                    <span>{u.query}</span>
                                    <ArrowRight className="h-4 w-4 shrink-0 opacity-60" />
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Already-trained Q&A */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-semibold text-gray-700">Trained questions</h2>
                        {trained && trained.length > 0 && (
                            <div className="flex items-center gap-4">
                                {/* Finish learning: retries any Q&A still stuck on "Learning…" */}
                                {trained.some((t) => !t.embedded) && (
                                    <button
                                        onClick={async () => {
                                            const r = await reEmbedPending({});
                                            toast.success(`Resuming learning for ${r.retried} answer${r.retried === 1 ? "" : "s"}…`, {
                                                description: "They'll be ready to answer shortly.",
                                            });
                                        }}
                                        className="inline-flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-900"
                                        title="Retry any answers still learning"
                                    >
                                        <RefreshCw className="h-3.5 w-3.5" /> Finish learning
                                    </button>
                                )}
                                <button
                                    onClick={async () => {
                                        const r = await purgeUngrounded({});
                                        toast.success(`Removed ${r.removed} unusable answer${r.removed === 1 ? "" : "s"}.`);
                                    }}
                                    className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-amber-600"
                                    title="Delete answers the AI couldn't actually answer"
                                >
                                    <AlertTriangle className="h-3.5 w-3.5" /> Remove unusable
                                </button>
                                <button
                                    onClick={async () => {
                                        if (confirm("Delete ALL trained Q&A? This removes every question the AI learned here (hand-written articles are untouched). Use this to wipe a bad batch.")) {
                                            await purgeAll({});
                                        }
                                    }}
                                    className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-600"
                                >
                                    <Trash2 className="h-3.5 w-3.5" /> Clear all
                                </button>
                            </div>
                        )}
                    </div>
                    {trained === undefined ? (
                        <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
                    ) : trained.length === 0 ? (
                        <p className="text-sm text-gray-400">Nothing trained yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {trained.map((t) => (
                                <div key={t._id} className="bg-white rounded-lg border border-gray-100 p-3 flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">{t.question}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{t.answer}</p>
                                        <span className="text-[11px] mt-1 inline-block" style={{ color: t.embedded ? "#16a34a" : "#a16207" }}>
                                            {t.embedded ? "● Ready to answer" : "○ Learning…"} · {t.workspace}
                                        </span>
                                    </div>
                                    <button onClick={() => remove({ id: t._id })} className="text-gray-400 hover:text-red-600 shrink-0">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
