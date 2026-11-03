"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Bell, CalendarDays, Home, LayoutGrid } from "lucide-react";
import { Component, type ReactNode } from "react";
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { OwnerWebScopeProvider, useOwnerWebScope } from '@/hooks/useOwnerWebScope';
import styles from "./OwnerShell.module.css";

/** Shared owner workspace chrome. Each page keeps its ownership gate. */
export function OwnerShell({ children }: { children: ReactNode }) {
    return <OwnerWebScopeProvider><ConnectedOwnerShell>{children}</ConnectedOwnerShell></OwnerWebScopeProvider>;
}

function ConnectedOwnerShell({ children }: { children: ReactNode }) {
    const scope = useOwnerWebScope();
    const notificationsActive = (usePathname() ?? '').startsWith('/my-business/notifications');
    return <OwnerShellView key={scope.scopeKey} name={scope.owner?.name?.trim() || scope.owner?.email || 'Your account'}
        notificationSlot={<OwnerInboxBoundary key={scope.scopeKey} fallback={<OwnerInboxLink active={notificationsActive} />}>
            <ConnectedOwnerInboxLink active={notificationsActive} />
        </OwnerInboxBoundary>}>{children}</OwnerShellView>;
}

/** An optional unread count must never take down the owner navigation. */
class OwnerInboxBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function ConnectedOwnerInboxLink({ active }: { active: boolean }) {
    const scope = useOwnerWebScope();
    const inbox = useQuery(api.ownerInbox.list, scope.ready && scope.userId ? { clerkId: scope.userId } : 'skip');
    const unread = scope.ready && inbox?.actorClerkId === scope.userId && inbox.ownerId === scope.owner?._id ? inbox.unreadCount : undefined;
    return <OwnerInboxLink active={active} unreadCount={unread} />;
}

/** Pure bell presentation, also used when the optional unread query fails. */
export function OwnerInboxLink({ href = '/my-business/notifications', active = false, unreadCount }: { href?: string; active?: boolean; unreadCount?: number }) {
    return <Link className={styles.inbox} href={href} aria-current={active ? 'page' : undefined}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}><Bell size={21} aria-hidden="true" />
        {unreadCount ? <span className={styles.unread}>{unreadCount > 99 ? '99+' : unreadCount}</span> : null}</Link>;
}

export type OwnerWebSection = 'today' | 'businesses' | 'visits' | 'notifications';

/** Auth-free presentation shared by the owner workspace and admin samples. */
export function OwnerShellView({ children, name = "Your account", preview = false, previewSection = 'businesses', unreadCount, notificationSlot }: {
    children: ReactNode; name?: string; preview?: boolean; previewSection?: OwnerWebSection; unreadCount?: number; notificationSlot?: ReactNode;
}) {
    const pathname = usePathname() ?? "";
    const label = name.trim() || "Your account";
    const initial = label.charAt(0).toUpperCase();
    const accountPage = pathname === "/profile" || pathname.startsWith("/profile/");
    const section: OwnerWebSection = preview ? previewSection : pathname.startsWith('/my-business/visits') ? 'visits'
        : pathname.startsWith('/my-business/notifications') ? 'notifications' : pathname === '/my-business/today' ? 'today' : 'businesses';
    const href = (value: OwnerWebSection) => preview ? `/admin/preview/owner?section=${value}`
        : value === 'businesses' ? '/my-business' : `/my-business/${value}`;
    const homeHref = href('today');
    const identity = <><span className={styles.avatar} aria-hidden="true">{initial}</span><span className={styles.accountName}>{label}</span><ArrowUpRight size={15} aria-hidden="true" /></>;
    return <div className={`r1 ${styles.shell}`}>
        <a href="#owner-main" className={styles.skip}>Skip to your workspace</a>
        <header className={styles.header}>
            <div className={styles.headerInner}>
                <Link href={homeHref} className={styles.brand} aria-label="Tendso business workspace">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/v2/brand/mark-ink-256.png" alt="" width={30} height={30} />
                    <span>tendso</span><span className={styles.workspace}>For your business</span>
                </Link>
                <nav className={styles.nav} aria-label="Business workspace">
                    <Link className={styles.navLink} href={href('today')} aria-current={!accountPage && section === 'today' ? 'page' : undefined}><Home size={17} aria-hidden="true" />Today</Link>
                    <Link className={styles.navLink} href={href('businesses')} aria-current={!accountPage && section === 'businesses' ? 'page' : undefined}><LayoutGrid size={17} aria-hidden="true" />Businesses</Link>
                    <Link className={styles.navLink} href={href('visits')} aria-current={!accountPage && section === 'visits' ? 'page' : undefined}><CalendarDays size={17} aria-hidden="true" />Visits</Link>
                </nav>
                <div className={styles.headerActions}>
                    {notificationSlot ?? <OwnerInboxLink href={href('notifications')} active={section === 'notifications'} unreadCount={unreadCount} />}
                    {preview ? <button type="button" className={styles.account} aria-label={`Sample account for ${label}`} disabled>{identity}</button>
                        : <Link className={styles.account} href="/profile" aria-label={`Account for ${label}`} aria-current={accountPage ? "page" : undefined}>{identity}</Link>}
                </div>
            </div>
        </header>
        <main className={styles.main} id="owner-main" tabIndex={-1}>{children}</main>
        <footer className={styles.footer}><p>Your business. Your website. One place to keep it moving.</p>{preview ? <p>Sample business workspace · Use View as above to return to admin.</p>
            : <div><Link href="/knowledge">Get help</Link><Link href="/privacy-policy">Privacy</Link><Link href="/terms-of-service">Terms</Link></div>}</footer>
    </div>;
}

export function OwnerPageHeader({ title, subtitle, back = false, action, preview = false, backHref, backLabel = 'All businesses' }: {
    title: ReactNode; subtitle: string; back?: boolean; action?: ReactNode; preview?: boolean; backHref?: string; backLabel?: string;
}) {
    return <header className={styles.pageHeader}><div className={styles.pageTitles}>
        {back ? <Link className={styles.back} href={backHref ?? (preview ? "/admin/preview/owner?section=businesses#businesses" : "/my-business")}><ArrowLeft size={16} aria-hidden="true" />{backLabel}</Link> : <p className={styles.eyebrow}>YOUR BUSINESS WORKSPACE</p>}
        <h1>{title}</h1><p className={styles.subtitle}>{subtitle}</p>
    </div>{action ? <div className={styles.pageAction}>{action}</div> : null}</header>;
}
