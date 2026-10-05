"use client";

import { ArrowRight, Check } from "lucide-react";

import { ButtonLink, Highlight, Icon, formatMoney } from "@/components/r1";
import { BASE_PRICE, WEBSITE_PRICE } from "@/lib/pricing";

import { fill } from "./copy";
import { useT } from "./i18n";
import { LANDING_BAND, LANDING_WRAP, SectionHead } from "./layout";

/**
 * The price (board: Landing, #price). One price, one card, paid once and only
 * when the site is live. The CTA points at /start, the owner-intake funnel, so
 * this card is the price and the entrance in one. Owners never "sign up":
 * /start is anonymous end to end and no account exists at any point.
 *
 * WHAT THE CARD SAYS is the board's price story: the website is WEBSITE_PRICE
 * (₱4,999), which is exactly what /start charges an owner with no campaign
 * (campaignSellPrice(null) === WEBSITE_PRICE), and it can be as low as
 * BASE_PRICE when a Tendso creator signs the owner up, because a creator may
 * discount their own offer that far. Both figures come from lib/pricing.
 *
 * The custom domain is an optional add-on, so it stays a quiet note under the
 * card rather than a second price (Theo's earlier feedback, kept).
 *
 * Phone first: the heading, then the card (the number the heading promises),
 * then what is included. From 1024 the card moves into the right column beside
 * both, as the board draws it.
 */
export default function BusinessPricingSection() {
    const { t } = useT();
    const included = [1, 2, 3, 4, 5, 6].map((n) => t(`r1.landing.price.inc${n}`));

    return (
        <section id="price" aria-labelledby="price-title" className={LANDING_BAND}>
            <div className={`${LANDING_WRAP} py-12 sm:py-16 lg:py-20`}>
                <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:grid-rows-[auto_1fr] lg:gap-x-16 xl:grid-cols-[minmax(0,1fr)_480px] xl:gap-x-24">
                    <SectionHead
                        id="price-title"
                        title={t("r1.landing.price.title")}
                        sub={t("r1.landing.price.sub")}
                        className="lg:col-start-1 lg:row-start-1"
                    />

                    <div className="t-card flex flex-col gap-6 p-6 sm:p-8 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
                        <div className="flex flex-col gap-3">
                            <span className="t-label">{t("r1.landing.price.tier")}</span>
                            <span className="t-hero-fig">{formatMoney(WEBSITE_PRICE)}</span>
                            <p className="t-meta">{t("r1.landing.price.once")}</p>
                        </div>
                        <Highlight className="px-4 py-3 text-sm leading-5 text-r1-ink-2">
                            {fill(t("r1.landing.price.viaCreator"), {
                                b: <strong className="t-num font-semibold text-r1-ink">{formatMoney(BASE_PRICE)}</strong>,
                            })}
                        </Highlight>
                        <ButtonLink variant="primary" size="lg" block href="/start">
                            {t("r1.landing.cta")}
                            <Icon icon={ArrowRight} />
                        </ButtonLink>
                        <hr className="t-divider" />
                        <p className="t-meta">{t("r1.landing.price.domain")}</p>
                        <p className="t-meta">{t("r1.landing.price.domainAddon")}</p>
                    </div>

                    <div className="flex flex-col gap-8 lg:col-start-1 lg:row-start-2">
                        <div className="flex flex-col gap-4">
                            <h3 className="t-label">{t("r1.landing.price.included")}</h3>
                            <ul className="flex flex-col gap-3">
                                {included.map((item) => (
                                    <li key={item} className="flex items-start gap-2.5 text-sm leading-5 text-r1-ink-2">
                                        <Icon icon={Check} className="mt-0.5 flex-none text-r1-ink" />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <p className="t-meta">{t("r1.landing.price.footnote")}</p>
                    </div>
                </div>
            </div>
        </section>
    );
}
