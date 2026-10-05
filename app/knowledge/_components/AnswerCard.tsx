"use client";

import { ChevronRight, RotateCw, Sparkles } from "lucide-react";

import { Button, Icon, SkeletonText } from "@/components/r1";

import { ContactRows } from "./ContactCard";
import { articleHref } from "./model";
import type { AskResult, Workspace } from "./types";

/*
 * The "Tendso AI" answer inside the command palette (board: AI answer card).
 * The palette calls convex knowledgeAI.ask — Gemini RAG grounded in the
 * published articles, which also logs every question for the Train AI page —
 * and this renders what came back:
 *  - grounded: the answer, its numbered sources, and a reminder to check them;
 *  - not grounded (nothing found, the model found no answer in the sources,
 *    or the rate limit): the server's own sentence and a way to ask a person;
 *  - failed: try again, or ask a person.
 * The board's "Was this helpful?" under an answer is left out: Convex has
 * nowhere to record it, and thanking someone for feedback that goes nowhere
 * would be a lie.
 */

export type AiState =
    | { key: string; question: string; workspace: Workspace; status: "loading" }
    | { key: string; question: string; workspace: Workspace; status: "done"; result: AskResult }
    | { key: string; question: string; workspace: Workspace; status: "error" };

export function AnswerPanel({ state, onOpen, onRetry }: { state: AiState; onOpen: (href: string) => void; onRetry: () => void }) {
    return (
        <div className="flex flex-col gap-4 px-3 pb-4 pt-3">
            <div className="flex flex-col gap-1">
                <span className="t-label inline-flex items-center gap-1.5 text-r1-gold-ink">
                    <Icon icon={Sparkles} size={14} />
                    Tendso AI
                </span>
                <p className="text-base font-medium leading-6 text-r1-ink">&ldquo;{state.question}&rdquo;</p>
            </div>
            <div className="flex flex-col gap-4" aria-live="polite">
                {state.status === "loading" && (
                    <>
                        <p className="t-meta">Searching the {state.workspace === "wiki" ? "creator wiki" : "Help Center"}…</p>
                        <SkeletonText lines={3} />
                    </>
                )}
                {state.status === "error" && (
                    <>
                        <div className="flex flex-col gap-1.5">
                            <h3 className="t-h2">The AI could not answer right now</h3>
                            <p className="t-body">Something went wrong on our side. Try again, or ask a person.</p>
                        </div>
                        <Button className="self-start" onClick={onRetry}>
                            <Icon icon={RotateCw} />
                            Try again
                        </Button>
                        <AskPerson />
                    </>
                )}
                {state.status === "done" && <Answer result={state.result} workspace={state.workspace} onOpen={onOpen} />}
            </div>
        </div>
    );
}

function Answer({ result, workspace, onOpen }: { result: AskResult; workspace: Workspace; onOpen: (href: string) => void }) {
    const paragraphs = result.answer.split(/\n\s*\n/).filter((p) => p.trim());
    const sources = result.sources.map((s, i) => ({ n: i + 1, title: s.title, href: articleHref({ slug: s.slug, workspace }) }));

    if (result.grounded) {
        return (
            <>
                <div className="flex flex-col gap-3">
                    {paragraphs.map((p, i) => (
                        <p key={i} className="whitespace-pre-line text-[15px] leading-6 text-r1-ink-2">
                            {p}
                        </p>
                    ))}
                </div>
                {sources.length > 0 && <Sources label="Sources" items={sources} onOpen={onOpen} />}
                <p className="t-help">Written from Tendso&apos;s published articles. Check the source before you act on it.</p>
            </>
        );
    }

    // The server says why it could not answer (nothing in the Help Center yet,
    // or too many questions at once), so its sentence is the body.
    return (
        <>
            <div className="flex flex-col gap-1.5">
                <h3 className="t-h2">We couldn&apos;t answer that — ask a person</h3>
                {paragraphs.map((p, i) => (
                    <p key={i} className="t-body whitespace-pre-line">
                        {p}
                    </p>
                ))}
                {result.escalated && <p className="t-meta">We sent your question to the team so they can add an answer.</p>}
            </div>
            {sources.length > 0 && <Sources label="Closest articles" items={sources} onOpen={onOpen} />}
            <AskPerson />
        </>
    );
}

function Sources({ label, items, onOpen }: { label: string; items: { n: number; title: string; href: string }[]; onOpen: (href: string) => void }) {
    return (
        <div className="flex flex-col gap-2">
            <p className="t-label">{label}</p>
            {items.map((s) => (
                <button
                    key={s.n}
                    type="button"
                    onClick={() => onOpen(s.href)}
                    className="flex min-h-11 w-full items-center gap-2.5 rounded-r1 border border-r1-line bg-r1-paper px-3 py-2 text-left text-sm text-r1-ink hover:bg-r1-fill"
                >
                    <span className="t-num inline-flex size-[22px] shrink-0 items-center justify-center rounded-full bg-r1-fill text-xs font-semibold text-r1-ink-2">
                        {s.n}
                    </span>
                    <span className="min-w-0 flex-1 font-medium leading-5">{s.title}</span>
                    <span className="flex shrink-0 text-r1-ink-4">
                        <Icon icon={ChevronRight} />
                    </span>
                </button>
            ))}
        </div>
    );
}

function AskPerson() {
    return <ContactRows className="rounded-r1-card border border-r1-line px-4 py-1" />;
}
