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

type Workspace = "help" | "wiki";
type TrainResult = { question: string; answer: string; grounded: boolean };

export default function AdminTrainAiPage() {
    const { isAdmin, loading } = useAdminAuth();
    const train = useAction(api.knowledgeTraining.trainFromQuestions);
    const trained = useQuery(api.knowledgeTraining.listTrainingQA, isAdmin ? {} : "skip");
    const unanswered = useQuery(api.knowledgeTraining.listUnansweredQueries, isAdmin ? {} : "skip");
    const remove = useMutation(api.knowledgeTraining.deleteTrainingQA);
    const purgeAll = useMutation(api.knowledgeTraining.purgeAllTrainedQA);

    // AI-key health: the page can't run the AI without a usable Gemini key.
    const poolStats = useQuery(api.aiKeys.poolStats, isAdmin ? {} : "skip");
    const addKey = useAction(api.aiKeys.addMyGeminiKey);
    const clearCooldowns = useMutation(api.aiKeys.clearGeminiCooldowns);

    const [text, setText] = useState("");
    const [workspace, setWorkspace] = useState<Workspace>("help");
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
            const res = await train({ questions, workspace });
            setResults(res);
            setText("");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Training failed.");
        } finally {
            setRunning(false);
        }
    };

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
                    <div className="flex items-center gap-3">
                        <label className="text-sm font-medium text-gray-700">Workspace</label>
                        <select
                            value={workspace}
                            onChange={(e) => setWorkspace(e.target.value as Workspace)}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                        >
                            <option value="help">Help Center (public + chatbot + Discord)</option>
                            <option value="wiki">Internal Wiki (field agents only)</option>
                        </select>
                    </div>
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        rows={8}
                        placeholder={"How do I get paid?\nHow long does a website take to build?\nCan I use my own domain?"}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-mono text-sm"
                    />
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">{questions.length} question{questions.length === 1 ? "" : "s"}</span>
                        <button
                            onClick={handleTrain}
                            disabled={running || questions.length === 0 || hasUsableKey === false}
                            title={hasUsableKey === false ? "Add a Gemini key above first" : undefined}
                            className="inline-flex items-center gap-2 h-11 px-6 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl disabled:opacity-50"
                        >
                            {running ? <><Loader2 className="h-5 w-5 animate-spin" /> Teaching the AI…</> : <><Sparkles className="h-5 w-5" /> Train</>}
                        </button>
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                </div>

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
                        <h2 className="text-sm font-semibold text-amber-800 mb-3">Questions the AI couldn&apos;t answer</h2>
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
                                            {t.embedded ? "● learned (embedded)" : "○ embedding…"} · {t.workspace}
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
