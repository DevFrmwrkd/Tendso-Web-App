"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/** Render the page at desktop width, then scale it down to the frame. */
const DESIGN_WIDTH = 1280;
const HEIGHT = 200;
const WIDE = "(min-width: 640px)";

function subscribeWide(onChange: () => void) {
    const query = window.matchMedia(WIDE);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
}

/**
 * The picture of the site in the drawer's "Live site" (board: `.sb-thumb`).
 *
 * Nothing stores a screenshot of a generated site, so this is the live page in
 * an inert iframe, scaled to the frame: the way the landing page shows real
 * sites (components/landing/LiveSitePreview.tsx), so it is never a version
 * behind. The link row under it is what people use; this is only a picture,
 * hidden from the accessibility tree and unreachable by Tab.
 *
 * Not on a phone. A creator checking a submission on mobile data should not
 * download a whole website, at desktop size, for a 200px thumbnail; the
 * link under it opens the real thing.
 */
export function SitePreview({ url, name }: { url: string; name: string }) {
    const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => false);
    const boxRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(0);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        const el = boxRef.current;
        if (!wide || !el || typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver((entries) => {
            const width = entries[0]?.contentRect.width ?? 0;
            if (width > 0) setScale(width / DESIGN_WIDTH);
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, [wide]);

    if (!wide) return null;

    return (
        <div
            ref={boxRef}
            className="relative w-full flex-none overflow-hidden rounded-r1 border border-r1-line bg-r1-fill-2"
            style={{ height: HEIGHT }}
            aria-hidden="true"
        >
            {!loaded && <span className="t-sk absolute inset-0 rounded-none" />}
            {scale > 0 && (
                <iframe
                    src={url}
                    title={`${name} website preview`}
                    loading="lazy"
                    tabIndex={-1}
                    scrolling="no"
                    // Scripts run (the page needs them to draw); it may not
                    // navigate the app, open windows or submit forms.
                    sandbox="allow-scripts allow-same-origin"
                    onLoad={() => setLoaded(true)}
                    className="absolute left-0 top-0 origin-top-left border-0"
                    style={{
                        width: DESIGN_WIDTH,
                        height: HEIGHT / scale,
                        transform: `scale(${scale})`,
                        pointerEvents: "none",
                        opacity: loaded ? 1 : 0,
                    }}
                />
            )}
        </div>
    );
}
