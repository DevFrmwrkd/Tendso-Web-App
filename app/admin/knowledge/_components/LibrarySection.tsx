"use client"

import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { useId, useState } from "react"
import { toast } from "sonner"

import { ArticleBody } from "@/app/knowledge/_components/views"
import { Button, Checkbox, Field, Loading, SearchInput, Select, SkeletonRows, Status, Tabs } from "@/components/r1"
import { api } from "@/convex/_generated/api"
import { KNOWLEDGE_AUDIENCES, KNOWLEDGE_VISIBILITIES, resolveKnowledgeAccess, type KnowledgeAudience, type KnowledgeVisibility } from "@/packages/shared/knowledge"

import { ACCESS_LABEL, AUDIENCE_LABEL, accessSummary, type KnowledgeAccess } from "../_lib/access"
import { errorText, WORKSPACE_NAME, type Workspace } from "../_lib/train"
import AudienceAccessFields from "./AudienceAccessFields"

type Article = FunctionReturnType<typeof api.knowledge.listAdminArticles>[number]
type Category = FunctionReturnType<typeof api.knowledge.listCategories>[number]
type Faq = FunctionReturnType<typeof api.knowledge.listFaqs>[number]
type Kind = "article" | "category" | "faq"
type LibraryItem = { kind: "article"; doc: Article } | { kind: "category"; doc: Category } | { kind: "faq"; doc: Faq }

function titleOf(item: LibraryItem): string { return item.kind === "faq" ? item.doc.question : item.doc.title }
function summaryOf(item: LibraryItem): string {
    return item.kind === "article" ? item.doc.summary : item.kind === "category" ? item.doc.description : item.doc.answer
}

