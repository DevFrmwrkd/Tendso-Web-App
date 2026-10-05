"use client";

import { useSyncExternalStore } from "react";

/**
 * Which lessons this person has marked done (board Certification, step 2:
 * "Mark as done", "3 of 5 done", the quiz unlocking at 5).
 *
 * KEPT ON THIS DEVICE ONLY. Convex has no field for lesson progress, and this
 * round adds no backend, so the marks live in localStorage, one entry per
 * Clerk user so a shared phone does not mix two people's progress. If storage
 * is blocked (some private windows), the marks last for the visit. Losing them
 * costs five clicks; nothing else depends on them, and the quiz route itself
 * stays open exactly as before.
 *
 * useSyncExternalStore, not state copied in an effect: the server renders
 * "nothing done", and the browser reads the real value without a flash or a
 * hydration mismatch.
 */

const CHANGED = "tendso:lesson-progress";
const memory = new Map<string, string>();

function keyFor(userId: string): string {
    return `tendso.lessons.v1.${userId}`;
}

function read(key: string): string {
    try {
        return window.localStorage.getItem(key) ?? memory.get(key) ?? "";
    } catch {
        return memory.get(key) ?? "";
    }
}

function write(key: string, value: string) {
    memory.set(key, value);
    try {
        window.localStorage.setItem(key, value);
    } catch {
        // Storage blocked or full: the in-memory copy carries this visit.
    }
    window.dispatchEvent(new Event(CHANGED));
}

function subscribe(onChange: () => void) {
    window.addEventListener("storage", onChange);
    window.addEventListener(CHANGED, onChange);
    return () => {
        window.removeEventListener("storage", onChange);
        window.removeEventListener(CHANGED, onChange);
    };
}

export function useLessonProgress(userId: string | null | undefined, count: number) {
    const key = userId ? keyFor(userId) : null;
    // A string ("10110"), so React can compare snapshots by value.
    const raw = useSyncExternalStore(
        subscribe,
        () => (key ? read(key) : ""),
        () => "",
    );
    const done = Array.from({ length: count }, (_, i) => raw.charAt(i) === "1");

    const setDone = (index: number, value: boolean) => {
        if (!key) return;
        const next = done.map((d, i) => (i === index ? value : d));
        write(key, next.map((d) => (d ? "1" : "0")).join(""));
    };

    return { done, setDone };
}
