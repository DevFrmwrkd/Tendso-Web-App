"use client"

import { useMutation, useQuery } from "convex/react"
import { Check } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"

import { Button, Dot, Field, Icon, Loading, Select, SkeletonRows, Status, Textarea } from "@/components/r1"
import { api } from "@/convex/_generated/api"
import { knowledgeAccessDefaults } from "@/packages/shared/knowledge"

import { AUDIENCE_LABEL, type KnowledgeAccess } from "../_lib/access"
import AudienceAccessFields from "./AudienceAccessFields"

import {
    answeredHint,
    errorText,
    groupQuestions,
    pairLine,
    plural,
    questionKey,
    shortDate,
    sourceLabel,
    trainedIndex,
    WORKSPACE_NAME,
    WORKSPACE_OPTIONS,
    workspaceRead,
    type QuestionGroup,
    type Workspace,
} from "../_lib/train"

/** Rows before "Show all". */
const CAP = 5

const LEAD =
    "Questions Ask Tendso could not answer from the shared knowledge base. Review the answer and who may read it before publishing."

/**
 * Questions people asked that the AI could not ground in an answer
 * (knowledgeTraining.listUnansweredQueries: the content-gap feed). Each one
 * can be answered in place; the answer is saved through trainQAPairs, the
 * same verbatim path as the paste box, so it needs no AI and no daily budget.
 *
 * The ask itself stays in the log after it is answered (the backend has no
 * per-question dismiss); the "Answered since" hint is what marks it handled.
 */
