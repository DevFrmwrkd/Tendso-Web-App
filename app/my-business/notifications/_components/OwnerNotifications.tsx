"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArrowUpRight, Bell, CalendarDays, CheckCheck, ChevronRight, Globe, MailOpen } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { Drawer } from "@/components/r1/Overlay";
import { api } from "@/convex/_generated/api";
import { useOwnerWebScope } from "@/hooks/useOwnerWebScope";
import type { OwnerSite } from "../../_components/ownerSite";
import styles from "./OwnerNotifications.module.css";

export type OwnerWebInbox = NonNullable<FunctionReturnType<typeof api.ownerInbox.list>>;
export type OwnerWebMessage = OwnerWebInbox["items"][number];
type OwnedSite = Pick<OwnerSite, "submissionId">;
type ReadFailure = { key: string; message: string };

const readFailure = "Could not save read status. Try again when connected.";
const date = (time: number) => new Date(time).toLocaleString("en-PH", {
    timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
});

/** Only an event in the verified owner inbox may choose a workspace destination. */
export function ownerNotificationDestination(item: OwnerWebMessage, inbox: OwnerWebInbox, sites: readonly OwnedSite[]) {
    const owned = inbox.items.find(row => row.key === item.key);
    if (!owned) return null;
    const segment = (value: string) => /^[A-Za-z0-9_-]+$/.test(value) ? encodeURIComponent(value) : null;
    if (owned.visitRequestId) {
        const id = segment(owned.visitRequestId);
        return id ? { href: `/my-business/visits/${id}`, label: "View visit request" } : null;
    }
    if (owned.submissionId && sites.some(site => site.submissionId === owned.submissionId)) {
        const id = segment(owned.submissionId);
        return id ? { href: `/my-business/${id}`, label: "Open business" } : null;
    }
    return null;
}

/** The shell supplies a verified, commit-bound Clerk/owner scope. */
export function OwnerNotifications() {
    const scope = useOwnerWebScope();
    const router = useRouter();
    const params = useSearchParams();
    const rawKey = params.get("eventKey");
    const eventKey = rawKey && rawKey.length <= 512 && !/[\x00-\x1f\x7f]/.test(rawKey) ? rawKey : null;
    const response = useQuery(api.ownerInbox.list, scope.ready && scope.userId ? { clerkId: scope.userId } : "skip");
    const inbox = scope.ready && response?.actorClerkId === scope.userId && response.ownerId === scope.owner?._id ? response : undefined;

    useEffect(() => {
        if (scope.loading || scope.isSignedIn) return;
        const suffix = eventKey ? `?eventKey=${encodeURIComponent(eventKey)}` : "";
        router.replace(`/my-business/sign-in?returnTo=${encodeURIComponent(`/my-business/notifications${suffix}`)}`);
    }, [scope.loading, scope.isSignedIn, eventKey, router]);

    if (scope.error) return <p role="alert" className={styles.error}>{scope.error}</p>;
    if (!scope.ready || !inbox || !scope.userId) return <OwnerNotificationsView inbox={response === null && scope.ready ? null : undefined} />;
    return <OwnerInboxController key={scope.scopeKey} inbox={inbox} sites={scope.sites ?? []}
        clerkId={scope.userId} eventKey={eventKey} isCurrent={scope.isCurrent} />;
}

