"use client";

import { ArrowLeft, ArrowRight, Check, ChevronRight, Clock3, LockKeyhole, RotateCcw, X } from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/v2/Button";

import { QUIZ } from "./content";
import { lessonIndexFromQuery, nextIncompleteLesson, TRAINING_LESSONS, TRAINING_OVERVIEW_PHOTO, type TrainingPhoto, type TrainingPoint } from "./trainingContent";
import styles from "./training.module.css";
import { useLessonProgress } from "./useLessonProgress";

function Photo({ photo, overview = false }: { photo: TrainingPhoto; overview?: boolean }) {
    return <figure className={overview ? styles.overviewPhoto : styles.photo}>
        <Image src={photo.src} alt={photo.alt} fill sizes={overview ? "(max-width: 760px) 100vw, 600px" : "(max-width: 760px) 100vw, 550px"} style={{ objectFit: "cover", objectPosition: photo.position ?? "50% 50%" }} />
        {photo.label ? <figcaption>{photo.label}</figcaption> : null}
    </figure>;
}

function Points({ points, avoid = false }: { points: TrainingPoint[]; avoid?: boolean }) {
    if (!points.length) return null;
    return <section className={styles.points}>
        <h3>{avoid ? "Don’t" : "Do"}</h3>
        <ul>{points.map(point => <li key={point.title}>
            <span className={`${styles.pointIcon} ${avoid ? styles.avoidIcon : ""}`} aria-hidden="true">{avoid ? <X size={15} /> : <Check size={16} />}</span>
            <div><strong>{point.title}</strong><p>{point.text}</p></div>
        </li>)}</ul>
    </section>;
}

