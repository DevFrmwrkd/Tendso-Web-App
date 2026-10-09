"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Bell, Check } from "lucide-react";
import { useState } from "react";

import { oldestAwaitingPayment, ownerFirstName, payoutOf, shortDate, submissionHref } from "@/app/dashboard/_lib/home";
import { Button, Dot, Drawer, EmptyState, Icon, List, Loading, RowButton, RowLink, Segmented, SkeletonRows } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

type Notification = Doc<"notifications">;
type Filter = "all" | "unread";

/**
 * Where a notification leads: the same places it always has. The certificate
 * is no longer drawn here; there is one certificate dialog, on Account, and
 * `?certificate=1` opens it. A submission opens its details.
 */
function destinationOf(n: Notification): string | null {
    const data = n.data as { showCertificate?: boolean; submissionId?: string } | null | undefined;
    if (data?.showCertificate) return "/profile?certificate=1";
    if (data?.submissionId) return submissionHref(data.submissionId);
    return null;
}

/**
 * Notifications (board Notifications): "What changed?" A 480px right drawer
 * (full width on a phone) with All / Unread, Mark all read, and one row per
 * notification. Opening a row marks it read, then follows it if it leads
 * somewhere.
 *
 * `creator` null = signed in without a creator profile: nothing to list.
 */
export function NotificationsDrawer({ open, onClose, creator }: { open: boolean; onClose: () => void; creator: Doc<"creators"> | null | undefined }) {
    const { isAuthenticated } = useConvexAuth();
    const notifications = useQuery(api.notifications.getByCreator, creator ? { creatorId: creator._id } : "skip");
    // For the "all caught up" line only; the creator shell runs this same subscription.
    const submissions = useQuery(api.submissions.getByCreatorId, isAuthenticated && creator ? { creatorId: creator._id } : "skip");
    const markAsRead = useMutation(api.notifications.markAsRead);
    const markAllAsRead = useMutation(api.notifications.markAllAsRead);

    const [filter, setFilter] = useState<Filter>("all");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Said to screen readers after Mark all read. The board's "N marked as read"
    // toast is not used: a toast renders under an open modal drawer, and its
    // Undo needs a mark-unread mutation the backend does not have.
    const [said, setSaid] = useState("");

    const list = creator === null ? [] : notifications;
    const unread = list?.filter((n) => !n.read) ?? [];
    const shown = filter === "unread" ? unread : (list ?? []);

    const openOne = (n: Notification) => {
        if (n.read) return;
        markAsRead({ id: n._id }).catch(() => setError("Couldn't mark it as read. Try again."));
    };

    const markAll = async () => {
        if (!creator) return;
        const count = unread.length;
        setBusy(true);
        setError(null);
        try {
            await markAllAsRead({ creatorId: creator._id });
            setSaid(count === 1 ? "1 marked as read" : `${count} marked as read`);
        } catch {
            setError("Couldn't mark them as read. Try again.");
        } finally {
            setBusy(false);
        }
    };

    const waiting = submissions ? oldestAwaitingPayment(submissions) : null;
    const payout = waiting ? payoutOf(waiting) : null;
    const caughtUp = waiting
        ? `Nothing unread. We'll tell you here when ${ownerFirstName(waiting.ownerName)} pays for ${waiting.businessName?.trim() || "your site"}${payout ? ` and your ${payout} lands` : ""}.`
        : "Nothing unread. We'll tell you here when something changes.";

    return (
        <Drawer open={open} onClose={onClose} title="Notifications" meta="What changed?" closeLabel="Close notifications" bodyClassName="gap-0 p-0">
            {list === undefined ? (
                <Loading label="Loading notifications">
                    <SkeletonRows count={5} className="rounded-none border-0" />
                </Loading>
            ) : list.length === 0 ? (
                <EmptyState icon={<Icon icon={Bell} size={20} />} title="No notifications yet" body="You'll see updates about your submissions and payouts here." />
            ) : (
                <>
                    <div className="sticky top-0 z-10 flex min-h-[60px] flex-wrap items-center justify-between gap-3 border-b border-r1-line bg-r1-paper px-5 py-3 sm:px-6">
                        <Segmented
                            label="Show"
                            value={filter}
                            onChange={setFilter}
                            options={[
                                { value: "all", label: "All" },
                                {
                                    value: "unread",
                                    label: (
                                        <>
                                            Unread <span className="t-count">{unread.length}</span>
                                        </>
                                    ),
                                },
                            ]}
                        />
                        {unread.length > 0 ? (
                            <Button variant="ghost" size="sm" onClick={markAll} disabled={busy} aria-busy={busy}>
                                <Icon icon={Check} />
                                Mark all read
                            </Button>
                        ) : (
                            <span className="t-meta">Everything is read</span>
                        )}
                        {error && (
                            <p className="t-error w-full" role="alert">
                                {error}
                            </p>
                        )}
                    </div>
                    {shown.length > 0 ? (
                        <List>
                            {shown.map((n) => (
                                <NotificationRow key={n._id} n={n} onOpen={openOne} />
                            ))}
                        </List>
                    ) : (
                        <EmptyState
                            icon={<Icon icon={Bell} size={20} />}
                            title="You're all caught up"
                            body={caughtUp}
                            action={<Button onClick={() => setFilter("all")}>Show all notifications</Button>}
                        />
                    )}
                    <span className="sr-only" role="status">
                        {said}
                    </span>
                </>
            )}
        </Drawer>
    );
}

/**
 * Unread: gold dot and a bold title; read: grey dot, regular weight, and the
 * state said in words for screen readers. The body says what the title only
 * names ("Submission Approved!" → which one), so it stays, clipped to two lines.
 */
function NotificationRow({ n, onOpen }: { n: Notification; onOpen: (n: Notification) => void }) {
    const href = destinationOf(n);
    const inner = (
        <>
            <Dot tone={n.read ? "off" : "attn"} className="mt-1.5" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={n.read ? "t-body" : "t-body font-semibold text-r1-ink"}>
                    <span className="sr-only">{n.read ? "Read" : "Unread"}: </span>
                    {n.title}
                </span>
                {n.body && <span className="t-meta line-clamp-2">{n.body}</span>}
                <span className="t-meta t-num">{shortDate(n.sentAt)}</span>
            </span>
        </>
    );
    const cls = "min-h-16 items-start px-5 sm:px-6";
    return href ? (
        <RowLink href={href} className={cls} onClick={() => onOpen(n)}>
            {inner}
        </RowLink>
    ) : (
        <RowButton className={cls} onClick={() => onOpen(n)}>
            {inner}
        </RowButton>
    );
}
