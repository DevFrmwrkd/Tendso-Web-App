"use client";

import { RotateCw } from "lucide-react";

import { SUPPORT_EMAIL } from "@/lib/contact";

import { Button } from "./Button";
import { cx } from "./cx";
import { Icon } from "./Icon";
import { Status } from "./Status";

/**
 * "This page failed to load": every page gets this instead of a blank screen.
 * It says nothing was changed, offers Reload, and a way to report it with a
 * reference the team can look up.
 */
export function ErrorState({
    what,
    onRetry,
    reference,
    className,
}: {
    /** The page or panel that failed, as a name: "Leads", "Payouts". Omit for the whole page. */
    what?: string;
    /** Defaults to a full reload. */
    onRetry?: () => void;
    /** An error digest or code to quote when reporting. */
    reference?: string | null;
    className?: string;
}) {
    const report = () => {
        const subject = `Problem report: ${what ?? "a page"} failed to load${reference ? ` (${reference})` : ""}`;
        const body = `What I was doing:\n\n\nPage: ${window.location.href}\nRef: ${reference ?? "none"}\nWhen: ${new Date().toString()}`;
        window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };
    return (
        <div className={cx("t-err", className)} role="alert">
            <Status tone="bad" word="Failed to load" />
            <h2 className="t-h2">{what ? `${what} failed to load` : "This page failed to load"}</h2>
            <p className="t-body max-w-[400px]">
                {what ?? "This page"} hit an error on our side. Nothing was changed. Reload to try again; if it happens again, report it and we will fix it.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" onClick={onRetry ?? (() => window.location.reload())}>
                    <Icon icon={RotateCw} />
                    Reload
                </Button>
                <Button onClick={report}>Report the problem</Button>
            </div>
            {reference && <span className="t-mono text-r1-ink-3">Ref {reference}</span>}
        </div>
    );
}
