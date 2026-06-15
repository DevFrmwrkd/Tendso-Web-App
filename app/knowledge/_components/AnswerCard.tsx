"use client";

import { useEffect, useMemo, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Icon, Enso } from "./Icon";
import type { Article, Workspace } from "./types";

/**
 * Grounded "Tendso AI" answer. Calls the Convex Gemini RAG action and keeps the
 * design's thinking → type-out → sources animation. Sources link back to the
 * matching article (resolved from the loaded set by slug).
 */
export function AnswerCard({
    query,
    workspace,
    articles,
    onOpen,
    compact,
}: {
    query: string;
    workspace: Workspace;
    articles: Article[];
    onOpen: (a: Article) => void;
    compact?: boolean;
}) {
    const ask = useAction(api.knowledgeAI.ask);
    const [phase, setPhase] = useState<"thinking" | "typing" | "done" | "error">("thinking");
    const [answer, setAnswer] = useState("");
    const [sources, setSources] = useState<{ slug: string; title: string }[]>([]);
    const [shown, setShown] = useState(0);
    const [errMsg, setErrMsg] = useState("");

    const bySlug = useMemo(() => new Map(articles.map((a) => [a.slug, a])), [articles]);

    // Fetch the grounded answer whenever the question / workspace changes.
    useEffect(() => {
        let cancelled = false;
        setPhase("thinking");
        setShown(0);
        setAnswer("");
        setSources([]);
        setErrMsg("");
        ask({ query, workspace, source: "web" })
            .then((res) => {
                if (cancelled) return;
                setAnswer(res.answer || "");
                setSources(res.sources || []);
                setPhase("typing");
            })
            .catch((e: unknown) => {
                if (cancelled) return;
                setErrMsg(e instanceof Error ? e.message : "Something went wrong.");
                setPhase("error");
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, workspace]);

    // Type out the answer.
    useEffect(() => {
        if (phase !== "typing") return;
        if (shown >= answer.length) {
            setPhase("done");
            return;
        }
        const step = Math.max(2, Math.round(answer.length / 80));
        const id = setTimeout(() => setShown((s) => Math.min(answer.length, s + step)), 16);
        return () => clearTimeout(id);
    }, [phase, shown, answer]);

    const visible = answer.slice(0, phase === "done" ? answer.length : shown);
    const paras = visible.split("\n\n");

    return (
        <div className={"ai-card" + (compact ? " in-cmd" : "")}>
            <div className="ai-head">
                <span className="badge">
                    <span className="em">
                        <Enso size={18} color="var(--accent)" />
                    </span>{" "}
                    Tendso AI
                </span>
                {!compact && <span className="q">{query}</span>}
            </div>
            <div className="ai-body">
                {phase === "thinking" ? (
                    <div className="ai-thinking">
                        <span className="dots">
                            <i></i>
                            <i></i>
                            <i></i>
                        </span>
                        Searching {workspace === "help" ? "the Help Center" : "the wiki"}…
                    </div>
                ) : phase === "error" ? (
                    <div className="ai-answer">
                        <p>I couldn&apos;t generate an answer right now. {errMsg}</p>
                    </div>
                ) : (
                    <div className="ai-answer">
                        {paras.map((p, i) => (
                            <p key={i}>
                                {p}
                                {phase === "typing" && i === paras.length - 1 && <span className="ai-cursor" />}
                            </p>
                        ))}
                    </div>
                )}

                {phase === "done" && sources.length > 0 && (
                    <div className="ai-sources" style={{ animation: "tkb-viewIn .3s" }}>
                        <div className="sl">Sources</div>
                        <div className="src-row">
                            {sources.map((s, i) => {
                                const article = bySlug.get(s.slug);
                                return (
                                    <button
                                        key={s.slug}
                                        className="src"
                                        onClick={() => article && onOpen(article)}
                                        disabled={!article}
                                    >
                                        <span className="n">{i + 1}</span>
                                        <span className="st">{s.title}</span>
                                        <span className="sx">
                                            <Icon name="arrowUR" size={13} />
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="ai-disc">
                            <Icon name="bolt" size={13} /> Generated from Tendso&apos;s published content. Always verify against the source.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