function OwnerInboxController({ inbox, sites, clerkId, eventKey, isCurrent }: {
    inbox: OwnerWebInbox; sites: readonly OwnedSite[]; clerkId: string; eventKey: string | null; isCurrent: () => boolean;
}) {
    const markRead = useMutation(api.ownerInbox.markRead);
    const markAllRead = useMutation(api.ownerInbox.markAllRead);
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [readError, setReadError] = useState<ReadFailure | null>(null);
    const [allError, setAllError] = useState("");
    const [markingAll, setMarkingAll] = useState(false);
    const [readingKey, setReadingKey] = useState<string | null>(null);
    const [confirmedReads, setConfirmedReads] = useState<Set<string>>(() => new Set());
    const pendingReads = useRef(new Set<string>());
    const allPending = useRef(false);
    const opened = useRef<string | null>(null);
    const mounted = useRef(false);
    useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const current = useCallback(() => mounted.current && isCurrent(), [isCurrent]);
    const verified = inbox.actorClerkId === clerkId;

    const read = useCallback((item: OwnerWebMessage) => {
        if (!current() || !verified || item.read || confirmedReads.has(item.key) || pendingReads.current.has(item.key)
            || !inbox.items.some(row => row.key === item.key)) return;
        pendingReads.current.add(item.key);
        setReadingKey(item.key);
        setReadError(previous => previous?.key === item.key ? null : previous);
        void markRead({ key: item.key, clerkId }).then(() => {
            if (current()) setConfirmedReads(previous => new Set([...previous, item.key]));
        }).catch(() => {
            if (current()) setReadError({ key: item.key, message: readFailure });
        }).finally(() => {
            pendingReads.current.delete(item.key);
            if (current()) setReadingKey(previous => previous === item.key ? null : previous);
        });
    }, [current, verified, confirmedReads, inbox.items, markRead, clerkId]);

    const open = useCallback((item: OwnerWebMessage) => {
        if (!current() || !verified || !inbox.items.some(row => row.key === item.key)) return;
        setSelectedKey(item.key);
        read(item);
    }, [current, verified, inbox.items, read]);

    useEffect(() => {
        if (!eventKey || opened.current === eventKey || !current()) return;
        const item = inbox.items.find(row => row.key === eventKey);
        if (!item) return;
        opened.current = eventKey;
        open(item);
    }, [eventKey, inbox.items, open, current]);

    const all = async () => {
        if (!current() || !verified || allPending.current || !inbox.items.some(item => !item.read && !confirmedReads.has(item.key))) return;
        allPending.current = true;
        setMarkingAll(true); setAllError("");
        try {
            await markAllRead({ clerkId });
            if (current()) {
                setConfirmedReads(previous => new Set([...previous, ...inbox.items.map(item => item.key)]));
                setReadError(null);
            }
        } catch {
            if (current()) setAllError("Could not mark updates read. Please try again.");
        } finally {
            allPending.current = false;
            if (current()) setMarkingAll(false);
        }
    };

    const items = inbox.items.map(item => confirmedReads.has(item.key) ? { ...item, read: true } : item);
    const displayedInbox = { ...inbox, items, unreadCount: items.filter(item => !item.read).length };
    return <OwnerNotificationsView inbox={displayedInbox} sites={sites} selectedKey={selectedKey}
        onOpen={open} onClose={() => setSelectedKey(null)} onRetryRead={read} onMarkAllRead={() => { void all(); }}
        canNavigate={current} markingAll={markingAll} readingKey={readingKey} readError={readError} allError={allError} />;
}

type OwnerNotificationsViewProps = {
    inbox: OwnerWebInbox | null | undefined;
    sites?: readonly OwnedSite[];
    preview?: boolean;
    /** Opens a known sample event without requiring a live inbox controller. */
    initialSelectedKey?: string | null;
    selectedKey?: string | null;
    onOpen?: (item: OwnerWebMessage) => void;
    onClose?: () => void;
    onRetryRead?: (item: OwnerWebMessage) => void;
    onMarkAllRead?: () => void;
    canNavigate?: () => boolean;
    markingAll?: boolean;
    readingKey?: string | null;
    readError?: ReadFailure | null;
    allError?: string;
};

