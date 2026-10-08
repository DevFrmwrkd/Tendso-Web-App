"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArrowRight, Check } from "lucide-react";
import { Component, useEffect, useSyncExternalStore, type ReactNode } from "react";

import { CopyButton } from "@/app/affiliates/dashboard/_components/CopyButton";
import { OfferPrice } from "@/app/affiliates/dashboard/_components/OfferPreview";
import { Avatar, ButtonLink, ErrorState, FunnelHeader, Icon, Loading, PublicFooter, PublicPage, Skeleton } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import { affiliateBuyHref, creatorPlatform, creatorStoreButtons, type CreatorPlatform } from "@/lib/affiliateLanding";
import { affiliatePhotoError, affiliateSocialLinkError } from "@/lib/affiliates";
import { rememberAffiliate } from "@/lib/campaign";
import { WEBSITE_PRICE } from "@/lib/pricing";

type PublicAffiliate = FunctionReturnType<typeof api.affiliates.publicPage>;
const subscribe = () => () => {};
const serverPlatform = (): CreatorPlatform => "other";
const browserPlatform = (): CreatorPlatform => creatorPlatform(navigator.userAgent, /macintosh/i.test(navigator.userAgent) && "ontouchend" in document);

const INCLUDED = [
    "Built from your photos and your words",
    "Your own live Tendso web address",
    "Made for customers on their phones",
    "Hosted with SSL, kept online",
];

class OfferBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    render() {
        return this.state.failed ? <ErrorState what="This offer" onRetry={() => this.setState({ failed: false })} /> : this.props.children;
    }
}

export function AffiliateLanding({ handle }: { handle: string }) {
    useEffect(() => {
        // A fresh entrance wins even if the account is no longer available.
        rememberAffiliate(handle);
    }, [handle]);

    return (
        <PublicPage
            header={<FunnelHeader exit={{ href: "/", label: "About Tendso" }} />}
            footer={<PublicFooter />}
            mainClassName="items-center px-4 py-8 sm:px-6 sm:py-12"
        >
            <div className="w-full max-w-[1040px]">
                <OfferBoundary key={handle}><AffiliateOfferQuery handle={handle} /></OfferBoundary>
            </div>
        </PublicPage>
    );
}

function AffiliateOfferQuery({ handle }: { handle: string }) {
    const affiliate = useQuery(api.affiliates.publicPage, { handle });
    const playUrl = useQuery(api.settings.get, { key: "play_store_url" }) as string | null | undefined;
    const iosUrl = useQuery(api.settings.get, { key: "app_store_url" }) as string | null | undefined;
    const platform = useSyncExternalStore(subscribe, browserPlatform, serverPlatform);
    if (affiliate === undefined) return <OfferLoading />;
    return <AffiliateOffer handle={handle} affiliate={affiliate} platform={platform} playUrl={playUrl} iosUrl={iosUrl} />;
}

/** Only the public projection is accepted; account contact and money fields stay private. */
export function AffiliateOffer({ handle, affiliate, platform = "other", playUrl, iosUrl }: {
    handle: string;
    affiliate: PublicAffiliate;
    platform?: CreatorPlatform;
    playUrl?: string | null;
    iosUrl?: string | null;
}) {
    const price = affiliate?.price ?? WEBSITE_PRICE;
    const photo = affiliate?.photo && !affiliatePhotoError(affiliate.photo) ? affiliate.photo : null;
    const social = affiliate?.socialLink && !affiliateSocialLinkError(affiliate.socialLink) ? affiliate.socialLink : null;
    const stores = creatorStoreButtons(platform, playUrl, iosUrl);

    return (
        <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-8">
            <article className="t-card t-card-pad flex min-w-0 flex-col gap-6" aria-labelledby="affiliate-offer-title">
                {affiliate && (
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            {photo ? (
                                // Affiliate photos are uploaded to R2 outside Next's image host list.
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={photo} alt="" className="t-avatar t-avatar-lg shrink-0 object-cover" />
                            ) : <Avatar name={affiliate.displayName} size="lg" />}
                            <div className="min-w-0">
                                <p className="t-label">Your Tendso affiliate</p>
                                <p className="t-row-title wrap-anywhere">{affiliate.displayName}</p>
                            </div>
                        </div>
                        {affiliate.message && <p className="t-body whitespace-pre-wrap wrap-anywhere">{affiliate.message}</p>}
                        <hr className="t-divider" />
                    </div>
                )}
                <div className="flex flex-col gap-3">
                    <p className="t-label">Tendso websites</p>
                    <h1 id="affiliate-offer-title" className="t-h1">A website for your shop.</h1>
                    <p className="t-sub">Tell us about your business. We&apos;ll turn your photos and your words into your own website.</p>
                </div>
                <div className="flex flex-col gap-2">
                    <OfferPrice price={price} />
                    <p className="t-body">Paid once, after your website is live. Nothing to pay today.</p>
                </div>
                <ButtonLink variant="primary" size="lg" href={affiliateBuyHref(handle)} block>
                    Get my website <Icon icon={ArrowRight} />
                </ButtonLink>
                <ul className="flex flex-col gap-2.5" aria-label="What your website includes">
                    {INCLUDED.map((item) => <li key={item} className="t-body flex items-start gap-2.5"><Icon icon={Check} className="mt-0.5 shrink-0" /><span>{item}</span></li>)}
                </ul>
                {social && <ButtonLink href={social} target="_blank" rel="noopener noreferrer" className="self-start">Message on Facebook</ButtonLink>}
            </article>
            <section className="t-card t-card-pad flex min-w-0 flex-col gap-5" aria-labelledby="affiliate-earn-title">
                <div className="flex flex-col gap-2">
                    <h2 id="affiliate-earn-title" className="t-h2">Earn with Tendso</h2>
                    <p className="t-body">Creators visit shops, take photos, and interview owners. Get paid to help local shops get online.</p>
                </div>
                {affiliate?.referralCode && (
                    <>
                        <div className="flex flex-wrap items-center justify-between gap-4 rounded-r1 border border-r1-line bg-r1-fill-2 p-4">
                            <div className="flex min-w-0 flex-col gap-2">
                                <p className="t-label">Creator referral code</p>
                                <p className="select-all break-all font-r1-mono text-2xl font-semibold leading-8 tracking-[0.04em] text-r1-ink">{affiliate.referralCode}</p>
                            </div>
                            <CopyButton value={affiliate.referralCode} label="Copy creator referral code" />
                        </div>
                        <p className="t-body">Download the Tendso app and enter this code</p>
                    </>
                )}
                <div className="flex flex-col gap-3">
                    {stores.map((store) => <ButtonLink key={store.href} href={store.href} size="lg" block rel={store.href.startsWith("https://") ? "noopener noreferrer" : undefined}>{store.label}</ButtonLink>)}
                </div>
            </section>
        </div>
    );
}

function OfferLoading() {
    return (
        <Loading label="Loading this website offer">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                <div className="t-card t-card-pad flex flex-col gap-5">
                    <Skeleton width="65%" height={38} />
                    <Skeleton height={44} />
                    <Skeleton width="50%" height={36} />
                    <Skeleton height={48} />
                    <Skeleton height={80} />
                </div>
                <div className="t-card t-card-pad flex flex-col gap-5">
                    <Skeleton width="60%" height={24} />
                    <Skeleton height={48} />
                    <Skeleton height={64} />
                    <Skeleton height={48} />
                </div>
            </div>
        </Loading>
    );
}
