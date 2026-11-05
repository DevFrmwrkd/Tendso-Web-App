"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type MouseEvent, type ReactNode } from "react";
import { ArrowUpRight, ChevronRight, CircleHelp, Menu, ShieldCheck } from "lucide-react";
import { Avatar } from "@/components/r1/Avatar";
import { Drawer } from "@/components/r1/Overlay";
import { NavItem, type NavLinkEntry, type SidebarProps } from "@/components/r1/Shell";
import AdminViewBar from "./AdminViewBar";
import styles from "./AdminShell.module.css";

function entryIsCurrent(pathname: string, item: NavLinkEntry) {
    if (item.isCurrent) return item.isCurrent(pathname);
    return [item.href, ...(item.alsoCurrent ?? [])].some(path => item.exact ? pathname === path : pathname === path || pathname.startsWith(`${path}/`));
}

function Brand({ href, role }: { href: string; role: string }) {
    return <Link className={styles.brand} href={href} aria-label={`Tendso ${role}`}>
        <Image src="/v2/brand/mark-ink-256.png" width={33} height={33} alt="" priority />
        <span>tendso<span className={styles.brandRole}>{role}</span></span>
    </Link>;
}

function Navigation({ sidebar, pathname, mobile = false }: { sidebar: SidebarProps; pathname: string; mobile?: boolean }) {
    return <aside className={`${styles.sidebar} ${mobile ? styles.mobileSidebar : ''}`} aria-label="Main navigation">
        <Brand href={sidebar.homeHref} role={sidebar.roleLabel ?? 'Admin'} />
        <div className={styles.navIntro}><span className={styles.workspaceDot} />Your workspace</div>
        <nav className={styles.navigation} aria-label="Sections">
            {sidebar.items.map((item, index) => item === 'separator'
                ? <div className={styles.navSection} key={`group-${index}`}><span>Manage & support</span></div>
                : <NavItem key={item.href} entry={item} pathname={pathname} />)}
        </nav>
        <div className={styles.sideFoot}>
            {sidebar.footItems?.map(item => <NavItem key={item.href} entry={item} pathname={pathname} />)}
            <Link className={styles.helpLink} href="/knowledge"><CircleHelp size={18} aria-hidden="true" /><span>Help & guides</span><ArrowUpRight size={15} aria-hidden="true" /></Link>
            {sidebar.me ? <Link href={sidebar.me.href} className={styles.account} aria-current={pathname === sidebar.me.href ? 'page' : undefined}>
                <Avatar name={sidebar.me.name} />
                <span className={styles.person}><strong>{sidebar.me.name}</strong><span>{sidebar.me.meta ?? 'Your account'}</span></span>
                <ChevronRight size={17} aria-hidden="true" />
            </Link> : null}
        </div>
    </aside>;
}

/** Admin-only visual scope. Access decisions remain in AdminLayout and the route gate. */
export default function AdminShell({ sidebar, children }: { sidebar: SidebarProps; children: ReactNode }) {
    const pathname = usePathname() ?? '';
    const [navOpen, setNavOpen] = useState(false);
    const current = sidebar.items.find((item): item is NavLinkEntry => item !== 'separator' && entryIsCurrent(pathname, item));
    const section = pathname === '/profile' ? 'Account' : current?.label ?? 'Workspace';
    const closeOnLink = (event: MouseEvent<HTMLDivElement>) => {
        if ((event.target as HTMLElement).closest('a')) setNavOpen(false);
    };
    return <div className={`r1 ${styles.shell}`} data-admin-workspace={sidebar.roleLabel ?? 'Admin'}>
        <a href="#admin-main" className={styles.skip}>Skip to workspace</a>
        <div className={styles.desktopNav}><Navigation sidebar={sidebar} pathname={pathname} /></div>
        <div className={styles.mainColumn}>
            <header className={styles.header}>
                <div className={styles.mobileBrand}><Brand href={sidebar.homeHref} role={sidebar.roleLabel ?? 'Admin'} /></div>
                <div className={styles.breadcrumb}><span>Workspace</span><ChevronRight size={15} aria-hidden="true" /><strong>{section}</strong></div>
                <div className={styles.headerTools}>
                    <span className={styles.role}><ShieldCheck size={15} aria-hidden="true" />{sidebar.roleLabel ?? 'Admin'} workspace</span>
                    <AdminViewBar />
                    <button type="button" className={styles.menuButton} aria-label="Open navigation" aria-expanded={navOpen} onClick={() => setNavOpen(true)}><Menu size={23} aria-hidden="true" /></button>
                </div>
            </header>
            <main id="admin-main" className={styles.main} tabIndex={-1}>{children}</main>
            <footer className={styles.footer}><span>Tendso workspace</span><span>Built around the people behind every shop.</span></footer>
        </div>
        <Drawer open={navOpen} onClose={() => setNavOpen(false)} side="left" title="Your workspace" closeLabel="Close navigation" className={styles.navDrawer} bodyClassName={styles.navDrawerBody}>
            <div className={styles.drawerNavigation} onClickCapture={closeOnLink}><Navigation sidebar={sidebar} pathname={pathname} mobile /></div>
        </Drawer>
    </div>;
}
