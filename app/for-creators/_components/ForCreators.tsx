"use client";

import { useQuery } from "convex/react";
import {
    ArrowRight,
    ArrowUpRight,
    Banknote,
    Book,
    ChevronRight,
    Clock,
    MapPin,
    Mic,
    Phone,
    Smartphone,
    UserRound,
    Users,
    Wallet,
    type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import type { ReactNode } from "react";

import ChatBot from "@/components/landing/ChatBot";
import { fill, fillText } from "@/components/landing/copy";
import { FaqList, type FaqItem } from "@/components/landing/FaqSection";
import { siteMeta, useFeaturedSites } from "@/components/landing/featuredSites";
import { useT } from "@/components/landing/i18n";
import LiveSitePreview from "@/components/landing/LiveSitePreview";
import { ButtonLink, Card, Highlight, Icon, PublicFooter, PublicHeader, PublicPage, cx, formatMoney } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import { DISCORD_INVITE_URL, OPERATOR } from "@/lib/contact";
import { BASE_PRICE, COMMISSION_RATE, PRICE_CEILING } from "@/lib/pricing";
import { SITE_URL } from "@/lib/seo";

/*
 * /for-creators in the Round 1 look (board: ForCreators). The pitch to the
 * people who visit shops and bring them online: what they earn, the five
 * steps, what they need, real sites, the app, the questions they ask.
 *
 * /for-field-agents and the legacy /creators page now redirect here (same
 * audience). From /for-field-agents this page carries the Discord invite, the
 * "is this legit" answer and the sign-up; the 10-minute call it never linked
 * to is now the second action beside "Start as a creator".
 *
 * PHONE FIRST. Everything is one column on a phone; the board's grids (five
 * steps, three needs, four sites, two panels) come in at 640 / 768 / 1024. The
 * "On this page" row scrolls sideways on a phone instead of wrapping.
 */

/**
 * Where "Start as a creator" goes: the Clerk sign-up, which the SignIn board
 * draws as "Create a creator account". Before Round 1 every action on this page
 * scrolled to the app band (#app) instead; the board puts this button in their
 * place, and the app band stays where it was for /otr's desktop link. (/otr's
 * own earn button still opens a store first; see the note in that page.)
 */
const SIGNUP_HREF = "/signup";
/** The 10-minute call, booked on our own page. Public: the people booking it have no account yet. */
const BOOK_CALL_HREF = "/field-agent/book";
/** "tendso.com/login", from the canonical origin rather than typed out. */
const LOGIN_TEXT = `${new URL(SITE_URL).host}/login`;
/** The creator's share, as a figure (50%). The prose says "half". */
const SHARE = `${Math.round(COMMISSION_RATE * 100)}%`;

/** The board's 1120px column, with phone and tablet sides. */
const WRAP = "mx-auto w-full max-w-[1168px] px-4 sm:px-6";
/** A band: hairline on top, the board's 64px rhythm (48 on a phone). */
const BAND = "border-t border-r1-line py-12 sm:py-16";

function Head({ id, title, sub }: { id: string; title: ReactNode; sub?: ReactNode }) {
    return (
        <div className="flex max-w-[720px] flex-col gap-2">
            <h2 id={id} className="text-2xl font-semibold leading-8 tracking-[-0.01em] text-r1-ink">
                {title}
            </h2>
            {sub && <p className="t-sub">{sub}</p>}
        </div>
    );
}

/** "On this page": the six sections, as plain in-page anchors. */
function JumpNav() {
    const { t } = useT();
    const links: [string, string][] = [
        ["earn", "r1.forCreators.jump.earn"],
        ["how", "r1.forCreators.jump.how"],
        ["need", "r1.forCreators.jump.need"],
        ["sites", "r1.forCreators.jump.sites"],
        ["app", "r1.forCreators.jump.app"],
        ["faq", "r1.forCreators.jump.faq"],
    ];
    return (
        <nav aria-label={t("r1.forCreators.jump.label")} className="border-b border-r1-line">
            <div className={cx(WRAP, "flex h-12 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden")}>
                <span className="flex-none pr-1.5 text-[13px] text-r1-ink-3" aria-hidden="true">
                    {t("r1.forCreators.jump.label")}
                </span>
                {links.map(([id, key]) => (
                    <a
                        key={id}
                        href={`#${id}`}
                        className="inline-flex h-10 flex-none items-center whitespace-nowrap rounded-r1-sm px-2.5 text-[13px] text-r1-ink-2 hover:bg-r1-fill hover:text-r1-ink"
                    >
                        {t(key)}
                    </a>
                ))}
            </div>
        </nav>
    );
}

function Hero() {
    const { t } = useT();
    const facts = [t("r1.forCreators.hero.fact1"), t("r1.forCreators.hero.fact2"), t("r1.forCreators.hero.fact3")];
    return (
        <section aria-labelledby="fc-title" className="py-10 sm:py-14 lg:py-16">
            <div className={cx(WRAP, "grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-16")}>
                <div className="flex min-w-0 flex-col gap-8">
                    <div className="flex flex-col gap-5">
                        <h1
                            id="fc-title"
                            className="t-serif text-balance text-[2.25rem] leading-[2.5rem] text-r1-ink sm:text-5xl sm:leading-[3.25rem] lg:text-[3.5rem] lg:leading-[3.75rem]"
                        >
                            {t("r1.forCreators.hero.title")}
                        </h1>
                        <p className="max-w-[580px] text-[17px] leading-[26px] text-r1-ink-2 lg:text-lg lg:leading-7">
                            {t("r1.forCreators.hero.lede")}
                        </p>
                    </div>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <ButtonLink variant="primary" size="lg" href={SIGNUP_HREF}>
                                {t("r1.forCreators.start")}
                                <Icon icon={ArrowRight} />
                            </ButtonLink>
                            <ButtonLink size="lg" href={BOOK_CALL_HREF}>
                                <Icon icon={Phone} />
                                {t("r1.forCreators.call")}
                            </ButtonLink>
                        </div>
                        <ul className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-[18px] text-r1-ink-3" aria-label={t("r1.forCreators.hero.factsLabel")}>
                            {facts.map((fact, i) => (
                                <li key={fact} className="inline-flex items-center gap-2">
                                    {i > 0 && <span className="h-[3px] w-[3px] flex-none rounded-full bg-r1-ink-4" aria-hidden="true" />}
                                    {fact}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* The page's one highlight: the share, and the only two prices
                    this page names (see Earn). */}
                <Highlight className="flex flex-col gap-4 p-6 sm:p-7">
                    <p className="t-label t-hl-label">{t("r1.forCreators.hero.earnLabel")}</p>
                    <div className="flex flex-col gap-2.5">
                        <p className="t-hero-fig">{SHARE}</p>
                        <p className="text-[15px] leading-[22px] text-r1-ink">{t("r1.forCreators.hero.earnBody")}</p>
                    </div>
                    <hr className="h-px border-0 bg-r1-gold-line" />
                    <p className="t-meta text-r1-ink-2">
                        {fillText(t("r1.forCreators.hero.earnNote"), { c: formatMoney(PRICE_CEILING), b: formatMoney(BASE_PRICE) })}
                    </p>
                </Highlight>
            </div>
        </section>
    );
}

/**
 * Earnings — three facts and no peso earnings.
 *
 * This page used to quote what a creator makes per site (₱500, up to ₱2,500)
 * and the referral bonus. It now says only what is fixed: the website price,
 * how low a creator may discount it, and that half of the sale is theirs. What
 * that half comes to depends on the price they sell at, and a figure on a
 * recruiting page reads as a promise of it. (Theo's decision on the Round 1
 * canvas: no ₱500, no ₱2,500, no ₱1,000 referral figure, no earnings
 * calculator.)
 *
 * The rule matches since 2026-10-06: every creator may price from BASE_PRICE
 * to PRICE_CEILING from their first site (lib/pricing.ts).
 */
function Earn() {
    const { t } = useT();
    const rules: { title: string; body: string; amount: ReactNode }[] = [
        { title: t("r1.forCreators.earn.shareTitle"), body: t("r1.forCreators.earn.shareBody"), amount: SHARE },
        { title: t("r1.forCreators.earn.priceTitle"), body: t("r1.forCreators.earn.priceBody"), amount: formatMoney(PRICE_CEILING) },
        {
            title: t("r1.forCreators.earn.discountTitle"),
            body: t("r1.forCreators.earn.discountBody"),
            amount: (
                <>
                    <span className="mr-1 text-[13px] font-normal tracking-normal text-r1-ink-3">{t("r1.forCreators.earn.asLowAs")}</span>
                    {formatMoney(BASE_PRICE)}
                </>
            ),
        },
    ];
    return (
        <section id="earn" aria-labelledby="fc-earn-title" className={cx(BAND, "bg-r1-fill-2")}>
            <div className={cx(WRAP, "flex flex-col gap-8")}>
                <Head id="fc-earn-title" title={t("r1.forCreators.earn.title")} sub={t("r1.forCreators.earn.sub")} />
                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
                    <div className="t-card overflow-hidden">
                        {rules.map((rule) => (
                            <div
                                key={rule.title}
                                className="flex min-h-[76px] items-center gap-4 border-b border-r1-line-3 px-5 py-4 last:border-b-0 sm:gap-6 sm:px-6"
                            >
                                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <p className="text-[15px] font-medium leading-[22px] text-r1-ink">{rule.title}</p>
                                    <p className="t-meta">{rule.body}</p>
                                </div>
                                <p className="t-num whitespace-nowrap text-right text-[22px] font-semibold leading-7 tracking-[-0.01em] text-r1-ink">
                                    {rule.amount}
                                </p>
                            </div>
                        ))}
                    </div>
                    <Card pad className="flex flex-col gap-2">
                        <h3 className="t-h2">{t("r1.forCreators.earn.paidTitle")}</h3>
                        <p className="t-body">{t("r1.forCreators.earn.paidBody")}</p>
                        {/* Referrals exist; the bonus figure is not quoted (see above). */}
                        <p className="t-meta">{t("r1.forCreators.earn.referral")}</p>
                    </Card>
                </div>
            </div>
        </section>
    );
}

const STEPS: { icon: LucideIcon; key: string; time?: boolean }[] = [
    { icon: UserRound, key: "s1" },
    { icon: Book, key: "s2", time: true },
    { icon: MapPin, key: "s3" },
    { icon: Mic, key: "s4", time: true },
    { icon: Wallet, key: "s5" },
];

/**
 * The five steps. The numbers in them are the app's: five lessons
 * (/training-lessons), a five-question quiz passed with four right
 * (/certification-quiz), about twenty minutes for both.
 */
function Steps() {
    const { t } = useT();
    return (
        <section id="how" aria-labelledby="fc-how-title" className={BAND}>
            <div className={cx(WRAP, "flex flex-col gap-8")}>
                <Head id="fc-how-title" title={t("r1.forCreators.how.title")} sub={t("r1.forCreators.how.sub")} />
                <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    {STEPS.map((step, i) => (
                        <li key={step.key} className="t-card flex flex-col gap-3 p-5">
                            <div className="flex items-center justify-between gap-2 text-r1-ink-3">
                                <span className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full border border-r1-line-2 text-[13px] font-semibold tabular-nums text-r1-ink">
                                    {i + 1}
                                </span>
                                <Icon icon={step.icon} size={18} />
                            </div>
                            <h3 className="text-[15px] font-semibold leading-[22px] text-r1-ink">{t(`r1.forCreators.how.${step.key}.title`)}</h3>
                            <p className="t-body">{t(`r1.forCreators.how.${step.key}.body`)}</p>
                            {step.time && <p className="text-xs leading-4 text-r1-ink-3">{t(`r1.forCreators.how.${step.key}.time`)}</p>}
                        </li>
                    ))}
                </ol>
            </div>
        </section>
    );
}

const NEEDS: { icon: LucideIcon; key: string }[] = [
    { icon: Smartphone, key: "phone" },
    { icon: Clock, key: "time" },
    { icon: Banknote, key: "wise" },
];

function Needs() {
    const { t } = useT();
    return (
        <section id="need" aria-labelledby="fc-need-title" className={BAND}>
            <div className={cx(WRAP, "flex flex-col gap-6")}>
                <Head id="fc-need-title" title={t("r1.forCreators.need.title")} sub={t("r1.forCreators.need.sub")} />
                <ul className="grid gap-4 md:grid-cols-3">
                    {NEEDS.map((need) => (
                        <li key={need.key} className="t-card flex flex-col gap-2.5 p-6">
                            <span className="flex text-r1-ink-3">
                                <Icon icon={need.icon} size={20} />
                            </span>
                            <h3 className="t-h2">{t(`r1.forCreators.need.${need.key}.title`)}</h3>
                            <p className="t-body">{t(`r1.forCreators.need.${need.key}.body`)}</p>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}

/**
 * Four real sites, the same curated list as the landing's grid (the landing
 * shows them all; "See more sites" goes there). Each is a live preview of the
 * real page and opens it.
 */
function Sites() {
    const { t } = useT();
    const sites = useFeaturedSites().slice(0, 4);
    return (
        <section id="sites" aria-labelledby="fc-sites-title" className={cx(BAND, "bg-r1-fill-2")}>
            <div className={cx(WRAP, "flex flex-col gap-6")}>
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
                    <Head id="fc-sites-title" title={t("r1.forCreators.sites.title")} sub={t("r1.forCreators.sites.sub")} />
                    <ButtonLink variant="ghost" href="/#sites" className="-ml-4 flex-none sm:ml-0">
                        {t("r1.forCreators.sites.more")}
                        <Icon icon={ChevronRight} />
                    </ButtonLink>
                </div>
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {sites.map((site, i) => (
                        <li key={`${i}-${site.url}`} className="min-w-0">
                            <a
                                href={site.url}
                                target="_blank"
                                rel="noreferrer"
                                className="t-card group flex h-full flex-col overflow-hidden text-r1-ink transition-colors hover:border-r1-line-2"
                            >
                                <LiveSitePreview url={site.url} name={site.name} className="border-b border-r1-line" />
                                <span className="flex flex-col gap-0.5 px-4 pb-4 pt-3.5">
                                    <span className="inline-flex items-start gap-1.5 text-sm font-medium leading-5 underline-offset-[3px] group-hover:underline">
                                        {site.name}
                                        <Icon icon={ArrowUpRight} className="mt-0.5 flex-none text-r1-ink-3" />
                                    </span>
                                    <span className="t-meta">{siteMeta(site)}</span>
                                </span>
                                <span className="sr-only">({t("r1.landing.sites.newTab")})</span>
                            </a>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}

/**
 * The app and the Discord. `id="app"` is load-bearing: /otr sends a desktop
 * viewer to /for-creators?src=…#app, because a desktop cannot install either
 * store's app. That is also why the Android QR stays from the old download
 * band on a wide screen (the board has no QR; a phone held up to this screen
 * is the way the app gets installed from here).
 *
 * Both store links come from Convex settings, managed by the admin
 * (`app_store_url`, `play_store_url`); each button renders only once its URL
 * is set, and nothing is hardcoded. With neither set, the web app link in the
 * copy is still a way in.
 */
function AppAndDiscord() {
    const { t } = useT();
    const appStoreUrl = useQuery(api.settings.get, { key: "app_store_url" }) as string | null | undefined;
    const playStoreUrl = useQuery(api.settings.get, { key: "play_store_url" }) as string | null | undefined;
    const appHref = appStoreUrl?.trim() || null;
    const playHref = playStoreUrl?.trim() || null;

    return (
        <section id="app" aria-labelledby="fc-app-title" className={BAND}>
            <div className={cx(WRAP, "grid gap-4 md:grid-cols-2")}>
                <Card className="flex flex-col gap-3 p-6">
                    <div className="flex items-start justify-between gap-6">
                        <div className="flex min-w-0 flex-col gap-3">
                            <h2 id="fc-app-title" className="t-h2">
                                {t("r1.forCreators.app.title")}
                            </h2>
                            <p className="t-body">
                                {fill(t("r1.forCreators.app.body"), {
                                    login: (
                                        <Link href="/login" className="t-link whitespace-nowrap">
                                            {LOGIN_TEXT}
                                        </Link>
                                    ),
                                })}
                            </p>
                        </div>
                        {playHref && (
                            <figure className="m-0 hidden flex-none flex-col items-center gap-2 md:flex">
                                <span className="rounded-r1 border border-r1-line p-2 text-r1-ink">
                                    <QRCodeSVG value={playHref} size={88} fgColor="currentColor" bgColor="transparent" level="M" aria-hidden="true" />
                                </span>
                                <figcaption className="max-w-[112px] text-center text-xs leading-4 text-r1-ink-3">{t("r1.forCreators.app.scan")}</figcaption>
                            </figure>
                        )}
                    </div>
                    {(appHref || playHref) && (
                        <div className="flex flex-wrap gap-2 pt-1">
                            {appHref && (
                                <ButtonLink href={appHref} target="_blank" rel="noreferrer">
                                    App Store
                                </ButtonLink>
                            )}
                            {playHref && (
                                <ButtonLink href={playHref} target="_blank" rel="noreferrer">
                                    Google Play
                                </ButtonLink>
                            )}
                        </div>
                    )}
                </Card>

                <Card className="flex flex-col gap-3 p-6">
                    <h2 className="t-h2">{t("r1.forCreators.discord.title")}</h2>
                    <p className="t-body">{t("r1.forCreators.discord.body")}</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                        <ButtonLink href={DISCORD_INVITE_URL} target="_blank" rel="noreferrer">
                            <Icon icon={Users} />
                            {t("r1.forCreators.discord.open")}
                        </ButtonLink>
                    </div>
                </Card>
            </div>
        </section>
    );
}

function Questions() {
    const { t } = useT();
    const items: FaqItem[] = [1, 2, 3, 4, 5].map((n) => ({
        q: t(`r1.forCreators.faq.q${n}`),
        a: fillText(t(`r1.forCreators.faq.a${n}`), { operator: OPERATOR }),
    }));
    return (
        <section id="faq" aria-labelledby="fc-faq-title" className={cx(BAND, "bg-r1-fill-2")}>
            <div className={cx(WRAP, "grid items-start gap-8 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-16")}>
                <div className="flex flex-col gap-6">
                    <Head id="fc-faq-title" title={t("r1.forCreators.faq.title")} sub={t("r1.forCreators.faq.sub")} />
                    <p className="t-body">
                        {fill(t("r1.forCreators.faq.more"), {
                            help: (
                                <Link href="/knowledge" className="t-link">
                                    {t("r1.forCreators.faq.helpLink")}
                                </Link>
                            ),
                            call: (
                                <Link href={BOOK_CALL_HREF} className="t-link">
                                    {t("r1.forCreators.faq.callLink")}
                                </Link>
                            ),
                        })}
                    </p>
                </div>
                <FaqList items={items} />
            </div>
        </section>
    );
}

function Closing() {
    const { t } = useT();
    return (
        <section aria-labelledby="fc-end-title" className={BAND}>
            <div className={cx(WRAP, "flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8")}>
                <Head id="fc-end-title" title={t("r1.forCreators.end.title")} sub={t("r1.forCreators.end.sub")} />
                <div className="flex flex-wrap items-center gap-3">
                    <ButtonLink variant="primary" size="lg" href={SIGNUP_HREF}>
                        {t("r1.forCreators.start")}
                    </ButtonLink>
                    <ButtonLink size="lg" href={BOOK_CALL_HREF}>
                        {t("r1.forCreators.call")}
                    </ButtonLink>
                </div>
            </div>
        </section>
    );
}

export default function ForCreators() {
    const { t } = useT();
    // pb-24: room under the footer's last line for the chat button, which stays
    // pinned to the bottom-right corner and would otherwise cover the phone number.
    const footer = (
        <PublicFooter
            className="pb-24"
            contact
            links={[
                { href: "/", label: t("r1.forCreators.foot.owners") },
                { href: "/knowledge", label: t("r1.foot.helpCenter") },
                { href: "/otr", label: t("r1.forCreators.foot.otr") },
                { href: "/privacy-policy", label: t("r1.forCreators.foot.legal") },
            ]}
        />
    );
    return (
        <>
            {/* The language switch is not on the board's header, but this page is
                bilingual and the switch is how a visitor gets here in Tagalog. */}
            <PublicPage header={<PublicHeader current="creators" showLang />} footer={footer}>
                <JumpNav />
                <Hero />
                <Earn />
                <Steps />
                <Needs />
                <Sites />
                <AppAndDiscord />
                <Questions />
                <Closing />
            </PublicPage>
            <ChatBot suggestions={[t("r1.forCreators.chat.q1"), t("r1.forCreators.chat.q2"), t("r1.forCreators.chat.q3")]} />
        </>
    );
}
