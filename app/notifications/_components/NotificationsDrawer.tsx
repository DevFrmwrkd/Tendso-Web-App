"use client";

import { useUser } from "@clerk/nextjs";
import { useConvex, useConvexAuth, useMutation, useQuery } from "convex/react";
import { ArrowLeft, Bell, Check } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { oldestAwaitingPayment, ownerFirstName, payoutOf, shortDate, submissionHref } from "@/app/dashboard/_lib/home";
import { Button, ButtonLink, Dot, Drawer, EmptyState, Icon, List, Loading, RowButton, Segmented, SkeletonRows } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { CREATOR_PAYOUTS_HREF, CREATOR_PORTAL_HREF } from "@/lib/v2/creatorPortalNavigation";

type Notification = Doc<"notifications">;
type Filter = "all" | "unread";
type Creator = Doc<"creators">;

const isFieldAgent = (creator: Creator) => !creator.role || creator.role === "creator";

/** Notification payloads can select known internal destinations, never arbitrary URLs. */
export function notificationDestination(notification: Notification, creator: Creator): { href: string; label: string } | null {
    const data = notification.data && typeof notification.data === "object" ? notification.data : {};
    const submissionId = typeof data.submissionId === "string" ? data.submissionId.trim() : "";
    const payout = /^(withdrawal|payout)(_|$)/.test(notification.type);
    if (creator.role === "affiliate") {
        if (payout) return { href: CREATOR_PAYOUTS_HREF, label: "View payouts" };
        if (submissionId) return { href: `${CREATOR_PORTAL_HREF}#pt-shops`, label: "View your shops" };
        return null;
    }
    if (!isFieldAgent(creator)) return null;
    if (data.showCertificate === true && creator.certifiedAt && !creator.rejectedAt) return { href: "/profile?certificate=1", label: "View certificate" };
    if (typeof data.articleSlug === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,159}$/.test(data.articleSlug)) {
        return { href: `/knowledge/${encodeURIComponent(data.articleSlug)}`, label: "Read article" };
    }
    if (submissionId) return { href: submissionHref(submissionId), label: "View submission" };
    return payout ? { href: "/wallet", label: "View payouts" } : null;
}

/** The account-keyed inbox unmounts on close, logout or account change, clearing selected private text. */
export function NotificationsDrawer({ open, onClose, creator }: { open: boolean; onClose: () => void; creator: Creator | null | undefined }) {
    const { user, isLoaded, isSignedIn } = useUser();
    const { isAuthenticated, isLoading } = useConvexAuth();
    const ready = isLoaded && isSignedIn && !isLoading && isAuthenticated && !!user;
    const account = ready && creator?.clerkId === user.id && !creator.isDeleted && creator.status !== "deleted" ? creator : null;
    return <Drawer open={open} onClose={onClose} title="Notifications" meta="What changed?" closeLabel="Close notifications" bodyClassName="gap-0 p-0">
        {open && (account ? <NotificationInbox key={`${account.clerkId}:${account._id}:${account.status}`} creator={account} onClose={onClose} />
            : !isLoaded || isLoading || ready && creator === undefined ? <Loading label="Loading notifications"><SkeletonRows count={5} className="rounded-none border-0" /></Loading>
                : <EmptyState icon={<Icon icon={Bell} size={20} />} title={ready ? "No notifications available" : "Sign in to see notifications"} body={ready ? "Your account notifications will appear here." : "Sign in with your account to read your updates."} />)}
    </Drawer>;
}

