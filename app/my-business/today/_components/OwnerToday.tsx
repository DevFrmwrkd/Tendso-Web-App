"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Check, ChevronRight, Globe, Mail, Plus, Sparkles, Store, Wallet } from "lucide-react";
import { OwnerPageHeader } from "@/components/shells/OwnerShell";
import { ownerPhaseStatus, type OwnerSite } from "../../_components/ownerSite";
import { hasLiveBalance, ownerTodayAction, ownerTodayFocus, ownerTodayGreeting, ownerTodayModel, ownerTodayPeso, ownerTodayPhase,
    ownerVisitLabel, ownerVisitSchedule, type OwnerTodayInbox, type OwnerTodayVisit } from "./ownerTodayModel";
import styles from "./OwnerToday.module.css";

export type OwnerTodayViewProps = {
    name?: string | null; sites: readonly OwnerSite[]; visits?: readonly OwnerTodayVisit[]; inbox?: OwnerTodayInbox;
    preview?: boolean; now: number; hrefForBusiness?: (site: OwnerSite) => string; hrefForVisit?: (visit: OwnerTodayVisit) => string;
    inboxHref?: string; requestVisitHref?: string; businessesHref?: string; addBusinessHref?: string; visitsHref?: string;
};

/** Read-only presentation shared with the admin sample. It never opens checkout or marks an update read. */
export function OwnerTodayView({ name, sites, visits, inbox, preview = false, now, hrefForBusiness, hrefForVisit,
    inboxHref, requestVisitHref, businessesHref, addBusinessHref, visitsHref }: OwnerTodayViewProps) {
    const model = ownerTodayModel(sites, visits ?? [], now);
    const businessHref = hrefForBusiness ?? (site => preview ? `/admin/preview/owner#business-${site.submissionId}` : `/my-business/${site.submissionId}`);
    const visitHref = hrefForVisit ?? (visit => preview ? `/admin/preview/owner#visit-${visit._id}` : `/my-business/visits/${visit._id}`);
    const updatesHref = inboxHref ?? (preview ? "/admin/preview/owner#notifications" : "/my-business/notifications");
    const allBusinessesHref = businessesHref ?? (preview ? "/admin/preview/owner#businesses" : "/my-business");
    const requestHref = requestVisitHref ?? (preview ? "/admin/preview/owner#request-visit" : "/my-business/visits/new");
    const addHref = addBusinessHref ?? (preview ? "/admin/preview/owner#add-business" : "/v2/start");
    const allVisitsHref = visitsHref ?? (preview ? "/admin/preview/owner#visits" : "/my-business/visits");
    const { primary, todayVisit, nextVisit, attention, remaining, openDrafts } = model;
    const firstName = name?.trim().split(/\s+/)[0];
    const date = new Date(now).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", weekday: "long", month: "short", day: "numeric" });
    const firstThree = sites.slice(0, 3);
    const events = inbox?.items.slice(0, 3) ?? [];
    return <>
        <OwnerPageHeader title="Today" subtitle={`${date} · ${ownerTodayGreeting(now)}${firstName ? `, ${firstName}` : ""}`} />
        <div className={styles.dashboard} id="today">
            <section className={styles.stats} aria-label="Your business overview">
                <div className={styles.stat}><Store size={20} aria-hidden="true" /><strong>{sites.length}</strong><span>Businesses</span></div>
                <div className={styles.stat}><Globe size={20} aria-hidden="true" /><strong>{model.liveCount}</strong><span>Live websites</span></div>
                <div className={`${styles.stat} ${attention.length ? styles.attentionStat : ""}`}><Sparkles size={20} aria-hidden="true" /><strong>{attention.length}</strong><span>Need you</span></div>
            </section>
            <div className={styles.mainGrid}>
                <div className={styles.column}>
                    <section className={styles.focus} aria-labelledby="today-next-title">
                        <div className={styles.eyebrow}><span className={styles.focusIcon}>{todayVisit ? <CalendarDays size={23} aria-hidden="true" /> : primary ? <Sparkles size={23} aria-hidden="true" /> : <Check size={23} aria-hidden="true" />}</span>
                            {todayVisit ? "On your schedule" : primary ? "Your next step" : "Looking good"}</div>
                        <h2 id="today-next-title">{todayVisit ? "An agent is visiting today." : ownerTodayFocus(primary, sites.length)}</h2>
                        <p>{todayVisit ? `${todayVisit.shopName} · ${ownerVisitSchedule(todayVisit.scheduledAt)}`
                            : primary ? `${primary.businessName} · ${ownerTodayPhase(primary.phase)}`
                                : sites.length ? "Your websites and visit updates are together here. We’ll let you know when something needs you."
                                    : "Start a website yourself, or ask a field agent to visit your shop."}</p>
                        <Link className={`${styles.button} ${styles.primaryButton}`} href={todayVisit ? visitHref(todayVisit) : primary ? businessHref(primary) : sites.length ? updatesHref : addHref}>
                            {todayVisit ? "View today’s visit" : primary ? ownerTodayAction(primary) : sites.length ? "Check notifications" : "Add a business"}<ArrowRight size={18} aria-hidden="true" /></Link>
                    </section>
                    {remaining > 0 ? <section className={styles.balance} aria-label="Outstanding website payments"><div><p>Remaining across your websites</p><strong>{ownerTodayPeso(remaining)}</strong></div><Wallet size={26} aria-hidden="true" /></section> : null}
                    <section className={styles.section} id="today-businesses" aria-labelledby="today-businesses-title">
                        <div className={styles.sectionHead}><h2 id="today-businesses-title">Your businesses</h2><Link href={allBusinessesHref}>View all <ArrowRight size={16} aria-hidden="true" /></Link></div>
                        {firstThree.length ? <div className={styles.list}>{firstThree.map(site => {
                            const status = ownerPhaseStatus(site);
                            return <Link key={site.submissionId} href={businessHref(site)} className={styles.row}>
                                <span className={styles.rowIcon}>{site.phase === "live" ? <Globe size={20} aria-hidden="true" /> : <Store size={20} aria-hidden="true" />}</span>
                                <div className={styles.rowText}><strong>{site.businessName}</strong><span>{hasLiveBalance(site) ? `${ownerTodayPeso(site.balanceDue)} remaining` : ownerTodayPhase(site.phase)}</span></div>
                                <span className={styles.phase} data-tone={status.tone}>{status.word}</span><ChevronRight size={17} aria-hidden="true" /></Link>;
                        })}</div> : <div className={styles.empty}><Store size={23} aria-hidden="true" /><h3>Your businesses will appear here</h3><p>Add your business to start a website, or request a visit for help.</p></div>}
                        <div className={styles.quickActions}>{openDrafts >= 3 ? <button className={styles.button} type="button" disabled>Add a business <Plus size={17} aria-hidden="true" /></button>
                            : <Link className={styles.button} href={addHref}>Add a business <Plus size={17} aria-hidden="true" /></Link>}
                            <Link className={styles.button} href={requestHref}>Request a visit <CalendarDays size={17} aria-hidden="true" /></Link></div>
                        {openDrafts >= 3 ? <p className={styles.note}>Finish one of your three drafts before adding another business.</p> : null}
                    </section>
                </div>
                <div className={styles.column}>
                    <section className={styles.section} aria-labelledby="today-visits-title">
                        <div className={styles.sectionHead}><h2 id="today-visits-title">Your visits</h2><Link href={allVisitsHref}>See all <ArrowRight size={16} aria-hidden="true" /></Link></div>
                        {nextVisit ? <Link className={styles.visit} href={visitHref(nextVisit)} aria-label={`Visit for ${nextVisit.shopName}, ${ownerVisitLabel(nextVisit.status)}`}>
                            <div className={styles.visitHead}><span className={styles.rowIcon}><CalendarDays size={22} aria-hidden="true" /></span><div className={styles.rowText}><strong>{nextVisit.shopName}</strong><span>{nextVisit.scheduledAt ? ownerVisitSchedule(nextVisit.scheduledAt) : `Preferred: ${nextVisit.preferredWhen}`}</span></div><ChevronRight size={18} aria-hidden="true" /></div>
                            <span className={styles.visitStatus}><i aria-hidden="true" />{ownerVisitLabel(nextVisit.status)}</span>
                            <p>{nextVisit.status === "assigned" ? "We’re waiting for your assigned agent to accept." : nextVisit.status === "confirmed"
                                ? `${nextVisit.assignedAgent?.name ?? "Your field agent"} has accepted the visit.` : "The team will assign an agent and confirm a time."}</p></Link>
                            : visits === undefined ? <div className={styles.empty} role="status">Loading your visits…</div>
                                : <div className={styles.empty}><CalendarDays size={23} aria-hidden="true" /><h3>No upcoming visits</h3><p>Need help with photos and your story? Ask an agent to visit.</p><Link href={requestHref} className={styles.textLink}>Request a shop visit <ArrowRight size={16} aria-hidden="true" /></Link></div>}
                    </section>
                    <section className={styles.section} aria-labelledby="today-updates-title">
                        <div className={styles.sectionHead}><h2 id="today-updates-title">Recent updates</h2><Link href={updatesHref}>View all <ArrowRight size={16} aria-hidden="true" /></Link></div>
                        {!inbox ? <div className={styles.empty} role="status">Loading your updates…</div> : events.length ? <div className={styles.list}>{events.map(item => <Link key={item.key} className={styles.row}
                            href={preview ? updatesHref : `${updatesHref}${updatesHref.includes("?") ? "&" : "?"}eventKey=${encodeURIComponent(item.key)}`}>
                            <span className={styles.rowIcon}>{item.visitRequestId ? <CalendarDays size={20} aria-hidden="true" /> : <Mail size={20} aria-hidden="true" />}</span>
                            <div className={styles.rowText}><strong>{item.title}</strong><span>{item.body}</span></div>
                            {!item.read ? <span className={styles.unread} aria-label="Unread" /> : null}<ChevronRight size={17} aria-hidden="true" /></Link>)}</div>
                            : <div className={styles.empty}><Mail size={23} aria-hidden="true" /><p>Visit and website updates will appear here.</p></div>}
                    </section>
                </div>
            </div>
        </div>
    </>;
}
