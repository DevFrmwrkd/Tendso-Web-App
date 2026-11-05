"use client";

import { Avatar, ButtonLink } from "@/components/r1";
import { CREATOR_CODE_PRICE, creatorDiscount, formatPHP, WEBSITE_PRICE } from "@/lib/pricing";
import { AFFILIATE_SOCIAL_LABELS, AFFILIATE_SOCIAL_PLATFORMS, getAffiliateSocialLinks, type AffiliateSocialLinks } from "@/lib/affiliates";

export function CreatorSocialLinks({ socialLinks, socialLink }: { socialLinks?: AffiliateSocialLinks; socialLink?: string }) {
    const links = getAffiliateSocialLinks(socialLinks, socialLink);
    const platforms = AFFILIATE_SOCIAL_PLATFORMS.filter((platform) => links[platform]);
    if (!platforms.length) return null;
    return (
        <nav className="flex min-w-0 flex-wrap gap-2" aria-label="Creator social links">
            {platforms.map((platform) => <ButtonLink key={platform} href={links[platform]!} target="_blank" rel="noopener noreferrer">{platform === "messenger" ? "Message on Messenger" : `View ${AFFILIATE_SOCIAL_LABELS[platform]}`}</ButtonLink>)}
        </nav>
    );
}

export function OfferPrice({ price }: { price: number }) {
    const discount = creatorDiscount(price, WEBSITE_PRICE);
    return (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {discount && <del className="t-num text-base text-r1-ink-3">{formatPHP(discount.listPrice)}</del>}
            <span className="t-num text-3xl font-semibold tracking-tight text-r1-ink">{formatPHP(price)}</span>
            {discount && <span className="t-meta font-medium text-r1-ink">{discount.percentOff}% off</span>}
        </div>
    );
}

/** Fixed text and plain strings keep the offer outside the page editor. */
export function OfferPreview({ photo, displayName, message, socialLink, socialLinks }: {
    photo?: string;
    displayName: string;
    message?: string;
    socialLink?: string;
    socialLinks?: AffiliateSocialLinks;
    /** Legacy callers may supply a price; creator-code previews always use the fixed offer. */
    price?: number;
}) {
    return (
        <article className="t-card flex flex-col gap-5 overflow-hidden p-5 sm:p-6" aria-label="Your page preview">
            <div className="flex items-center gap-3">
                {photo && photo.startsWith("https://") ? (
                    // Affiliates upload to R2; their photos are outside Next's image host list.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="" className="t-avatar t-avatar-lg shrink-0 object-cover" />
                ) : <Avatar name={displayName} size="lg" />}
                <div className="min-w-0">
                    <p className="t-label">Your Tendso creator</p>
                    <p className="t-row-title wrap-anywhere">{displayName || "Your name"}</p>
                </div>
            </div>
            {message && <p className="t-body whitespace-pre-wrap wrap-anywhere">{message}</p>}
            <hr className="t-divider" />
            <div className="flex flex-col gap-3">
                <h3 className="t-h2">A website for your shop</h3>
                <OfferPrice price={CREATOR_CODE_PRICE} />
                <p className="t-meta">See it first. Pay once to publish your business website.</p>
            </div>
            <CreatorSocialLinks socialLinks={socialLinks} socialLink={socialLink} />
        </article>
    );
}