function NotificationInbox({ creator, onClose }: { creator: Creator; onClose: () => void }) {
    const notifications = useQuery(api.notifications.getByCreator, { creatorId: creator._id });
    // This payment hint belongs to field agents. Affiliates need no private submission subscription.
    const submissions = useQuery(api.submissions.getByCreatorId, isFieldAgent(creator) ? { creatorId: creator._id } : "skip");
    const markAsRead = useMutation(api.notifications.markAsRead);
    const markAllAsRead = useMutation(api.notifications.markAllAsRead);
    const [filter, setFilter] = useState<Filter>("all");
    const [selected, setSelected] = useState<Notification | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [said, setSaid] = useState("");
    const alive = useRef(true);
    const activeSelection = useRef<Notification["_id"] | null>(null);
    const rowPrefix = useId();
    const returnTo = useRef<string | null>(null);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    useEffect(() => {
        if (!selected && returnTo.current && typeof document !== "undefined") {
            const target = document.getElementById(`${rowPrefix}-${returnTo.current}`) ?? document.querySelector<HTMLButtonElement>('dialog[open] button[aria-label="Close notifications"]');
            target?.focus();
        }
    }, [selected, rowPrefix]);

    const list = notifications?.filter(notification => notification.creatorId === creator._id);
    const unread = list?.filter(notification => !notification.read) ?? [];
    const shown = filter === "unread" ? unread : list ?? [];

    const markOne = (notification: Notification) => {
        if (notification.read || notification.creatorId !== creator._id) return;
        void markAsRead({ id: notification._id }).catch(() => {
            if (alive.current && activeSelection.current === notification._id) setError("Could not mark this message as read. You can still read it.");
        });
    };
    const openOne = (notification: Notification) => {
        if (notification.creatorId !== creator._id) return;
        setError(null);
        activeSelection.current = notification._id;
        returnTo.current = notification._id;
        setSelected(notification);
        markOne(notification);
    };
    const markAll = async () => {
        if (busy || !unread.length) return;
        const count = unread.length;
        setBusy(true);
        setError(null);
        try {
            await markAllAsRead({ creatorId: creator._id });
            if (alive.current) setSaid(count === 1 ? "1 marked as read" : `${count} marked as read`);
        } catch {
            if (alive.current && activeSelection.current === null) setError("Could not mark them as read. Try again.");
        } finally {
            if (alive.current) setBusy(false);
        }
    };
    const waiting = submissions ? oldestAwaitingPayment(submissions) : null;
    const payout = waiting ? payoutOf(waiting) : null;
    const caughtUp = waiting
        ? `Nothing unread. We'll tell you here when ${ownerFirstName(waiting.ownerName)} pays for ${waiting.businessName?.trim() || "your site"}${payout ? ` and your ${payout} lands` : ""}.`
        : "Nothing unread. We'll tell you here when something changes.";

    if (selected) return <>
        <div className="sticky top-0 z-10 border-b border-r1-line bg-r1-paper px-5 py-3 sm:px-6">
            <Button variant="ghost" size="sm" onClick={() => { activeSelection.current = null; setSelected(null); setError(null); }}><Icon icon={ArrowLeft} />Back to notifications</Button>
        </div>
        {error ? <div className="flex flex-col items-start gap-2 px-5 pt-4 sm:px-6"><p className="t-error" role="alert">{error}</p><Button size="sm" onClick={() => { setError(null); markOne(selected); }}>Retry marking read</Button></div> : null}
        <NotificationDetail key={selected._id} notification={selected} creator={creator} onNavigate={onClose} />
    </>;

    if (list === undefined) return <Loading label="Loading notifications"><SkeletonRows count={5} className="rounded-none border-0" /></Loading>;
    if (!list.length) return <EmptyState icon={<Icon icon={Bell} size={20} />} title="No notifications yet" body={isFieldAgent(creator) ? "You'll see updates about your submissions and payouts here." : "Updates about your earnings, team and payouts appear here."} />;
    return <>
        <div className="sticky top-0 z-10 flex min-h-[60px] flex-wrap items-center justify-between gap-3 border-b border-r1-line bg-r1-paper px-5 py-3 sm:px-6">
            <Segmented label="Show" value={filter} onChange={setFilter} options={[
                { value: "all", label: "All" },
                { value: "unread", label: <>Unread <span className="t-count">{unread.length}</span></> },
            ]} />
            {unread.length ? <Button variant="ghost" size="sm" onClick={markAll} disabled={busy} aria-busy={busy}><Icon icon={Check} />Mark all read</Button> : <span className="t-meta">Everything is read</span>}
            {error ? <p className="t-error w-full" role="alert">{error}</p> : null}
        </div>
        {shown.length ? <List>{shown.map(notification => <NotificationRow key={notification._id} id={`${rowPrefix}-${notification._id}`} notification={notification} onOpen={openOne} />)}</List>
            : <EmptyState icon={<Icon icon={Bell} size={20} />} title="You're all caught up" body={caughtUp} action={<Button onClick={() => setFilter("all")}>Show all notifications</Button>} />}
        <span className="sr-only" role="status">{said}</span>
    </>;
}

