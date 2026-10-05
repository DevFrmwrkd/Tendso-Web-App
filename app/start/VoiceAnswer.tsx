"use client";

import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { Mic, Square } from "lucide-react";

import { Button, Dot, Icon } from "@/components/r1";
import { api } from "@/convex/_generated/api";

import { Spinner } from "./_components/frame";

/**
 * Answer a question by talking instead of typing.
 *
 * WHY IT IS HERE. These eight answers are the product: they become the words on
 * the owner's website. Typing three sentences on a phone keyboard, standing in a
 * shop, produces a short answer for reasons that have nothing to do with how
 * much the owner has to say. Holding the phone and talking produces the real one.
 *
 * IT ADDS, IT NEVER REPLACES. The transcript is appended to whatever is already
 * in the box, so a second recording extends the answer and nothing anyone typed
 * is ever thrown away by a tap.
 *
 * THE RECORDING IS NEVER KEPT. It goes straight to the transcription action in
 * the request itself and is dropped the moment the words come back. Nothing is
 * uploaded, so there is no file of somebody's voice sitting in a bucket waiting
 * for a reason to be deleted.
 *
 * ONE MICROPHONE, ONE RECORDING. On a desk all eight answers are on screen at
 * once, and two of these recording together would open the microphone twice and
 * transcribe the same speech into two boxes. So each one tells the page when it
 * starts and stops (`onBusyChange`), and the page marks the others `blocked`
 * until it is done (Round 1, board Start: "Finish the other recording first").
 */

/** Long enough for a full answer, short enough to stay inside the size ceiling
 *  the transcription action enforces. */
const MAX_SECONDS = 120;

type Phase = "idle" | "starting" | "recording" | "working";

/** 75 → "1:15", the way the board's Stop button counts. */
function clock(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return `${minutes}:${rest < 10 ? "0" : ""}${rest}`;
}

