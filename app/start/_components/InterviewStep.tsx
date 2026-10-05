"use client";

import { Textarea, cx } from "@/components/r1";
import { INTAKE_QUESTIONS, meetsAnswerMinimum, type IntakeQuestion, type IntakeQuestionKey } from "@/lib/narrativeFromQa";

import VoiceAnswer from "../VoiceAnswer";
import { STEP_TITLE_ID, StepHeader } from "./frame";

type Answers = Partial<Record<IntakeQuestionKey, string>>;

/** The id of a question's box. page.tsx sends the owner to it by this id. */
export function answerFieldId(key: IntakeQuestionKey): string {
    return `answer-${key}`;
}

/**
 * The line under a box: how far it is from clearing its floor, or that it may
 * be left blank. The ~2-sentence floor on the two load-bearing answers is the
 * entire quality mechanism on this funnel — everything the site says about the
 * business is written from them. The mutation re-checks with the same function.
 */
function counterFor(question: IntakeQuestion, value: string): string | null {
    const ok = meetsAnswerMinimum(question, value);
    const length = value.trim().length;
    if (!ok && question.minChars) {
        return `A couple of sentences, please — ${length} of about ${question.minChars} characters so far.`;
    }
    // Otherwise the way forward is simply held, with nothing on screen saying why.
    if (!ok) return "One line is enough — we just can't leave this one blank.";
    if (question.optional && length === 0) return "Optional — skip it if you'd rather.";
    return null;
}

/**
 * Step 2: the interview (Round 1, board Start, "A few questions").
 *
 * One question per screen on a phone, all eight at once on a desk. The ONLY
 * place the two layouts diverge structurally, and the reason useIsDesktop
 * exists at all: eight textareas rendered twice would be eight duplicate ids
 * bound to the same draft keys.
 *
 * Both paths write the same `answers` keys through the same handlers, and both
 * gate on meetsAnswerMinimum — the phone on the question in hand, the desk on
 * all eight. Neither can let through an intake submitOwnerIntake would reject.
 */
export function InterviewStep({
    isDesktop,
    answers,
    questionIndex,
    flagShort,
    onAnswerChange,
    onAppend,
    submitting,
    voiceBusyKey,
    onVoiceBusy,
}: {
    isDesktop: boolean;
    answers: Answers;
    questionIndex: number;
    /** The owner pressed Continue on the desk with answers still short: mark them. */
    flagShort: boolean;
    onAnswerChange: (key: IntakeQuestionKey, value: string) => void;
    /** Merge a spoken answer into the box (appended, never substituted). */
    onAppend: (key: IntakeQuestionKey, text: string) => void;
    submitting: boolean;
    /** The answer currently using the microphone, if any. */
    voiceBusyKey: IntakeQuestionKey | null;
    onVoiceBusy: (key: IntakeQuestionKey, busy: boolean) => void;
}) {
    if (isDesktop) {
        return (
            <>
                <StepHeader
                    title="Now tell us about the place."
                    sub={
                        <>
                            Answer in your own words — Taglish is fine. Type it, or press &ldquo;Speak your answer&rdquo; and talk.
                            Nobody sees this except us; we turn it into the words on your site.
                        </>
                    }
                />

                <div className="grid grid-cols-1 items-start gap-8 xl:grid-cols-2">
                    {INTAKE_QUESTIONS.map((entry, index) => {
                        const value = answers[entry.key] ?? "";
                        const id = answerFieldId(entry.key);
                        const counter = counterFor(entry, value);
                        const flagged = flagShort && !meetsAnswerMinimum(entry, value);
                        return (
                            <div key={entry.key} className="flex min-w-0 flex-col gap-2">
                                <label htmlFor={id} className="flex gap-2.5 text-[15px] font-semibold leading-[22px] text-r1-ink">
                                    <span aria-hidden="true" className="w-5 flex-none font-medium tabular-nums text-r1-ink-3">
                                        {index + 1}
                                    </span>
                                    <span>{entry.q}</span>
                                </label>
                                <div className="flex flex-col gap-2 pl-[30px]">
                                    <p id={`${id}-hint`} className="t-meta">
                                        {entry.hint}
                                    </p>
                                    <Textarea
                                        id={id}
                                        rows={3}
                                        placeholder="Type it the way you'd say it out loud."
                                        aria-invalid={flagged || undefined}
                                        aria-describedby={cx(`${id}-hint`, counter && `${id}-count`)}
                                        value={value}
                                        onChange={(event) => onAnswerChange(entry.key, event.target.value)}
                                    />
                                    <VoiceAnswer
                                        onText={(text) => onAppend(entry.key, text)}
                                        disabled={submitting}
                                        blocked={voiceBusyKey !== null && voiceBusyKey !== entry.key}
                                        onBusyChange={(busy) => onVoiceBusy(entry.key, busy)}
                                        current={value}
                                    />
                                    {/* The same sentences the phone shows, per box — a
                                        counter has to sit beside the field it is
                                        counting when eight of them are on screen. */}
                                    {counter ? (
                                        <p id={`${id}-count`} className={flagged ? "t-error" : "t-help"}>
                                            {counter}
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </>
        );
    }

    // loadDraft already clamps questionIndex, but the value it clamps came out of
    // localStorage — belt and braces, because every read below assumes a question
    // and a miss here is a white screen the owner cannot refresh their way out of.
    const question = INTAKE_QUESTIONS[questionIndex] ?? INTAKE_QUESTIONS[0];
    const answer = answers[question.key] ?? "";
    const counter = counterFor(question, answer);
    const id = answerFieldId(question.key);

    return (
        <>
            <StepHeader
                eyebrow={`Question ${questionIndex + 1} of ${INTAKE_QUESTIONS.length}`}
                title={question.q}
                sub={<span id={`${id}-hint`}>{question.hint}</span>}
            />

            <div className="flex flex-col gap-2">
                <Textarea
                    id={id}
                    rows={5}
                    className="min-h-[152px]"
                    placeholder="Type it the way you'd say it out loud."
                    aria-labelledby={STEP_TITLE_ID}
                    aria-describedby={cx(`${id}-hint`, counter && `${id}-count`)}
                    value={answer}
                    onChange={(event) => onAnswerChange(question.key, event.target.value)}
                />
                {/* Keyed by question so a recording in hand ends when the owner
                    moves on (its words still land in the answer it was recorded
                    for) and the next question starts with a clean slate. */}
                <VoiceAnswer
                    key={question.key}
                    onText={(text) => onAppend(question.key, text)}
                    disabled={submitting}
                    blocked={voiceBusyKey !== null && voiceBusyKey !== question.key}
                    onBusyChange={(busy) => onVoiceBusy(question.key, busy)}
                    current={answer}
                />
                {counter ? (
                    <p id={`${id}-count`} className="t-help">
                        {counter}
                    </p>
                ) : null}
            </div>

            <p className="t-note">
                Taglish is fine. Type it, or tap &ldquo;Speak your answer&rdquo; and talk. Nobody sees this except us — we turn
                your answers into the words on your site.
            </p>
        </>
    );
}
