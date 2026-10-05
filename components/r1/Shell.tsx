"use client";

import type { LucideIcon } from "lucide-react";
import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type MouseEvent, type ReactNode } from "react";

import { Avatar } from "./Avatar";
import { Button, ButtonLink } from "./Button";
import { cx } from "./cx";
import { Icon } from "./Icon";
import { Logo } from "./Logo";
import { Drawer } from "./Overlay";
import { Dot } from "./Status";
import type { Tone } from "./statusWords";

/*
 * One navigation per role, at real width: a 240px white sidebar with a
 * hairline on the right. Nothing else on a page repeats these links: no top
 * bar on a desk, no breadcrumb, no "Overview" header.
 *
 * On a phone the sidebar folds into a top bar whose menu button opens the
 * same sidebar in a left drawer. (The phone round will redesign this; until
 * then the creator also keeps a bottom tab bar, see <TabBar>.)
 */

/** A count, or a dot plus a count or a word. Gold dot = needs you, red = problem. */
export type NavBadge = { count?: number | null; tone?: Tone; word?: string };

export type NavLinkEntry = {
    href: string;
    label: string;
    icon: LucideIcon;
    badge?: NavBadge | null;
    /** Only the exact path counts as current (a home that prefixes every route). */
    exact?: boolean;
    /** Extra paths that light this item (a merged screen's old routes). */
    alsoCurrent?: string[];
};
export type NavEntry = NavLinkEntry | "separator";

function isCurrent(pathname: string, e: NavLinkEntry): boolean {
    const paths = [e.href, ...(e.alsoCurrent ?? [])];
    return paths.some((p) => (e.exact ? pathname === p : pathname === p || pathname.startsWith(p + "/")));
}

function Badge({ badge }: { badge: NavBadge }) {
    if (badge.count == null && !badge.word && !badge.tone) return null;
    return (
        <span className="t-nav-badge">
            {badge.tone && <Dot tone={badge.tone} />}
            {badge.word ?? (badge.count != null ? badge.count : null)}
        </span>
    );
}

export function NavItem({ entry, pathname }: { entry: NavLinkEntry; pathname: string }) {
    const current = isCurrent(pathname, entry);
    const badge = entry.badge && (entry.badge.count ?? 0) === 0 && !entry.badge.word ? null : entry.badge;
    return (
        <Link href={entry.href} className="t-nav-item" aria-current={current ? "page" : undefined}>
            <Icon icon={entry.icon} size={18} />
            {entry.label}
            {badge && <Badge badge={badge} />}
        </Link>
    );
}

export type SidebarProps = {
    /** Where the wordmark goes: the role's home. */
    homeHref: string;
    /** "Admin" or "Staff", shown beside the wordmark. Creators and owners have none. */
    roleLabel?: string;
    /** The creator's single primary action, under the logo. Owners and admins have none. */
    primary?: { href: string; label: string; icon: LucideIcon };
    items: NavEntry[];
    /** Items pinned to the foot, above the person (the creator's Notifications). */
    footItems?: NavLinkEntry[];
    /** The person at the foot; opens Account. */
    me?: { name: string; meta?: string; href: string } | null;
};

export function Sidebar({ homeHref, roleLabel, primary, items, footItems, me }: SidebarProps) {
    const pathname = usePathname() ?? "";
    return (
        <aside className="t-side" aria-label="Main navigation">
            <Link className="t-brand" href={homeHref}>
                <Logo />
                {roleLabel && <span className="t-brand-role">{roleLabel}</span>}
            </Link>
            {primary && (
                <ButtonLink variant="primary" block href={primary.href}>
                    <Icon icon={primary.icon} />
                    {primary.label}
                </ButtonLink>
            )}
            <nav className="t-nav" aria-label="Sections">
                {items.map((e, i) => (e === "separator" ? <span key={`sep${i}`} className="t-nav-sep" role="separator" /> : <NavItem key={e.href} entry={e} pathname={pathname} />))}
            </nav>
            {(footItems?.length || me) && (
                <div className="t-side-foot">
                    {footItems?.map((e) => <NavItem key={e.href} entry={e} pathname={pathname} />)}
                    {me && (
                        <Link className="t-me" href={me.href} aria-current={isCurrent(pathname, { href: me.href, label: "", icon: Menu }) ? "page" : undefined}>
                            <Avatar name={me.name} />
                            <span className="t-me-text">
                                <span className="t-me-name">{me.name}</span>
                                {me.meta && <span className="t-meta">{me.meta}</span>}
                            </span>
                        </Link>
                    )}
                </div>
            )}
        </aside>
    );
}

