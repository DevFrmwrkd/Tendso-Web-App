"use client";

import { useState } from "react";

import { ArrowUpRight, Check, Eye } from "lucide-react";
import Link from "next/link";
import type { Doc } from "@/convex/_generated/dataModel";
import { getAffiliateSocialLinks } from "@/lib/affiliates";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { WEBSITE_PRICE, clampSellPrice } from "@/lib/pricing";

import { OfferPreview } from "./OfferPreview";
import { PageSettings, type AffiliatePageDraft } from "./PageSettings";
import { PriceSettings } from "./PriceSettings";
import { ShareTools } from "./ShareTools";
import styles from "./MyPage.module.css";

function pageValues(account: Doc<"creators">): AffiliatePageDraft {
    return {
        photo: account.affiliatePhoto ?? "",
        displayName: account.affiliateDisplayName ?? "",
        message: account.affiliateMessage ?? "",
        socialLinks: getAffiliateSocialLinks(account.affiliateSocialLinks, account.affiliateSocialLink),
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

    return (
        <div className={styles.editor}>
            <header className={styles.heading}>
                <div>
                    <span className={styles.eyebrow}>YOUR CREATOR PAGE</span>
                    <h1>My page.</h1>
                    <p>Introduce yourself, set your offer, and make your link ready to share.</p>
                </div>
                {!preview && account.affiliateHandle && <Link className={styles.visit} href={`/v2/a/${encodeURIComponent(account.affiliateHandle)}`} target="_blank" rel="noopener noreferrer">View saved page <ArrowUpRight size={18} aria-hidden="true" /></Link>}
            </header>
            <nav className={styles.sections} aria-label="Page settings">
                <a href="#page-settings"><span>01</span> Page details</a>
                <a href="#price-settings"><span>02</span> Your offer</a>
                <a href="#affiliate-share-heading"><span>03</span> Share your page</a>
            </nav>
            <div className={styles.layout}>
                <div className={styles.forms}>
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
                <div className={styles.aside}>
                    <section className={styles.preview} aria-labelledby="offer-preview-title">
                        <div className={styles.previewHeading}>
                            <h2 id="offer-preview-title"><Eye size={18} aria-hidden="true" /> Page preview</h2>
                            <span>{pageDirty || priceDirty ? "Unsaved changes" : <><Check size={14} aria-hidden="true" /> Saved offer</>}</span>
                        </div>
                        <OfferPreview photo={pageDraft.photo || undefined} displayName={previewName} message={pageDraft.message.trim() || undefined} socialLinks={pageDraft.socialLinks} price={previewPrice} />
                        <p className={styles.previewNote}>{pageDirty || priceDirty ? "Preview includes unsaved changes. Visitors still see your saved page." : "This is the offer shop owners see from your link."}</p>
                    </section>
                    {account.affiliateHandle ? (
                        <ShareTools handle={account.affiliateHandle} displayName={pageBaseline.displayName.trim() || defaultName} price={priceBaseline} disabled={suspended || preview} />
                    ) : (
                        <div className="t-card t-card-pad"><p className="t-body">Your page handle is unavailable. Contact <a className="t-link" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> for help.</p></div>
                    )}
                    {(pageDirty || priceDirty) && <p className={styles.previewNote}>Sharing uses your saved offer. Save your changes before downloading new materials.</p>}
                </div>
            </div>
        </div>
    );
}
