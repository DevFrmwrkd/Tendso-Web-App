"use client";

import { useClerk } from "@clerk/nextjs";
import Link from "next/link";
import type { ReactNode } from "react";

import { CREATORS_SAMPLE, usePortal } from "@/lib/v2/creatorData";
import { firstName, fmtMonthYear, fmtMonthName } from "@/lib/v2/creatorProgram";

import { CreatorsBoundary } from "./CreatorsBoundary";
import { PortalFrame } from "./PortalFrame";
import { PortalView } from "./PortalView";

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
            <PortalInner />
        </CreatorsBoundary>
    );
}

function PortalInner() {
    const state = usePortal();
    const ready = state.status === "ready" ? state : null;
    const name = ready?.data.creator.name ?? "";
    return (
        <PortalFrame
            identity={ready ? { name, photo: ready.pictures?.creator ?? ready.data.creator.photo } : undefined}
            sample={CREATORS_SAMPLE}
            right={state.status === "loading" ? null : <Link className="btn btn--line btn--sm" href="/v2/creators/signup">Log in</Link>}
        >
            {state.status === "loading" && (
                <div className="pt-hi">
                    <div>
                        <h1>Your portal</h1>
                        <p>Loading…</p>
                    </div>
                </div>
            )}
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
                    A real person looks at it, then emails you. Your link and code go live when you are approved.
                </State>
            )}
            {ready && (
                <>
                    <div className="pt-hi">
                        <div>
                            <h1>Hi, {firstName(name)}.</h1>
                            <p>Here is {fmtMonthName(ready.data.month.start)} so far.{CREATORS_SAMPLE ? " Sample data." : ""}</p>
                        </div>
                        <span className="pt-month">{fmtMonthYear(ready.data.month.start)}</span>
                    </div>
                    {ready.data.creator.status === "suspended" && (
                        <div className="pt-state" role="status">
                            <p>Your creator account is paused. What you already earned is still here, and you can still send it.</p>
                        </div>
                    )}
                    <PortalView data={ready.data} pictures={ready.pictures} sample={CREATORS_SAMPLE} compactIncome payoutTo={CREATORS_SAMPLE ? "mika.santos@gmail.com" : undefined} />
                </>
            )}

        </PortalFrame>
    );
}
