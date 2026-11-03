"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowUpRight, CircleHelp, LayoutGrid } from "lucide-react";
import type { ReactNode } from "react";
import { useOwnerAuth } from "@/hooks/useOwnerAuth";
import styles from "./OwnerShell.module.css";

/** Shared owner workspace chrome. Each page keeps its ownership gate. */
export function OwnerShell({ children }: { children: ReactNode }) {
    const pathname = usePathname() ?? "";
    const { owner } = useOwnerAuth();
    const name = owner?.name?.trim() || owner?.email || "Your account";
    const initial = (owner?.name?.trim() || owner?.email || "Y").charAt(0).toUpperCase();
    const accountPage = pathname === "/profile" || pathname.startsWith("/profile/");
    return <div className={`r1 ${styles.shell}`}>
        <a href="#owner-main" className={styles.skip}>Skip to your workspace</a>
        <header className={styles.header}>
            <div className={styles.headerInner}>
                <Link href="/my-business" className={styles.brand} aria-label="Tendso business workspace">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/v2/brand/mark-ink-256.png" alt="" width={30} height={30} />
                    <span>tendso</span><span className={styles.workspace}>For your business</span>
                </Link>
                <nav className={styles.nav} aria-label="Business workspace">
                    <Link className={styles.navLink} href="/my-business" aria-current={!accountPage ? "page" : undefined}><LayoutGrid size={17} aria-hidden="true" />My businesses</Link>
                    <Link className={styles.navLink} href="/knowledge"><CircleHelp size={17} aria-hidden="true" />Help & support</Link>
                </nav>
                <Link className={styles.account} href="/profile" aria-label={`Account for ${name}`} aria-current={accountPage ? "page" : undefined}>
                    <span className={styles.avatar} aria-hidden="true">{initial}</span><span className={styles.accountName}>{name}</span><ArrowUpRight size={15} aria-hidden="true" />
                </Link>
            </div>
        </header>
        <main className={styles.main} id="owner-main" tabIndex={-1}>{children}</main>
        <footer className={styles.footer}><p>Your business. Your website. One place to keep it moving.</p><div><Link href="/knowledge">Get help</Link><Link href="/privacy-policy">Privacy</Link><Link href="/terms-of-service">Terms</Link></div></footer>
    </div>;
}

export function OwnerPageHeader({ title, subtitle, back = false, action }: { title: ReactNode; subtitle: string; back?: boolean; action?: ReactNode }) {
    return <header className={styles.pageHeader}><div className={styles.pageTitles}>
        {back ? <Link className={styles.back} href="/my-business"><ArrowLeft size={16} aria-hidden="true" />All businesses</Link> : <p className={styles.eyebrow}>YOUR BUSINESS WORKSPACE</p>}
        <h1>{title}</h1><p className={styles.subtitle}>{subtitle}</p>
    </div>{action ? <div className={styles.pageAction}>{action}</div> : null}</header>;
}
