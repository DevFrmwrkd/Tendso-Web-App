"use client";

import { useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { api } from "@/convex/_generated/api";
import "./chat.css";
import { messageUsHref, sourceHref, tidy } from "./tidy";

export { messageUsHref, sourceHref };

/*
 * Ask Tendso, in the v2 look.
 *
 * THE ENGINE IS THE EXISTING ONE, UNCHANGED. Every answer comes from
 * `api.knowledgeAI.ask` (Gemini RAG over the published Help Center articles, with
 * the BYOK key pool, the extractive fallback when Gemini is down, the rate limit
 * and the question log), scoped to the public "help" workspace. That is the same
 * call the landing ChatBot (components/landing/ChatBot.tsx) and the /knowledge
 * search palette make. The last six turns go along as history so a follow-up
 * keeps its context.
 *
 * Two forms of one thing:
 *  - <AskTendsoInline />   an answer box that sits in a page (the Help page).
 *  - <AskTendsoLauncher /> a floating button that opens a small panel (the landing).
 *
 * What it shows is short on purpose: the first lines of the answer, the articles
 * it came from as links, and "Message us" whenever the AI could not answer (the
 * knowledge base had nothing, the rate limit was hit, or the call failed).
 */

type AskResult = FunctionReturnType<typeof api.knowledgeAI.ask>;
type Source = { slug: string; title: string };
type Turn = { role: "user" | "assistant"; text: string };

type Exchange = {
    id: number;
    question: string;
    status: "loading" | "answer" | "no-answer" | "error";
    answer?: string;
    sources?: Source[];
};

export const DEFAULT_STARTERS = ["How much does it cost?", "How fast is my site ready?", "When do I pay?"];

/** Turns "[1]" in an answer into a small number chip that links to its source. */
function WithCitations({ text, sources }: { text: string; sources: Source[] }) {
    const parts = text.split(/(\[\d+\])/g);
    return (
        <>
            {parts.map((p, i) => {
                const m = /^\[(\d+)\]$/.exec(p);
                if (!m) return <Fragment key={i}>{p}</Fragment>;
                const n = Number(m[1]);
                const src = sources[n - 1];
                if (!src) return null;
                return (
                    <Link key={i} className="at-cite" href={sourceHref(src.slug)} aria-label={`Source ${n}: ${src.title}`}>
                        {n}
                    </Link>
                );
            })}
        </>
    );
}

/** The engine call, with the thread and the errors handled. */
function useAsk(source: "web" | "chatbot") {
    const askAction = useAction(api.knowledgeAI.ask);
    const [thread, setThread] = useState<Exchange[]>([]);
    const [busy, setBusy] = useState(false);
    const counter = useRef(0);
    const history = useRef<Turn[]>([]);

    const ask = useCallback(
        async (raw: string) => {
            const question = raw.trim().slice(0, 500);
            if (!question || busy) return;
            const id = ++counter.current;
            setBusy(true);
            setThread((t) => [...t, { id, question, status: "loading" }]);
            const prior = history.current.slice(-6);
            try {
                const res: AskResult = await askAction({ query: question, workspace: "help", source, history: prior });
                const status = res.grounded ? "answer" : "no-answer";
                setThread((t) => t.map((e) => (e.id === id ? { ...e, status, answer: res.answer, sources: res.sources } : e)));
                // A reply that was not grounded ("I don't have that…") is not a fact to carry forward.
                history.current = [...history.current, { role: "user" as const, text: question }, ...(res.grounded ? [{ role: "assistant" as const, text: res.answer }] : [])].slice(-6);
            } catch {
                setThread((t) => t.map((e) => (e.id === id ? { ...e, status: "error" } : e)));
            } finally {
                setBusy(false);
            }
        },
        [askAction, busy, source],
    );

    const retry = useCallback(
        (id: number) => {
            const e = thread.find((x) => x.id === id);
            if (!e) return;
            setThread((t) => t.filter((x) => x.id !== id));
            void ask(e.question);
        },
        [ask, thread],
    );

    const clear = useCallback(() => {
        setThread([]);
        history.current = [];
    }, []);

    return { thread, busy, ask, retry, clear };
}

/** One answer: short text, sources as links, and "Message us" when it could not answer. */
function Answer({ ex, onRetry }: { ex: Exchange; onRetry: () => void }) {
    const [more, setMore] = useState(false);

    if (ex.status === "loading") {
        return (
            <div className="at-answer" aria-live="polite">
                <p className="at-looking">
                    <span className="at-dots" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                    </span>
                    Looking in the Help Center
                </p>
            </div>
        );
    }

    if (ex.status === "error") {
        return (
            <div className="at-answer" aria-live="polite">
                <p className="at-text">I can&apos;t answer right now. Try again, or message us and a person will.</p>
                <div className="at-actions">
                    <button type="button" className="at-btn at-btn--ghost" onClick={onRetry}>
                        Try again
                    </button>
                    <a className="at-btn at-btn--ink" href={messageUsHref(ex.question)}>
                        Message us
                    </a>
                </div>
            </div>
        );
    }

    const allSources = ex.sources ?? [];
    const { short, full, clipped } = tidy(ex.answer ?? "");
    // Show the articles the answer cites. The engine returns everything it looked at, so when the
    // answer cites nothing (or could not answer) only the closest three are listed.
    const cited = new Set([...(ex.answer ?? "").matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
    const sources = ex.status === "answer" && cited.size > 0 ? allSources.filter((_, i) => cited.has(i + 1)) : allSources.slice(0, 3);
    const text = more ? full : short;

    return (
        <div className="at-answer" aria-live="polite">
            <p className="at-text">
                <WithCitations text={text} sources={allSources} />
                {clipped && (
                    <>
                        {" "}
                        <button type="button" className="at-more" onClick={() => setMore((m) => !m)}>
                            {more ? "Less" : "More"}
                        </button>
                    </>
                )}
            </p>
            {sources.length > 0 && (
                <div className="at-sources">
                    <span className="at-sources-k">{ex.status === "answer" ? (sources.length > 1 ? "Sources" : "Source") : "Closest articles"}</span>
                    {sources.map((s) => (
                        <Link key={s.slug} className="at-source" href={sourceHref(s.slug)}>
                            {sources.length > 1 && ex.status === "answer" && cited.size > 0 && <b>{allSources.indexOf(s) + 1}</b>}
                            {s.title}
                        </Link>
                    ))}
                </div>
            )}
            {ex.status === "no-answer" && (
                <div className="at-actions">
                    <a className="at-btn at-btn--ink" href={messageUsHref(ex.question)}>
                        Message us
                    </a>
                </div>
            )}
        </div>
    );
}

function SendIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function AskForm({
    value,
    onChange,
    onSubmit,
    busy,
    placeholder,
    inputRef,
    id,
}: {
    value: string;
    onChange: (v: string) => void;
    onSubmit: (e?: FormEvent) => void;
    busy: boolean;
    placeholder: string;
    inputRef?: React.Ref<HTMLInputElement>;
    id: string;
}) {
    return (
        <form className="at-form" onSubmit={onSubmit}>
            <label htmlFor={id} className="sr-only">
                Ask Tendso a question
            </label>
            <input
                id={id}
                ref={inputRef}
                className="at-input"
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                autoComplete="off"
                enterKeyHint="send"
                maxLength={500}
            />
            <button type="submit" className="at-send" aria-label="Ask" disabled={!value.trim() || busy}>
                <SendIcon />
            </button>
        </form>
    );
}

/**
 * The inline answer box (Help page). One question and its answer at a time;
 * asking again replaces the answer, and the follow-up keeps its context.
 */
export function AskTendsoInline({
    suggestions = DEFAULT_STARTERS,
    title = "Ask Tendso",
    intro = "Ask in your own words. Answers come from our Help articles.",
    className,
}: {
    suggestions?: string[];
    title?: string;
    intro?: string;
    className?: string;
}) {
    const { thread, busy, ask, retry, clear } = useAsk("web");
    const [value, setValue] = useState("");
    const id = useId();
    const latest = thread[thread.length - 1];

    const submit = (e?: FormEvent) => {
        e?.preventDefault();
        const q = value.trim();
        if (!q || busy) return;
        setValue("");
        void ask(q);
    };

    return (
        <section className={`at-inline ${className ?? ""}`} aria-label={title}>
            <p className="at-kicker">
                <i aria-hidden="true" />
                Tendso AI
            </p>
            <h2 className="at-title">{title}</h2>
            {!latest && <p className="at-intro">{intro}</p>}

            {latest && (
                <div className="at-exchange">
                    <p className="at-q">{latest.question}</p>
                    <Answer ex={latest} onRetry={() => retry(latest.id)} />
                </div>
            )}

            <AskForm id={id} value={value} onChange={setValue} onSubmit={submit} busy={busy} placeholder={latest ? "Ask something else" : "Ask anything, like “how much”"} />

            {!latest ? (
                <div className="at-chips" role="group" aria-label="Questions people ask">
                    {suggestions.map((s) => (
                        <button key={s} type="button" className="at-chip" onClick={() => void ask(s)} disabled={busy}>
                            {s}
                        </button>
                    ))}
                </div>
            ) : (
                !busy && (
                    <button type="button" className="at-clear" onClick={clear}>
                        Start over
                    </button>
                )
            )}
        </section>
    );
}

/**
 * The floating launcher (landing). A pill in the bottom corner that opens a
 * small panel: a short thread, starter questions, sources, "Message us".
 * Escape closes it and focus goes back to the pill.
 */
export function AskTendsoLauncher({
    suggestions = DEFAULT_STARTERS,
    label = "Ask Tendso",
    className,
}: {
    suggestions?: string[];
    label?: string;
    className?: string;
}) {
    const { thread, busy, ask, retry } = useAsk("chatbot");
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState("");
    const bodyRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const panelId = useId();
    const titleId = useId();
    const inputId = useId();

    useEffect(() => {
        const el = bodyRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [thread, open]);

    useEffect(() => {
        if (open) inputRef.current?.focus();
    }, [open]);

    const close = () => {
        setOpen(false);
        buttonRef.current?.focus();
    };

    const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
        if (e.key === "Escape") {
            e.stopPropagation();
            close();
        }
    };

    const submit = (e?: FormEvent) => {
        e?.preventDefault();
        const q = value.trim();
        if (!q || busy) return;
        setValue("");
        void ask(q);
    };

    return (
        <div className={`at-launcher ${className ?? ""}`}>
            {open && (
                <section id={panelId} className="at-panel" role="dialog" aria-labelledby={titleId} onKeyDown={onKeyDown}>
                    <header className="at-panel-head">
                        <div>
                            <p className="at-kicker">
                                <i aria-hidden="true" />
                                Tendso AI
                            </p>
                            <h2 className="at-panel-title" id={titleId}>
                                {label}
                            </h2>
                        </div>
                        <button type="button" className="at-x" onClick={close} aria-label="Close">
                            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                                <path d="m3 3 8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                            </svg>
                        </button>
                    </header>

                    <div ref={bodyRef} className="at-panel-body">
                        <p className="at-hello">Hi. Ask me about prices, how it works, or changing your site.</p>
                        {thread.length === 0 && (
                            <div className="at-chips at-chips--col">
                                {suggestions.map((s) => (
                                    <button key={s} type="button" className="at-chip" onClick={() => void ask(s)} disabled={busy}>
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}
                        {thread.map((ex) => (
                            <div key={ex.id} className="at-exchange">
                                <p className="at-me">{ex.question}</p>
                                <Answer ex={ex} onRetry={() => retry(ex.id)} />
                            </div>
                        ))}
                    </div>

                    <div className="at-panel-foot">
                        <AskForm id={inputId} inputRef={inputRef} value={value} onChange={setValue} onSubmit={submit} busy={busy} placeholder="Type your question" />
                    </div>
                </section>
            )}

            <button
                ref={buttonRef}
                type="button"
                className="at-fab"
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                onClick={() => (open ? close() : setOpen(true))}
            >
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                </svg>
                {open ? "Close" : label}
            </button>
        </div>
    );
}

/** One export for both forms: `<AskTendso variant="inline" />` or `<AskTendso variant="floating" />`. */
export function AskTendso({ variant = "inline", ...props }: { variant?: "inline" | "floating"; suggestions?: string[]; className?: string }) {
    return variant === "floating" ? <AskTendsoLauncher {...props} /> : <AskTendsoInline {...props} />;
}

export default AskTendso;
