"use client";

import { useMutation } from "convex/react";
import { ArrowLeft, ArrowRight, BookOpen, Check, RotateCw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";

import { FootActions, StepBody, StepCard } from "@/app/training/_funnel/FunnelFrame";
import { LETTERS, PASS_MARK, QUIZ } from "@/app/training/_funnel/content";
import { Button, ButtonLink, Icon, Status, cx } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Stage 3, the certification quiz (board Certification). The same five
 * questions, answers and pass mark (4 of 5) as before, one at a time: pick,
 * check, see the right answer, go on. A pass writes quizPassedAt; a fail
 * offers another try at once (no limit, as before) or the lessons.
 *
 * The certificate is no longer shown here. Passing is not approval: it is
 * shown when the Tendso team approves (the end of /pending) and on Account.
 */
export function QuizStep({ creatorId }: { creatorId?: Id<"creators"> }) {
    const router = useRouter();
    // Passing the quiz now marks the creator as quiz-passed (awaiting admin
    // approval), matching mobile — NOT auto-certified. Admin approves in
    // /admin/pending-approvals, which sets certifiedAt and releases the gate.
    const markQuizPassed = useMutation(api.creators.markQuizPassed);

    const [qi, setQi] = useState(0);
    const [sel, setSel] = useState<number | null>(null);
    const [checked, setChecked] = useState(false);
    const [answers, setAnswers] = useState<number[]>([]);
    const [phase, setPhase] = useState<"quiz" | "pass" | "fail">("quiz");
    const [certifying, setCertifying] = useState(false);

    const questionId = useId();
    const questionRef = useRef<HTMLParagraphElement>(null);
    const resultRef = useRef<HTMLDivElement>(null);

    const q = QUIZ[qi];
    const last = qi === QUIZ.length - 1;
    const score = answers.filter((a, i) => a === QUIZ[i].correct).length;

    // Move focus to what just changed, after React has drawn it.
    const focusSoon = (el: { current: HTMLElement | null }) => requestAnimationFrame(() => el.current?.focus());

    const pick = (i: number) => {
        if (!checked) setSel(i);
    };

    const check = () => {
        if (sel !== null) setChecked(true);
    };

    const next = async () => {
        if (sel === null || certifying) return;
        const newAnswers = [...answers, sel];
        setAnswers(newAnswers);

        if (!last) {
            setQi(qi + 1);
            setSel(null);
            setChecked(false);
            focusSoon(questionRef);
            return;
        }

        const finalScore = newAnswers.filter((a, i) => a === QUIZ[i].correct).length;
        if (finalScore >= PASS_MARK) {
            setCertifying(true);
            try {
                if (creatorId) await markQuizPassed({ id: creatorId });
            } catch (e) {
                console.error("Marking quiz passed failed:", e);
            }
            setCertifying(false);
            setPhase("pass");
        } else {
            setPhase("fail");
        }
        focusSoon(resultRef);
    };

    const retry = () => {
        setQi(0);
        setSel(null);
        setChecked(false);
        setAnswers([]);
        setPhase("quiz");
        focusSoon(questionRef);
    };

    const reviewMissed = () => {
        const missed = QUIZ.findIndex((qq, i) => answers[i] !== qq.correct);
        router.push(missed >= 0 ? `/training-lessons?lesson=${missed + 1}` : "/training-lessons");
    };

    const intro = `${QUIZ.length} questions from the lessons. Get ${PASS_MARK} right to pass. You can try again as often as you need.`;

    // ── Result ──────────────────────────────────────────────────────────────
    if (phase !== "quiz") {
        const passed = phase === "pass";
        const missed = QUIZ.filter((qq, i) => answers[i] !== qq.correct).map((qq) => qq.category);
        return (
            <StepCard
                title="Certification quiz"
                intro={intro}
                foot={
                    passed ? (
                        <>
                            <span className="t-meta">Nothing else to do after this.</span>
                            <FootActions>
                                <ButtonLink variant="primary" href="/pending">
                                    Continue
                                    <Icon icon={ArrowRight} />
                                </ButtonLink>
                            </FootActions>
                        </>
                    ) : (
                        <>
                            <span className="t-meta">{missed.length > 0 ? `Missed: ${missed.join(", ")}.` : ""}</span>
                            <FootActions>
                                <Button onClick={retry}>
                                    <Icon icon={RotateCw} />
                                    Try again
                                </Button>
                                <Button variant="primary" onClick={reviewMissed}>
                                    <Icon icon={BookOpen} />
                                    Review the lessons
                                </Button>
                            </FootActions>
                        </>
                    )
                }
            >
                <StepBody>
                    <div ref={resultRef} tabIndex={-1} className="flex items-center gap-4">
                        <span className="t-figure">
                            {score}/{QUIZ.length}
                        </span>
                        <div className="flex flex-col gap-1">
                            {passed ? (
                                <>
                                    <Status tone="done" word="Passed" />
                                    <p className="t-body">
                                        The pass mark is {PASS_MARK} of {QUIZ.length}. Your application now goes to the Tendso team for approval.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <Status tone="bad" word="Not passed" />
                                    <p className="t-body">
                                        You need {PASS_MARK} of {QUIZ.length} to pass. Review the lessons you missed, then try again. There is no limit on
                                        attempts.
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="t-list overflow-hidden rounded-r1-card border border-r1-line">
                        {QUIZ.map((qq, i) => {
                            const ok = answers[i] === qq.correct;
                            return (
                                <div key={qq.question} className="t-row">
                                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                        <span className="t-label">{qq.category}</span>
                                        <span className="t-body">{qq.question}</span>
                                    </div>
                                    <Status tone={ok ? "done" : "bad"} word={ok ? "Right" : "Missed"} />
                                </div>
                            );
                        })}
                    </div>
                </StepBody>
            </StepCard>
        );
    }

    // ── Answering ───────────────────────────────────────────────────────────
    return (
        <StepCard
            title="Certification quiz"
            intro={intro}
            foot={
                <>
                    <ButtonLink variant="ghost" href="/training-lessons" className="self-start">
                        <Icon icon={ArrowLeft} />
                        Back to lessons
                    </ButtonLink>
                    <FootActions>
                        {!checked && sel === null && <span className="t-meta">Pick one answer</span>}
                        {/* One button that changes job, so focus stays on it from "Check answer" to "Next". */}
                        <Button
                            variant="primary"
                            onClick={checked ? next : check}
                            disabled={(!checked && sel === null) || certifying}
                            aria-busy={certifying}
                        >
                            {!checked ? (
                                "Check answer"
                            ) : certifying ? (
                                "Saving…"
                            ) : (
                                <>
                                    {last ? "See result" : "Next question"}
                                    <Icon icon={ArrowRight} />
                                </>
                            )}
                        </Button>
                    </FootActions>
                </>
            }
        >
            <StepBody>
                <div className="flex flex-col gap-2.5">
                    <div className="flex justify-between gap-4">
                        <span className="t-label t-num">
                            Question {qi + 1} of {QUIZ.length}
                        </span>
                        <span className="t-label text-right">
                            From lesson {qi + 1}: {q.category}
                        </span>
                    </div>
                    <div className="flex gap-1" aria-hidden="true">
                        {QUIZ.map((qq, i) => (
                            <span
                                key={qq.question}
                                className={cx(
                                    "h-1 flex-1 rounded-full",
                                    i < qi || (i === qi && checked) ? "bg-r1-ink" : i === qi ? "bg-r1-ink-4" : "bg-r1-line",
                                )}
                            />
                        ))}
                    </div>
                </div>

                <p ref={questionRef} tabIndex={-1} id={questionId} className="text-xl font-semibold leading-7 tracking-[-0.01em] text-r1-ink">
                    {q.question}
                </p>

                {/* A radio group drawn as the board's option cards (the kit's "Radio
                    cards"): the whole card is the target and arrow keys move between
                    answers. Once checked, the answers lock. */}
                <div role="radiogroup" aria-labelledby={questionId} className="flex flex-col gap-2">
                    {q.options.map((option, i) => {
                        const state = !checked ? (sel === i ? "picked" : "idle") : i === q.correct ? "right" : i === sel ? "wrong" : "idle";
                        const inked = state === "picked" || state === "right";
                        return (
                            <label
                                key={option}
                                className={cx(
                                    // relative: keeps the visually hidden radio inside its card, so focusing it never scrolls the page.
                                    "relative flex min-h-14 w-full items-center gap-3 rounded-r1 border bg-r1-paper px-4 py-3 text-left text-sm leading-5 text-r1-ink",
                                    "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-r1-gold",
                                    checked ? "cursor-default" : "cursor-pointer hover:bg-r1-fill-row",
                                    inked
                                        ? "border-r1-ink shadow-[inset_0_0_0_1px_var(--r1-ink)]"
                                        : state === "wrong"
                                          ? "border-r1-red shadow-[inset_0_0_0_1px_var(--r1-red)]"
                                          : "border-r1-line-2",
                                )}
                            >
                                <input
                                    type="radio"
                                    name={`question-${qi}`}
                                    value={i}
                                    checked={sel === i}
                                    disabled={checked && sel !== i}
                                    aria-disabled={checked || undefined}
                                    onChange={() => pick(i)}
                                    className="sr-only"
                                />
                                <span
                                    className={cx(
                                        "inline-flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-semibold",
                                        inked ? "bg-r1-ink text-r1-paper" : state === "wrong" ? "bg-r1-red-bg text-r1-red" : "bg-r1-fill text-r1-ink-2",
                                    )}
                                >
                                    {LETTERS[i]}
                                </span>
                                <span className="min-w-0 flex-1">{option}</span>
                                {/* On a phone the icon carries the note (the words stay for screen
                                    readers) and the line under the options says it in full. */}
                                {state === "right" && (
                                    <span className="flex flex-none items-center gap-1.5 text-[13px] leading-[18px] text-r1-ink">
                                        <Icon icon={Check} />
                                        <span className="max-sm:sr-only">Correct answer</span>
                                    </span>
                                )}
                                {state === "wrong" && (
                                    <span className="flex flex-none items-center gap-1.5 text-[13px] leading-[18px] text-r1-red">
                                        <Icon icon={X} />
                                        <span className="max-sm:sr-only">Your answer</span>
                                    </span>
                                )}
                            </label>
                        );
                    })}
                </div>

                <div role="status">
                    {checked &&
                        (sel === q.correct ? (
                            <Status tone="done" word="Correct." />
                        ) : (
                            <Status tone="bad" className="whitespace-normal">
                                Not quite. The answer is {LETTERS[q.correct]}, “{q.options[q.correct]}.”
                            </Status>
                        ))}
                </div>
            </StepBody>
        </StepCard>
    );
}
