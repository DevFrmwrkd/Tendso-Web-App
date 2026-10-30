"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";

import { ArrowUpRight, Eye, Pencil } from "lucide-react";
import Link from "next/link";

import { CreatorPagePreview } from "@/components/v2/creators/CreatorPagePreview";
import type { Doc } from "@/convex/_generated/dataModel";
import { getAffiliateSocialLinks } from "@/lib/affiliates";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { WEBSITE_PRICE, clampSellPrice } from "@/lib/pricing";
import { createCreatorPageCard, creatorPageDraftsEqual } from "@/lib/v2/creatorPageEditor";

import { CopyButton } from "./CopyButton";
import { PageSettings, type AffiliatePageDraft } from "./PageSettings";
import { PriceSettings } from "./PriceSettings";
import { ShareTools } from "./ShareTools";
import styles from "./MyPage.module.css";

const CONTROL_TABS = [
    { id: "page", label: "Page details" },
    { id: "offer", label: "Your offer" },
    { id: "sharing", label: "Sharing" },
] as const;
type ControlTab = typeof CONTROL_TABS[number]["id"];

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
    const defaultName = [account.firstName, account.lastName].filter(Boolean).join(" ").trim()
        || (account.affiliateHandle ? `@${account.affiliateHandle}` : "Tendso creator");
    const [pageDraft, setPageDraft] = useState(() => savedPage);
    const [pageBaseline, setPageBaseline] = useState(() => savedPage);
    const [priceValue, setPriceValue] = useState(() => String(savedPrice));
    const [priceBaseline, setPriceBaseline] = useState(savedPrice);
    const pageDirty = !creatorPageDraftsEqual(pageDraft, pageBaseline);
    const priceDirty = priceValue !== String(priceBaseline);
    const latestPage = JSON.stringify(savedPage);
    const [seenPage, setSeenPage] = useState(latestPage);
    const [seenPrice, setSeenPrice] = useState(savedPrice);
    const [controlTab, setControlTab] = useState<ControlTab>("page");
    const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
    const editorId = useId();
    const tabRefs = useRef<Partial<Record<ControlTab, HTMLButtonElement | null>>>({});

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
    const card = createCreatorPageCard(account, pageDraft, previewPrice);
    const publicHref = account.affiliateHandle ? `/v2/a/${encodeURIComponent(account.affiliateHandle)}` : undefined;
    const inviteUrl = account.affiliateHandle ? `https://tendso.com/v2/a/${encodeURIComponent(account.affiliateHandle)}/earn` : undefined;

    function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
        let next: number;
        if (event.key === "ArrowRight") next = (index + 1) % CONTROL_TABS.length;
        else if (event.key === "ArrowLeft") next = (index + CONTROL_TABS.length - 1) % CONTROL_TABS.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = CONTROL_TABS.length - 1;
        else return;
        event.preventDefault();
        const nextTab = CONTROL_TABS[next].id;
        setControlTab(nextTab);
        tabRefs.current[nextTab]?.focus();
    }

    return (
        <div className={styles.editor}>
            <header className={styles.heading}>
                <div>
                    <h1>My page</h1>
                    <p>Edit the public page shop owners open from your link.</p>
                </div>
                {!preview && !suspended && publicHref && (
                    <Link className={styles.visit} href={publicHref} target="_blank" rel="noopener noreferrer">
                        View saved page <ArrowUpRight size={18} aria-hidden="true" />
                    </Link>
                )}
            </header>
            <div className={styles.viewSwitch} role="group" aria-label="Page editor view">
                <button type="button" aria-pressed={mobileView === "edit"} aria-controls={`${editorId}-controls`} onClick={() => setMobileView("edit")}>
                    <Pencil size={16} aria-hidden="true" />Edit
                </button>
                <button type="button" aria-pressed={mobileView === "preview"} aria-controls={`${editorId}-preview`} onClick={() => setMobileView("preview")}>
                    <Eye size={16} aria-hidden="true" />Preview
                </button>
            </div>
            <div className={styles.layout}>
                <div id={`${editorId}-controls`} className={`${styles.controls} ${mobileView === "preview" ? styles.mobileHidden : ""}`}>
                    <div className={styles.tabs} role="tablist" aria-label="Page settings">
                        {CONTROL_TABS.map((tab, index) => (
                            <button
                                key={tab.id}
                                ref={(element) => { tabRefs.current[tab.id] = element; }}
                                type="button"
                                role="tab"
                                id={`${editorId}-tab-${tab.id}`}
                                aria-selected={controlTab === tab.id}
                                aria-controls={`${editorId}-panel-${tab.id}`}
                                tabIndex={controlTab === tab.id ? 0 : -1}
                                onClick={() => setControlTab(tab.id)}
                                onKeyDown={(event) => moveTab(event, index)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div className={styles.controlPanel} role="tabpanel" id={`${editorId}-panel-page`} aria-labelledby={`${editorId}-tab-page`} tabIndex={0} hidden={controlTab !== "page"}>
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
                    </div>
                    <div className={styles.controlPanel} role="tabpanel" id={`${editorId}-panel-offer`} aria-labelledby={`${editorId}-tab-offer`} tabIndex={0} hidden={controlTab !== "offer"}>
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
                    <div className={styles.controlPanel} role="tabpanel" id={`${editorId}-panel-sharing`} aria-labelledby={`${editorId}-tab-sharing`} tabIndex={0} hidden={controlTab !== "sharing"}>
                        <div className={styles.sharing}>
                            {account.affiliateHandle ? (
                                <ShareTools handle={account.affiliateHandle} displayName={pageBaseline.displayName.trim() || defaultName} photo={pageBaseline.photo} referralCode={account.referralCode} price={priceBaseline} disabled={suspended || preview} />
                            ) : (
                                <p className={styles.unavailable}>Your page handle is unavailable. Contact <a className="t-link" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> for help.</p>
                            )}
                            {(pageDirty || priceDirty) && <p className={styles.sharingNote}>Sharing uses your saved page and price. Save your changes before downloading new materials.</p>}
                            {inviteUrl && <section className={styles.invitation} aria-labelledby={`${editorId}-invite-title`}>
                                <div>
                                    <h2 id={`${editorId}-invite-title`}>Invite a field agent</h2>
                                    <p>This link is for people who want to become field agents. Use your shop link above for shop owners.</p>
                                </div>
                                <div className={styles.shareDetail}>
                                    <span className={styles.detailLabel}>Field agent invitation link</span>
                                    <div className={styles.copyRow}>
                                        <span className={styles.linkValue}>{inviteUrl.replace("https://", "")}</span>
                                        <CopyButton value={inviteUrl} label="Copy your field agent invitation link" disabled={suspended || preview} />
                                    </div>
                                </div>
                                {account.referralCode && <div className={styles.shareDetail}>
                                    <span className={styles.detailLabel}>Invitation code</span>
                                    <div className={styles.copyRow}>
                                        <strong className={styles.codeValue}>{account.referralCode}</strong>
                                        <CopyButton value={account.referralCode} label="Copy your field agent invitation code" disabled={suspended || preview} />
                                    </div>
                                    <p>They can enter this code when creating their account.</p>
                                </div>}
                            </section>}
                        </div>
                    </div>
                </div>
                <div id={`${editorId}-preview`} className={`${styles.previewPane} ${mobileView === "edit" ? styles.mobileHidden : ""}`}>
                    <CreatorPagePreview card={card} dirty={pageDirty || priceDirty} paused={suspended} publicHref={preview || suspended ? undefined : publicHref} />
                </div>
            </div>
        </div>
    );
}
