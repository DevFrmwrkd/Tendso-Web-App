import Link from 'next/link';
import { ArrowUpRight, CircleHelp } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './PaymentShell.module.css';

/** Public, token-scoped payment chrome. No owner session or workspace queries. */
export function PaymentShell({ children }: { children: ReactNode }) {
    return <div className={`r1 ${styles.shell}`}>
        <a href="#payment-main" className={styles.skip}>Skip to payment details</a>
        <header className={styles.header}>
            <div className={styles.headerInner}>
                <Link href="/" className={styles.brand} aria-label="Tendso home">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/v2/brand/mark-ink-256.png" alt="" width={30} height={30} />
                    <span>tendso</span>
                    <span className={styles.context}>Website payment</span>
                </Link>
                <nav aria-label="Payment support" className={styles.headerNav}>
                    <Link href="/knowledge" className={styles.help}><CircleHelp size={17} aria-hidden="true" /><span>Help & support</span></Link>
                </nav>
            </div>
        </header>
        <main className={styles.main} id="payment-main" tabIndex={-1}>{children}</main>
        <footer className={styles.footer}>
            <p>Questions about your payment? <Link href="/contact">Contact the team <ArrowUpRight size={13} aria-hidden="true" /></Link></p>
            <nav aria-label="Payment information"><Link href="/privacy-policy">Privacy</Link><Link href="/terms-of-service">Terms</Link></nav>
        </footer>
    </div>;
}

export function PaymentPageHeader({ title, subtitle, eyebrow = 'WEBSITE PAYMENT', action }: {
    title: ReactNode; subtitle?: ReactNode; eyebrow?: string; action?: ReactNode;
}) {
    return <header className={styles.pageHeader}>
        <div className={styles.pageTitles}>
            {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
            <h1>{title}</h1>
            {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </div>
        {action ? <div className={styles.pageAction}>{action}</div> : null}
    </header>;
}
