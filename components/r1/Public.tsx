"use client";

import type { LucideIcon } from "lucide-react";
import { Menu } from "lucide-react";
import Link from "next/link";
import { useState, type MouseEvent, type ReactNode } from "react";

import { useT, type Lang } from "@/components/landing/i18n";
import { SUPPORT_EMAIL } from "@/lib/contact";

import { Button, ButtonLink } from "./Button";
import { cx } from "./cx";
import { Icon } from "./Icon";
import { Logo } from "./Logo";
import { Drawer } from "./Overlay";
import { Segmented } from "./Tabs";

/*
 * Public pages: Landing, For creators, Help Center, OTR, Legal.
 * Funnels (Start, Pay, Sign in, Certification, Book a call) use the funnel
 * header instead: the wordmark and one quiet exit, no navigation.
 *
 * Copy comes from useT(), so on a page inside <LanguageProvider> the header
 * and footer follow the visitor's EN/TL choice, and anywhere else they read
 * in English.
 */

export type PublicSection = "how" | "sites" | "price" | "creators" | "help";

const YEAR = new Date().getFullYear();

function LangSwitch({ className }: { className?: string }) {
    const { t, lang, setLang } = useT();
    return (
        <Segmented<Lang>
            className={className}
            label={t("r1.lang")}
            value={lang}
            onChange={setLang}
            options={[
                { value: "en", label: "EN" },
                { value: "tl", label: "TL" },
            ]}
        />
    );
}

/** The site header: wordmark, the five sections, Sign in and Get a website. A menu drawer on a phone. */
export function PublicHeader({
    current,
    showLang = false,
    actions,
    className,
}: {
    /** The section this page is, so its link carries aria-current. */
    current?: PublicSection;
    /** The EN/TL switch. Only on pages inside <LanguageProvider>. */
    showLang?: boolean;
    /** Replace Sign in / Get a website (a signed-in creator in the Help Center gets "Back to my home"). */
    actions?: ReactNode;
    className?: string;
}) {
    const { t } = useT();
    const [menuOpen, setMenuOpen] = useState(false);
    const links: { key: PublicSection; href: string; label: string }[] = [
        { key: "how", href: "/#how", label: t("r1.nav.how") },
        { key: "sites", href: "/#sites", label: t("r1.nav.sites") },
        { key: "price", href: "/#price", label: t("r1.nav.price") },
        { key: "creators", href: "/for-creators", label: t("r1.nav.creators") },
        { key: "help", href: "/knowledge", label: t("r1.nav.help") },
    ];
    const closeOnLink = (e: MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest("a")) setMenuOpen(false);
    };
    return (
        <header className={cx("t-pub-head", className)}>
            <Link href="/" className="flex items-center" aria-label={t("r1.nav.home")}>
                <Logo height={20} priority />
            </Link>
            <nav className="t-pub-nav" aria-label={t("r1.nav.label")}>
                {links.map((l) => (
                    <Link key={l.key} href={l.href} aria-current={current === l.key ? "page" : undefined}>
                        {l.label}
                    </Link>
                ))}
            </nav>
            <div className="t-pub-actions">
                {showLang && <LangSwitch className="max-lg:hidden" />}
                {actions ?? (
                    <>
                        <ButtonLink variant="ghost" href="/login" className="max-lg:hidden">
                            {t("r1.nav.signIn")}
                        </ButtonLink>
                        <ButtonLink variant="primary" href="/start" className="max-sm:h-9 max-sm:px-3 max-sm:text-[13px]">
                            {t("r1.nav.getWebsite")}
                        </ButtonLink>
                    </>
                )}
                <Button variant="ghost" icon className="lg:hidden" aria-label={t("r1.nav.menu")} aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
                    <Icon icon={Menu} size={18} />
                </Button>
            </div>
            <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} title={t("r1.nav.menuTitle")} closeLabel={t("r1.nav.closeMenu")}>
                <div className="flex flex-col gap-6" onClickCapture={closeOnLink}>
                    <nav className="t-nav" aria-label={t("r1.nav.label")}>
                        {links.map((l) => (
                            <Link key={l.key} href={l.href} className="t-nav-item" aria-current={current === l.key ? "page" : undefined}>
                                {l.label}
                            </Link>
                        ))}
                    </nav>
                    {showLang && <LangSwitch className="self-start" />}
                    {!actions && (
                        <ButtonLink href="/login" block>
                            {t("r1.nav.signIn")}
                        </ButtonLink>
                    )}
                </div>
            </Drawer>
        </header>
    );
}