/** Finishing one lesson preserves the existing per-user, device-local progress. */
export function LearnStep({ userId }: { userId: string }) {
    const searchParams = useSearchParams();
    const { done, setDone } = useLessonProgress(userId, TRAINING_LESSONS.length);
    const [open, setOpen] = useState(() => lessonIndexFromQuery(searchParams.get("lesson")));
    const heading = useRef<HTMLHeadingElement>(null);
    const hasNavigated = useRef(false);
    const baseId = useId();
    const doneCount = done.filter(Boolean).length;
    const left = TRAINING_LESSONS.length - doneCount;
    const allDone = left === 0;
    const firstIncomplete = done.findIndex(value => !value);
    const lesson = TRAINING_LESSONS[open];

    useEffect(() => {
        if (hasNavigated.current) heading.current?.focus({ preventScroll: true });
    }, [open]);

    function openLesson(index: number) {
        hasNavigated.current = true;
        setOpen(index);
    }
    function completeLesson(index: number) {
        setDone(index, true);
        openLesson(nextIncompleteLesson(done, index));
    }

    return <div className={`${styles.layout} ${lesson ? styles.focused : ""}`}>
        <aside className={styles.sidebar} aria-label="Your lessons">
            <section className={styles.progressCard}>
                <div className={styles.progressHeading}><span>Your training</span><strong>{doneCount} <span>/ {TRAINING_LESSONS.length}</span></strong></div>
                <div className={styles.progressTrack} role="progressbar" aria-label="Lessons completed" aria-valuemin={0} aria-valuemax={TRAINING_LESSONS.length} aria-valuenow={doneCount} aria-valuetext={`${doneCount} of ${TRAINING_LESSONS.length} lessons completed`}><span style={{ width: `${doneCount / TRAINING_LESSONS.length * 100}%` }} /></div>
                <p>{allDone ? "Ready for the quiz." : "Go at your own pace. Your progress is saved on this device."}</p>
            </section>
            <nav className={styles.lessons} aria-label="Training lessons">
                {TRAINING_LESSONS.map((item, index) => <button type="button" key={item.id} className={`${styles.lessonLink} ${open === index ? styles.active : ""}`} aria-current={open === index ? "step" : undefined} aria-label={`Lesson ${item.id}: ${item.title}, ${done[index] ? "completed" : "not completed"}`} onClick={() => openLesson(index)}>
                    <span className={`${styles.lessonNumber} ${done[index] ? styles.lessonDone : ""}`} aria-hidden="true">{done[index] ? <Check size={17} /> : String(item.id).padStart(2, "0")}</span>
                    <span className={styles.lessonName}><strong>{item.title}</strong><small>{item.minutes} min{done[index] ? " · Completed" : ""}</small></span><ChevronRight size={17} aria-hidden="true" />
                </button>)}
            </nav>
            <section className={styles.quizGate} aria-label="Certification quiz">
                <div><span className={styles.quizIcon} aria-hidden="true">{allDone ? <Check size={18} /> : <LockKeyhole size={18} />}</span><strong>The certification quiz</strong></div>
                <p>{QUIZ.length} questions. Get 4 right to pass.</p>
                {allDone ? <Button href="/certification-quiz" block>Take the quiz <ArrowRight size={17} aria-hidden="true" /></Button> : <Button block disabled aria-describedby={`${baseId}-unlock`}>Take the quiz <LockKeyhole size={16} aria-hidden="true" /></Button>}
                {!allDone ? <small id={`${baseId}-unlock`}>Finish {left} more {left === 1 ? "lesson" : "lessons"} to unlock.</small> : null}
            </section>
        </aside>
        <div className={styles.main}>
            {lesson ? <article className={styles.lessonCard} aria-labelledby={`${baseId}-lesson-heading`}>
                <div className={styles.lessonTop}><button type="button" onClick={() => openLesson(-1)}><ArrowLeft size={16} aria-hidden="true" /> All lessons</button><span>{String(lesson.id).padStart(2, "0")} <span>/ 05</span></span></div>
                <div className={lesson.photos.length > 1 ? styles.examples : styles.singlePhoto}>{lesson.photos.map(photo => <Photo key={photo.src} photo={photo} />)}</div>
                <header className={styles.lessonHeader}><p className={styles.lessonMeta}><Clock3 size={14} aria-hidden="true" /> Lesson {lesson.id} of 5 · {lesson.minutes} min{done[open] ? <span><Check size={14} aria-hidden="true" /> Completed</span> : null}</p><h2 id={`${baseId}-lesson-heading`} tabIndex={-1} ref={heading}>{lesson.title}</h2><p className={styles.summary}>{lesson.summary}</p></header>
                <Points points={lesson.dos} /><Points points={lesson.donts} avoid />
                <footer className={styles.lessonFooter}>{done[open] ? <><button className={styles.undo} type="button" onClick={() => setDone(open, false)}><RotateCcw size={15} aria-hidden="true" /> Mark as not done</button><Button onClick={() => openLesson(allDone ? -1 : firstIncomplete)}>{allDone ? "Back to overview" : "Continue training"}<ArrowRight size={17} aria-hidden="true" /></Button></> : <><span>Read it? Put it into practice on your next visit.</span><Button onClick={() => completeLesson(open)}>{left === 1 ? "Finish lesson" : "Got it · next lesson"}<Check size={17} aria-hidden="true" /></Button></>}</footer>
            </article> : <section className={styles.overview} aria-labelledby={`${baseId}-overview-heading`}>
                <Photo photo={TRAINING_OVERVIEW_PHOTO} overview />
                <div className={styles.overviewBody}><p className={styles.eyebrow}>About 15 minutes · Five lessons</p><h2 id={`${baseId}-overview-heading`} tabIndex={-1} ref={heading}>{allDone ? "Five lessons down. Your quiz is next." : "A little practice. A better first visit."}</h2><p>{allDone ? "You’ve covered the essentials. Take the five-question quiz to continue your field agent setup." : "Learn to capture clear photos and the owner’s story. These small details help us build a website they’ll be proud to share."}</p>{allDone ? <Button href="/certification-quiz">Take the quiz<ArrowRight size={18} aria-hidden="true" /></Button> : <Button onClick={() => openLesson(firstIncomplete)}>{doneCount ? "Continue training" : "Start learning"}<ArrowRight size={18} aria-hidden="true" /></Button>}<small>{allDone ? "Get four correct answers to pass. You can try again if needed." : "Read a lesson, mark it done, and come back whenever you need a refresher."}</small></div>
            </section>}
        </div>
    </div>;
}
