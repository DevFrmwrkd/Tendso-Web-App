"use client";

import { ArrowRight, Check, ChevronDown, Lock } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useId, useState } from "react";

import { Button, ButtonLink, Icon, Status, cx } from "@/components/r1";

import { LESSONS, QUIZ } from "./content";
import { FootActions, Marker, NoteBlock, StepCard } from "./FunnelFrame";
import { useLessonProgress } from "./useLessonProgress";

/**
 * Stage 2, "Learn the basics" (board Certification). The old training hub
 * (/training: five topics and "Start Training") and the old lessons page
 * (/training-lessons: an accordion and "Start Certification Quiz") are one
 * card now: each lesson opens in place, is marked done, and the quiz button
 * unlocks when all five are.
 *
 * ?lesson=N opens lesson N: the quiz's "Review the lessons" uses it to open
 * the first lesson that was missed.
 */
export function LearnStep({ userId }: { userId: string }) {
    const searchParams = useSearchParams();
    const { done, setDone } = useLessonProgress(userId, LESSONS.length);
    const [open, setOpen] = useState(() => {
        const n = Number(searchParams.get("lesson"));
        return Number.isInteger(n) && n >= 1 && n <= LESSONS.length ? n - 1 : 0;
    });
    const baseId = useId();

    const doneCount = done.filter(Boolean).length;
    const left = LESSONS.length - doneCount;
    const allDone = left === 0;
    const lockId = `${baseId}-lock`;

    const markDone = (i: number) => {
        setDone(i, true);
        // On to the first lesson still not done, as the board does; none left closes them all.
        setOpen(done.findIndex((d, j) => j !== i && !d));
    };

    return (
        <StepCard
            title="Learn the basics"
            intro="Five short lessons on filming a shop owner. Open each one, read it, and mark it done."
            aside={<Status tone={allDone ? "done" : "attn"} word={`${doneCount} of ${LESSONS.length} done`} className="t-num" />}
            foot={
                allDone ? (
                    <>
                        <span className="t-meta">
                            All {LESSONS.length} lessons done. The quiz is {QUIZ.length} questions.
                        </span>
                        <FootActions>
                            <ButtonLink variant="primary" href="/certification-quiz">
                                Take the quiz
                                <Icon icon={ArrowRight} />
                            </ButtonLink>
                        </FootActions>
                    </>
                ) : (
                    <>
                        <span className="t-meta t-num" id={lockId}>
                            Mark all {LESSONS.length} lessons done to unlock the quiz. {left} {left === 1 ? "lesson" : "lessons"} to go.
                        </span>
                        <FootActions>
                            <Button variant="primary" disabled aria-describedby={lockId}>
                                <Icon icon={Lock} />
                                Take the quiz
                            </Button>
                        </FootActions>
                    </>
                )
            }
        >
            <div className="flex flex-col">
                {LESSONS.map((lesson, i) => {
                    const isOpen = open === i;
                    const isDone = done[i];
                    const bodyId = `${baseId}-lesson-${i}`;
                    return (
                        <div key={lesson.title} className="border-b border-r1-line-3 last:border-b-0">
                            <button
                                type="button"
                                aria-expanded={isOpen}
                                aria-controls={bodyId}
                                onClick={() => setOpen(isOpen ? -1 : i)}
                                className="flex min-h-16 w-full cursor-pointer items-center gap-3 bg-r1-paper px-4 py-3 text-left hover:bg-r1-fill-row sm:gap-4 sm:px-6"
                            >
                                <Marker n={i + 1} kind={isDone ? "done" : "todo"} />
                                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <span className="text-sm font-medium leading-5 text-r1-ink">{lesson.title}</span>
                                    <span className="t-meta">{lesson.desc}</span>
                                </span>
                                <Status tone={isDone ? "done" : "off"} word={isDone ? "Done" : "Not read"} />
                                <span className={cx("flex flex-none text-r1-ink-3 transition-transform duration-150", isOpen && "rotate-180")}>
                                    <Icon icon={ChevronDown} />
                                </span>
                            </button>
                            <div id={bodyId} hidden={!isOpen} className="flex flex-col gap-4 px-4 pb-6 sm:pl-16 sm:pr-6">
                                <ul className="t-body flex list-disc flex-col gap-2 pl-[18px]">
                                    {lesson.tips.map((tip) => (
                                        <li key={tip}>{tip}</li>
                                    ))}
                                </ul>
                                <NoteBlock label="Before you film">
                                    <p className="t-body">{lesson.action}</p>
                                </NoteBlock>
                                <div className="flex flex-wrap items-center gap-3">
                                    {isDone ? (
                                        <>
                                            <Status tone="done" word="Done" />
                                            <Button variant="ghost" size="sm" onClick={() => setDone(i, false)}>
                                                Mark as not done
                                            </Button>
                                        </>
                                    ) : (
                                        <Button onClick={() => markDone(i)}>
                                            <Icon icon={Check} />
                                            Mark as done
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </StepCard>
    );
}
