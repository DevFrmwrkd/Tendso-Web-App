"use client";

import { fillText } from "./copy";
import { useT } from "./i18n";
import { LANDING_BAND, LANDING_BAND_IN, SectionHead } from "./layout";

/**
 * How it works, for the owner (board: Landing, #how). Four steps, each with
 * what it costs the owner in time, so the owner's part reads as small: about
 * half an hour, then a look before paying.
 *
 * This is also where the old /about page's "how a business gets a website"
 * went (/about now redirects to the landing); the operator line it carried is
 * in the footer.
 */
export default function HowItWorks() {
    const { t } = useT();
    const steps = [1, 2, 3, 4].map((n) => ({
        n,
        meta: t(`r1.landing.how.s${n}.meta`),
        title: t(`r1.landing.how.s${n}.title`),
        body: t(`r1.landing.how.s${n}.body`),
    }));

    return (
        <section id="how" aria-labelledby="how-title" className={LANDING_BAND}>
            <div className={LANDING_BAND_IN}>
                <SectionHead id="how-title" title={t("r1.landing.how.title")} sub={t("r1.landing.how.sub")} />
                <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                    {steps.map((s) => (
                        <li key={s.n} className="flex flex-col gap-2 border-t border-r1-ink pt-5">
                            <div className="flex items-center justify-between gap-3">
                                <span className="t-label">{fillText(t("r1.landing.how.step"), { n: s.n })}</span>
                                <span className="t-meta">{s.meta}</span>
                            </div>
                            <h3 className="t-h2">{s.title}</h3>
                            <p className="t-body">{s.body}</p>
                        </li>
                    ))}
                </ol>
            </div>
        </section>
    );
}
