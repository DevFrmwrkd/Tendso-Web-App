import type { StatusWord } from "@/components/r1"
import type { KnowledgeAudience, KnowledgeVisibility } from "@/packages/shared/knowledge"

/**
 * Words, parsing and grouping for the Train AI page (board TrainAI). Pure: no
 * React, no Convex. The server stays the judge of what is saved; the parsing
 * here only mirrors it so the page can say what will happen before it does.
 */

export type Workspace = "help" | "wiki"
/** "pairs" = the admin writes the answers; "generate" = the AI drafts them from the knowledge base. */
export type BulkMode = "pairs" | "generate"

/** The server's cap per paste (MAX_PER_PASTE in convex/knowledgeTraining.ts). */
export const MAX_PER_PASTE = 25

export const WORKSPACE_NAME: Record<Workspace, string> = { help: "Help Center", wiki: "Wiki" }

/** Collections organize one shared library; audience/access controls protect it. */
export const WORKSPACE_OPTIONS: ReadonlyArray<{ value: Workspace; label: string }> = [
    { value: "help", label: "Help Center" },
    { value: "wiki", label: "Wiki" },
]

const SOURCE_LABEL: Record<string, string> = { web: "Help Center search", chatbot: "Ask Tendso", mobile: "Ask Tendso · mobile", discord: "Discord /ask" }

/** knowledgeQueries.source, in words. */
export function sourceLabel(source: string): string {
    return SOURCE_LABEL[source] ?? source
}

/**
 * Suggested collection for an older log without workspace metadata. Access
 * never follows this suggestion: it is selected separately by the admin.
 */
export function workspaceRead(source: string): Workspace {
    return source === "discord" ? "wiki" : "help"
}

/** Two questions are the same question when they differ only in case, spacing or end punctuation. */
export function questionKey(text: string): string {
    return text
        .toLowerCase()
        .replace(/[?？]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/[.!,;:…]+$/, "")
        .trim()
}

export type UnansweredRow = {
    query: string; source: string; createdAt: number; workspace?: Workspace
    audiences?: KnowledgeAudience[]; visibility?: KnowledgeVisibility
}
export type QuestionGroup = {
    key: string; text: string; source: string; createdAt: number; times: number; workspace?: Workspace
    audiences?: KnowledgeAudience[]; visibility?: KnowledgeVisibility
}

/**
 * listUnansweredQueries returns every ungrounded ask, newest first, so one
 * person retrying shows up as several rows. The same question (questionKey)
 * becomes one row that keeps the newest wording, channel and date and counts
 * how many times it was asked.
 */
export function groupQuestions(rows: UnansweredRow[]): QuestionGroup[] {
    const groups = new Map<string, QuestionGroup>()
    for (const r of rows) {
        const textKey = questionKey(r.query)
        if (!textKey) continue
        // Keep identical wording from different account types separate so an
        // owner question cannot disappear into an affiliate question's count.
        const scope = r.audiences?.length ? `|${[...r.audiences].sort().join(",")}|${r.visibility ?? ""}` : ""
        const key = `${textKey}${scope}`
        const seen = groups.get(key)
        if (seen) seen.times += 1
        else groups.set(key, {
            key, text: r.query.trim(), source: r.source, createdAt: r.createdAt, times: 1,
            workspace: r.workspace, audiences: r.audiences, visibility: r.visibility,
        })
    }
    return [...groups.values()]
}

/** Where each question already has a trained answer, by questionKey. */
export function trainedIndex(trained: ReadonlyArray<{ question: string; workspace: string; status?: string }>): Map<string, Set<Workspace>> {
    const index = new Map<string, Set<Workspace>>()
    for (const t of trained) {
        if (t.status === "draft") continue
        const key = questionKey(t.question)
        const ws: Workspace = t.workspace === "wiki" ? "wiki" : "help"
        const set = index.get(key) ?? new Set<Workspace>()
        set.add(ws)
        index.set(key, set)
    }
    return index
}

/**
 * The hint under an unanswered question once a trained answer exists for it.
 * The ask stays in the log (there is no per-question dismiss), so the hint is
 * what tells the admin it is handled, or handled where the asker cannot see it.
 */
export function answeredHint(group: QuestionGroup, index: Map<string, Set<Workspace>>): StatusWord | null {
    const where = index.get(questionKey(group.text))
    if (!where || where.size === 0) return null
    return { tone: "done", word: "Published answer available · check its audience" }
}

