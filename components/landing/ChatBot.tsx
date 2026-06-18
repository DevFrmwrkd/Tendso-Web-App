"use client";

import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

type Msg = { role: "bot" | "user"; text: string; sources?: { slug: string; title: string }[] };

export default function ChatBot() {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<Msg[]>([
        { role: "bot", text: "Hi — I'm trained on the Tendso knowledge base. Ask me anything." },
        { role: "bot", text: "Try: \"How much do I earn?\" or \"How fast can I get a site?\"" },
    ]);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const askAI = useAction(api.knowledgeAI.ask);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, open]);

    // Grounded answer from the Tendso knowledge base (Convex + Gemini RAG),
    // scoped to the public Help Center workspace.
    const ask = async () => {
        const q = input.trim();
        if (!q || busy) return;
        // Snapshot the conversation so far (excluding the two opening greetings)
        // so the assistant can resolve follow-up questions. Keep it short.
        const history = messages
            .filter((m, i) => !(m.role === "bot" && i < 2))
            .map((m) => ({ role: m.role === "bot" ? ("assistant" as const) : ("user" as const), text: m.text }))
            .slice(-6);
        setInput("");
        setMessages((m) => [...m, { role: "user", text: q }]);
        setBusy(true);
        try {
            const res = await askAI({ query: q, workspace: "help", source: "chatbot", history });
            setMessages((m) => [...m, { role: "bot", text: res.answer, sources: res.sources }]);
        } catch {
            setMessages((m) => [
                ...m,
                {
                    role: "bot",
                    text: "I couldn't reach the knowledge base just now — try again in a moment, or grab the app to ask in-app.",
                },
            ]);
        } finally {
            setBusy(false);
        }
    };

    const suggestions = [
        "How much does a site cost?",
        "How fast can I get one?",
        "Where do payouts go?",
        "Do I need experience?",
    ];

    return (
        <>
            {open && (
                <div className="chatbot-window" role="dialog" aria-label="Chat with us">
                    <div
                        style={{
                            padding: "16px 20px",
                            borderBottom: "1px solid var(--neo-rule)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            background: "var(--neo-paper)",
                        }}
                    >
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span className="live-dot"></span>
                                <span
                                    style={{
                                        fontFamily: "var(--neo-serif)",
                                        fontSize: 22,
                                        fontStyle: "italic",
                                        letterSpacing: "-.01em",
                                    }}
                                >
                                    Ask Tendso
                                </span>
                            </div>
                            <div className="label" style={{ marginTop: 4 }}>Powered by our knowledge base</div>
                        </div>
                        <button
                            onClick={() => setOpen(false)}
                            aria-label="Close chat"
                            style={{
                                width: 30,
                                height: 30,
                                borderRadius: "50%",
                                border: "1px solid var(--neo-rule)",
                                background: "var(--neo-paper-3)",
                                color: "var(--neo-ink)",
                                cursor: "pointer",
                                fontSize: 14,
                            }}
                        >
                            ×
                        </button>
                    </div>

                    <div
                        ref={scrollRef}
                        style={{
                            flex: 1,
                            padding: 16,
                            display: "flex",
                            flexDirection: "column",
                            gap: 10,
                            overflowY: "auto",
                            maxHeight: 320,
                        }}
                    >
                        {messages.map((m, i) => (
                            <div
                                key={i}
                                style={{
                                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                                    background: m.role === "user" ? "var(--neo-ink)" : "var(--neo-paper-2)",
                                    color: m.role === "user" ? "var(--neo-paper)" : "var(--neo-ink)",
                                    padding: "10px 14px",
                                    borderRadius:
                                        m.role === "user"
                                            ? "var(--neo-r-md) var(--neo-r-md) 4px var(--neo-r-md)"
                                            : "var(--neo-r-md) var(--neo-r-md) var(--neo-r-md) 4px",
                                    fontSize: 14,
                                    lineHeight: 1.45,
                                    maxWidth: "85%",
                                }}
                            >
                                {m.text}
                                {m.role === "bot" && m.sources && m.sources.length > 0 && (
                                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                                        {m.sources.map((s) => (
                                            <a
                                                key={s.slug}
                                                href={`/knowledge?ws=help&article=${encodeURIComponent(s.slug)}`}
                                                style={{
                                                    fontSize: 12,
                                                    color: "var(--neo-creator-ink)",
                                                    textDecoration: "underline",
                                                }}
                                            >
                                                → {s.title}
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                        {busy && (
                            <div
                                style={{
                                    alignSelf: "flex-start",
                                    color: "var(--neo-ink-3)",
                                    fontSize: 13,
                                    padding: "8px 12px",
                                }}
                            >
                                <span className="live-dot" style={{ marginRight: 6 }}></span>typing…
                            </div>
                        )}
                    </div>

                    <div
                        style={{
                            padding: "10px 16px",
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 6,
                            borderTop: "1px solid var(--neo-rule)",
                        }}
                    >
                        {suggestions.map((s) => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => setInput(s)}
                                className="tag"
                                style={{ cursor: "pointer" }}
                            >
                                {s}
                            </button>
                        ))}
                    </div>

                    <div
                        style={{
                            padding: 12,
                            display: "flex",
                            gap: 8,
                            borderTop: "1px solid var(--neo-rule)",
                            background: "var(--neo-paper)",
                        }}
                    >
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") ask();
                            }}
                            placeholder="Type a question…"
                            style={{
                                flex: 1,
                                border: "1px solid var(--neo-rule)",
                                background: "var(--neo-paper-3)",
                                color: "var(--neo-ink)",
                                padding: "10px 14px",
                                borderRadius: "var(--neo-r-pill)",
                                fontFamily: "var(--neo-sans)",
                                fontSize: 14,
                                outline: "none",
                            }}
                        />
                        <button
                            type="button"
                            onClick={ask}
                            disabled={!input.trim() || busy}
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: "50%",
                                border: 0,
                                background: "var(--neo-ink)",
                                color: "var(--neo-paper)",
                                cursor: "pointer",
                                fontSize: 16,
                                opacity: !input.trim() || busy ? 0.4 : 1,
                            }}
                            aria-label="Send"
                        >
                            ↑
                        </button>
                    </div>
                </div>
            )}

            <button
                type="button"
                className="chatbot-fab"
                onClick={() => setOpen((o) => !o)}
                aria-label={open ? "Close chat" : "Open chat"}
            >
                {open ? (
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                        <path d="M5 5 L17 17 M17 5 L5 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path
                            d="M4 6 C4 4.9 4.9 4 6 4 H18 C19.1 4 20 4.9 20 6 V14 C20 15.1 19.1 16 18 16 H10 L6 20 V16 H6 C4.9 16 4 15.1 4 14 V6 Z"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinejoin="round"
                        />
                        <circle cx="9" cy="10" r="1" fill="currentColor" />
                        <circle cx="12" cy="10" r="1" fill="currentColor" />
                        <circle cx="15" cy="10" r="1" fill="currentColor" />
                    </svg>
                )}
            </button>
        </>
    );
}
