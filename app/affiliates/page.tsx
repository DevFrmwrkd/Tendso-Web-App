import type { Metadata } from "next";
import { ArrowRight, Link2, Users, Wallet } from "lucide-react";
import Link from "next/link";

import { ButtonLink, Icon, PublicFooter, PublicHeader, PublicPage } from "@/components/r1";
import { COMMISSION_RATE, CREATOR_CODE_DISCOUNT, CREATOR_CODE_PRICE, formatPHP } from "@/lib/pricing";
import { AFFILIATE_RECRUIT_REWARD, AFFILIATE_RECRUIT_TERMS } from "@/lib/affiliateReferralProgram";

const SHARE = Math.round(COMMISSION_RATE * 100);
const DISCOUNT = Math.round(CREATOR_CODE_DISCOUNT * 100);
const DESCRIPTION = `Share your own Tendso page and fixed ${DISCOUNT}% creator-code offer. Shop owners pay ${formatPHP(CREATOR_CODE_PRICE)} and you keep ${SHARE}% of each website sale. ${AFFILIATE_RECRUIT_REWARD}`;

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
                        Help shop owners get online through your own Tendso page. Your creator code gives a fixed {DISCOUNT}% off: shop owners pay {formatPHP(CREATOR_CODE_PRICE)} and you keep half of the website price.
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
                        <h2 className="t-h2">Share a fixed {DISCOUNT}% offer</h2>
                        <p className="t-body">Every creator code has the same website offer. You earn {SHARE}% of each eligible website sale.</p>
                    </section>
                    <section className="t-card t-card-pad flex flex-col gap-3">
                        <Icon icon={Users} size={20} />
                        <h2 className="t-h2">Refer creators</h2>
                        <p className="t-body">{AFFILIATE_RECRUIT_REWARD}</p>
                        <p className="t-meta">Your team commission is credited after the shop has paid in full.</p>
                        <p className="t-meta">{AFFILIATE_RECRUIT_TERMS}</p>
                    </section>
                </div>

                <div className="flex max-w-[680px] flex-col gap-3">
                    <p className="t-body">
                        Affiliates share their link. Field agents visit shops, take photos, and interview owners. Sign up, then wait for admin approval before sharing your page.
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
