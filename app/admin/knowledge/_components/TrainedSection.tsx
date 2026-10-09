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
import { knowledgeSlugError, parseKnowledgeKeywords } from "@/lib/knowledgeArticle"

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
 * summary, and knowledge.upsertArticle rewrites the whole article, so the
 * full article and both workspaces'
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
    const [slug, setSlug] = useState(article.slug)
    const [summary, setSummary] = useState(article.summary)
    const [keywords, setKeywords] = useState(() => article.keywords.join(", "))
    const [answer, setAnswer] = useState(() => article.body.map((b) => ("text" in b ? b.text : "")).join("\n\n"))
    const [workspace, setWorkspace] = useState<Workspace>(article.workspace)
    const [categorySlugs, setCategorySlugs] = useState<Record<Workspace, string>>(() => ({
        help: (categories.help.find((c) => c._id === article.categoryId) ?? categories.help[0])?.slug ?? "",
        wiki: (categories.wiki.find((c) => c._id === article.categoryId) ?? categories.wiki[0])?.slug ?? "",
    }))
    const [error, setError] = useState("")
    const [slugError, setSlugError] = useState("")
    const [saving, setSaving] = useState(false)
    const categoryOptions = categories[workspace]
    const selectedCategory = categoryOptions.find((c) => c.slug === categorySlugs[workspace]) ?? categoryOptions[0]

    async function save() {
        const nextSlug = slug.trim()
        const invalidSlug = nextSlug !== article.slug ? knowledgeSlugError(nextSlug) : undefined
        if (invalidSlug) {
            setSlugError(invalidSlug)
            setError(invalidSlug)
            return
        }
        if (question.trim().length < 4 || answer.trim().length < 2) {
            setError("Both the question and the answer need some text.")
            return
        }
        if (!selectedCategory) {
            setError(`Choose a category in the ${WORKSPACE_NAME[workspace]} before saving.`)
            return
        }
        const paras = answer
            .split(/\n\s*\n/)
            .map((p) => p.replace(/\s+/g, " ").trim())
            .filter(Boolean)
        setSaving(true)
        setError("")
        try {
            // Identify the existing article by id so a new slug cannot create
            // a duplicate. Everything this form does not show is carried over.
            await upsertArticle({
                articleId: article._id,
                slug: nextSlug,
                title: question.replace(/\s+/g, " ").trim(),
                summary: summary.trim() || paras.join(" ").slice(0, 300),
                categorySlug: selectedCategory.slug,
                workspace,
                body: paras.map((text) => ({ t: "p" as const, text })),
                keywords: parseKnowledgeKeywords(keywords),
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
                    disabled={saving}
                    onChange={(e) => {
                        setQuestion(e.target.value)
                        setError("")
                    }}
                />
            </Field>
            <Field label="Slug" help="The article’s link name. Changing it changes the link; old links will stop working." error={slugError || undefined}>
                <Input
                    type="text"
                    value={slug}
                    disabled={saving}
                    autoCapitalize="none"
                    spellCheck={false}
                    onChange={(e) => {
                        setSlug(e.target.value)
                        setSlugError("")
                        setError("")
                    }}
                />
            </Field>
            <Field label="Summary" help="Shown in search. Leave blank to use the start of the answer.">
                <Textarea
                    rows={2}
                    value={summary}
                    disabled={saving}
                    onChange={(e) => {
                        setSummary(e.target.value)
                        setError("")
                    }}
                />
            </Field>
            <Field label="Keywords" help="Words that help the AI find this answer. Separate them with commas or new lines.">
                <Textarea
                    rows={2}
                    value={keywords}
                    disabled={saving}
                    onChange={(e) => {
                        setKeywords(e.target.value)
                        setError("")
                    }}
                />
            </Field>
            <Field label="Answer">
                <Textarea
                    rows={4}
                    value={answer}
                    disabled={saving}
                    onChange={(e) => {
                        setAnswer(e.target.value)
                        setError("")
                    }}
                />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Where the AI can use it">
                    <Select
                        value={workspace}
                        disabled={saving}
                        onChange={(e) => {
                            setWorkspace(e.target.value as Workspace)
                            setError("")
                        }}
                    >
                        {WORKSPACE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </Select>
                </Field>
                <Field label="Category" help={categoryOptions.length === 0 ? "No categories in this workspace yet." : undefined}>
                    <Select
                        value={selectedCategory?.slug ?? ""}
                        disabled={saving || categoryOptions.length === 0}
                        onChange={(e) => {
                            setCategorySlugs((current) => ({ ...current, [workspace]: e.target.value }))
                            setError("")
                        }}
                    >
                        {categoryOptions.length === 0 ? (
                            <option value="">No categories available</option>
                        ) : categoryOptions.map((category) => (
                            <option key={category._id} value={category.slug}>
                                {category.title}
                            </option>
                        ))}
                    </Select>
                </Field>
            </div>
            {error ? <p className="t-error" role="alert">{error}</p> : null}
            <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={onDone} disabled={saving}>
                    Cancel
                </Button>
                <Button variant="primary" onClick={save} disabled={saving || categoryOptions.length === 0} aria-busy={saving}>
                    {saving ? "Saving…" : "Save changes"}
                </Button>
            </div>
        </div>
    )
}
