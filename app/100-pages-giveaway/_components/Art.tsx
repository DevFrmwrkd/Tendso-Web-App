/** Drawn pieces of the giveaway poster. All decorative: the words around them carry the meaning. */

/** A gift box with a website popping out of it. */
export function GiftArt() {
    return (
        <svg className="gw-gift" viewBox="0 0 132 112" aria-hidden="true">
            <path d="M14 18 4 10M118 18l10-8M30 4l-4-6M102 4l4-6M66 0v-8" stroke="#FFC531" strokeWidth="4" strokeLinecap="round" />
            <g transform="rotate(-8 66 40)">
                <rect x="40" y="10" width="54" height="40" rx="5" fill="#FFFFFF" stroke="#0D0D0D" strokeWidth="3.5" />
                <path d="M40 21h54" stroke="#0D0D0D" strokeWidth="3.5" />
                <circle cx="47" cy="15.5" r="2" fill="#E23A1F" />
                <circle cx="54" cy="15.5" r="2" fill="#FFC531" />
                <path d="M48 30h28M48 38h18" stroke="#0D0D0D" strokeWidth="3.5" strokeLinecap="round" />
            </g>
            <rect x="18" y="62" width="96" height="48" rx="5" fill="#E23A1F" stroke="#0D0D0D" strokeWidth="3.5" />
            <rect x="10" y="46" width="112" height="20" rx="5" fill="#E23A1F" stroke="#0D0D0D" strokeWidth="3.5" transform="rotate(-4 66 56)" />
            <rect x="58" y="62" width="16" height="48" fill="#FFC531" stroke="#0D0D0D" strokeWidth="3.5" />
        </svg>
    );
}

const ICON = {
    fill: "none",
    stroke: "#0D0D0D",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    viewBox: "0 0 24 24",
    "aria-hidden": true,
} as const;

export function PrintIcon() {
    return (
        <svg {...ICON}>
            <path d="M6 9V2h12v7" fill="#FFC531" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" fill="#FFFFFF" />
        </svg>
    );
}

export function CameraIcon() {
    return (
        <svg {...ICON}>
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" fill="#FFC531" />
            <circle cx="12" cy="13" r="3.5" fill="#FFFFFF" />
        </svg>
    );
}

export function SendIcon() {
    return (
        <svg {...ICON}>
            <path d="m22 2-7 20-4-9-9-4Z" fill="#FFC531" />
            <path d="M22 2 11 13" />
        </svg>
    );
}

export function ArrowIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
        </svg>
    );
}

export function DownloadIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 21h14" />
        </svg>
    );
}

/**
 * One tick per website. `open` ticks are the slots still free; with no count
 * yet every tick is neutral, and `full` paints them all as taken.
 */
export function SlotBar({ open, full = false }: { open?: number; full?: boolean }) {
    const taken = open === undefined ? 100 : 100 - open;
    return (
        <div className={full ? "gw-bar is-full" : "gw-bar"} aria-hidden="true">
            {Array.from({ length: 100 }, (_, i) => (
                <span key={i} className={!full && i >= taken ? "is-open" : undefined} />
            ))}
        </div>
    );
}