/**
 * The app frame: sidebar on a desk; on a phone a top bar whose menu opens the
 * same sidebar in a left drawer. `topbarActions` adds icons to the phone bar
 * (the creator's notifications bell). `tabbar` is the creator's phone tab bar.
 */
export function AppShell({
    sidebar,
    homeHref,
    topbarActions,
    tabbar,
    children,
    className,
    mainClassName,
}: {
    sidebar: SidebarProps;
    homeHref?: string;
    topbarActions?: ReactNode;
    tabbar?: ReactNode;
    children: ReactNode;
    className?: string;
    mainClassName?: string;
}) {
    const [navOpen, setNavOpen] = useState(false);
    const closeOnLink = (e: MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest("a")) setNavOpen(false);
    };
    return (
        <div className={cx("r1 t-shell", tabbar ? "has-tabbar" : undefined, className)}>
            <Sidebar {...sidebar} />
            <div className="t-main-col">
                <header className="t-topbar">
                    <Link className="t-brand px-0" href={homeHref ?? sidebar.homeHref}>
                        <Logo />
                        {sidebar.roleLabel && <span className="t-brand-role">{sidebar.roleLabel}</span>}
                    </Link>
                    <div className="t-topbar-actions">
                        {topbarActions}
                        <Button variant="ghost" icon aria-label="Open navigation" aria-expanded={navOpen} onClick={() => setNavOpen(true)}>
                            <Icon icon={Menu} size={18} />
                        </Button>
                    </div>
                </header>
                <main className={cx("t-main", mainClassName)}>{children}</main>
            </div>
            {tabbar}
            <Drawer open={navOpen} onClose={() => setNavOpen(false)} side="left" title="Menu" closeLabel="Close navigation" bodyClassName="p-0">
                <div className="h-full" onClickCapture={closeOnLink}>
                    <Sidebar {...sidebar} />
                </div>
            </Drawer>
        </div>
    );
}

/** The page's own header: the title, the one question it answers, and at most one primary action (the rest in More). */
export function PageHeader({ title, sub, actions, className }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; className?: string }) {
    return (
        <header className={cx("t-page-head", className)}>
            <div className="t-page-titles">
                <h1 className="t-h1">{title}</h1>
                {sub && <p className="t-sub">{sub}</p>}
            </div>
            {actions && <div className="t-page-actions">{actions}</div>}
        </header>
    );
}

/** The creator's phone tab bar (hidden on a desk, where the sidebar takes over). */
export function TabBar({ items, center }: { items: NavLinkEntry[]; center?: { href: string; label: string; icon: LucideIcon } }) {
    const pathname = usePathname() ?? "";
    const half = Math.ceil(items.length / 2);
    const link = (e: NavLinkEntry) => (
        <Link key={e.href} href={e.href} className="t-tabbar-item" aria-current={isCurrent(pathname, e) ? "page" : undefined}>
            <Icon icon={e.icon} size={20} />
            {e.label}
        </Link>
    );
    return (
        <nav className="r1 t-tabbar" aria-label="Main navigation">
            {items.slice(0, half).map(link)}
            {center && (
                <Link href={center.href} className="t-tabbar-item" aria-label={center.label}>
                    <span className="t-tabbar-new">
                        <Icon icon={center.icon} size={22} />
                    </span>
                </Link>
            )}
            {items.slice(half).map(link)}
        </nav>
    );
}