/** Tag the existing library in place; rich article blocks are never rewritten by a text editor. */
export default function LibrarySection() {
    const [kind, setKind] = useState<Kind>("article")
    const [query, setQuery] = useState("")
    const [workspace, setWorkspace] = useState<Workspace | "all">("all")
    const [audience, setAudience] = useState<KnowledgeAudience | "all">("all")
    const [visibility, setVisibility] = useState<KnowledgeVisibility | "all">("all")
    const [status, setStatus] = useState<"all" | "draft" | "published">("all")
    const [editing, setEditing] = useState<string | null>(null)
    const headingId = useId()

    // All are admin-gated server-side, or queried only inside the admin page.
    const articles = useQuery(api.knowledge.listAdminArticles, kind === "article" ? {} : "skip")
    const helpCategories = useQuery(api.knowledge.listCategories, { workspace: "help" })
    const wikiCategories = useQuery(api.knowledge.listCategories, { workspace: "wiki" })
    const helpFaqs = useQuery(api.knowledge.listFaqs, kind === "faq" ? { workspace: "help" } : "skip")
    const wikiFaqs = useQuery(api.knowledge.listFaqs, kind === "faq" ? { workspace: "wiki" } : "skip")
    const categories = [...(helpCategories ?? []), ...(wikiCategories ?? [])]
    const ready = kind === "article" ? articles !== undefined : kind === "category"
        ? helpCategories !== undefined && wikiCategories !== undefined
        : helpFaqs !== undefined && wikiFaqs !== undefined
    const items: LibraryItem[] = kind === "article"
        ? (articles ?? []).map((doc) => ({ kind: "article", doc }))
        : kind === "category" ? categories.map((doc) => ({ kind: "category", doc }))
          : [...(helpFaqs ?? []), ...(wikiFaqs ?? [])].map((doc) => ({ kind: "faq", doc }))
    const term = query.trim().toLowerCase()
    const matches = items.filter((item) => {
        const access = resolveKnowledgeAccess(item.doc)
        return (workspace === "all" || item.doc.workspace === workspace)
            && (audience === "all" || access.audiences.includes("everyone") || access.audiences.includes(audience))
            && (visibility === "all" || access.visibility === visibility)
            && (kind !== "article" || status === "all" || (item.kind === "article" && item.doc.status === status))
            && (!term || `${titleOf(item)} ${summaryOf(item)}`.toLowerCase().includes(term))
    })

    return (
        <section className="flex flex-col gap-4" aria-labelledby={headingId}>
            <div>
                <h2 className="t-h2" id={headingId}>Knowledge library</h2>
                <p className="t-meta mt-1">One source for Ask Tendso and the Help Center. Review existing content, choose its audience and control access.</p>
            </div>
            <Tabs label="Library content" value={kind} onChange={(next) => { setKind(next); setEditing(null) }} tabs={[
                { value: "article", label: "Articles" }, { value: "faq", label: "FAQs" }, { value: "category", label: "Categories" },
            ]}>
                <div className="flex flex-col gap-4">
                    <SearchInput label="Search knowledge library" placeholder="Search the library" value={query} onChange={(e) => setQuery(e.target.value)} />
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Field label="Collection"><Select value={workspace} onChange={(e) => setWorkspace(e.target.value as Workspace | "all")}>
                            <option value="all">All collections</option><option value="help">Help Center</option><option value="wiki">Wiki</option>
                        </Select></Field>
                        <Field label="Audience"><Select value={audience} onChange={(e) => setAudience(e.target.value as KnowledgeAudience | "all")}>
                            <option value="all">All audiences</option>
                            {KNOWLEDGE_AUDIENCES.map((value) => <option key={value} value={value}>{AUDIENCE_LABEL[value]}</option>)}
                        </Select></Field>
                        <Field label="Access"><Select value={visibility} onChange={(e) => setVisibility(e.target.value as KnowledgeVisibility | "all")}>
                            <option value="all">All access levels</option>
                            {KNOWLEDGE_VISIBILITIES.map((value) => <option key={value} value={value}>{ACCESS_LABEL[value]}</option>)}
                        </Select></Field>
                        {kind === "article" && <Field label="Publication"><Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                            <option value="all">All articles</option><option value="draft">Needs review</option><option value="published">Published</option>
                        </Select></Field>}
                    </div>
                    {!ready ? <Loading label="Loading knowledge library"><SkeletonRows count={5} /></Loading> : (
                        <div className="t-card">
                            <p className="t-meta border-b border-r1-line-3 px-4 py-3" aria-live="polite">{matches.length} of {items.length} {kind === "faq" ? "FAQs" : `${kind}s`}</p>
                            {matches.length === 0 ? <p className="t-meta p-6">No content matches these filters.</p> : matches.map((item) => (
                                <div key={item.doc._id} className="border-b border-r1-line-3 p-4 last:border-b-0">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                            <h3 className="text-sm font-medium text-r1-ink [overflow-wrap:anywhere]">{titleOf(item)}</h3>
                                            <p className="t-meta line-clamp-2 [overflow-wrap:anywhere]">{summaryOf(item)}</p>
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                {item.kind === "article" && <Status tone={item.doc.status === "draft" ? "attn" : "done"} word={item.doc.status === "draft" ? "Needs review" : "Published"} />}
                                                <span className="text-xs text-r1-ink-3">{WORKSPACE_NAME[item.doc.workspace]}</span>
                                                <span className="text-xs text-r1-ink-3">{accessSummary(resolveKnowledgeAccess(item.doc))}</span>
                                            </div>
                                        </div>
                                        <Button size="sm" aria-expanded={editing === item.doc._id} onClick={() => setEditing(editing === item.doc._id ? null : item.doc._id)}>
                                            {editing === item.doc._id ? "Close" : "Review"}
                                        </Button>
                                    </div>
                                    {editing === item.doc._id && <LibraryAccessEditor key={item.doc._id} item={item} categories={categories} onDone={() => setEditing(null)} />}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Tabs>
        </section>
    )
}

function LibraryAccessEditor({ item, categories, onDone }: { item: LibraryItem; categories: Category[]; onDone: () => void }) {
    const setAccess = useMutation(api.knowledge.setKnowledgeAccess)
    const upsertArticle = useMutation(api.knowledge.upsertArticle)
    const [access, updateAccess] = useState<KnowledgeAccess>(() => resolveKnowledgeAccess(item.doc))
    const [status, setStatus] = useState<"draft" | "published">(item.kind === "article" ? item.doc.status : "published")
    const [reviewed, setReviewed] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState("")
    const publishing = item.kind === "article" && item.doc.status === "draft" && status === "published"

    async function save() {
        if (publishing && !reviewed) return
        setBusy(true)
        setError("")
        try {
            if (item.kind === "article" && status !== item.doc.status) {
                const article = item.doc
                const category = categories.find((candidate) => candidate._id === article.categoryId)
                if (!category) throw new Error("This article’s category could not be loaded. Try again before changing its publication status.")
                await upsertArticle({
                    articleId: article._id, slug: article.slug, title: article.title, summary: article.summary,
                    categorySlug: category.slug, workspace: article.workspace, body: article.body,
                    keywords: article.keywords, author: article.author, readMin: article.readMin,
                    popular: article.popular, status, ...access,
                })
            } else {
                await setAccess({ kind: item.kind, id: item.doc._id, ...access })
            }
            toast(publishing ? "Article published for its allowed audiences." : "Knowledge settings saved.")
            onDone()
        } catch (e) {
            setError(errorText(e, "Could not save these settings."))
        } finally { setBusy(false) }
    }

    return (
        <div className="mt-4 flex flex-col gap-4 border-t border-r1-line-3 pt-4">
            {item.kind === "article" ? (
                <details className="rounded-r1 border border-r1-line p-3.5">
                    <summary className="cursor-pointer text-sm font-medium">Read full article</summary>
                    <div className="mt-4 flex flex-col gap-4"><ArticleBody blocks={item.doc.body} /></div>
                </details>
            ) : <p className="t-body whitespace-pre-wrap [overflow-wrap:anywhere]">{summaryOf(item)}</p>}
            <AudienceAccessFields value={access} disabled={busy} onChange={(next) => { updateAccess(next); setReviewed(false) }} />
            <p className="t-help">{item.kind === "category"
                ? "A category’s access also restricts its articles and linked FAQs. Their own settings are kept."
                : item.kind === "faq" ? "A linked article and its category may further restrict who can read this FAQ."
                  : "This article’s category may further restrict access. Changing these settings keeps every article block intact."}</p>
            {item.kind === "article" && (
                <Field label="Publication" help={status === "draft" ? "Drafts are visible only to admins and are not used by Ask Tendso." : "Published content is used only when its access and audience permit it."}>
                    <Select value={status} disabled={busy} onChange={(e) => { setStatus(e.target.value as typeof status); setReviewed(false) }}>
                        <option value="draft">Draft · needs review</option><option value="published">Published</option>
                    </Select>
                </Field>
            )}
            {publishing && <Checkbox label="I read the full article and reviewed its audience and access settings." checked={reviewed} disabled={busy} onChange={(e) => setReviewed(e.target.checked)} />}
            {error && <p className="t-error" role="alert">{error}</p>}
            <div className="flex justify-end gap-2">
                <Button variant="ghost" disabled={busy} onClick={onDone}>Cancel</Button>
                <Button variant="primary" disabled={busy || (publishing && !reviewed)} aria-busy={busy} onClick={save}>
                    {busy ? "Saving…" : publishing ? "Publish article" : "Save settings"}
                </Button>
            </div>
        </div>
    )
}
