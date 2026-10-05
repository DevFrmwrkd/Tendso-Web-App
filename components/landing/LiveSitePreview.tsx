"use client";

import { useEffect, useRef, useState } from "react";

import { cx } from "@/components/r1";

/**
 * A live, scaled, non-interactive preview of a real site — it renders the actual
 * page in an iframe at desktop width and scales it to fill its container (16:9).
 * Because it's the live site (not a stored screenshot), the preview can never
 * drift "a version behind" the real page. The iframe is inert (pointer-events
 * off, not focusable, hidden from the a11y tree) so a wrapping link owns clicks.
 *
 * The Round 1 boards draw a screenshot here because the canvas cannot load a
 * live page; the Site settings board confirms the landing card is "a live
 * preview of the site's page", so the iframe stays.
 */
const DESIGN_WIDTH = 1280; // render each site at desktop width, then scale down

export default function LiveSitePreview({ url, name, className }: { url: string; name: string; className?: string }) {
    const boxRef = useRef<HTMLDivElement | null>(null);
    const [scale, setScale] = useState(0);
    const [loaded, setLoaded] = useState(false);

    // Scale = container width / design width, kept in sync with responsive resizes.
    useEffect(() => {
        const el = boxRef.current;
        if (!el || typeof ResizeObserver === "undefined") return;
        const ro = new ResizeObserver((entries) => {
            const w = entries[0]?.contentRect.width ?? 0;
            if (w > 0) setScale(w / DESIGN_WIDTH);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // At 1280×720 scaled by (width/1280), the iframe exactly fills the 16:9 box.
    const iframeHeight = (DESIGN_WIDTH * 9) / 16;

    return (
        <div ref={boxRef} className={cx("relative aspect-video w-full overflow-hidden bg-r1-fill-2", className)}>
            {/* The kit's skeleton pulse until the live page paints (it stops under reduced motion). */}
            {!loaded && <span aria-hidden="true" className="t-sk absolute inset-0 rounded-none" />}
            {scale > 0 && (
                <iframe
                    src={url}
                    title={`${name} — live website`}
                    loading="lazy"
                    tabIndex={-1}
                    aria-hidden="true"
                    scrolling="no"
                    onLoad={() => setLoaded(true)}
                    className="absolute left-0 top-0 origin-top-left border-0 transition-opacity duration-500"
                    style={{
                        width: `${DESIGN_WIDTH}px`,
                        height: `${iframeHeight}px`,
                        transform: `scale(${scale})`,
                        pointerEvents: "none",
                        opacity: loaded ? 1 : 0,
                    }}
                />
            )}
        </div>
    );
}
