"use client";

import { useAction } from "convex/react";
import { CircleHelp, Send, X } from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { Button, Icon } from "@/components/r1";
import { api } from "@/convex/_generated/api";

import { useT } from "./i18n";

type Source = { slug: string; title: string };
type Msg = { role: "bot" | "user"; text: string; sources?: Source[] };

/**
 * "Ask Tendso", the floating chat on the public pages (kit: Chat button +
 * panel; board: Landing). Closed by default: a pill in the bottom-right
 * corner that opens a small panel above it.
 *
 * THE BEHAVIOUR IS THE OLD WIDGET'S, UNCHANGED. Answers are grounded in the
 * Tendso knowledge base (Convex + Gemini RAG, api.knowledgeAI.ask), scoped to
 * the public Help Center workspace and tagged as coming from the chatbot. The
 * last six turns go along as history so a follow-up keeps its context; the
 * greeting is not a turn, so it never reaches the model (the old widget
 * filtered its two canned greetings out for the same reason). The thread
 * survives closing and reopening the panel.
 *
 * What the kit and the board changed: the look (t-chat classes), starter
 * questions as chips that fill the box until the first question is asked,
 * a "Looking in the Help Center" line while an answer is on its way, sources
 * as links under the answer, Esc to close, and focus that goes into the box on
 * open and back to the button on close.
 *
 * It carries its own `r1` scope because it sits outside the page's frame, so it
 * looks right wherever it is rendered. Its copy follows the page's EN/TL choice
 * inside LanguageProvider, and is English anywhere else.
 */
export default function ChatBot({ suggestions }: { /** Starter questions; the owner's three by default. */ suggestions?: string[] } = {}) {
    const { t } = useT();
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<Msg[]>([]);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const askAI = useAction(api.knowledgeAI.ask);
    const panelId = useId();
    const titleId = useId();
    const inputId = useId();

    const starters = suggestions ?? [t("r1.chat.q1"), t("r1.chat.q2"), t("r1.chat.q3")];

    // Keep the newest message in view.
    useEffect(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [messages, busy, open]);

    // Opening puts the cursor in the question box.
    useEffect(() => {
        if (open) inputRef.current?.focus();
    }, [open]);

    const close = () => {
        setOpen(false);
        buttonRef.current?.focus();
    };

    const onPanelKeyDown = (e: KeyboardEvent<HTMLElement>) => {
        if (e.key === "Escape") {
            e.stopPropagation();
            close();
        }
    };

    // A starter fills the box rather than sending, so it can be edited first.
    const pick = (question: string) => {
        setInput(question);
        inputRef.current?.focus();
    };

    const ask = async (e?: FormEvent) => {
        e?.preventDefault();
        const q = input.trim();
        if (!q || busy) return;
        const history = messages
            .map((m) => ({ role: m.role === "bot" ? ("assistant" as const) : ("user" as const), text: m.text }))
            .slice(-6);
        setInput("");
        setMessages((m) => [...m, { role: "user", text: q }]);
        setBusy(true);
        try {
            const res = await askAI({ query: q, workspace: "help", source: "chatbot", history });
            setMessages((m) => [...m, { role: "bot", text: res.answer, sources: res.sources }]);
        } catch {
            setMessages((m) => [...m, { role: "bot", text: t("r1.chat.error") }]);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="r1 contents">
            {open && (
                <section id={panelId} className="t-chat" role="dialog" aria-labelledby={titleId} onKeyDown={onPanelKeyDown}>
                    <div className="t-chat-head">
                        <div className="flex min-w-0 flex-col gap-0.5">
                            <h2 id={titleId} className="t-h2 text-[15px] leading-5">
                                {t("r1.chat.title")}
                            </h2>
                            <p className="t-meta">{t("r1.chat.sub")}</p>
                        </div>
                        <Button variant="ghost" size="sm" icon aria-label={t("r1.chat.closeLabel")} onClick={close}>
                            <Icon icon={X} />
                        </Button>
                    </div>

                    <div ref={scrollRef} className="t-chat-msgs" aria-live="polite">
                        <p className="t-bub-ai">{t("r1.chat.hello")}</p>

                        {messages.length === 0 && !busy && (
                            <div className="flex flex-col items-start gap-2">
                                <p className="t-meta">{t("r1.chat.try")}</p>
                                {starters.map((s) => (
                                    <button key={s} type="button" className="t-chip h-auto min-h-8 whitespace-normal py-1.5 text-left" onClick={() => pick(s)}>
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}

                        {messages.map((m, i) =>
                            m.role === "user" ? (
                                <p key={i} className="t-bub-me [overflow-wrap:anywhere]">
                                    {m.text}
                                </p>
                            ) : (
                                <div key={i} className="flex flex-col items-start gap-1.5">
                                    <p className="t-bub-ai whitespace-pre-line [overflow-wrap:anywhere]">{m.text}</p>
                                    {m.sources && m.sources.length > 0 && (
                                        <p className="t-meta">
                                            {t(m.sources.length > 1 ? "r1.chat.sources" : "r1.chat.source")}:{" "}
                                            {m.sources.map((s, n, all) => (
                                                <Fragment key={s.slug}>
                                                    {n > 0 && " · "}
                                                    <Link href={`/knowledge?ws=help&article=${encodeURIComponent(s.slug)}`} className="t-link text-r1-ink-3">
                                                        {/* Numbered when there are several, to match the [1] [2] the answer cites. */}
                                                        {all.length > 1 && `[${n + 1}] `}
                                                        {s.title}
                                                    </Link>
                                                </Fragment>
                                            ))}
                                        </p>
                                    )}
                                </div>
                            ),
                        )}

                        {busy && (
                            <p className="t-meta inline-flex items-center gap-2">
                                <span className="t-dot is-progress" aria-hidden="true" />
                                {t("r1.chat.pending")}
                            </p>
                        )}
                    </div>

                    <form className="t-chat-foot" onSubmit={ask}>
                        <label htmlFor={inputId} className="sr-only">
                            {t("r1.chat.label")}
                        </label>
                        <input
                            id={inputId}
                            ref={inputRef}
                            className="t-input min-w-0 flex-1"
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={t("r1.chat.placeholder")}
                            autoComplete="off"
                            enterKeyHint="send"
                        />
                        <Button type="submit" variant="primary" icon aria-label={t("r1.chat.send")} disabled={!input.trim() || busy}>
                            <Icon icon={Send} />
                        </Button>
                    </form>
                </section>
            )}

            <Button
                ref={buttonRef}
                variant="primary"
                size="lg"
                className="t-chat-btn"
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                onClick={() => (open ? close() : setOpen(true))}
            >
                <Icon icon={open ? X : CircleHelp} />
                {open ? t("r1.chat.close") : t("r1.chat.open")}
            </Button>
        </div>
    );
}
