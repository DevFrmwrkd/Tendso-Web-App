"use client";

/**
 * The frame every Field Agent booking screen wears.
 *
 * Round 1, board BookCall: a funnel, so the header is the wordmark and one
 * quiet way back to the site, and nothing else to wander off to. Under it the
 * page title, the one question the page answers, and the step rail on the
 * right (above the content on a phone).
 *
 * ONE COMPONENT SO THEY CANNOT DIVERGE. /field-agent/book and
 * /field-agent/manage are the same flow seen at two moments — making a booking
 * and moving one — and the second was briefly a plainer page of its own. If the
 * frame changes, it changes for both.
 *
 * The header's side padding follows the 1120px content column, so the
 * wordmark sits over the left edge of the page and not out in the margin.
 */

import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

import { FunnelHeader, PublicPage, Stepper, cx } from "@/components/r1";

export default function BookingShell({
    title,
    steps,
    current = 0,
    phoneBar = false,
    children,
}: {
    title: ReactNode;
    /** The step rail, e.g. ["Time", "Details", "Done"]. Left out on a screen that is not a step (a link that does not work). */
    steps?: string[];
    /** Index of the step showing; steps.length when every step is done. */
    current?: number;
    /** Leave room at the bottom for the phone's fixed action bar (see ActionBar). */
    phoneBar?: boolean;
    children: ReactNode;
}) {
    return (
        <PublicPage
            header={
                <FunnelHeader
                    exit={{ href: "/for-creators", label: "Back to site", icon: ArrowLeft }}
                    className="lg:px-[max(24px,calc((100%_-_1120px)/2))]"
                />
            }
        >
            <div className={cx("mx-auto flex w-full max-w-[1168px] flex-col gap-8 px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:pt-10", phoneBar && "max-lg:pb-40")}>
                <header className="t-page-head">
                    <div className="t-page-titles">
                        <h1 className="t-h1">{title}</h1>
                        <p className="t-sub">When can I talk to Tendso?</p>
                    </div>
                    {steps && <Stepper steps={steps} current={current} label="Progress" className="w-full sm:w-auto [&_.t-step-line]:min-w-8" />}
                </header>
                {children}
            </div>
        </PublicPage>
    );
}
