"use client"

import { useMutation, useQuery } from "convex/react"
import { MoreHorizontal } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button, ConfirmDialog, Icon, MoreMenu, type MenuItem } from "@/components/r1"
import { api } from "@/convex/_generated/api"

import { errorText, groupQuestions, plural } from "../_lib/train"

/**
 * The page's More menu: the housekeeping that is not the page's job of
 * answering questions. Its own component (with its own boundary in the page)
 * so a failure here only takes the menu away.
 *
 * None of the three deletes can be undone (the rows are gone, and the trained
 * list only carries a 300-character summary, too little to put an answer
 * back), so each goes through a confirm instead of the board's Undo toast.
 */
export default function TrainAiMenu() {
    const trained = useQuery(api.knowledgeTraining.listTrainingQA, {})
    const unanswered = useQuery(api.knowledgeTraining.listUnansweredQueries, {})
    const purgeUngrounded = useMutation(api.knowledgeTraining.purgeUngroundedQA)
    const resetDailyLimit = useMutation(api.knowledgeTraining.resetTrainingDailyLimit)
    const reEmbedPending = useMutation(api.knowledgeTraining.reEmbedPendingQA)
    const clearUnanswered = useMutation(api.knowledgeTraining.clearUnansweredQueries)
    const purgeAll = useMutation(api.knowledgeTraining.purgeAllTrainedQA)

    const [confirm, setConfirm] = useState<null | "unusable" | "dismiss" | "clear">(null)
    const [busy, setBusy] = useState(false)

    const nTrained = trained?.length ?? 0
    const nLearning = trained?.filter((t) => !t.embedded).length ?? 0
    const nWaiting = unanswered ? groupQuestions(unanswered).length : 0

    async function run(task: () => Promise<void>) {
        try {
            await task()
        } catch (e) {
            toast.error(errorText(e))
        }
    }

    const items: MenuItem[] = [
        { label: "Remove unusable answers…", disabled: nTrained === 0, onSelect: () => setConfirm("unusable") },
        // Finish learning: retries any trained answer still stuck on "Learning…"
        // (its embedding is made once, in the background, and can fail when the
        // AI key was busy or missing).
        ...(nLearning > 0
            ? [
                  {
                      label: `Finish learning ${plural(nLearning, "answer")}`,
                      onSelect: () =>
                          run(async () => {
                              const r = await reEmbedPending({})
                              toast(`Resuming learning for ${plural(r.retried, "answer")}…`, {
                                  description: "They’ll be ready to answer shortly.",
                              })
                          }),
                  },
              ]
            : []),
        {
            label: "Reset today’s AI limit",
            onSelect: () =>
                run(async () => {
                    await resetDailyLimit({})
                    toast("Today’s AI limit is reset. “AI writes the answers” can run again.")
                }),
        },
        { label: "Dismiss all unanswered…", disabled: nWaiting === 0, onSelect: () => setConfirm("dismiss") },
        "divider",
        { label: "Clear all trained answers…", danger: true, disabled: nTrained === 0, onSelect: () => setConfirm("clear") },
    ]

    async function confirmed(task: () => Promise<void>) {
        setBusy(true)
        try {
            await task()
        } catch (e) {
            toast.error(errorText(e))
        } finally {
            setBusy(false)
            setConfirm(null)
        }
    }

    return (
        <>
            <MoreMenu
                label="More actions for Train AI"
                items={items}
                // On a phone the header stacks and the button sits on the left, so
                // the menu opens rightwards from it; on a desk it hangs from the right.
                className="[&>.t-menu]:left-0 [&>.t-menu]:right-auto sm:[&>.t-menu]:left-auto sm:[&>.t-menu]:right-0"
                trigger={(props) => (
                    <Button {...props}>
                        <Icon icon={MoreHorizontal} />
                        More
                    </Button>
                )}
            />

            <ConfirmDialog
                open={confirm === "unusable"}
                onCancel={() => setConfirm(null)}
                onConfirm={() =>
                    confirmed(async () => {
                        // Deletes trained answers that are really the AI's "I don't have
                        // information…" fallback, saved before the grounding guard existed.
                        const r = await purgeUngrounded({})
                        toast(
                            r.removed > 0
                                ? `Removed ${plural(r.removed, "unusable answer")}.`
                                : `Nothing to remove. ${r.total === 1 ? "The one answer is" : `All ${r.total} answers are`} grounded.`,
                        )
                    })
                }
                busy={busy}
                title="Remove unusable answers?"
                confirmLabel="Remove unusable answers"
                cancelLabel="Keep them"
            >
                <p>
                    This deletes every trained answer whose text reads like the AI’s fallback (“I don’t have information…”, “please contact
                    Tendso support”, “ask in Discord”), including any you wrote that say so. This can’t be undone.
                </p>
            </ConfirmDialog>

            <ConfirmDialog
                open={confirm === "dismiss"}
                onCancel={() => setConfirm(null)}
                onConfirm={() =>
                    confirmed(async () => {
                        const r = await clearUnanswered({})
                        toast(`Dismissed ${plural(r.removed, "unanswered question")}.`)
                    })
                }
                busy={busy}
                title="Dismiss every unanswered question?"
                confirmLabel="Dismiss all"
                cancelLabel="Keep them"
            >
                <p>
                    This clears the log of questions the AI couldn’t answer, older ones not shown here included. A question comes back if someone
                    asks it again. This can’t be undone.
                </p>
            </ConfirmDialog>

            <ConfirmDialog
                open={confirm === "clear"}
                onCancel={() => setConfirm(null)}
                onConfirm={() =>
                    confirmed(async () => {
                        const r = await purgeAll({})
                        toast(`Cleared ${plural(r.removed, "trained answer")}.`)
                    })
                }
                busy={busy}
                title={`Clear all ${plural(nTrained, "trained answer")}?`}
                confirmLabel={`Clear all ${nTrained}`}
                cancelLabel="Keep them"
            >
                <p>
                    The AI forgets every answer on this page, in the Help Center and the Wiki. Help articles written by hand are not touched. This
                    can’t be undone.
                </p>
                <p className="t-meta">Use this to wipe a bad batch, for example answers saved while the AI had no working key.</p>
            </ConfirmDialog>
        </>
    )
}
