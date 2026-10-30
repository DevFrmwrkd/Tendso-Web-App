"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";

import { CREATORS_SAMPLE, usePortal } from "@/lib/v2/creatorData";
import { firstName, fmtMonthName } from "@/lib/v2/creatorProgram";

import { CreatorsBoundary } from "./CreatorsBoundary";
import { PortalFrame, type PortalIdentity } from "./PortalFrame";
import { PortalView } from "./PortalView";
import { PortalUtilities } from "./PortalUtilities";
import styles from "./PortalFrame.module.css";

function State({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
    return (
        <div className="pt-state">
            <h1>{title}</h1>
            <p>{children}</p>
            {action}
        </div>
    );
}

function SignOut() {
    const { signOut } = useClerk();
    return (
        <button type="button" className="btn btn--line" onClick={() => signOut({ redirectUrl: "/v2/creators" })}>
            Log out
        </button>
    );
}

/** /v2/creators/portal: the real portal for a signed-in creator (role `affiliate`). */
export function PortalPage() {
    return (
        <CreatorsBoundary>
            {CREATORS_SAMPLE ? <PortalInner /> : <PortalSession />}
        </CreatorsBoundary>
    );
}

function PortalSession() {
    const { user } = useUser();
    return <PortalInner key={user?.id ?? "signed-out"} />;
}

function PortalInner() {
    const [month, setMonth] = useState<string>();
    const [pendingIdentity, setPendingIdentity] = useState<PortalIdentity>();
    const monthId = useId();
    const currentMonth = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 7);
    const state = usePortal({ month });
    const ready = state.status === "ready" ? state : null;
    const name = ready?.data.creator.name ?? "";
    const identity = ready ? { name, photo: ready.pictures?.creator ?? ready.data.creator.photo }
        : state.status === "loading" ? pendingIdentity : undefined;
    const selectMonth = (value?: string) => {
        if (identity) setPendingIdentity(identity);
        setMonth(value);
    };
    const showMonth = !!ready || state.status === "loading" && !!pendingIdentity;
    return (
        <PortalFrame
            identity={identity}
            sample={CREATORS_SAMPLE}
            utilityActions={!CREATORS_SAMPLE ? <PortalUtilities /> : undefined}
            right={state.status === "loading" ? null : <Link className="btn btn--line btn--sm" href="/v2/creators/signup">Log in</Link>}
        >
            {state.status === "loading" || ready ? (
                <div className="pt-hi">
                    <div>
                        <h1>{ready ? `Hi, ${firstName(name)}.` : "Your portal"}</h1>
                        <p>{ready ? <>Your earnings for {fmtMonthName(ready.data.month.start)}.{CREATORS_SAMPLE ? " Sample data." : ""}</> : "Loading…"}</p>
                    </div>
                    {showMonth ? <div className={styles.monthPicker}>
                        <label htmlFor={monthId}>Month</label>
                        <input id={monthId} type="month" value={month ?? ready?.data.month.label ?? currentMonth} min="2000-01" max={currentMonth} disabled={CREATORS_SAMPLE} aria-describedby={`${monthId}-note`} onChange={event => {
                            const value = event.target.value;
                            if (!value || /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && value >= "2000-01" && value <= currentMonth) selectMonth(value || undefined);
                        }} />
                        {month && month !== currentMonth ? <button type="button" className={styles.utilityButton} onClick={() => selectMonth()}>This month</button> : null}
                        <span className={styles.monthNote} id={`${monthId}-note`}>Month filters earnings and agent sales.</span>
                    </div> : null}
                </div>
            ) : null}
            {state.status === "signed_out" && (
                <State
                    title="Log in to your portal."
                    action={
                        <Link className="btn btn--accent" href="/v2/creators/signup">
                            Log in with your email
                        </Link>
                    }
                >
                    We email you a code. No password.
                </State>
            )}
            {state.status === "none" && (
                <State
                    title="You have not applied yet."
                    action={
                        <Link className="btn btn--accent" href="/v2/creators/signup">
                            Apply as a creator
                        </Link>
                    }
                >
                    It takes about two minutes, and it is free.
                </State>
            )}
            {state.status === "other_account" && (
                <State title="This email has another Tendso account." action={<SignOut />}>
                    It is a field agent, business or admin account, so it cannot be a creator account. Log out and use a different email.
                </State>
            )}
            {state.status === "pending" && (
                <State
                    title="We are reviewing your page."
                    action={
                        <Link className="btn btn--line" href="/v2/creators">
                            Back to Tendso for creators
                        </Link>
                    }
                >
                    A real person reviews your application. This screen updates when you are approved, and your link and code go live. You can also sign in again later.
                </State>
            )}
            {ready && (
                <>
                    {ready.data.creator.status === "suspended" && (
                        <div className="pt-state" role="status">
                            <p>Your creator account is paused. You can view your sales and earnings. Page changes, sharing, and payouts are paused.</p>
                        </div>
                    )}
                    <PortalView data={ready.data} pictures={ready.pictures} sample={CREATORS_SAMPLE} compactIncome payoutTo={CREATORS_SAMPLE ? "mika.santos@gmail.com" : undefined} />
                </>
            )}

        </PortalFrame>
    );
}