export default function UnansweredSection({ hasUsableKey }: { hasUsableKey: boolean | undefined }) {
    const unanswered = useQuery(api.knowledgeTraining.listUnansweredQueries, {})
    const trained = useQuery(api.knowledgeTraining.listTrainingQA, {})
    const trainQAPairs = useMutation(api.knowledgeTraining.trainQAPairs)

    const [showAll, setShowAll] = useState(false)
    const [answering, setAnswering] = useState<string | null>(null)
    const [draft, setDraft] = useState("")
    const [draftWs, setDraftWs] = useState<Workspace>("help")
    const [access, setAccess] = useState<KnowledgeAccess>(() => knowledgeAccessDefaults("help"))
    const [reviewed, setReviewed] = useState(false)
    const [draftErr, setDraftErr] = useState("")
    const [saving, setSaving] = useState(false)
    const headingId = useId()

    if (unanswered === undefined) {
        return (
            <section className="flex flex-col gap-4" aria-labelledby={headingId}>
                <div className="flex flex-col gap-1">
                    <h2 className="t-h2" id={headingId}>
                        Questions the AI couldn’t answer
                    </h2>
                    <p className="t-meta">{LEAD}</p>
                </div>
                <Loading label="Loading unanswered questions">
                    <SkeletonRows count={3} />
                </Loading>
            </section>
        )
    }

    const index = trainedIndex(trained ?? [])
    const groups = groupQuestions(unanswered).map((g) => ({ g, hint: answeredHint(g, index) }))
    const covered = groups.filter((x) => x.hint).length
    const n = groups.length
    const visible = showAll ? groups : groups.slice(0, CAP)

    function toggle(g: QuestionGroup) {
        const opening = answering !== g.key
        setAnswering(opening ? g.key : null)
        setDraft("")
        setDraftErr("")
        setDraftWs(g.workspace ?? workspaceRead(g.source))
        // An unanswered question may contain personal or team details. The
        // admin deliberately chooses broader access after reviewing the reply.
        setAccess({ audiences: ["admin"], visibility: "internal" })
        setReviewed(false)
    }

    async function save(g: QuestionGroup) {
        if (!reviewed) return
        const text = draft.trim()
        if (text.length < 2) {
            setDraftErr("Write an answer first. A sentence or two is enough.")
            return
        }
        setSaving(true)
        setDraftErr("")
        try {
            const r = await trainQAPairs({ text: pairLine(g.text, text), workspace: draftWs, ...access })
            if (r.saved > 0) {
                setAnswering(null)
                setDraft("")
                toast(
                    hasUsableKey === false
                        ? "Published for the selected audiences. The AI starts using it once a key works."
                        : "Published for the selected audiences. The AI can use it in a few seconds.",
                )
            } else if (r.skipped > 0) {
                // trainQAPairs skips a question that already has a trained answer,
                // in either workspace.
                const where = index.get(questionKey(g.text))
                const ws: Workspace | null = where ? (where.has("help") ? "help" : "wiki") : null
                setDraftErr(
                    `This question already has a trained answer${ws ? ` in the ${WORKSPACE_NAME[ws]}` : ""}. Change it under Trained answers, where you can also move it.`,
                )
            } else {
                setDraftErr("Nothing saved: a question this short can’t be trained.")
            }
        } catch (e) {
            setDraftErr(errorText(e, "Could not save the answer."))
        } finally {
            setSaving(false)
        }
    }

    return (
        <section className="flex flex-col gap-4" aria-labelledby={headingId}>
            <div className="flex flex-col gap-1">
                <h2 className="t-h2" id={headingId}>
                    {n === 0 ? "Every question has an answer" : `${plural(n, "question")} the AI couldn’t answer`}
                </h2>
                <p className="t-meta">
                    {LEAD}
                    {covered > 0 && ` ${covered} ${covered === 1 ? "has" : "have"} an answer now.`}
                </p>
            </div>

            {n === 0 ? (
                <div className="t-card">
                    <div className="t-empty">
                        <Dot tone="done" />
                        <h3 className="t-h2">Nothing waiting</h3>
                        <p className="t-meta max-w-[440px]">
                            When someone asks the Help Center, the chatbot or Discord /ask something the AI can’t ground in an answer, it shows up
                            here for you to answer.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="t-card">
                    <div className="t-list">
                        {visible.map(({ g, hint }) => {
                            const open = answering === g.key
                            return (
                                <div key={g.key} className="border-b border-r1-line-3 last:border-b-0">
                                    <div className="flex min-h-16 items-center gap-3 px-4 py-3">
                                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                                            <p className="text-sm font-medium text-r1-ink [overflow-wrap:anywhere]">{g.text}</p>
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] leading-[18px] text-r1-ink-3">
                                                <span>
                                                    {sourceLabel(g.source)} · {shortDate(g.createdAt)}
                                                    {g.times > 1 && ` · asked ${g.times} times`}
                                                </span>
                                                {g.audiences?.length ? <span>Asked by: {g.audiences.map((audience) => AUDIENCE_LABEL[audience]).join(", ")}</span> : null}
                                                {hint && <Status {...hint} className="whitespace-normal" />}
                                            </div>
                                        </div>
                                        <Button
                                            size="sm"
                                            disabled={saving}
                                            className="flex-none"
                                            aria-expanded={open}
                                            aria-label={`${open ? "Close answer" : "Answer"}: ${g.text}`}
                                            onClick={() => toggle(g)}
                                        >
                                            {open ? "Close" : "Answer"}
                                        </Button>
                                    </div>

                                    {open && (
                                        <div className="px-4 pb-4">
                                            <div className="flex flex-col gap-3.5 rounded-r1 border border-r1-line bg-r1-fill-2 p-4">
                                                <Field label="Your answer" error={draftErr || undefined}>
                                                    <Textarea
                                                        rows={4}
                                                        value={draft}
                                                        disabled={saving}
                                                        placeholder="Write it the way you’d reply in Discord. Two or three sentences is plenty."
                                                        onChange={(e) => {
                                                            setDraft(e.target.value)
                                                            setReviewed(false)
                                                            setDraftErr("")
                                                        }}
                                                    />
                                                </Field>
                                                <AudienceAccessFields value={access} onChange={(next) => { setAccess(next); setReviewed(false) }} disabled={saving} />
                                                <label className="t-check">
                                                    <input type="checkbox" checked={reviewed} disabled={saving} onChange={(e) => setReviewed(e.target.checked)} />
                                                    I reviewed this answer and removed personal details before sharing it beyond admins.
                                                </label>
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                                    <Field label="Collection" help="Organizes the library. Audience and access control who can read it." className="sm:w-[300px]">
                                                        <Select value={draftWs} disabled={saving} onChange={(e) => { setDraftWs(e.target.value as Workspace); setReviewed(false) }}>
                                                            {WORKSPACE_OPTIONS.map((o) => (
                                                                <option key={o.value} value={o.value}>
                                                                    {o.label}
                                                                </option>
                                                            ))}
                                                        </Select>
                                                    </Field>
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="ghost" onClick={() => toggle(g)} disabled={saving}>
                                                            Cancel
                                                        </Button>
                                                        <Button variant="primary" onClick={() => save(g)} disabled={saving || !reviewed} aria-busy={saving}>
                                                            <Icon icon={Check} />
                                                            {saving ? "Publishing…" : "Publish answer"}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                    {n > CAP && (
                        <button type="button" className="t-showall" aria-expanded={showAll} onClick={() => setShowAll((s) => !s)}>
                            {showAll ? "Show fewer" : `Show all ${n}`}
                        </button>
                    )}
                </div>
            )}
        </section>
    )
}
