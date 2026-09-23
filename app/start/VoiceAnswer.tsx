"use client";

import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { Mic, Square } from "lucide-react";

import { api } from "@/convex/_generated/api";

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
 * THE RECORDING IS ONLY A CARRIER. It goes to R2 exactly like the photos on the
 * next step, is transcribed, and is never stored on the submission — the text is
 * what we keep.
 */

/** Long enough for a full answer, short enough to stay inside the size ceiling
 *  the transcription action enforces. */
const MAX_SECONDS = 120;

type Phase = "idle" | "recording" | "working";

export default function VoiceAnswer({
    questionKey,
    onText,
    disabled,
}: {
    questionKey: string;
    /** Called with the transcript. The caller decides how to merge it. */
    onText: (text: string) => void;
    disabled?: boolean;
}) {
    const generateUploadUrl = useAction(api.r2.generateUploadUrl);
    const transcribe = useAction(api.intakeVoice.transcribeAnswer);

    const [phase, setPhase] = useState<Phase>("idle");
    const [seconds, setSeconds] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // A recorder left running because the step changed underneath it would hold
    // the microphone open with nothing on screen saying so.
    useEffect(() => {
        return () => {
            if (tickRef.current) clearInterval(tickRef.current);
            const rec = recorderRef.current;
            if (rec && rec.state !== "inactive") {
                rec.stop();
                rec.stream.getTracks().forEach((t) => t.stop());
            }
        };
    }, []);

    async function handleStop(blob: Blob) {
        setPhase("working");
        try {
            const { uploadUrl, publicUrl } = await generateUploadUrl({
                mediaType: "audio",
                contentType: blob.type || "audio/webm",
                fileName: `intake-${questionKey}-${Date.now()}.webm`,
            });
            const put = await fetch(uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": blob.type || "audio/webm" },
                body: blob,
            });
            if (!put.ok) throw new Error(`upload ${put.status}`);

            const result = await transcribe({ audioUrl: publicUrl });
            if (!result.ok || !result.text) {
                setError(result.error ?? "That did not work. Please try again.");
            } else {
                onText(result.text);
            }
        } catch {
            setError("That did not work. Please try again.");
        } finally {
            setPhase("idle");
            setSeconds(0);
        }
    }

    async function start() {
        setError(null);
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
            setError("This browser cannot record. Please type your answer.");
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
                }
            };
            recorderRef.current = rec;
            rec.start();
            setPhase("recording");
            setSeconds(0);
            tickRef.current = setInterval(() => {
                setSeconds((s) => {
                    // Stopping itself at the ceiling is what keeps a phone left
                    // in a pocket from producing a file too big to transcribe.
                    if (s + 1 >= MAX_SECONDS) stop();
                    return s + 1;
                });
            }, 1000);
        } catch {
            // Denied, dismissed, or no microphone. All the same to the owner.
            setError("We could not use the microphone. Please type your answer.");
            setPhase("idle");
        }
    }

    function stop() {
        const rec = recorderRef.current;
        if (rec && rec.state !== "inactive") rec.stop();
        if (tickRef.current) clearInterval(tickRef.current);
    }

    const busy = phase === "working";
    const recording = phase === "recording";

    return (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
                type="button"
                onClick={recording ? stop : start}
                disabled={disabled || busy}
                aria-label={recording ? "Stop recording" : "Record your answer"}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-semibold transition-colors disabled:opacity-50 ${
                    recording
                        ? "border-rust bg-rust text-white"
                        : "border-ink/15 bg-white text-ink hover:border-ink/40"
                }`}
            >
                {recording ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-4 w-4" />}
                {busy ? "Writing it down…" : recording ? `Stop · ${seconds}s` : "Say it instead"}
            </button>

            <span className="text-xs text-ink-soft">
                {recording
                    ? "Talk the way you would to a customer."
                    : busy
                      ? "This takes a few seconds."
                      : "Record and we will write it down for you."}
            </span>

            {error && <span className="w-full text-xs text-rust">{error}</span>}
        </div>
    );
}
