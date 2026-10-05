import type { ReactNode } from "react";

import { cx } from "@/components/r1";

/*
 * The landing's frame (board: Landing). The board is drawn at 1440px with 64px
 * sides; phone first, that is 16px, then 24px from 640, then 64px from 1024,
 * and the content stops growing at the board's width so a wide monitor does
 * not stretch a site preview to a metre across.
 */
export const LANDING_WRAP = "mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-16";

/** A band: the hairline above it and the board's 80px rhythm (48 on a phone). */
export const LANDING_BAND = "border-t border-r1-line";
export const LANDING_BAND_IN = cx(LANDING_WRAP, "flex flex-col gap-8 py-12 sm:py-16 lg:gap-10 lg:py-20");

/** A section's serif title and its one-line answer (board: `.la-head`). */
export function SectionHead({ id, title, sub, className }: { id: string; title: ReactNode; sub?: ReactNode; className?: string }) {
    return (
        <div className={cx("flex max-w-[720px] flex-col gap-2", className)}>
            <h2 id={id} className="t-h1">
                {title}
            </h2>
            {sub && <p className="t-sub">{sub}</p>}
        </div>
    );
}
