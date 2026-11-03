import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { LinkTabs } from "@/components/r1";
import { OPERATOR } from "@/lib/contact";
import styles from "./AuthFrame.module.css";

/**
 * Shared presentation for password, email-code and account recovery screens.
 * Auth state and providers stay with each existing form.
 */
export function AuthFrame({
    title,
    sub,
    tabs,
    foot,
    eyebrow = "WELCOME TO TENDSO",
    children,
}: {
    title: ReactNode;
    sub?: ReactNode;
    /** <AuthTabs>, on the two screens that have them (sign in, create account). */
    tabs?: ReactNode;
    /** An extra line under the card, above the operator line. */
    foot?: ReactNode;
    eyebrow?: string;
    children: ReactNode;
}) {
    return (
        <div className={`r1 ${styles.page}`}>
            <a className={styles.skip} href="#auth-main">Skip to account access</a>
            <header className={styles.header}>
                <Link href="/" className={styles.brand} aria-label="Tendso home"><Image src="/v2/brand/mark-ink-256.png" alt="" width={32} height={32} /><span>tendso</span></Link>
                <Link href="/" className={styles.back} aria-label="Back to site"><ArrowLeft size={17} aria-hidden="true" /><span>Back to site</span></Link>
            </header>
            <main className={styles.main} id="auth-main" tabIndex={-1}>
                <div className={styles.heading}><p className={styles.eyebrow}>{eyebrow}</p><h1>{title}</h1>{sub ? <p className={styles.subtitle}>{sub}</p> : null}</div>
                <section className={styles.card} aria-label="Account access">{tabs}{children}</section>
                <div className={styles.foot}>{foot}<p className={styles.operator}>Tendso is operated by {OPERATOR}.<br />Trouble signing in? <Link href="/knowledge">Get help</Link></p></div>
            </main>
        </div>
    );
}

/**
 * Sign in | Create account. Two routes, so the tabs are links: the current one
 * carries aria-current, and each keeps its own address for emails and the app
 * to link to.
 */
export function AuthTabs({ current }: { current: "signin" | "create" }) {
    return (
        <div className={styles.tabs}>
            <LinkTabs
                label="Sign in or create an account"
                current={current === "signin" ? "/login" : "/signup"}
                tabs={[
                    { href: "/login", label: "Sign in" },
                    { href: "/signup", label: "Create account" },
                ]}
            />
        </div>
    );
}

/** Shared form spacing, including the custom password and account-recovery forms. */
export const AUTH_BODY = styles.body;
