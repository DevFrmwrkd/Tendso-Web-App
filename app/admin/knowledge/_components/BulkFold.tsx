"use client"

import { useMutation, useQuery } from "convex/react"
import { useState } from "react"
import { toast } from "sonner"

import { Button, Dot, Field, Fold, Select, Segmented, Status, Textarea } from "@/components/r1"
import { api } from "@/convex/_generated/api"

import { errorText, jobStatus, MAX_PER_PASTE, parseBulk, plural, WORKSPACE_OPTIONS, type BulkMode, type Workspace } from "../_lib/train"

/** Runs shown before "Show all". */
const RUNS_CAP = 5

/**
 * "Add many at once" (a fold, closed by default): paste up to 25 lines.
 *
 *   * "I write the answers" sends "Question? Answer" lines to trainQAPairs,
 *     which saves them verbatim: no RAG, no daily limit, instant.
 *   * "AI writes the answers" enqueues the questions (enqueueTraining). The
 *     server drafts each answer from the knowledge base one at a time, so a
 *     big batch can't time out the client ("Connection lost while action was
 *     in flight"), and keeps only the answers it could ground.
 *
 * The queue's progress and each run's outcome (listTrainingJobs) sit at the
 * foot of the fold.
 */
export default function BulkFold({ hasUsableKey }: { hasUsableKey: boolean | undefined }) {
    const trainQAPairs = useMutation(api.knowledgeTraining.trainQAPairs)
    // Enqueue (fast): the server processes questions one at a time.
    const enqueueTraining = useMutation(api.knowledgeTraining.enqueueTraining)
    const jobs = useQuery(api.knowledgeTraining.listTrainingJobs, {})
    const clearJobs = useMutation(api.knowledgeTraining.clearFinishedTrainingJobs)

    const [mode, setMode] = useState<BulkMode>("pairs")
    const [text, setText] = useState("")
    const [workspace, setWorkspace] = useState<Workspace>("help")
    const [error, setError] = useState<string | null>(null)
    const [running, setRunning] = useState(false)
    const [showAllRuns, setShowAllRuns] = useState(false)

    const isPairs = mode === "pairs"
    const parsed = parseBulk(text, mode)
    const usable = Math.min(parsed.usable, MAX_PER_PASTE)

    let linesLabel = plural(parsed.lines.length, "line")
    if (isPairs && parsed.skipped > 0) linesLabel += ` · ${parsed.skipped} without a “?” and an answer will be skipped`
    if (parsed.usable > MAX_PER_PASTE) linesLabel += ` · only the first ${MAX_PER_PASTE} are ${isPairs ? "saved" : "queued"}`

    const buttonLabel = isPairs
        ? usable > 0
            ? `Save ${plural(usable, "answer")}`
            : "Save answers"
        : usable > 0
          ? `Queue ${plural(usable, "question")}`
          : "Queue questions"

    const help = isPairs
        ? "One per line: the question, a “?”, then your answer. Saved exactly as written, straight away. No AI, no daily limit."
        : hasUsableKey === false
          ? "Paused: the AI has no working key. Questions you queue now would fail. Write the answers yourself instead."
          : "One question per line. The AI drafts each answer from what that workspace already knows, one at a time, and uses the daily AI budget. If it can’t ground an answer, nothing is saved and the question comes back to the list above."

    // Live queue state derived from the jobs table.
    const queued = jobs?.filter((j) => j.status === "queued" || j.status === "processing").length ?? 0
    const finished = jobs?.filter((j) => j.status === "done" || j.status === "error").length ?? 0
    const runs = jobs ?? []
    const visibleRuns = showAllRuns ? runs : runs.slice(0, RUNS_CAP)

    async function submit() {
        if (!isPairs && hasUsableKey === false) {
            setError("The AI has no working key, so it can’t write answers right now. Switch to “I write the answers”, or fix the key at the top.")
            return
        }
        if (parsed.usable === 0) {
            setError(isPairs ? "Paste at least one line with a “?” between the question and the answer." : "Paste at least one question.")
            return
        }
        setRunning(true)
        setError(null)
        try {
            if (isPairs) {
                // Save admin-provided "Question? Answer" pairs verbatim. No RAG,
                // no daily limit: instant, and uses your exact answers.
                const res = await trainQAPairs({ text, workspace })
                if (res.saved === 0) {
                    setError(
                        res.skipped > 0
                            ? `Nothing saved: all ${res.skipped} were already trained.`
                            : "No valid “Question? Answer” pairs found. Each line needs a “?” then the answer.",
                    )
                } else {
                    setText("")
                    toast(`Saved ${plural(res.saved, "answer")}${res.skipped > 0 ? ` · ${res.skipped} already trained, skipped` : ""}`, {
                        description: hasUsableKey === false ? "The AI starts using them once a key works." : "The AI can use them in a few seconds.",
                    })
                }
            } else {
                // Generate mode: enqueue the questions; the server drafts answers from the KB.
                const res = await enqueueTraining({ questions: parsed.lines, workspace })
                if (res.count === 0) {
                    setError(res.note ?? "Nothing queued: every question was already trained or queued, or a limit was hit.")
                } else {
                    setText("")
                    toast(
                        `Queued ${plural(res.count, "question")}. Answers appear below as they finish.`,
                        res.skipped > 0
                            ? { description: `Skipped ${res.skipped} (already trained or queued, or over the daily or queue limit).${res.note ? ` ${res.note}` : ""}` }
                            : undefined,
                    )
                }
            }
        } catch (e) {
            setError(errorText(e, "Could not train."))
        } finally {
            setRunning(false)
        }
    }

    async function clearFinished() {
        try {
            const r = await clearJobs({})
            toast(`Cleared ${plural(r.removed, "finished run")}.`)
        } catch (e) {
            toast.error(errorText(e))
        }
    }

    return (
        <Fold
            // Two lines in the fold's button: the name, and what it does.
            className="[&>.t-fold-btn]:h-auto [&>.t-fold-btn]:min-h-[52px] [&>.t-fold-btn]:py-2.5"
            title={
                <span className="flex min-w-0 flex-col gap-0.5">
                    <span>Add many at once</span>
                    <span className="text-[13px] font-normal leading-[18px] text-r1-ink-3">
                        Paste up to {MAX_PER_PASTE} questions, with your answers or for the AI to answer
                    </span>
                </span>
            }
        >
            <div className="flex flex-col gap-4 pb-2 pt-1">
                <Segmented
                    label="Who writes the answers"
                    className="self-start"
                    value={mode}
                    onChange={(m) => {
                        setMode(m)
                        setError(null)
                    }}
                    options={[
                        { value: "pairs", label: "I write the answers" },
                        { value: "generate", label: "AI writes the answers" },
                    ]}
                />

                <Field label={isPairs ? "Questions and answers" : "Questions"} help={help} error={error ?? undefined}>
                    <Textarea
                        rows={7}
                        value={text}
                        placeholder={
                            isPairs
                                ? "Where does the business pay? Through a Wise payment link sent by email.\nCan the owner pay with GCash? Not yet. Wise is the only way for now."
                                : "How do I get paid?\nHow long does a website take to build?\nCan I use my own domain?"
                        }
                        onChange={(e) => {
                            setText(e.target.value)
                            setError(null)
                        }}
                    />
                </Field>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <Field label="Where the AI can use them" className="sm:w-[300px]">
                        <Select value={workspace} onChange={(e) => setWorkspace(e.target.value as Workspace)}>
                            {WORKSPACE_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                        <span className="t-num text-[13px] leading-[18px] text-r1-ink-3" aria-live="polite">
                            {linesLabel}
                        </span>
                        <Button variant="primary" className="flex-none" onClick={submit} disabled={running} aria-busy={running}>
                            {running ? (isPairs ? "Saving…" : "Queuing…") : buttonLabel}
                        </Button>
                    </div>
                </div>

                {queued > 0 && (
                    <p className="flex items-center gap-2 text-[13px] leading-[18px] text-r1-ink-2" role="status">
                        <Dot tone="progress" />
                        {plural(queued, "question")} in the queue. The AI works through them one at a time; you can leave this page.
                    </p>
                )}

                {runs.length > 0 && (
                    <div className="t-card">
                        <div className="flex min-h-12 items-center justify-between gap-3 border-b border-r1-line-3 px-4 py-2">
                            <div className="flex flex-col">
                                <h3 className="text-sm font-medium text-r1-ink">Recent AI runs</h3>
                                <p className="t-meta">What happened to each queued question, newest first.</p>
                            </div>
                            {finished > 0 && (
                                <Button size="sm" variant="ghost" className="flex-none" onClick={clearFinished}>
                                    Clear finished
                                </Button>
                            )}
                        </div>
                        <div className="t-list">
                            {visibleRuns.map((j) => (
                                <div key={j._id} className="flex min-h-12 items-center gap-3 border-b border-r1-line-3 px-4 py-2.5 last:border-b-0">
                                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                        <p className="truncate text-sm text-r1-ink">{j.question}</p>
                                        {j.status === "error" && j.error && <p className="t-meta [overflow-wrap:anywhere]">{j.error}</p>}
                                    </div>
                                    <Status {...jobStatus(j)} />
                                </div>
                            ))}
                        </div>
                        {runs.length > RUNS_CAP && (
                            <button type="button" className="t-showall" aria-expanded={showAllRuns} onClick={() => setShowAllRuns((s) => !s)}>
                                {showAllRuns ? "Show fewer" : `Show all ${runs.length}`}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </Fold>
    )
}
