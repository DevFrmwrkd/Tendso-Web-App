"use client";

import { useQuery } from "convex/react";
import { Check } from "lucide-react";

import { Button, ButtonLink, DefList, DefRow, Icon, Status, bookingStatus, creatorStatus } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

import { avatarName, callTime, firstNameOf, fullName, payoutLines, shortDate, waitedFor } from "../_lib/creators";
import { EmailValue, Line, PhoneValue, ReferrerValue, Section } from "./Bits";
import { DrawerHead, QuietBoundary } from "./DrawerFrame";

/**
 * The drawer for someone waiting for approval (board Creators, "Drawer:
 * waiting creator"; it replaces /admin/creators/pending/[id]). What the old
 * overview showed (contact, payout, quiz date, account date, referrer), then
 * the decision in the foot: Reject, and Approve as the one primary action.
 *
 * Not shown, because nothing stores it: the quiz score and pass mark ("5 of 5
 * correct · pass mark is 4"). Only the moment they passed is recorded.
 */
export function WaitingBody({
    creator,
    titleId,
    now,
    onClose,
    onOpenCreator,
    onApprove,
    onReject,
}: {
    creator: Doc<"creators">;
    titleId: string;
    now: number;
    onClose: () => void;
    onOpenCreator: (id: string) => void;
    onApprove: () => void;
    onReject: () => void;
}) {
    const status = creatorStatus(creator, "admin");
    const first = firstNameOf(creator);
    const payout = payoutLines(creator);
    const passedAt = creator.quizPassedAt;

    return (
        <>
            <DrawerHead titleId={titleId} name={fullName(creator)} avatar={avatarName(creator)} onClose={onClose}>
                <Status tone={status.tone}>
                    {status.word}
                    {passedAt ? ` · applied ${shortDate(passedAt, now)}` : ""}
                </Status>
            </DrawerHead>

            <div className="t-drawer-body">
                {/* The board's right-hand "Passed" status sat beside the score; with no score, the line itself says it. */}
                <Section title="Certification quiz">
                    <Line
                        title={passedAt ? `Passed ${shortDate(passedAt, now)}` : "Passed"}
                        meta={passedAt ? `Waiting ${waitedFor(passedAt, now)} for you` : undefined}
                    />
                </Section>

                <Section title="Onboarding answers">
                    <DefList>
                        <DefRow term="Name">{fullName(creator)}</DefRow>
                        <DefRow term="Phone">
                            <PhoneValue phone={creator.phone} />
                        </DefRow>
                        <DefRow term="Email">
                            <EmailValue email={creator.email} />
                        </DefRow>
                        <DefRow term="Referred by">
                            <ReferrerValue
                                referredBy={creator.referredBy}
                                referredByName={creator.referredByName}
                                referredByCode={creator.referredByCode}
                                onOpenCreator={onOpenCreator}
                            />
                        </DefRow>
                        <DefRow term="Payout method">{payout.length ? payout.join(" / ") : <span className="text-r1-ink-3">Not set yet</span>}</DefRow>
                        <DefRow term="Account created">{shortDate(creator.createdAt ?? creator._creationTime, now)}</DefRow>
                    </DefList>
                </Section>

                {/* The call is extra: if the bookings cannot be read, the drawer goes on without it. */}
                <QuietBoundary>
                    <CallSection email={creator.email} now={now} />
                </QuietBoundary>

                <p className="t-meta">
                    Approve lets {first} into the app to start submitting. Reject shows your reason on their screen; they can retake the quiz or contact support.
                </p>
            </div>

            <div className="t-drawer-foot">
                <Button variant="danger" onClick={onReject}>
                    Reject
                </Button>
                <Button variant="primary" onClick={onApprove}>
                    <Icon icon={Check} />
                    Approve
                </Button>
            </div>
        </>
    );
}

/**
 * Their 10-minute call, when they booked one. A booking holds a name and an
 * email, not a creator id, so it is matched on the email they signed up
 * with, within the window the Calls screen reads (`listForAdmin`: the last
 * three weeks and everything ahead). No match, no section: a missing call is
 * not shown as "no call", because they may have booked with another address.
 */
function CallSection({ email, now }: { email: string; now: number }) {
    const bookings = useQuery(api.nativeBookings.listForAdmin, {});
    const address = email.trim().toLowerCase();
    if (!bookings || !address) return null;
    const theirs = bookings.filter((b) => b.email.trim().toLowerCase() === address);
    const booking = theirs.find((b) => b.status === "confirmed") ?? theirs[0];
    if (!booking) return null;

    return (
        <Section title="Call">
            <Line title="10-minute call" meta={callTime(booking.startMs)}>
                <span className="flex flex-col items-end gap-2">
                    <Status {...bookingStatus(booking, now)} />
                    <ButtonLink size="sm" href="/admin/bookings">
                        Open in Calls
                    </ButtonLink>
                </span>
            </Line>
        </Section>
    );
}
