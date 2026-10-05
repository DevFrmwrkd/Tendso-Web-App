"use client";

import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";

import { ButtonLink, Icon, cx } from "@/components/r1";

import { fillText } from "./copy";
import { HERO_SITE } from "./featuredSites";
import { useT } from "./i18n";
import { LANDING_WRAP } from "./layout";
import SiteFrame from "./SiteFrame";

/**
 * The landing's first screen (board: Landing, #hero). Owner-first: the paying
 * customer is the business owner, so the one primary action is "Get a
 * website", straight into the /start intake funnel (the same destination as
 * the header button and the price card). The reader who wants proof first has
 * "See real sites" beside it, and creators get a single quiet line underneath.
 *
 * The lede states no price on purpose: the price card further down carries it,
 * with what is included and how a creator changes it.
 *
 * Phone first: one column, the live preview under the pitch. Two columns from
 * 1024; the board's 640px pitch column from 1280, where the preview still has
 * room to read as a website.
 */
export default function HeroSection() {
    const { t } = useT();
    const proof = [t("r1.landing.hero.proof1"), t("r1.landing.hero.proof2"), t("r1.landing.hero.proof3")];

    return (
        <section
            id="hero"
            aria-labelledby="hero-title"
            className={cx(
                LANDING_WRAP,
                "grid items-center gap-10 py-10 sm:py-14 lg:grid-cols-2 lg:gap-12 lg:py-[72px] xl:grid-cols-[minmax(0,640px)_minmax(0,1fr)] xl:gap-[72px]",
            )}
        >
            <div className="flex min-w-0 flex-col gap-8">
                <div className="flex flex-col gap-5">
                    <h1
                        id="hero-title"
                        className="t-serif text-balance text-[2.25rem] leading-[2.5rem] tracking-[-0.015em] text-r1-ink sm:text-5xl sm:leading-[3.25rem] lg:text-[3.5rem] lg:leading-[3.75rem]"
                    >
                        <span className="block">{t("r1.landing.hero.title1")}</span>
                        <span className="block">{t("r1.landing.hero.title2")}</span>
                    </h1>
                    <p className="max-w-[560px] text-[17px] leading-[26px] text-r1-ink-2">{t("r1.landing.hero.lede")}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <ButtonLink variant="primary" size="lg" href="/start">
                        {t("r1.landing.cta")}
                        <Icon icon={ArrowRight} />
                    </ButtonLink>
                    <ButtonLink size="lg" href="#sites">
                        {t("r1.landing.hero.seeSites")}
                    </ButtonLink>
                </div>

                <ul className="flex flex-wrap gap-x-6 gap-y-2" aria-label={t("r1.landing.hero.proofLabel")}>
                    {proof.map((item) => (
                        <li key={item} className="inline-flex items-center gap-2 text-sm leading-5 text-r1-ink-2">
                            <Icon icon={Check} className="flex-none text-r1-ink" />
                            {item}
                        </li>
                    ))}
                </ul>

                {/* Creators keep one secondary path from the owner page (this line,
                    the header link and the footer); their pitch is /for-creators. */}
                <p className="t-meta text-sm leading-5">
                    {t("r1.landing.earnLead")}{" "}
                    <Link href="/for-creators" className="t-link inline-flex items-center gap-1.5 font-medium">
                        {t("r1.landing.earnLink")}
                        <Icon icon={ArrowRight} />
                    </Link>
                </p>
            </div>

            {/* A real client site, live. Not a link: it is a picture of the
                product, and the grid below is where the sites open. */}
            {HERO_SITE && (
                <figure className="m-0 flex min-w-0 flex-col gap-3">
                    <SiteFrame url={HERO_SITE.url} name={HERO_SITE.name} />
                    <figcaption className="t-meta">
                        {fillText(t("r1.landing.hero.caption"), { name: HERO_SITE.name, city: HERO_SITE.city })}
                    </figcaption>
                </figure>
            )}
        </section>
    );
}
