"use client";

import { useMutation } from "convex/react";
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCheck, CircleAlert, LoaderCircle, RotateCw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";

import { LETTERS, PASS_MARK, QUIZ } from "@/app/training/_funnel/content";
import { Button } from "@/components/v2/Button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import styles from "./Quiz.module.css";

/** Passing saves quiz progress; certification is granted separately by the team. */
export function QuizStep({ creatorId }: { creatorId?: Id<"creators"> }) {
    const router = useRouter();
    const markQuizPassed = useMutation(api.creators.markQuizPassed);
    const [qi, setQi] = useState(0);
    const [sel, setSel] = useState<number | null>(null);
    const [checked, setChecked] = useState(false);
    const [answers, setAnswers] = useState<number[]>([]);
    const [phase, setPhase] = useState<"quiz" | "pass" | "fail">("quiz");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [saveError, setSaveError] = useState("");
    const savingRef = useRef(false);
    const questionId = useId();
    const questionRef = useRef<HTMLHeadingElement>(null);
    const resultRef = useRef<HTMLHeadingElement>(null);
    const q = QUIZ[qi];
    const last = qi === QUIZ.length - 1;
    const score = answers.filter((answer, index) => answer === QUIZ[index]?.correct).length;

    const focusSoon = (ref: { current: HTMLElement | null }) => requestAnimationFrame(() => ref.current?.focus());

    async function savePass() {
        if (savingRef.current || saved) return;
        if (!creatorId) {
            setSaveError("Sign in again before submitting your quiz result.");
            return;
        }
        savingRef.current = true;
        setSaving(true);
        setSaveError("");
        try {
            await markQuizPassed({ id: creatorId });
            setSaved(true);
        } catch {
            setSaveError("We couldn’t save your result. Check your connection and try again. Your answers are still here.");
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    }

    async function next() {
        if (sel === null || !checked || savingRef.current) return;
        const nextAnswers = [...answers, sel];
        setAnswers(nextAnswers);
        if (!last) {
            setQi(qi + 1);
            setSel(null);
            setChecked(false);
            focusSoon(questionRef);
            return;
        }
        const passed = nextAnswers.filter((answer, index) => answer === QUIZ[index].correct).length >= PASS_MARK;
        setPhase(passed ? "pass" : "fail");
        focusSoon(resultRef);
        if (passed) await savePass();
    }

    function retry() {
        setQi(0);
        setSel(null);
        setChecked(false);
        setAnswers([]);
        setSaved(false);
        setSaveError("");
        setPhase("quiz");
        focusSoon(questionRef);
    }

    function reviewMissed() {
        const missed = QUIZ.findIndex((question, index) => answers[index] !== question.correct);
        router.push(missed >= 0 ? `/training-lessons?lesson=${missed + 1}` : "/training-lessons");
    }

    if (phase !== "quiz") {
        const passed = phase === "pass";
        return <section className={styles.results} aria-labelledby={questionId}>
            <div className={styles.resultHero}>
                <span className={`${styles.resultIcon} ${passed ? styles.passedIcon : ""}`} aria-hidden="true">{passed ? <Check size={36} strokeWidth={1.8} /> : <RotateCw size={32} strokeWidth={1.8} />}</span>
                <p className={styles.eyebrow}>{passed ? "Quiz passed" : "Keep going"}</p>
                <h2 id={questionId} ref={resultRef} tabIndex={-1} className={styles.resultTitle}>{passed ? "You passed the quiz." : "Let’s try that again."}</h2>
                <p className={styles.score}>{score}<span> / {QUIZ.length}</span></p>
                <p className={styles.resultDescription}>{passed
                    ? "Nice work. The Tendso team checks your profile before you can start submitting shops."
                    : `You need ${PASS_MARK} correct answers to pass. Review the topics below, then give it another go. You can try again as often as you need.`}</p>
                {passed ? <div className={styles.saveStatus} aria-live="polite">
                    {saving ? <p><LoaderCircle className={styles.spinner} size={18} aria-hidden="true" />Saving your result…</p> : saved ? <p><CheckCheck size={18} aria-hidden="true" />Your quiz pass is saved.</p> : null}
                </div> : null}
            </div>

            {saveError ? <div className={styles.error} role="alert"><CircleAlert size={21} aria-hidden="true" /><p>{saveError}</p></div> : null}

            <div className={styles.resultList}>
                <div className={styles.listHeading}><h3>Your answers</h3><span>{score} correct · {QUIZ.length - score} to review</span></div>
                <ul>{QUIZ.map((question, index) => {
                    const correct = answers[index] === question.correct;
                    return <li key={question.question}>
                        <span className={`${styles.answerIcon} ${correct ? styles.answerCorrect : styles.answerMissed}`} aria-hidden="true">{correct ? <Check size={17} /> : <BookOpen size={17} />}</span>
                        <div className={styles.answerSummary}><strong>{question.category}</strong><p>{question.question}</p></div>
                        <span className={`${styles.resultLabel} ${correct ? styles.labelCorrect : styles.labelMissed}`}>{correct ? "Correct" : "Review"}</span>
                    </li>;
                })}</ul>
            </div>

            <div className={styles.resultActions}>
                {passed ? saved ? <Button href="/pending" size="lg">Continue to review <ArrowRight size={18} aria-hidden="true" /></Button>
                    : creatorId ? <Button size="lg" onClick={savePass} disabled={saving} aria-busy={saving}>{saving ? "Saving…" : "Retry saving result"}{!saving ? <RotateCw size={18} aria-hidden="true" /> : null}</Button>
                        : <Button href="/login" size="lg">Sign in again <ArrowRight size={18} aria-hidden="true" /></Button>
                    : <><Button size="lg" onClick={retry}>Try again <RotateCw size={18} aria-hidden="true" /></Button><Button variant="ghost" size="lg" onClick={reviewMissed}><BookOpen size={18} aria-hidden="true" />Review the lessons</Button></>}
                {passed && saved ? <p>Approval is the next step. Your certificate appears after the team approves your profile.</p> : null}
            </div>
        </section>;
    }

    return <section className={styles.quiz} aria-labelledby={questionId}>
        <div className={styles.progressHeader}><p>Question {qi + 1} <span>of {QUIZ.length}</span></p><span className={styles.topic}>{q.category}</span></div>
        <div className={styles.progress} role="progressbar" aria-label="Quiz progress" aria-valuemin={0} aria-valuemax={QUIZ.length} aria-valuenow={qi + 1} aria-valuetext={`Question ${qi + 1} of ${QUIZ.length}`}>
            {QUIZ.map((question, index) => <span key={question.question} data-state={index < qi ? "done" : index === qi ? "current" : "next"} />)}
        </div>
        <div className={styles.questionStage}>
            <p className={styles.eyebrow}>From lesson {qi + 1}</p>
            <h2 id={questionId} ref={questionRef} tabIndex={-1} className={styles.question}>{q.question}</h2>
            <div role="radiogroup" aria-labelledby={questionId} className={styles.options}>
                {q.options.map((option, index) => {
                    const state = !checked ? sel === index ? "picked" : "idle" : index === q.correct ? "right" : index === sel ? "wrong" : "idle";
                    return <label key={option} className={styles.option} data-state={state} data-locked={checked || undefined}>
                        <input type="radio" name={`question-${qi}`} value={index} checked={sel === index} disabled={checked}
                            onChange={() => { if (!checked) setSel(index); }} className={styles.radio} />
                        <span className={styles.letter} aria-hidden="true">{LETTERS[index]}</span>
                        <span className={styles.optionText}>{option}</span>
                        {state === "right" ? <span className={styles.optionNote}><Check size={20} aria-hidden="true" /><span className={styles.srOnly}>Correct answer</span></span> : state === "wrong" ? <span className={styles.optionNote}><X size={20} aria-hidden="true" /><span className={styles.srOnly}>Your answer</span></span> : null}
                    </label>;
                })}
            </div>
            <div className={styles.feedback} role="status" aria-live="polite">
                {checked ? sel === q.correct ? <p data-correct="true"><Check size={19} aria-hidden="true" />That’s right.</p>
                    : <p><CircleAlert size={19} aria-hidden="true" /><span>Not quite. The correct answer is {LETTERS[q.correct]}: {q.options[q.correct]}.</span></p>
                    : <p className={styles.chooseHint}>{sel === null ? "Choose one answer, then check it." : "Ready? Check your answer below."}</p>}
            </div>
        </div>
        <div className={styles.actions}>
            <Button variant="ghost" href="/training-lessons"><ArrowLeft size={17} aria-hidden="true" />Back to lessons</Button>
            <Button size="lg" onClick={checked ? next : () => { if (sel !== null) setChecked(true); }} disabled={sel === null || saving} aria-busy={saving}>
                {!checked ? "Check answer" : last ? "See result" : "Next question"}{checked ? <ArrowRight size={18} aria-hidden="true" /> : null}
            </Button>
        </div>
    </section>;
}
