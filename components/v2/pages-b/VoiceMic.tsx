"use client";

import { useAction } from "convex/react";
import { useEffect, useRef, useState } from "react";

import { api } from "@/convex/_generated/api";

/**
 * "Say it instead": answer a question by talking. The v2 look on the existing
 * engine (app/start/VoiceAnswer.tsx): the recording goes straight to
 * `intakeVoice.transcribeAnswer` and is never stored; the words come back and are
 * ADDED to the box, never replacing what was typed. The recorder stops itself at
 * two minutes, which keeps the file inside the size the action accepts.
 */

const MAX_SECONDS = 120;
type Phase = "idle" | "starting" | "recording" | "working";

function clock(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
}

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

export function VoiceMic({
    onText,
    blocked,
    onBusyChange,
    hasText,
}: {
    onText: (text: string) => void;
    blocked?: boolean;
    onBusyChange?: (busy: boolean) => void;
    hasText?: boolean;
}) {
    const transcribe = useAction(api.intakeVoice.transcribeAnswer);
    const [phase, setPhase] = useState<Phase>("idle");
    const [seconds, setSeconds] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [added, setAdded] = useState(false);
    const recorder = useRef<MediaRecorder | null>(null);
    const chunks = useRef<Blob[]>([]);
    const tick = useRef<ReturnType<typeof setInterval> | null>(null);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            if (tick.current) clearInterval(tick.current);
            const rec = recorder.current;
            if (rec && rec.state !== "inactive") {
                rec.stop();
                rec.stream.getTracks().forEach((t) => t.stop());
            }
        };
    }, []);

    useEffect(() => {
        if (phase !== "recording" || seconds < MAX_SECONDS) return;
        const rec = recorder.current;
        if (rec && rec.state !== "inactive") rec.stop();
        if (tick.current) clearInterval(tick.current);
    }, [phase, seconds]);

    async function handleStop(blob: Blob) {
        setPhase("working");
        try {
            const result = await transcribe({ audioBase64: await toBase64(blob), mimeType: blob.type || "audio/webm" });
            if (!result.ok || !result.text) setError(result.error ?? "That did not work. Please try again.");
            else {
                onText(result.text);
                setAdded(true);
            }
        } catch {
            setError("That did not work. Please try again.");
        } finally {
            if (mounted.current) {
                setPhase("idle");
                setSeconds(0);
            }
            onBusyChange?.(false);
        }
    }

    async function start() {
        if (phase !== "idle" || blocked) return;
        setError(null);
        setAdded(false);
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
            setError("This browser can't record. Please type your answer.");
            return;
        }
        setPhase("starting");
        onBusyChange?.(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (!mounted.current) {
                stream.getTracks().forEach((t) => t.stop());
                onBusyChange?.(false);
                return;
            }
            const rec = new MediaRecorder(stream);
            chunks.current = [];
            rec.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.current.push(e.data);
            };
            rec.onstop = () => {
                stream.getTracks().forEach((t) => t.stop());
                if (tick.current) clearInterval(tick.current);
                const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
                if (blob.size > 0) void handleStop(blob);
                else {
                    if (mounted.current) {
                        setPhase("idle");
                        setSeconds(0);
                    }
                    onBusyChange?.(false);
                }
            };
            recorder.current = rec;
            rec.start();
            setPhase("recording");
            setSeconds(0);
            tick.current = setInterval(() => setSeconds((s) => s + 1), 1000);
        } catch {
            setError("We couldn't use the microphone. Please type your answer.");
            setPhase("idle");
            onBusyChange?.(false);
        }
    }

    function stop() {
        const rec = recorder.current;
        if (rec && rec.state !== "inactive") rec.stop();
        if (tick.current) clearInterval(tick.current);
    }

    const recording = phase === "recording";
    const working = phase === "working";

    return (
        <div className="pb-st-micwrap">
            <button
                type="button"
                className={`pb-st-mic ${recording ? "is-rec" : ""} ${working ? "is-busy" : ""}`}
                onClick={recording ? stop : start}
                disabled={blocked || phase === "starting"}
            >
                <span className="pb-st-mic-i">
                    {recording ? (
                        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                            <rect x="3" y="3" width="10" height="10" rx="2" fill="currentColor" />
                        </svg>
                    ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                            <rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
                            <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                    )}
                </span>
                <span>{recording ? `Listening. Tap to stop · ${clock(seconds)}` : working ? "Writing it down…" : hasText || added ? "Say more" : "Say it instead"}</span>
            </button>
            {added && phase === "idle" && <p className="pb-st-help">Written down from your recording. Fix anything that&apos;s off.</p>}
            {error && (
                <p className="pb-st-err" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}
