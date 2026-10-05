import { Fragment, type ReactNode } from "react";

/*
 * Putting values into translated copy.
 *
 * A sentence with a link or a bold price in it stays ONE string per language,
 * with {name} where the value goes. Cutting it into pieces around the link
 * would freeze English word order into the Tagalog, which puts things in a
 * different place in the sentence.
 */

const PLACEHOLDER = /(\{\w+\})/g;

/** Text values only: aria labels, captions. An unknown {name} is left as written. */
export function fillText(text: string, values: Record<string, string | number>): string {
    return text.replace(PLACEHOLDER, (whole: string) => {
        const key = whole.slice(1, -1);
        return key in values ? String(values[key]) : whole;
    });
}

/** Text or elements: a link, a <strong>. Returns nodes to render in place of the string. */
export function fill(text: string, values: Record<string, ReactNode>): ReactNode {
    return text.split(PLACEHOLDER).map((part, i) => {
        const key = part.startsWith("{") && part.endsWith("}") ? part.slice(1, -1) : null;
        if (key !== null && key in values) return <Fragment key={i}>{values[key]}</Fragment>;
        return part;
    });
}