/** Auth-free presentation: preview can open sample details without reading or writing an account. */
export function OwnerNotificationsView({ inbox, sites = [], preview = false, initialSelectedKey, selectedKey, onOpen, onClose,
    onRetryRead, onMarkAllRead, canNavigate, markingAll = false, readingKey, readError, allError }: OwnerNotificationsViewProps) {
    const [filter, setFilter] = useState<"all" | "unread">("all");
    const [localSelection, setLocalSelection] = useState<string | null>(() => initialSelectedKey && inbox?.items.some(item => item.key === initialSelectedKey) ? initialSelectedKey : null);
    const activeKey = selectedKey === undefined ? localSelection : selectedKey;
    const selected = inbox?.items.find(item => item.key === activeKey);
    const visible = inbox?.items.filter(item => filter === "all" || !item.read) ?? [];
    const action = selected && inbox ? ownerNotificationDestination(selected, inbox, sites) : null;
    const detailError = !selected?.read && readError?.key === selected?.key ? readError?.message : null;
    const close = () => { setLocalSelection(null); onClose?.(); };
    const open = (item: OwnerWebMessage) => { if (preview || !onOpen) setLocalSelection(item.key); else onOpen(item); };

    return <div className={styles.workspace}>
        {preview ? <p className={styles.previewNotice}>Sample notifications · Read status and actions are disabled.</p> : null}
        <section className={styles.inbox} aria-label="Business notifications">
            <div className={styles.inboxHead}>
                <div className={styles.titleRow}><span className={styles.headingIcon}><Bell size={21} aria-hidden="true" /></span><div><h2>Your updates</h2><p role="status">{inbox ? inbox.unreadCount ? `${inbox.unreadCount} unread` : "All updates read" : "Your business inbox"}</p></div></div>
                <button type="button" className={styles.markAll} disabled={preview || !onMarkAllRead || !inbox?.unreadCount || markingAll}
                    onClick={preview ? undefined : onMarkAllRead} aria-busy={markingAll}><CheckCheck size={17} aria-hidden="true" />{markingAll ? "Saving…" : "Mark all read"}</button>
            </div>
            {allError ? <p role="alert" className={styles.error}>{allError}</p> : null}
            <div className={styles.filters} role="group" aria-label="Filter notifications">
                <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All updates</button>
                <button type="button" aria-pressed={filter === "unread"} onClick={() => setFilter("unread")}>Unread{inbox?.unreadCount ? <span>{inbox.unreadCount}</span> : null}</button>
            </div>
            {inbox === undefined ? <div className={styles.empty} role="status"><span className={styles.emptyIcon}><Bell size={27} aria-hidden="true" /></span><h3>Loading your updates…</h3><p>Your visits and website updates will appear here.</p></div>
                : inbox === null ? <div className={styles.empty}><span className={styles.emptyIcon}><MailOpen size={27} aria-hidden="true" /></span><h3>Your notifications aren’t available</h3><p>Sign in with your business owner account to see your updates.</p></div>
                : visible.length ? <ul className={styles.list}>{visible.map(item => <li key={item.key}>
                    <button type="button" className={`${styles.message} ${item.read ? "" : styles.unread}`} onClick={() => open(item)}
                        aria-label={`${item.read ? "Read" : "Unread"}: ${item.title}`} aria-haspopup="dialog">
                        <span className={styles.messageIcon}>{item.visitRequestId ? <CalendarDays size={21} aria-hidden="true" /> : item.type === "website_live" ? <Globe size={21} aria-hidden="true" /> : <Bell size={21} aria-hidden="true" />}</span>
                        <span className={styles.messageContent}><span className={styles.messageTitle}>{item.title}</span><span className={styles.messageBody}>{item.body}</span><time dateTime={new Date(item.createdAt).toISOString()}>{date(item.createdAt)}</time></span>
                        <span className={styles.messageEnd}>{!item.read ? <span className={styles.dot} aria-hidden="true" /> : null}<ChevronRight size={18} aria-hidden="true" /></span>
                    </button>
                </li>)}</ul>
                : <div className={styles.empty}><span className={styles.emptyIcon}><MailOpen size={29} aria-hidden="true" /></span><h3>{filter === "unread" ? "You’re all caught up" : "No updates yet"}</h3><p>{filter === "unread" ? "Your unread updates will appear here." : "We’ll keep your visit requests, payments and website updates here."}</p>{filter === "unread" ? <button type="button" className={styles.quietButton} onClick={() => setFilter("all")}>Show all updates</button> : null}</div>}
        </section>
        <aside className={styles.note}><span className={styles.noteIcon}><Bell size={21} aria-hidden="true" /></span><div><h2>Everything stays here</h2><p>Open an update to read the full message. Visiting this page keeps unread updates unread.</p></div></aside>
        <Drawer open={!!selected} onClose={close} title="Update details" closeLabel="Close owner notification" className={styles.drawer} bodyClassName={styles.detail}
            footer={<div className={styles.detailActions}>{action ? preview ? <button type="button" className={styles.primaryButton} disabled>{action.label}<ArrowUpRight size={17} aria-hidden="true" /></button>
                : <Link className={styles.primaryButton} href={action.href} onClick={event => { if (canNavigate && !canNavigate()) { event.preventDefault(); return; } close(); }}>{action.label}<ArrowUpRight size={17} aria-hidden="true" /></Link> : null}<button type="button" className={styles.quietButton} onClick={close}>Close</button></div>}>
            {selected ? <><time dateTime={new Date(selected.createdAt).toISOString()}>{date(selected.createdAt)}</time><h3>{selected.title}</h3><p className={styles.fullBody} data-testid="owner-notification-full-body">{selected.body}</p>
                {detailError ? <div className={styles.readError}><p role="alert">{detailError}</p><button type="button" className={styles.quietButton} disabled={preview || !onRetryRead || readingKey === selected.key}
                    onClick={() => { if (!preview) onRetryRead?.(selected); }} aria-busy={readingKey === selected.key}>{readingKey === selected.key ? "Saving…" : "Retry read status"}</button></div> : null}</> : null}
        </Drawer>
    </div>;
}
