import type { ReactNode } from "react";

import { cx } from "./cx";
import type { StatusWord, Tone } from "./statusWords";

export function Dot({ tone, className }: { tone?: Tone; className?: string }) {
    return <span className={cx("t-dot", tone && `is-${tone}`, className)} aria-hidden="true" />;
}

/**
 * A dot plus a word. Pass a mapped status (`<Status {...submissionStatus(s)} />`)
 * or a tone and children.
 */
export function Status({ tone, word, children, className }: Partial<StatusWord> & { children?: ReactNode; className?: string }) {
    return (
        <span className={cx("t-status", className)}>
            <Dot tone={tone} />
            {word ?? children}
        </span>
    );
}