/**
 * One "Question? Answer" line for trainQAPairs, which splits each line at its
 * FIRST "?" and saves the rest verbatim as the answer. So the question may
 * carry one "?" only, at its end (any other becomes a full-width "？", which
 * reads the same), and the answer has to fit on one line.
 */
export function pairLine(question: string, answer: string): string {
    const q = question
        .replace(/\s+/g, " ")
        .trim()
        .replace(/[?？]+$/, "")
        .replace(/\?/g, "？")
    const a = answer.replace(/\s+/g, " ").trim()
    return `${q}? ${a}`
}

/**
 * The server's own parse (trainQAPairs / enqueueTraining), for the line count
 * and the button: one entry per non-empty line; a pair needs a "?" with a
 * question of more than 3 characters before it and an answer of more than 1
 * after it.
 */
export function parseBulk(text: string, mode: BulkMode): { lines: string[]; usable: number; skipped: number } {
    const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
    if (mode === "generate") return { lines, usable: lines.length, skipped: 0 }
    let usable = 0
    for (const l of lines) {
        const i = l.indexOf("?")
        if (i === -1) continue
        if (l.slice(0, i + 1).trim().length > 3 && l.slice(i + 1).trim().length > 1) usable += 1
    }
    return { lines, usable, skipped: lines.length - usable }
}

export function plural(n: number, one: string, many = `${one}s`): string {
    return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`
}

/** listTrainingQA.embedded: whether the vector the AI searches is in place yet. */
export function trainedStatus(embedded: boolean, status?: string): StatusWord {
    if (status === "draft") return { tone: "attn", word: "Needs review" }
    return embedded ? { tone: "done", word: "Ready to answer" } : { tone: "progress", word: "Learning…" }
}

/** knowledgeTrainingJobs.status: 'queued' | 'processing' | 'done' | 'error'. */
export function jobStatus(job: { status: string; grounded: boolean | null }): StatusWord {
    switch (job.status) {
        case "queued":
            return { tone: "progress", word: "Queued" }
        case "processing":
            return { tone: "progress", word: "Processing" }
        case "done":
            // An ungrounded draft is never saved: it would poison the knowledge
            // base. The question comes back to the unanswered list instead.
            return job.grounded ? { tone: "attn", word: "Draft ready for review" } : { tone: "attn", word: "Not grounded, not saved" }
        case "error":
            return { tone: "bad", word: "Failed" }
        default:
            return { tone: "off", word: job.status ? job.status.charAt(0).toUpperCase() + job.status.slice(1) : "Unknown" }
    }
}

export type PoolStats = { total: number; active: number; usableNow: number; onCooldown: number; retired: number }

/**
 * Why the pool has no usable key, from aiKeys.poolStats. A key on cooldown hit
 * Google's limit or kept failing; a retired one was rejected as invalid.
 */
export function poolProblem(p: PoolStats): string {
    if (p.total === 0) return "There are no Gemini keys in the pool yet."
    const parts: string[] = []
    if (p.onCooldown > 0) parts.push(`${p.onCooldown} ${p.onCooldown === 1 ? "is" : "are"} cooling down after hitting a limit`)
    if (p.retired > 0) parts.push(`${p.retired} ${p.retired === 1 ? "was" : "were"} rejected by Google`)
    const lead = p.total === 1 ? "The one Gemini key in the pool is failing" : `All ${p.total} Gemini keys in the pool are failing`
    return parts.length > 0 ? `${lead}: ${parts.join(", ")}.` : `${lead}.`
}

/** The line at the foot of the page. */
export function keyLine(p: PoolStats): string {
    const pool = `${plural(p.total, "key")} in the pool`
    if (p.usableNow > 0) return `The AI has a working key · ${pool}`
    return `No working key · ${pool}${p.total > 0 ? ", none usable right now" : ""}`
}

/** "Sep 28", with the year only when it is not this year's. */
export function shortDate(ts: number, now: number = Date.now()): string {
    const sameYear = new Date(ts).getFullYear() === new Date(now).getFullYear()
    return new Date(ts).toLocaleDateString(
        "en-US",
        sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" },
    )
}

/**
 * The sentence to show for a failed call. Convex wraps a thrown Error as
 * "… Uncaught Error: <message>"; the message is lifted out when it is there.
 */
export function errorText(e: unknown, fallback = "Something went wrong."): string {
    const data = (e as { data?: unknown } | null)?.data
    if (typeof data === "string" && data) return data
    const message = e instanceof Error ? e.message : ""
    const inner = /Uncaught Error: ([^\n]+)/.exec(message)?.[1]
    return (inner ?? message) || fallback
}
