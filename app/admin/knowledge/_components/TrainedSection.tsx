"use client"

import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { MoreHorizontal } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"

import {
    Button,
    ConfirmDialog,
    Field,
    Icon,
    Input,
    Loading,
    MoreMenu,
    SearchInput,
    Select,
    SkeletonRows,
    SkeletonText,
    Status,
    TableHead,
    Textarea,
} from "@/components/r1"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"

import { errorText, trainedStatus, WORKSPACE_NAME, WORKSPACE_OPTIONS, type Workspace } from "../_lib/train"
import PanelBoundary from "./PanelBoundary"

type TrainedRow = FunctionReturnType<typeof api.knowledgeTraining.listTrainingQA>[number]
type Article = FunctionReturnType<typeof api.knowledge.listArticles>[number]
type Category = FunctionReturnType<typeof api.knowledge.listCategories>[number]

/** Rows before "Show all" (a search shows every match). */
const CAP = 5

/**
 * What the AI already knows from this page: every trained Q&A
 * (knowledgeTraining.listTrainingQA), newest first, searchable. Each row can be
 * edited in place or removed; removing deletes the article, so it asks first.
 */
export default function TrainedSection() {
    const trained = useQuery(api.knowledgeTraining.listTrainingQA, {})
    const remove = useMutation(api.knowledgeTraining.deleteTrainingQA)

    const [q, setQ] = useState("")
    const [showAll, setShowAll] = useState(false)
    const [editing, setEditing] = useState<Id<"knowledgeArticles"> | null>(null)
    const [removing, setRemoving] = useState<TrainedRow | null>(null)
    const [busy, setBusy] = useState(false)
    const headingId = useId()

    const rows = trained ?? []
    const term = q.trim().toLowerCase()
    const matches = term ? rows.filter((t) => `${t.question} ${t.answer}`.toLowerCase().includes(term)) : rows
    const visible = showAll || term ? matches : matches.slice(0, CAP)

    async function confirmRemove() {
        if (!removing) return
        setBusy(true)
        try {
            await remove({ id: removing._id })
            if (editing === removing._id) setEditing(null)
            toast("Removed. The AI no longer uses this answer.")
        } catch (e) {
            toast.error(errorText(e))
        } finally {
            setBusy(false)
            setRemoving(null)
        }
    }

    return (
        <section className="flex flex-col gap-4" aria-labelledby={headingId}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                <div className="flex flex-col gap-1">
                    <h2 className="t-h2" id={headingId}>
                        Trained answers {trained !== undefined && <span className="t-count">{rows.length}</span>}
                    </h2>
                    <p className="t-meta">What the AI already knows from this page. Newest first.</p>
                </div>
                <SearchInput
                    label="Search trained answers"
                    placeholder="Search questions and answers"
                    className="w-full sm:w-[280px] sm:flex-none"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                />
            </div>

            {trained === undefined ? (
                <Loading label="Loading trained answers">
                    <SkeletonRows count={CAP} />
                </Loading>
            ) : rows.length === 0 ? (
                <div className="t-card">
                    <div className="t-empty">
                        <h3 className="t-h2">Nothing trained yet</h3>
                        <p className="t-meta max-w-[420px]">
                            Answer a question above, or paste a batch under “Add many at once”. Each answer shows up here and the AI starts using
                            it within seconds.
                        </p>
                    </div>
                </div>
            ) : matches.length === 0 ? (
                <div className="t-card">
                    <div className="t-empty">
                        <h3 className="t-h2 [overflow-wrap:anywhere]">No trained answer mentions “{q.trim()}”</h3>
                        <p className="t-meta">Try another word, or answer it from the list above when someone asks.</p>
                        <Button size="sm" onClick={() => setQ("")}>
                            Clear search
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="t-card">
                    {term && (
                        <TableHead className="rounded-t-r1-card">
                            <span className="min-w-0 truncate" aria-live="polite">
                                {matches.length} of {rows.length} match “{q.trim()}”
                            </span>
                        </TableHead>
                    )}
                    <div className="t-list">
                        {visible.map((t) => (
                            <div key={t._id} className="flex items-start gap-4 border-b border-r1-line-3 px-4 py-3.5 last:border-b-0">
                                {editing === t._id ? (
                                    <PanelBoundary what="This answer">
                                        <EditTrained row={t} onDone={() => setEditing(null)} />
                                    </PanelBoundary>
                                ) : (
                                    <>
                                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                                            <p className="text-sm font-medium text-r1-ink [overflow-wrap:anywhere]">{t.question}</p>
                                            <p className="line-clamp-2 text-[13px] leading-[18px] text-r1-ink-2 [overflow-wrap:anywhere]">{t.answer}</p>
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
                                                <Status {...trainedStatus(t.embedded)} />
                                                <span className="text-xs text-r1-ink-3">{WORKSPACE_NAME[t.workspace]}</span>
                                            </div>
                                        </div>
                                        <MoreMenu
                                            label={`Options for: ${t.question}`}
                                            items={[
                                                { label: "Edit", onSelect: () => setEditing(t._id) },
                                                "divider",
                                                { label: "Remove", danger: true, onSelect: () => setRemoving(t) },
                                            ]}
                                            trigger={(props) => (
                                                <Button variant="ghost" size="sm" icon {...props}>
                                                    <Icon icon={MoreHorizontal} />
                                                </Button>
                                            )}
                                        />
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                    {!term && matches.length > CAP && (
                        <button type="button" className="t-showall" aria-expanded={showAll} onClick={() => setShowAll((s) => !s)}>
                            {showAll ? "Show fewer" : `Show all ${matches.length}`}
                        </button>
                    )}
                </div>
            )}

            <ConfirmDialog
                open={removing !== null}
                onCancel={() => setRemoving(null)}
                onConfirm={confirmRemove}
                busy={busy}
                title="Remove this trained answer?"
                confirmLabel="Remove answer"
            >
                <p className="[overflow-wrap:anywhere]">
                    The AI stops using the answer to “{removing?.question}” in the {removing ? WORKSPACE_NAME[removing.workspace] : ""}. Help
                    articles written by hand are not touched. This can’t be undone.
                </p>
            </ConfirmDialog>
        </section>
    )
}

/**
 * Edit one trained answer in place. The list only carries a 300-character
 * summary, and knowledge.upsertArticle (the admin article editor, keyed by
 * slug) rewrites the whole article, so the full article and both workspaces'
 * categories are loaded only while this one answer is open.
 */
function EditTrained({ row, onDone }: { row: TrainedRow; onDone: () => void }) {
    const articles = useQuery(api.knowledge.listArticles, { workspace: row.workspace })
    const helpCategories = useQuery(api.knowledge.listCategories, { workspace: "help" })
    const wikiCategories = useQuery(api.knowledge.listCategories, { workspace: "wiki" })

    if (articles === undefined || helpCategories === undefined || wikiCategories === undefined) {
        return (
            <Loading label="Loading this answer" className="flex-1">
                <SkeletonText lines={4} />
            </Loading>
        )
    }

    const article = articles.find((a) => a._id === row._id)
    if (!article) {
        return (
            <div className="flex flex-1 flex-col items-start gap-2">
                <p className="t-error">This answer is no longer in the knowledge base.</p>
                <Button size="sm" onClick={onDone}>
                    Close
                </Button>
            </div>
        )
    }

    return <EditTrainedForm article={article} categories={{ help: helpCategories, wiki: wikiCategories }} onDone={onDone} />
}

function EditTrainedForm({
    article,
    categories,
    onDone,
}: {
    article: Article
    categories: Record<Workspace, Category[]>
    onDone: () => void
}) {
    const upsertArticle = useMutation(api.knowledge.upsertArticle)

    // Trained answers are plain paragraphs. Anything richer (a list, a heading)
    // would be flattened by this form, so such an article is left alone.
    const plain = article.body.every((b) => b.t === "p")
    const [question, setQuestion] = useState(article.title)
    const [answer, setAnswer] = useState(() => article.body.map((b) => ("text" in b ? b.text : "")).join("\n\n"))
    const [workspace, setWorkspace] = useState<Workspace>(article.workspace)
    const [error, setError] = useState("")
    const [saving, setSaving] = useState(false)

    async function save() {
        if (question.trim().length < 4 || answer.trim().length < 2) {
            setError("Both the question and the answer need some text.")
            return
        }
        // Keep the article's own category while it stays in its workspace;
        // moved to the other one, it joins that workspace's first category,
        // as a new trained answer would.
        const list = categories[workspace]
        const category = list.find((c) => c._id === article.categoryId) ?? list[0]
        if (!category) {
            setError(`The ${WORKSPACE_NAME[workspace]} has no category yet, so the answer can’t move there.`)
            return
        }
        const paras = answer
            .split(/\n\s*\n/)
            .map((p) => p.replace(/\s+/g, " ").trim())
            .filter(Boolean)
        setSaving(true)
        setError("")
        try {
            // Same slug, so the article is updated in place (and its embedding
            // regenerated); everything this form does not show is carried over.
            await upsertArticle({
                slug: article.slug,
                title: question.replace(/\s+/g, " ").trim(),
                // The list's preview, cut the way trainQAPairs cuts it.
                summary: paras.join(" ").slice(0, 300),
                categorySlug: category.slug,
                workspace,
                body: paras.map((text) => ({ t: "p" as const, text })),
                keywords: article.keywords,
                author: article.author,
                readMin: article.readMin,
                popular: article.popular ?? false,
                status: article.status,
            })
            toast("Updated. The AI re-learns it in a few seconds.")
            onDone()
        } catch (e) {
            setError(errorText(e, "Could not save the changes."))
        } finally {
            setSaving(false)
        }
    }

    if (!plain) {
        return (
            <div className="flex flex-1 flex-col items-start gap-2">
                <p className="t-body">This answer has formatting the quick editor can’t keep, so it can’t be changed here.</p>
                <Button size="sm" onClick={onDone}>
                    Close
                </Button>
            </div>
        )
    }

    return (
        <div className="flex min-w-0 flex-1 flex-col gap-3">
            <Field label="Question">
                <Input
                    type="text"
                    value={question}
                    onChange={(e) => {
                        setQuestion(e.target.value)
                        setError("")
                    }}
                />
            </Field>
            <Field label="Answer" error={error || undefined}>
                <Textarea
                    rows={4}
                    value={answer}
                    onChange={(e) => {
                        setAnswer(e.target.value)
                        setError("")
                    }}
                />
            </Field>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <Field label="Where the AI can use it" className="sm:w-[300px]">
                    <Select value={workspace} onChange={(e) => setWorkspace(e.target.value as Workspace)}>
                        {WORKSPACE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </Select>
                </Field>
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={onDone} disabled={saving}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={save} disabled={saving} aria-busy={saving}>
                        {saving ? "Saving…" : "Save changes"}
                    </Button>
                </div>
            </div>
        </div>
    )
}
