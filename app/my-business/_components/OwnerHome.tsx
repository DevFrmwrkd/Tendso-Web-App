"use client";

import { ArrowRight, ArrowUpRight, Check, Copy, ExternalLink, Globe, LockKeyhole, MessageCircle, Store } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { toast } from "sonner";

import LiveSitePreview from "@/components/landing/LiveSitePreview";
import { Loading } from "@/components/r1";
import { hostOf, ownerPhaseStatus, ownerSiteAction, type OwnerSite } from "./ownerSite";
import styles from "./OwnerHome.module.css";

const peso = (value: number) => `₱${value.toLocaleString("en-PH")}`;

function publicAddress(site: OwnerSite): string | null {
    if (site.phase !== "live" || !site.publishedUrl) return null;
    try {
        const url = new URL(site.publishedUrl);
        return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
    } catch { return null; }
}

/** Owner-owned businesses only. Private-preview and payment actions live in OwnerPrivateWebsite. */
export function SiteOverview({ site }: { site: OwnerSite }) {
    const url = publicAddress(site);
    const host = url ? hostOf(url) : null;
    const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
    const copied = !!url && copiedUrl === url;
    const titleId = useId();
    const paymentDue = site.balanceDue > 0 && !site.paidInFull && (site.phase === "awaiting_payment" || site.phase === "live");
    const copyAddress = async () => {
        if (!url) return;
        try {
            await navigator.clipboard.writeText(url);
            setCopiedUrl(url);
            toast.success("Website address copied");
        } catch {
            toast.error("Couldn't copy the address. Select it and copy it instead.");
        }
    };

    return <div className={styles.stack}>
        <section className={styles.overview} aria-labelledby={titleId}>
            <div className={styles.overviewHeader}>
                <div className={styles.businessHeading}>
                    <span className={styles.businessIcon}><Store size={23} strokeWidth={1.7} aria-hidden="true" /></span>
                    <div className={styles.headingText}>
                        <p className={styles.eyebrow}>Your website</p>
                        <h2 className={styles.businessTitle} id={titleId}>{site.businessName}</h2>
                    </div>
                </div>
                <SitePill site={site} />
            </div>
            <div className={styles.overviewGrid}>
                <div className={styles.previewSurface}>
                    {url && host ? <div className={styles.browser}>
                        <div className={styles.browserBar}>
                            <span className={styles.browserDots} aria-hidden="true"><i /><i /><i /></span>
                            <span className={styles.browserAddress}><LockKeyhole size={12} aria-hidden="true" />{host}</span>
                            <span className={styles.browserBarEnd} aria-hidden="true" />
                        </div>
                        <LiveSitePreview url={url} name={site.businessName} />
                    </div> : <div className={styles.previewEmpty}>
                        <span className={styles.previewEmptyIcon}><Globe size={31} strokeWidth={1.5} aria-hidden="true" /></span>
                        <h3>Your website will appear here</h3>
                        <p>{site.phase === "draft" ? "Your business is saved as a draft. Continue setup in the Tendso app." : "There isn’t a public web address for this business yet."}</p>
                    </div>}
                </div>
                <div className={styles.overviewDetails}>
                    <div>
                        <p className={styles.eyebrow}>Website address</p>
                        <h3 className={styles.addressTitle}>{host ?? "Not published yet"}</h3>
                        <p className={styles.body}>{host ? "Open your website or copy its address to share with customers." : "Once your website has a public address, you can open or copy it here."}</p>
                    </div>
                    {url ? <div className={styles.overviewActions}>
                        <a className={`${styles.button} ${styles.primaryButton}`} href={url} target="_blank" rel="noopener noreferrer">
                            Open website <ExternalLink size={17} aria-hidden="true" />
                        </a>
                        <button className={styles.button} type="button" onClick={() => void copyAddress()}>
                            {copied ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
                            {copied ? "Address copied" : "Copy address"}
                        </button>
                    </div> : null}
                    {paymentDue ? <div className={styles.paymentNote}>
                        <span className={styles.noteDot} aria-hidden="true" />
                        <div><p className={styles.balanceValue}>{peso(site.balanceDue)} remaining</p><p>Check your payment email from Tendso for the latest payment details.</p></div>
                    </div> : null}
                    <div className={styles.detailHelp}>
                        <MessageCircle size={19} strokeWidth={1.6} aria-hidden="true" />
                        <div><p>Have a question?</p><Link href="/contact">Talk to the team <ArrowUpRight size={14} aria-hidden="true" /></Link></div>
                    </div>
                </div>
            </div>
        </section>
        <EditsCard />
    </div>;
}

function SitePill({ site }: { site: OwnerSite }) {
    const label = ownerPhaseStatus(site);
    return <span className={`${styles.status} ${styles[`status_${label.tone}`]}`}>
        <span className={styles.statusDot} aria-hidden="true" />{label.word}
    </span>;
}

/** Support requests remain the route for changing a published website. */
export function EditsCard() {
    const titleId = useId();
    return <section className={styles.supportCard} aria-labelledby={titleId}>
        <span className={styles.supportIcon}><MessageCircle size={25} strokeWidth={1.6} aria-hidden="true" /></span>
        <div className={styles.supportText}>
            <h2 id={titleId}>Need something changed?</h2>
            <p>New prices, photos or opening hours? Tell us what needs updating and our team will help with the next steps.</p>
        </div>
        <Link className={styles.supportLink} href="/contact">Request a change <ArrowUpRight size={17} aria-hidden="true" /></Link>
    </section>;
}

/** Every business stays visible; each card opens that business’s own workspace. */
export function SiteList({ sites }: { sites: OwnerSite[] }) {
    const titleId = useId();
    return <div className={styles.stack}>
        <section aria-labelledby={titleId}>
            <div className={styles.sectionHeading}>
                <div><h2 id={titleId}>Websites & drafts <span className={styles.count}>{sites.length}</span></h2>
                    <p>Choose a business to see its website and latest updates.</p></div>
                <span className={styles.sectionMeta}>All in one place</span>
            </div>
            <div className={styles.siteGrid}>
                {sites.map(site => <BusinessCard key={site.submissionId} site={site} />)}
            </div>
        </section>
        <EditsCard />
    </div>;
}

function BusinessCard({ site }: { site: OwnerSite }) {
    const titleId = useId();
    const workspace = `/my-business/${site.submissionId}`;
    const action = ownerSiteAction(site);
    const url = publicAddress(site);
    const openWebsite = action === "Open website" && !!url;
    const paymentDue = site.balanceDue > 0 && !site.paidInFull && (site.phase === "awaiting_payment" || site.phase === "live");
    return <article className={styles.siteCard} aria-labelledby={titleId}>
        <div className={styles.cardTop}>
            <span className={styles.businessIcon}><Store size={23} strokeWidth={1.7} aria-hidden="true" /></span>
            <SitePill site={site} />
        </div>
        <p className={styles.businessType}>{site.businessType.replaceAll("_", " ")}</p>
        <h3 id={titleId}><Link className={styles.titleLink} href={workspace} aria-label={`Open ${site.businessName} workspace`}>{site.businessName}</Link></h3>
        <p className={styles.cardAddress}><Globe size={15} aria-hidden="true" /><span>{url ? hostOf(url) : "No public address yet"}</span></p>
        {paymentDue ? <p className={styles.cardBalance}>{peso(site.balanceDue)} <span>remaining</span></p> : null}
        <div className={styles.cardFooter}>
            {openWebsite ? <>
                <a className={styles.cardAction} href={url} target="_blank" rel="noopener noreferrer">Open website <ArrowUpRight size={17} aria-hidden="true" /></a>
                <Link className={styles.detailsLink} href={workspace}>View details</Link>
            </> : <Link className={styles.cardAction} href={workspace}>{action}<span className={styles.cardArrow}><ArrowRight size={19} aria-hidden="true" /></span></Link>}
        </div>
    </article>;
}

/** Signed in, with no business linked to this owner account. */
export function NoSite() {
    return <section className={styles.emptyCard} aria-label="No website yet">
        <span className={styles.emptyIcon}><Store size={36} strokeWidth={1.4} aria-hidden="true" /></span>
        <p className={styles.eyebrow}>Your next chapter</p>
        <h2>Let’s bring your business online.</h2>
        <p className={styles.emptyBody}>No business is linked to this account yet. Start with your business details, or contact us if Tendso has already built your website.</p>
        <div className={styles.emptyActions}>
            <Link className={`${styles.button} ${styles.primaryButton}`} href="/start">Tell us about your business <ArrowRight size={17} aria-hidden="true" /></Link>
            <Link className={`${styles.button} ${styles.quietButton}`} href="/contact">Find an existing website</Link>
        </div>
    </section>;
}

export function SiteNotAvailable() {
    return <section className={styles.emptyCard} aria-label="Website not available">
        <span className={styles.emptyIcon}><Globe size={36} strokeWidth={1.4} aria-hidden="true" /></span>
        <p className={styles.eyebrow}>Let’s get you back</p>
        <h2>This website isn’t available.</h2>
        <p className={styles.emptyBody}>It may not be linked to your account, or it may not be ready yet. Go back to your businesses to choose another one.</p>
        <div className={styles.emptyActions}>
            <Link className={`${styles.button} ${styles.primaryButton}`} href="/my-business">Back to my businesses <ArrowRight size={17} aria-hidden="true" /></Link>
            <Link className={`${styles.button} ${styles.quietButton}`} href="/contact">Get help</Link>
        </div>
    </section>;
}

export function SiteOverviewLoading() {
    return <Loading label="Loading your businesses">
        <div className={styles.stack} aria-hidden="true">
            <div className={styles.loadingHeader}><span className={styles.skeletonIcon} /><span className={`${styles.skeleton} ${styles.skeletonTitle}`} /><span className={styles.skeletonPill} /></div>
            <div className={styles.siteGrid}>{[0, 1].map(item => <div className={styles.loadingCard} key={item}>
                <span className={styles.skeletonIcon} /><span className={`${styles.skeleton} ${styles.skeletonTitle}`} /><span className={`${styles.skeleton} ${styles.skeletonLine}`} /><span className={`${styles.skeleton} ${styles.skeletonAction}`} />
            </div>)}</div>
        </div>
    </Loading>;
}
