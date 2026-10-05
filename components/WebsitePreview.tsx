"use client";

import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";

import { cx } from "@/components/r1";

/**
 * The site preview frame (board Review: the centre column; ComponentKit
 * "Segmented control" switches its size).
 *
 * A white frame with an address bar on top, holding the site in an iframe drawn
 * at a REAL screen width (1440 desktop, 834 tablet, 390 phone) and scaled down
 * to fit, so the admin judges the layout a visitor actually gets rather than
 * the site squeezed into whatever width the column happens to have. The
 * caption under it says the width and the scale.
 *
 * Two callers:
 *  - the review workspace (SandboxEditorV3), where this iframe IS the editing
 *    surface: its ref, onLoad and sandbox pass straight through, and the editor
 *    bridge inside it works the same at any scale (it only ever deals in the
 *    iframe's own coordinates and postMessage);
 *  - /preview/[id], the read-only preview a creator or admin opens.
 *
 * Controlled: the caller owns the device (the segmented control lives in the
 * caller's header) and the frame fills the box the caller gives this section.
 */

export type PreviewDevice = "desktop" | "tablet" | "phone";

/**
 * The screen each size stands for, and how wide the board draws its frame.
 * Desktop has no frame width of its own: it takes the column (up to 1440, i.e.
 * never enlarged past 100%) and the column's height, because in an editor more
 * of the page in view beats the board's fixed 16:10 window.
 */
export const PREVIEW_DEVICES: Record<PreviewDevice, { label: string; width: number; height: number; frame: number | null }> = {
    desktop: { label: "Desktop", width: 1440, height: 900, frame: null },
    tablet: { label: "Tablet", width: 834, height: 1112, frame: 560 },
    phone: { label: "Phone", width: 390, height: 844, frame: 300 },
};

/** The options for a <Segmented label="Preview size">. */
export const PREVIEW_DEVICE_OPTIONS: { value: PreviewDevice; label: string }[] = (Object.keys(PREVIEW_DEVICES) as PreviewDevice[]).map(
    (value) => ({ value, label: PREVIEW_DEVICES[value].label }),
);

const BAR = 44; // the frame's address bar
const CAPTION = 30; // the caption line under the frame, and the gap above it
const MIN_VIEW = 120; // never squash the page area below this

export default function WebsitePreview({
    device,
    html,
    src,
    title = "Website preview",
    label,
    barActions,
    banner,
    busy,
    empty = "No website generated yet.",
    iframeRef,
    iframeKey,
    onLoad,
    sandbox = "allow-same-origin allow-scripts",
    className,
    ariaLabel = "Site preview",
}: {
    device: PreviewDevice;
    /** The page as a string (srcDoc). */
    html?: string;
    /** Or its address, for HTML kept in file storage. */
    src?: string;
    title?: string;
    /** The address bar: where this page lives, or that it is not live yet. */
    label: ReactNode;
    /** Ghost toggles at the right end of the address bar. */
    barActions?: ReactNode;
    /** A strip across the top of the page area (an unsaved preview, say). */
    banner?: ReactNode;
    /** While set, the page area is covered and this says why. */
    busy?: ReactNode;
    /** Shown in the frame when there is neither html nor src. */
    empty?: ReactNode;
    iframeRef?: Ref<HTMLIFrameElement>;
    /** Change it to load a different document in a fresh iframe. */
    iframeKey?: string;
    onLoad?: () => void;
    sandbox?: string;
    /** The caller sizes this section; the frame fits inside it. */
    className?: string;
    ariaLabel?: string;
}) {
    const rootRef = useRef<HTMLElement>(null);
    const [box, setBox] = useState<{ w: number; h: number } | null>(null);

    // The frame is sized from the space the section actually has. A
    // ResizeObserver reports once as soon as it starts observing, so there is
    // no separate first measurement.
    useEffect(() => {
        const el = rootRef.current;
        if (!el || typeof ResizeObserver === "undefined") return;
        const ro = new ResizeObserver(() => {
            const cs = window.getComputedStyle(el);
            const w = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
            const h = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
            setBox((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const spec = PREVIEW_DEVICES[device];
    const hasPage = Boolean(html || src);

    let frame: { w: number; h: number; scale: number; viewH: number } | null = null;
    if (box && box.w > 0) {
        const w = Math.max(1, Math.min(spec.frame ?? spec.width, box.w));
        // Inside the 1px border on each side.
        const scale = Math.min(1, Math.max(0.05, (w - 2) / spec.width));
        const room = Math.max(box.h - CAPTION, BAR + MIN_VIEW);
        const natural = BAR + Math.round(spec.height * scale) + 2;
        const h = device === "desktop" ? room : Math.min(natural, room);
        frame = { w, h, scale, viewH: Math.max(1, Math.round((h - BAR - 2) / scale)) };
    }

    return (
        <section
            ref={rootRef}
            aria-label={ariaLabel}
            className={cx("flex min-h-0 min-w-0 flex-col items-center gap-3 overflow-hidden bg-r1-fill-2 p-4 sm:p-6", className)}
        >
            {frame && (
                <>
                    <div
                        className="flex flex-none flex-col overflow-hidden rounded-r1-card border border-r1-line bg-r1-paper"
                        style={{ width: frame.w, height: frame.h }}
                    >
                        <div className="flex h-11 flex-none items-center justify-between gap-3 border-b border-r1-line pl-3.5 pr-0.5">
                            <span className="min-w-0 truncate text-[13px] leading-[18px] text-r1-ink-2">{label}</span>
                            {barActions && <div className="flex flex-none items-center">{barActions}</div>}
                        </div>
                        <div className="relative min-h-0 flex-1 overflow-hidden">
                            {hasPage ? (
                                <iframe
                                    key={iframeKey}
                                    ref={iframeRef}
                                    src={src || undefined}
                                    srcDoc={src ? undefined : html}
                                    title={title}
                                    sandbox={sandbox}
                                    onLoad={onLoad}
                                    className="block origin-top-left border-0 bg-r1-paper"
                                    style={{ width: spec.width, height: frame.viewH, transform: `scale(${frame.scale})` }}
                                />
                            ) : (
                                <div className="flex h-full items-center justify-center p-6 text-center">
                                    <p className="t-meta">{empty}</p>
                                </div>
                            )}
                            {banner}
                            {busy && (
                                <div className="absolute inset-0 z-10 flex items-center justify-center bg-r1-paper/75 p-6 text-center backdrop-blur-sm" role="status">
                                    <span className="t-body font-medium text-r1-ink">{busy}</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <p className="t-meta t-num text-center">
                        {spec.label} · {spec.width} px wide, shown at {Math.round(frame.scale * 100)}%
                    </p>
                </>
            )}
        </section>
    );
}
