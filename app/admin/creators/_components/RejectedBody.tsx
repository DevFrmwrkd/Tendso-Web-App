"use client";

import { useQuery } from "convex/react";

import { DefList, DefRow, Skeleton, Status } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

import { avatarName, fullName, shortDate } from "../_lib/creators";
import { EmailValue, PhoneValue, Section } from "./Bits";
import { DrawerHead, QuietBoundary } from "./DrawerFrame";

/**
 * The drawer for someone an admin rejected (board Creators, "Drawer: rejected
 * creator"): the reason exactly as they see it, and the facts around it.
 * Nothing to decide here, so no foot: they come back on their own by
 * retaking the quiz.
 *
 * Not shown, because nothing stores it: their quiz score ("4 of 5"). The day
 * they passed is shown instead.
 */
export function RejectedBody({ creator, titleId, now, onClose }: { creator: Doc<"creators">; titleId: string; now: number; onClose: () => void }) {
    const reason = creator.rejectionReason?.trim();
    return (
        <>
            <DrawerHead titleId={titleId} name={fullName(creator)} avatar={avatarName(creator)} onClose={onClose}>
                <Status tone="bad">Rejected{creator.rejectedAt ? ` · ${shortDate(creator.rejectedAt, now)}` : ""}</Status>
            </DrawerHead>

            <div className="t-drawer-body">
                <Section title="Reason they see">
                    {reason ? <p className="t-body whitespace-pre-line">{reason}</p> : <p className="t-meta">No reason given</p>}
                </Section>

                <Section title="Details">
                    <DefList>
                        <DefRow term="Quiz">{creator.quizPassedAt ? `Passed ${shortDate(creator.quizPassedAt, now)}` : "Not taken"}</DefRow>
                        <DefRow term="Phone">
                            <PhoneValue phone={creator.phone} />
                        </DefRow>
                        <DefRow term="Email">
                            <EmailValue email={creator.email} />
                        </DefRow>
                        <DefRow term="Rejected by">
                            <RejectedBy by={creator.rejectedBy} />
                        </DefRow>
                    </DefList>
                </Section>

                <p className="t-meta">They can retake the quiz or contact support. If they pass again, they come back to Waiting for approval.</p>
            </div>
        </>
    );
}

/**
 * `rejectedBy` is the deciding admin's Clerk id, or `discord:<user id>` when
 * the rejection came from a ❌ on the #pending-approvals message.
 */
function RejectedBy({ by }: { by?: string }) {
    if (!by) return <span className="text-r1-ink-3">Not recorded</span>;
    if (by.startsWith("discord:")) return <>A reviewer on Discord</>;
    return (
        <QuietBoundary fallback="An admin">
            <AdminName clerkId={by} />
        </QuietBoundary>
    );
}

function AdminName({ clerkId }: { clerkId: string }) {
    const admin = useQuery(api.creators.getByClerkId, { clerkId });
    if (admin === undefined) return <Skeleton width={96} height={12} className="ml-auto" />;
    return <>{admin ? fullName(admin) : "An admin"}</>;
}
