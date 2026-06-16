import type { CSSProperties } from "react";

/* Tendso icon set — line icons, 24×24, currentColor stroke. Ported from the
   design handoff (icons.jsx). */
const P: Record<string, string> = {
    search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3",
    enter: "M9 10l-4 4 4 4 M5 14h11a4 4 0 0 0 4-4V6",
    arrowUp: "M12 19V5 M6 11l6-6 6 6",
    arrowDown: "M12 5v14 M18 13l-6 6-6-6",
    chevRight: "M9 6l6 6-6 6",
    chevDown: "M6 9l6 6 6-6",
    chevLeft: "M15 6l-6 6 6 6",
    close: "M6 6l12 12 M18 6 6 18",
    external: "M14 5h5v5 M19 5l-8 8 M19 13v6H5V5h6",
    arrowUR: "M7 17 17 7 M8 7h9v9",
    copy: "M9 9h10v10H9z M5 15V5h10",
    check: "M5 13l4 4L19 7",
    thumbUp: "M7 11v9H4v-9h3Zm0 0 4-7a2 2 0 0 1 2 2v3h5a2 2 0 0 1 2 2.3l-1 6A2 2 0 0 1 17 20H7",
    thumbDown: "M17 13V4h3v9h-3Zm0 0-4 7a2 2 0 0 1-2-2v-3H6a2 2 0 0 1-2-2.3l1-6A2 2 0 0 1 7 4h10",
    clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7v5l3 2",
    calendar: "M7 3v3 M17 3v3 M4 8h16 M5 5h14v15H5z",
    hash: "M9 4 7 20 M17 4l-2 16 M5 9h15 M4 15h15",
    book: "M5 4h10a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4Z M17 4h2v16",
    rocket: "M12 3c3 1 5 4 5 8l-2 4H9l-2-4c0-4 2-7 5-8Z M9 15l-2 4 M15 15l2 4 M12 9v.01",
    card: "M3 7h18v10H3z M3 11h18 M7 15h3",
    plug: "M9 3v5 M15 3v5 M7 8h10v3a5 5 0 0 1-10 0V8Z M12 16v5",
    shield: "M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Z",
    wrench: "M15 6a4 4 0 0 0-5 5l-6 6 2 2 6-6a4 4 0 0 0 5-5l-2.5 2.5L14 9l1.5-3Z",
    book2: "M5 4h10a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4Z",
    terminal: "M5 5h14v14H5z M8 9l3 3-3 3 M13 15h3",
    people: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M3 20a5 5 0 0 1 10 0 M16 11a3 3 0 1 0 0-6 M14.5 8h.5a5 5 0 0 1 5 5v.5",
    palette: "M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-.8-1.5-.8-2.5S14 13 16 13h2a3 3 0 0 0 3-3 7 7 0 0 0-7-7H12Z M8 12v.01 M9 8v.01 M14 8v.01",
    chart: "M5 20V10 M12 20V4 M19 20v-7 M3 20h18",
    sparkle: "M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4Z M19 4v3 M20.5 5.5h-3",
    list: "M8 6h12 M8 12h12 M8 18h12 M4 6h.01 M4 12h.01 M4 18h.01",
    home: "M4 11l8-7 8 7 M6 10v9h12v-9",
    menu: "M4 7h16 M4 12h16 M4 17h16",
    link: "M10 14a4 4 0 0 0 6 0l2-2a4 4 0 0 0-6-6l-1 1 M14 10a4 4 0 0 0-6 0l-2 2a4 4 0 0 0 6 6l1-1",
    sliders: "M4 8h10 M18 8h2 M4 16h2 M10 16h10 M14 6v4 M6 14v4",
    filter: "M4 5h16l-6 7v5l-4 2v-7L4 5Z",
    question: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M9.5 9a2.5 2.5 0 1 1 3.4 2.3c-.8.3-1.4 1-1.4 1.9v.3 M12 17h.01",
    bolt: "M13 3 5 14h6l-1 7 8-11h-6l1-7Z",
    doc: "M7 3h7l4 4v14H7z M14 3v4h4 M10 13h5 M10 16h5",
    star: "M12 4l2.4 5 5.6.8-4 4 1 5.6L12 16.8 7 19.4l1-5.6-4-4 5.6-.8L12 4Z",
    globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M3 12h18 M12 3c2.5 2.4 4 5.6 4 9s-1.5 6.6-4 9c-2.5-2.4-4-5.6-4-9s1.5-6.6 4-9Z",
    key: "M14 7a4 4 0 1 0-3.5 6L9 14.5 7.5 16 6 14.5 4.5 16l-2-2L9 7.5A4 4 0 0 1 14 7Z M15 8h.01",
};

export function Icon({
    name,
    size = 20,
    stroke = 1.7,
    className,
    style,
}: {
    name: string;
    size?: number;
    stroke?: number;
    className?: string;
    style?: CSSProperties;
}) {
    const d = P[name] ?? P.doc;
    const paths = d.split(" M").map((seg, i) => (i === 0 ? seg : "M" + seg));
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            style={style}
            aria-hidden="true"
        >
            {paths.map((pd, i) => (
                <path key={i} d={pd} />
            ))}
        </svg>
    );
}

/** Enso brand mark — two offset broken rings (recolorable). */
export function Enso({
    size = 28,
    className,
    style,
    color = "currentColor",
}: {
    size?: number;
    className?: string;
    style?: CSSProperties;
    color?: string;
}) {
    return (
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className} style={style} aria-hidden="true">
            <path
                d="M50 9 C26 9 11 27 11 49 C11 71 27 89 51 89 C70 89 86 76 89 58"
                stroke={color}
                strokeWidth="7.5"
                strokeLinecap="round"
                fill="none"
            />
            <path
                d="M70 22 C57 17 40 18 31 30 C22 41 24 58 37 67 C47 74 61 73 69 64"
                stroke={color}
                strokeWidth="6"
                strokeLinecap="round"
                fill="none"
                opacity="0.85"
            />
        </svg>
    );
}
