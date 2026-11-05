import { accessSummary, toggleAudience } from "@/app/admin/knowledge/_lib/access"
import { answeredHint, groupQuestions, jobStatus, trainedIndex, trainedStatus } from "@/app/admin/knowledge/_lib/train"
import { resolveKnowledgeAccess } from "@/packages/shared/knowledge"

describe("knowledge admin audience choices", () => {
    it("replaces Everyone with a specific audience without broadening a final restricted choice", () => {
        expect(toggleAudience(["everyone"], "owner")).toEqual(["owner"])
        expect(toggleAudience(["owner"], "affiliate")).toEqual(["owner", "affiliate"])
        expect(toggleAudience(["owner", "affiliate"], "owner")).toEqual(["affiliate"])
        expect(toggleAudience(["affiliate"], "affiliate")).toEqual(["affiliate"])
        expect(toggleAudience(["owner", "affiliate"], "everyone")).toEqual(["everyone"])
    })

    it("shows legacy defaults and keeps an existing restricted record's selections", () => {
        expect(accessSummary(resolveKnowledgeAccess({ workspace: "help" }))).toBe("Public · Everyone")
        expect(accessSummary(resolveKnowledgeAccess({ workspace: "wiki" }))).toBe("Internal · Field agents, Admins")
        const record = { workspace: "help" as const, audiences: ["owner" as const], visibility: "authenticated" as const }
        const value = resolveKnowledgeAccess(record)
        expect(accessSummary(value)).toBe("Signed-in accounts · Business owners")
        value.audiences.push("affiliate")
        expect(record.audiences).toEqual(["owner"])
    })
})

describe("training draft review", () => {
    it("keeps the same question from owners and affiliates in separate review groups", () => {
        const rows = groupQuestions([
            { query: "How do I get paid?", source: "mobile", createdAt: 3, audiences: ["owner"] },
            { query: "How do I get paid?", source: "mobile", createdAt: 2, audiences: ["affiliate"] },
            { query: "How do I get paid?", source: "mobile", createdAt: 1, audiences: ["owner"] },
        ])
        expect(rows).toHaveLength(2)
        expect(rows.map((row) => [row.audiences, row.times])).toEqual([[["owner"], 2], [["affiliate"], 1]])
    })

    it("never labels a generated or embedded draft as ready to answer", () => {
        expect(trainedStatus(true, "draft")).toEqual({ tone: "attn", word: "Needs review" })
        expect(jobStatus({ status: "done", grounded: true })).toEqual({ tone: "attn", word: "Draft ready for review" })
        expect(trainedStatus(true, "published").word).toBe("Ready to answer")
    })

    it("does not mark an unanswered question handled until a draft is published", () => {
        const group = { key: "how do i get paid", text: "How do I get paid?", source: "chatbot", createdAt: 1, times: 1 }
        const draft = { question: group.text, workspace: "help", status: "draft" }
        expect(answeredHint(group, trainedIndex([draft]))).toBeNull()
        expect(answeredHint(group, trainedIndex([{ ...draft, status: "published" }]))?.word).toContain("check its audience")
    })
})