/** A funnel's header: the wordmark and one quiet exit. No navigation. */
export function FunnelHeader({ exit, className }: { exit?: { href: string; label: string; icon?: LucideIcon } | null; className?: string }) {
    const { t } = useT();
    return (
        <header className={cx("t-pub-head is-funnel", className)}>
            <Link href="/" className="flex items-center" aria-label={t("r1.nav.home")}>
                <Logo height={20} priority />
            </Link>
            {exit && (
                <ButtonLink variant="ghost" href={exit.href}>
                    {exit.icon && <Icon icon={exit.icon} />}
                    {exit.label}
                </ButtonLink>
            )}
        </header>
    );
}

export type FooterLink = { href: string; label: string };

/**
 * The public footer.
 *  - "full" (Landing): the wordmark, the blurb and the operator line, then
 *    three columns (Talk to us, Tendso, Help).
 *  - "simple" (everywhere else): the copyright and operator line, a few
 *    links, and optionally the support email.
 */
export function PublicFooter({
    variant = "simple",
    links,
    contact = false,
    className,
}: {
    variant?: "full" | "simple";
    /** "simple" only. Defaults to Privacy, Terms, Help. */
    links?: FooterLink[];
    /** "simple" only: show the support email on the right. */
    contact?: boolean;
    className?: string;
}) {
    const { t } = useT();
    if (variant === "full") {
        return (
            <footer className={cx("t-pub-foot", className)}>
                <div className="flex max-w-[420px] flex-col gap-3">
                    <Logo height={18} className="self-start" />
                    <p className="t-meta">{t("r1.foot.blurb")}</p>
                    <p className="t-meta">{t("r1.foot.operated")}</p>
                    <p className="t-meta">© {YEAR} Tendso</p>
                </div>
                <nav className="t-foot-cols" aria-label={t("r1.foot.label")}>
                    <div className="t-foot-col">
                        <span className="t-label">{t("r1.foot.talk")}</span>
                        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-sm font-medium text-r1-ink">
                            {t("r1.foot.email")}
                        </a>
                        <Link href="/contact">{t("r1.foot.contact")}</Link>
                    </div>
                    <div className="t-foot-col">
                        <span className="t-label">{t("r1.foot.tendso")}</span>
                        <Link href="/#how">{t("r1.nav.how")}</Link>
                        <Link href="/#price">{t("r1.nav.price")}</Link>
                        <Link href="/for-creators">{t("r1.nav.creators")}</Link>
                    </div>
                    <div className="t-foot-col">
                        <span className="t-label">{t("r1.foot.helpCol")}</span>
                        <Link href="/knowledge">{t("r1.foot.helpCenter")}</Link>
                        <Link href="/privacy-policy">{t("r1.foot.privacy")}</Link>
                        <Link href="/terms-of-service">{t("r1.foot.terms")}</Link>
                    </div>
                </nav>
            </footer>
        );
    }
    const footLinks = links ?? [
        { href: "/privacy-policy", label: t("r1.foot.privacy") },
        { href: "/terms-of-service", label: t("r1.foot.terms") },
        { href: "/knowledge", label: t("r1.nav.help") },
    ];
    return (
        <footer className={cx("t-pub-foot", className)}>
            <span>
                © {YEAR} Tendso · {t("r1.foot.operatedShort")}
            </span>
            {footLinks.length > 0 && (
                <nav className="t-foot-links" aria-label={t("r1.foot.label")}>
                    {footLinks.map((l) => (
                        <Link key={l.href + l.label} href={l.href} className="underline underline-offset-[3px]">
                            {l.label}
                        </Link>
                    ))}
                </nav>
            )}
            {contact && (
                <div className="flex flex-col gap-1.5 lg:text-right">
                    <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
                </div>
            )}
        </footer>
    );
}

/** A public page: the r1 ground, a header, one <main>, a footer. */
export function PublicPage({ header, footer, children, className, mainClassName }: { header?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string; mainClassName?: string }) {
    return (
        <div className={cx("r1 flex min-h-dvh flex-col", className)}>
            {header}
            <main id="main" className={cx("flex flex-1 flex-col", mainClassName)}>
                {children}
            </main>
            {footer}
        </div>
    );
}