type DetailState = { status: "loading" | "error" | "missing" } | { status: "ready"; notification: Notification };

function NotificationDetail({ notification, creator, onNavigate }: { notification: Notification; creator: Creator; onNavigate: () => void }) {
    const convex = useConvex();
    const [state, setState] = useState<DetailState>({ status: "loading" });
    const [attempt, setAttempt] = useState(0);
    const heading = useRef<HTMLHeadingElement>(null);
    useEffect(() => { heading.current?.focus(); }, []);
    useEffect(() => {
        let current = true;
        setState({ status: "loading" });
        void (async () => {
            try {
                const details = await convex.query(api.notifications.getDetails, { id: notification._id });
                if (!current) return;
                if (!details) setState({ status: "missing" });
                else if (details._id === notification._id && details.creatorId === creator._id) setState({ status: "ready", notification: details });
                else setState({ status: "error" });
            } catch { if (current) setState({ status: "error" }); }
        })();
        return () => { current = false; };
    }, [convex, notification._id, creator._id, attempt]);
    const message = state.status === "ready" ? state.notification : notification;
    const destination = state.status === "missing" ? null : notificationDestination(message, creator);
    return <article className="flex min-w-0 flex-col gap-4 p-5 sm:p-6" aria-label="Full notification">
        <p className="t-meta t-num">{new Date(message.sentAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</p>
        <h3 ref={heading} tabIndex={-1} className="t-h2 [overflow-wrap:anywhere]">{message.title}</h3>
        {state.status === "loading" && notification.data?.announcementId ? <p className="t-meta" role="status">Loading original announcement…</p> : null}
        {state.status === "error" ? <div className="flex flex-col items-start gap-2"><p className="t-error" role="alert">Could not load the full message. You can still read the notification below.</p><Button size="sm" onClick={() => setAttempt(value => value + 1)}>Retry</Button></div> : null}
        {state.status === "missing" ? <p className="t-meta" role="status">This notification is no longer available. The copy below was already in your inbox.</p> : null}
        <p className="t-body whitespace-pre-wrap [overflow-wrap:anywhere]" data-testid="notification-full-body">{message.body}</p>
        {destination ? <div className="flex flex-wrap gap-3"><ButtonLink href={destination.href} onClick={onNavigate}>{destination.label}</ButtonLink></div> : null}
    </article>;
}

function NotificationRow({ id, notification, onOpen }: { id: string; notification: Notification; onOpen: (notification: Notification) => void }) {
    return <RowButton id={id} className="min-h-16 items-start px-5 sm:px-6" onClick={() => onOpen(notification)}>
        <Dot tone={notification.read ? "off" : "attn"} className="mt-1.5" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className={notification.read ? "t-body" : "t-body font-semibold text-r1-ink"}><span className="sr-only">{notification.read ? "Read" : "Unread"}: </span>{notification.title}</span>
            {notification.body ? <span className="t-meta line-clamp-2">{notification.body}</span> : null}
            <span className="t-meta t-num">{shortDate(notification.sentAt)}</span>
        </span>
    </RowButton>;
}
