"use client"

import { useAction, useMutation } from "convex/react"
import { useId, useState } from "react"
import { toast } from "sonner"

import { Button, Field, PasswordInput, Status } from "@/components/r1"
import { api } from "@/convex/_generated/api"

import { errorText, plural, poolProblem, type PoolStats } from "../_lib/train"

/**
 * AI-key setup, shown only while no key in the pool is usable. The page can't
 * run the AI without one; offering the input here keeps the page
 * self-contained, so an admin never has to hunt through the Convex dashboard.
 * The key is the admin's own (aiKeys.addMyGeminiKey adds or replaces the
 * caller's key), encrypted at rest and shared by the chatbot, Discord /ask and
 * this page.
 */
export default function KeyBanner({ stats, learning }: { stats: PoolStats; learning: number }) {
    const addKey = useAction(api.aiKeys.addMyGeminiKey)
    const clearCooldowns = useMutation(api.aiKeys.clearGeminiCooldowns)
    const reEmbedPending = useMutation(api.knowledgeTraining.reEmbedPendingQA)

    const [keyInput, setKeyInput] = useState("")
    const [keyErr, setKeyErr] = useState<string | null>(null)
    const [busy, setBusy] = useState<null | "save" | "reactivate">(null)
    const headingId = useId()

    // Answers saved while no key worked never got their embedding: it is made
    // once, in the background, at save time. Once a key works again, retry
    // them, so they start answering without anyone finding "Finish learning".
    async function finishLearning() {
        if (learning === 0) return
        try {
            await reEmbedPending({})
        } catch {
            // Not fatal: "Finish learning" in the More menu retries the same.
        }
    }

    async function saveKey() {
        const key = keyInput.trim()
        if (key.length < 20) {
            setKeyErr("That doesn’t look like a Gemini key. They start with “AIza” and are about 39 characters.")
            return
        }
        setBusy("save")
        setKeyErr(null)
        try {
            const res = await addKey({ key })
            setKeyInput("")
            await finishLearning()
            toast(`Key ${res.label} saved. The AI uses it from the next question.`)
        } catch (e) {
            setKeyErr(errorText(e, "Could not save the key."))
        } finally {
            setBusy(null)
        }
    }

    // When the only key(s) are on cooldown (rate-limited, not invalid), offer
    // a one-click reactivate instead of forcing a new key.
    async function reactivate() {
        setBusy("reactivate")
        setKeyErr(null)
        try {
            const res = await clearCooldowns({})
            if (res.cleared > 0) await finishLearning()
            toast(res.cleared > 0 ? `Reactivated ${plural(res.cleared, "key")}. If they hit the limit again, add a new key.` : "No keys needed clearing.")
        } catch (e) {
            setKeyErr(errorText(e, "Could not clear cooldowns."))
        } finally {
            setBusy(null)
        }
    }

    return (
        <section className="t-card flex flex-col gap-4 p-5 sm:px-6" aria-labelledby={headingId}>
            <div className="flex flex-col gap-1.5">
                <Status tone="bad" word="No working key" />
                <h2 className="t-h2" id={headingId}>
                    The help AI has no working key
                </h2>
                <p className="t-body">
                    {poolProblem(stats)} Until one works, the website chatbot and Discord /ask can’t write answers, and “AI writes the answers”
                    is paused. Answers you write yourself still save.
                </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-2">
                <Field
                    label="Add a Gemini key"
                    className="flex-1"
                    error={keyErr ?? undefined}
                    help={
                        <>
                            Free at{" "}
                            <a className="t-link" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
                                aistudio.google.com/apikey
                            </a>
                            . Stored encrypted and shared by the chatbot, Discord /ask and this page.
                        </>
                    }
                >
                    <PasswordInput
                        autoComplete="off"
                        placeholder="AIza…"
                        value={keyInput}
                        onChange={(e) => {
                            setKeyInput(e.target.value)
                            setKeyErr(null)
                        }}
                    />
                </Field>
                <div className="flex flex-wrap gap-2 sm:flex-none sm:pt-6">
                    <Button variant="primary" onClick={saveKey} disabled={busy !== null} aria-busy={busy === "save"}>
                        {busy === "save" ? "Saving…" : "Save key"}
                    </Button>
                    {stats.onCooldown > 0 && (
                        <Button onClick={reactivate} disabled={busy !== null} aria-busy={busy === "reactivate"}>
                            {busy === "reactivate" ? "Reactivating…" : `Reactivate ${plural(stats.onCooldown, "key")}`}
                        </Button>
                    )}
                </div>
            </div>
        </section>
    )
}
