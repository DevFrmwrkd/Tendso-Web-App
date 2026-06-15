import { Fragment } from "react";
import { highlightParts } from "./search";

/** Renders `text` with query terms wrapped in <mark>. */
export function Hi({ text, q }: { text: string; q: string }) {
    const parts = highlightParts(text, q);
    return (
        <>
            {parts.map((p, i) =>
                p.m ? <mark key={i}>{p.text}</mark> : <Fragment key={i}>{p.text}</Fragment>,
            )}
        </>
    );
}
