"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { ButtonLink, Icon, cx } from "@/components/r1";

import { useT } from "./i18n";
import { LANDING_WRAP } from "./layout";

/**
 * The landing's closing band (board: Landing, `.la-close`). One primary action,
 * "Get a website", into the /start intake funnel: this band sits at the bottom
 * of the owner pitch, so a link back to the pitch would be a self-link that
 * appears to do nothing. The secondary line is the cross-audience nudge, to the
 * creator pitch rather than to any creator form.
 */
export default function CtaSection() {
    const { t } = useT();
    return (
        <section aria-labelledby="close-title" className="border-t border-r1-line bg-r1-fill-2">
            <div className={cx(LANDING_WRAP, "flex flex-col items-center gap-4 py-12 text-center sm:py-16 lg:py-[72px]")}>
                <h2 id="close-title" className="t-h1">
                    {t("r1.landing.close.title")}
                </h2>
                <p className="t-sub">{t("r1.landing.close.sub")}</p>
                <div className="flex flex-col items-center gap-5 pt-3">
                    <ButtonLink variant="primary" size="lg" href="/start">
                        {t("r1.landing.cta")}
                        <Icon icon={ArrowRight} />
                    </ButtonLink>
                    <p className="t-meta text-sm leading-5">
                        {t("r1.landing.earnLead")}{" "}
                        <Link href="/for-creators" className="t-link font-medium">
                            {t("r1.landing.earnLink")}
                        </Link>
                    </p>
                </div>
            </div>
        </section>
    );
}
