"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";

import { api } from "@/convex/_generated/api";
import { useNow } from "@/app/pay/[token]/_components/useNow";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { CREATORS_SAMPLE, usePortal, type PortalState } from "@/lib/v2/creatorData";
import { firstName, fmtMonthName } from "@/lib/v2/creatorProgram";
import { CREATOR_ACCOUNT_HREF } from "@/lib/v2/creatorPortalNavigation";

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
        <button type="button" className="btn btn--line" onClick={() => signOut({ redirectUrl: "/affiliates" })}>
            Log out
        </button>
    );
}

function PortalStatus({ state }: { state: PortalState }) {
    if (state.status === "signed_out") return <State title="Log in to your portal." action={<Link className="btn btn--accent" href="/affiliates/join?login=1">Log in with your email</Link>}>We email you a code. No password.</State>;
    if (state.status === "none") return <State title="You have not applied yet." action={<Link className="btn btn--accent" href="/affiliates/join">Apply as a creator</Link>}>It takes about two minutes, and it is free.</State>;
    if (state.status === "other_account") return <State title="This email has another Tendso account." action={<SignOut />}>It is a field agent, business or admin account, so it cannot be a creator account. Log out and use a different email.</State>;
    if (state.status === "pending") return <State title="We are reviewing your page." action={<Link className="btn btn--line" href="/affiliates">Back to Tendso for creators</Link>}>A real person reviews your application. This screen updates when you are approved, and your link and code go live. You can also sign in again later.</State>;
    return null;
}

/** /affiliates/dashboard: the real portal for a signed-in creator (role `affiliate`). */
export function PortalPage() {
    return (
        <CreatorsBoundary>
            {CREATORS_SAMPLE ? <PortalInner /> : <PortalSession />}
        </CreatorsBoundary>
    );
}

function PortalSession() {
    const { user, isLoaded, isSignedIn } = useUser();
    const { isLoading, isAuthenticated } = useConvexAuth();
    const authenticated = isLoaded && isSignedIn && !!user && !isLoading && isAuthenticated;
    const session = useQuery(api.adminAccess.me, authenticated ? {} : "skip");
    let state: PortalState;
    if (!isLoaded) state = { status: "loading" };
    else if (!isSignedIn) state = { status: "signed_out" };
    else if (!authenticated || !user || !session || session.clerkId !== user.id) state = { status: "loading" };
    else {
        const account = session.creator;
        if (!account) state = { status: session.isOwner ? "other_account" : "none" };
        else if (account.clerkId !== user.id) state = { status: "loading" };
        else if (account.isDeleted || account.status === "deleted") state = { status: "none" };
        else if (account.role !== "affiliate") state = { status: "other_account" };
        else if (account.status === "pending") state = { status: "pending", handle: account.affiliateHandle ?? null, code: account.referralCode ?? null };
        else if (account.status === "active" || account.status === "suspended") {
            if (!account.affiliateHandle?.trim()) return <PortalFrame><State title="Your creator page needs setup." action={<Link className="btn btn--line" href={CREATOR_ACCOUNT_HREF}>Open account</Link>}>
                Your page address is missing. Contact <a className="u" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> so we can finish setting it up.
            </State></PortalFrame>;
            // The same verified account gate as the editor and payout screens. An
            // old Convex JWT must never mount the previous person's summary.
            return <PortalInner key={`${user.id}:${account._id}`} expectedHandle={account.affiliateHandle} />;
        } else state = { status: "none" };
    }
    return <PortalFrame right={state.status === "loading" ? null : <Link className="btn btn--line btn--sm" href="/affiliates/join?login=1">Log in</Link>}>
        {state.status === "loading" ? <div className="pt-hi"><div><h1>Your portal</h1><p>Loading…</p></div></div> : <PortalStatus state={state} />}
    </PortalFrame>;
}

function PortalInner({ expectedHandle }: { expectedHandle?: string } = {}) {
    const [month, setMonth] = useState<string>();
    const [pendingIdentity, setPendingIdentity] = useState<PortalIdentity>();
    const monthId = useId();
    const now = useNow();
    const currentMonth = new Date(now + 8 * 60 * 60 * 1000).toISOString().slice(0, 7);
    const response = usePortal({ month });
    // Cached summary data must also belong to the newly verified public handle.
    const state: PortalState = response.status === "ready" && expectedHandle !== undefined && response.data.creator.handle !== expectedHandle
        ? { status: "loading" } : response;
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
            right={state.status === "loading" ? null : <Link className="btn btn--line btn--sm" href="/affiliates/join?login=1">Log in</Link>}
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
            <PortalStatus state={state} />
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
