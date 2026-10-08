import type { Metadata } from "next";
import { ArrowRight, Link2, Users, Wallet } from "lucide-react";
import Link from "next/link";

import { ButtonLink, Icon, PublicFooter, PublicHeader, PublicPage } from "@/components/r1";
import { BASE_PRICE, COMMISSION_RATE, PRICE_CEILING, REFERRAL_BONUS, formatPHP } from "@/lib/pricing";

const SHARE = Math.round(COMMISSION_RATE * 100);
const DESCRIPTION = `Share your own Tendso page, set your website price from ${formatPHP(BASE_PRICE)} to ${formatPHP(PRICE_CEILING)}, and earn ${SHARE}% of every sale. Refer creators for ${formatPHP(REFERRAL_BONUS)}.`;

export const metadata: Metadata = {
    title: "Share a link, earn a commission — Tendso affiliates",
    description: DESCRIPTION,
    alternates: { canonical: "/affiliates" },
};

export default function AffiliatesPage() {
    return (
        <PublicPage header={<PublicHeader />} footer={<PublicFooter />} mainClassName="items-center px-4 py-12 sm:px-6 sm:py-20">
            <div className="flex w-full max-w-[880px] flex-col gap-10">
                <div className="flex max-w-[680px] flex-col gap-4">
                    <p className="t-label">Tendso affiliates</p>
                    <h1 className="t-h1">Share your link. Earn with every website.</h1>
                    <p className="t-sub">
                        Help shop owners get online through your own Tendso page. Choose your price from {formatPHP(BASE_PRICE)} to {formatPHP(PRICE_CEILING)} and keep {SHARE}% of each sale.
                    </p>
                    <ButtonLink href="/affiliates/join" variant="primary" size="lg" className="self-start">
                        Become an affiliate
                        <Icon icon={ArrowRight} />
                    </ButtonLink>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                    <section className="t-card t-card-pad flex flex-col gap-3">
                        <Icon icon={Link2} size={20} />
                        <h2 className="t-h2">Share your page</h2>
                        <p className="t-body">Send your personal link to shop owners, or share it with your audience.</p>
                    </section>
                    <section className="t-card t-card-pad flex flex-col gap-3">
                        <Icon icon={Wallet} size={20} />
                        <h2 className="t-h2">Set your price</h2>
                        <p className="t-body">Owners who order through your page pay your price. You earn {SHARE}% of the website sale.</p>
                    </section>
                    <section className="t-card t-card-pad flex flex-col gap-3">
                        <Icon icon={Users} size={20} />
                        <h2 className="t-h2">Refer creators</h2>
                        <p className="t-body">Earn {formatPHP(REFERRAL_BONUS)} when a creator you refer makes their first paid sale.</p>
                    </section>
                </div>

                <div className="flex max-w-[680px] flex-col gap-3">
                    <p className="t-body">
                        Affiliates share their link. Creators visit shops, take photos, and interview owners. Your affiliate account is active as soon as you finish signing up.
                    </p>
                    <p className="t-meta">
                        Already a creator? Use a different email for your affiliate account. Each login has one account type.{" "}
                        <Link href="/for-creators" className="t-link">Learn about creator work</Link>
                    </p>
                </div>
            </div>
        </PublicPage>
    );
}