export default function VoiceAnswer({
    onText,
    disabled,
    blocked,
    onBusyChange,
    current,
}: {
    /** Called with the transcript. The caller decides how to merge it. */
    onText: (text: string) => void;
    disabled?: boolean;
    /** Another answer is recording or being written down right now. */
    blocked?: boolean;
    /** True when this answer takes the microphone, false when it lets it go. */
    onBusyChange?: (busy: boolean) => void;
    /** What is already in the box, so the note after a recording says truthfully
     *  whether the words went after the owner's own or on their own. */
    current?: string;
}) {
    const transcribe = useAction(api.intakeVoice.transcribeAnswer);

    const [phase, setPhase] = useState<Phase>("idle");
    const [seconds, setSeconds] = useState(0);
    const [error, setError] = useState<string | null>(null);
    /** What the last recording did to the box, for the note under it. Cleared
     *  when the next recording starts. */
    const [added, setAdded] = useState<"after" | "alone" | null>(null);

    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const mountedRef = useRef(true);
    const currentRef = useRef(current ?? "");
    useEffect(() => {
        currentRef.current = current ?? "";
    }, [current]);

    // A recorder left running because the step changed underneath it would hold
    // the microphone open with nothing on screen saying so. Stopping it here
    // still hands the words over: onstop runs, the transcript is appended to the
    // answer it was recorded for, and the busy flag is released when it lands.
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (tickRef.current) clearInterval(tickRef.current);
            const rec = recorderRef.current;
            if (rec && rec.state !== "inactive") {
                rec.stop();
                rec.stream.getTracks().forEach((t) => t.stop());
            }
        };
    }, []);

    // Stopping itself at the ceiling is what keeps a phone left in a pocket from
    // producing a file too big to transcribe.
    useEffect(() => {
        if (phase !== "recording" || seconds < MAX_SECONDS) return;
        const rec = recorderRef.current;
        if (rec && rec.state !== "inactive") rec.stop();
        if (tickRef.current) clearInterval(tickRef.current);
    }, [phase, seconds]);

    /** The blob as base64, without the data: prefix the reader adds. */
    function toBase64(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error("read failed"));
            reader.onload = () => {
                const result = String(reader.result ?? "");
                resolve(result.slice(result.indexOf(",") + 1));
            };
            reader.readAsDataURL(blob);
        });
    }

    async function handleStop(blob: Blob) {
        setPhase("working");
        try {
            const result = await transcribe({
                audioBase64: await toBase64(blob),
                mimeType: blob.type || "audio/webm",
            });
            if (!result.ok || !result.text) {
                setError(result.error ?? "That did not work. Please try again.");
            } else {
                const hadText = currentRef.current.trim().length > 0;
                onText(result.text);
                setAdded(hadText ? "after" : "alone");
            }
        } catch {
            setError("That did not work. Please try again.");
        } finally {
            setPhase("idle");
            setSeconds(0);
            onBusyChange?.(false);
        }
    }

    async function start() {
        if (phase !== "idle" || blocked || disabled) return;
        setError(null);
        setAdded(null);
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
            setError("This browser cannot record. Please type your answer.");
            return;
        }
        // Claimed before the permission prompt, not after it: the prompt can sit
        // open for a while, and a second answer must not ask for the microphone
        // while the first is still waiting for it.
        setPhase("starting");
        onBusyChange?.(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Granted after the owner had already moved on: let go of the
            // microphone at once rather than record into a box nobody can see.
            if (!mountedRef.current) {
                stream.getTracks().forEach((t) => t.stop());
                onBusyChange?.(false);
                return;
            }
            const rec = new MediaRecorder(stream);
            chunksRef.current = [];
            rec.ondataavailable = (event) => {
                if (event.data.size > 0) chunksRef.current.push(event.data);
            };
            rec.onstop = () => {
                stream.getTracks().forEach((t) => t.stop());
                if (tickRef.current) clearInterval(tickRef.current);
                const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
                if (blob.size > 0) void handleStop(blob);
                else {
                    setPhase("idle");
                    setSeconds(0);
                    onBusyChange?.(false);
                }
            };
            recorderRef.current = rec;
            rec.start();
            setPhase("recording");
            setSeconds(0);
            tickRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
        } catch {
            // Denied, dismissed, or no microphone. All the same to the owner.
            setError("We could not use the microphone. Please type your answer.");
            setPhase("idle");
            onBusyChange?.(false);
        }
    }

    function stop() {
        const rec = recorderRef.current;
        if (rec && rec.state !== "inactive") rec.stop();
        if (tickRef.current) clearInterval(tickRef.current);
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1.5">
                {phase === "recording" ? (
                    <>
                        <Button size="sm" onClick={stop} aria-label="Stop recording" className="border-r1-ink tabular-nums">
                            <Icon icon={Square} />
                            Stop · {clock(seconds)}
                        </Button>
                        <span className="t-status whitespace-normal" role="status">
                            <Dot tone="attn" className="motion-safe:animate-pulse" />
                            Listening. Talk like you would to a customer.
                        </span>
                    </>
                ) : phase === "working" ? (
                    <>
                        <Button size="sm" disabled>
                            <Spinner />
                            Writing it down…
                        </Button>
                        <span className="t-help">This takes a few seconds.</span>
                    </>
                ) : (
                    <>
                        <Button size="sm" onClick={start} disabled={disabled || blocked || phase === "starting"}>
                            <Icon icon={Mic} />
                            Speak your answer
                        </Button>
                        <span className="t-help">{blocked ? "Finish the other recording first." : "We write it down for you."}</span>
                    </>
                )}
            </div>

            {added && phase === "idle" && !blocked ? (
                <p className="t-help">
                    {added === "after"
                        ? "Added from your recording, after what you typed. Fix anything that's off."
                        : "Written down from your recording. Fix anything that's off."}
                </p>
            ) : null}

            {error ? (
                <p className="t-error" role="alert">
                    {error}
                </p>
            ) : null}
        </div>
    );
}
