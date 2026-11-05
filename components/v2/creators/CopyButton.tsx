"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Copies `text` to the clipboard and says "Copied" for a moment. `className` picks the look. */
export function CopyButton({ text, className, children = "Copy", doneLabel = "Copied", disabled }: { text: string; className?: string; children?: ReactNode; doneLabel?: string; disabled?: boolean }) {
    const [done, setDone] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
    return (
        <button
            type="button"
            className={`${className ?? ""}${done ? " is-done" : ""}`.trim()}
            disabled={disabled}
            onClick={async () => {
                try {
                    await navigator.clipboard.writeText(text);
                } catch {
                    /* the browser blocked it: nothing else to do */
                }
                setDone(true);
                if (timer.current) clearTimeout(timer.current);
                timer.current = setTimeout(() => setDone(false), 1400);
            }}
        >
            {done ? doneLabel : children}
        </button>
    );
}

/** The "Share" button: the phone's share sheet when there is one, a copy when not. */
export function ShareButton({ url, title, className, disabled }: { url: string; title: string; className?: string; disabled?: boolean }) {
    const [done, setDone] = useState(false);
    return (
        <button
            type="button"
            className={`${className ?? ""}${done ? " is-done" : ""}`.trim()}
            disabled={disabled}
            onClick={async () => {
                try {
                    if (navigator.share) await navigator.share({ title, url });
                    else {
                        await navigator.clipboard.writeText(url);
                        setDone(true);
                        setTimeout(() => setDone(false), 1400);
                    }
                } catch {
                    /* cancelled */
                }
            }}
        >
            {done ? "Copied" : "Share"}
        </button>
    );
}
