import type { ReactNode } from "react";

import { cx } from "@/components/r1";

import { CONTAINER } from "./frame";

/**
 * The one action bar (Round 1, board Start): what this step is waiting on, on
 * the left; Back and the way forward on the right.
 *
 * Sticky to the bottom of the screen at every width, so the way forward is
 * always under the thumb however long the step is — and above the iOS home
 * indicator, via env(safe-area-inset-bottom). On a desk its message lines up
 * with the form column, past the rail (256px rail + 64px gap + the 40px gutter).
 *
 * On a phone the running status line ("Step 2 of 4 · …") is left out to keep
 * the bar to one row of buttons; a problem the owner has to fix is never left
 * out, and sits above the buttons.
 */
export function ActionBar({
    info,
    error,
    extra,
    children,
}: {
    /** The step's running status. Hidden on a phone. */
    info?: ReactNode;
    /** What is stopping the owner. Replaces `info`, shown at every width. */
    error?: ReactNode;
    /** Beside the message, e.g. "Show me". */
    extra?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div
            role="region"
            aria-label="Step actions"
            className="sticky bottom-0 z-20 border-t border-r1-line bg-r1-paper"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
            <div
                className={cx(
                    CONTAINER,
                    "flex flex-col gap-2.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 lg:min-h-20 lg:pl-[360px]",
                )}
            >
                <div className={cx("flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2", !error && "max-sm:hidden")}>
                    {error ? (
                        <p role="alert" className="text-[13px] leading-[18px] text-r1-red">
                            {error}
                        </p>
                    ) : info ? (
                        <p className="t-meta">{info}</p>
                    ) : null}
                    {extra}
                </div>
                <div className="flex flex-none items-center gap-2">{children}</div>
            </div>
        </div>
    );
}
