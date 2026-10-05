"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { cx } from "./cx";

/**
 * Skeletons: the same shape and size as what is loading, shown only after
 * 300ms so a fast load never flashes. No spinners in lists. The pulse stops
 * under reduced motion.
 */

export function useDelayed(ms = 300): boolean {
    const [ready, setReady] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setReady(true), ms);
        return () => clearTimeout(t);
    }, [ms]);
    return ready;
}

export function Skeleton({ width, height = 12, round = false, className, style }: { width?: number | string; height?: number | string; round?: boolean; className?: string; style?: CSSProperties }) {
    return <span className={cx("t-sk", className)} style={{ width, height, borderRadius: round ? 999 : undefined, ...style }} aria-hidden="true" />;
}

/** The loading region: announces itself once, then shows its skeleton after the delay. */
export function Loading({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
    const show = useDelayed();
    return (
        <div className={className} aria-busy="true">
            <span className="sr-only" role="status">
                {label}
            </span>
            {show && children}
        </div>
    );
}

/** Rows like a list's: avatar or not, two text lines, a short value on the right. */
export function SkeletonRows({ count = 4, avatar = false, className }: { count?: number; avatar?: boolean; className?: string }) {
    return (
        <div className={cx("t-card overflow-hidden", className)} aria-hidden="true">
            {Array.from({ length: count }, (_, i) => (
                <div key={i} className="t-row">
                    {avatar && <Skeleton width={32} height={32} round />}
                    <span className="flex flex-1 flex-col gap-1.5">
                        <Skeleton width="60%" height={12} />
                        <Skeleton width="40%" height={10} />
                    </span>
                    <Skeleton width={64} height={12} />
                </div>
            ))}
        </div>
    );
}

/** A stat card's shape. */
export function SkeletonCard({ className }: { className?: string }) {
    return (
        <div className={cx("t-card t-card-pad flex flex-col gap-3", className)} aria-hidden="true">
            <Skeleton width="55%" height={12} />
            <Skeleton width="40%" height={32} />
            <Skeleton width="35%" height={12} />
        </div>
    );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
    const widths = ["100%", "92%", "64%", "84%", "72%"];
    return (
        <div className={cx("flex flex-col gap-2.5", className)} aria-hidden="true">
            {Array.from({ length: lines }, (_, i) => (
                <Skeleton key={i} width={widths[i % widths.length]} height={12} />
            ))}
        </div>
    );
}
