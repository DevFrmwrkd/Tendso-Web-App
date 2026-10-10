"use client";

import { useState } from "react";

import { PageHeader } from "@/components/r1";
import type { Doc } from "@/convex/_generated/dataModel";
import { affiliateSocialLinkError } from "@/lib/affiliates";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { WEBSITE_PRICE, clampSellPrice } from "@/lib/pricing";

import { OfferPreview } from "./OfferPreview";
import { PageSettings, type AffiliatePageDraft } from "./PageSettings";
import { PriceSettings } from "./PriceSettings";
import { ShareTools } from "./ShareTools";

function pageValues(account: Doc<"creators">): AffiliatePageDraft {
    return {
        photo: account.affiliatePhoto ?? "",
        displayName: account.affiliateDisplayName ?? "",
        message: account.affiliateMessage ?? "",
        socialLink: account.affiliateSocialLink ?? "",
    };
}

export function DashboardContent({ account, preview = false }: { account: Doc<"creators">; preview?: boolean }) {
    const savedPage = pageValues(account);
    const savedPrice = clampSellPrice(account.affiliatePrice ?? WEBSITE_PRICE);
    const defaultName = [account.firstName, account.lastName].filter(Boolean).join(" ") || "Affiliate";
    const [pageDraft, setPageDraft] = useState(() => savedPage);
    const [pageBaseline, setPageBaseline] = useState(() => savedPage);
    const [priceValue, setPriceValue] = useState(() => String(savedPrice));
    const [priceBaseline, setPriceBaseline] = useState(savedPrice);
    const pageDirty = JSON.stringify(pageDraft) !== JSON.stringify(pageBaseline);
    const priceDirty = priceValue !== String(priceBaseline);
    const latestPage = JSON.stringify(savedPage);
    const [seenPage, setSeenPage] = useState(latestPage);
    const [seenPrice, setSeenPrice] = useState(savedPrice);

    // Live balance/status updates must not overwrite edits. Refresh a clean
    // draft when another tab saves page settings, while preserving dirty ones.
    if (seenPage !== latestPage) {
        setSeenPage(latestPage);
        setPageBaseline(savedPage);
        if (!pageDirty) setPageDraft(savedPage);
    }
    if (seenPrice !== savedPrice) {
        setSeenPrice(savedPrice);
        setPriceBaseline(savedPrice);
        if (!priceDirty) setPriceValue(String(savedPrice));
    }

    const suspended = account.status !== "active";
    const previewPrice = priceValue.trim() && Number.isFinite(Number(priceValue)) ? clampSellPrice(Number(priceValue)) : priceBaseline;
    const previewName = pageDraft.displayName.trim() || defaultName;
    const previewSocial = affiliateSocialLinkError(pageDraft.socialLink) ? undefined : pageDraft.socialLink.trim() || undefined;

    return (
        <>
            <PageHeader title="My page" sub="Personalize your page, set your offer, and share your link." />
            <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                <div className="flex min-w-0 flex-col gap-6">
                    <PageSettings
                        draft={pageDraft}
                        defaultName={defaultName}
                        handle={account.affiliateHandle}
                        dirty={pageDirty}
                        disabled={suspended}
                        preview={preview}
                        onChange={(patch) => setPageDraft((current) => ({ ...current, ...patch }))}
                        onSaved={(page) => { setPageDraft(page); setPageBaseline(page); }}
                    />
                    <PriceSettings
                        value={priceValue}
                        previewPrice={previewPrice}
                        dirty={priceDirty}
                        disabled={suspended}
                        preview={preview}
                        onChange={setPriceValue}
                        onSaved={(price) => { setPriceValue(String(price)); setPriceBaseline(price); }}
                    />
                </div>
                <div className="flex min-w-0 flex-col gap-6">
                    <section className="flex min-w-0 flex-col gap-3" aria-labelledby="offer-preview-title">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <h2 id="offer-preview-title" className="t-h2">Page preview</h2>
                            <p className="t-meta">{pageDirty || priceDirty ? "Preview includes unsaved changes" : "Your saved offer"}</p>
                        </div>
                        <OfferPreview photo={pageDraft.photo || undefined} displayName={previewName} message={pageDraft.message.trim() || undefined} socialLink={previewSocial} price={previewPrice} />
                    </section>
                    {account.affiliateHandle ? (
                        <ShareTools handle={account.affiliateHandle} displayName={pageBaseline.displayName.trim() || defaultName} price={priceBaseline} disabled={suspended || preview} />
                    ) : (
                        <div className="t-card t-card-pad"><p className="t-body">Your page handle is unavailable. Contact <a className="t-link" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> for help.</p></div>
                    )}
                    {(pageDirty || priceDirty) && <p className="t-meta">Sharing uses your saved offer. Save your changes before downloading new materials.</p>}
                </div>
            </div>
        </>
    );
}
