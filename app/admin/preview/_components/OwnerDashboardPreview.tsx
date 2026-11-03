"use client";

import { SiteList, SiteNotAvailable, SiteOverview } from '@/app/my-business/_components/OwnerHome';
import { OwnerNotificationsView } from '@/app/my-business/notifications/_components/OwnerNotifications';
import { OwnerTodayView } from '@/app/my-business/today/_components/OwnerToday';
import { OwnerVisitDetailsView, OwnerVisitsView } from '@/app/my-business/visits/_components/OwnerVisits';
import { OwnerPageHeader, OwnerShellView, type OwnerWebSection } from '@/components/shells/OwnerShell';
import { OWNER_PREVIEW_INBOX, OWNER_PREVIEW_NOW, OWNER_PREVIEW_SITES, OWNER_PREVIEW_VISITS } from '../_lib/ownerPreviewData';
import { PreviewGuard } from './PreviewGuard';
import { PreviewNotice } from './PreviewNotice';

const BASE = '/admin/preview/owner';
export const OWNER_PREVIEW_SECTIONS = ['today', 'businesses', 'visits', 'notifications'] as const;
export function ownerPreviewSection(value?: string): OwnerWebSection {
    return OWNER_PREVIEW_SECTIONS.find(section => section === value) ?? 'today';
}

/** Current owner presentation with local fixtures, without the live owner auth hook. */
export function OwnerDashboardPreview({ business, visit, section, eventKey }: { business?: string; visit?: string; section?: string; eventKey?: string }) {
    const site = business ? OWNER_PREVIEW_SITES.find(item => item.submissionId === business) : undefined;
    const request = visit ? OWNER_PREVIEW_VISITS.find(item => item._id === visit) : undefined;
    const activeSection = business ? 'businesses' : visit ? 'visits' : ownerPreviewSection(section);
    const sectionHref = (value: OwnerWebSection) => `${BASE}?section=${value}`;
    const businessContent = <>
        <OwnerPageHeader title={site?.businessName ?? (business ? 'Business preview' : 'Your businesses')}
            subtitle="Check your websites, pick up where you left off and see what needs you next." back={!!business} preview />
        {business ? site ? <SiteOverview site={site} preview /> : <SiteNotAvailable preview /> : <SiteList sites={OWNER_PREVIEW_SITES} preview />}
    </>;
    return <PreviewGuard role="owner">
        <OwnerShellView name="Alex Santos" preview previewSection={activeSection} unreadCount={OWNER_PREVIEW_INBOX.unreadCount}>
            <PreviewNotice view="Business owner" />
            {activeSection === 'businesses' ? businessContent : activeSection === 'today' ? <OwnerTodayView
                name="Alex Santos" sites={OWNER_PREVIEW_SITES} visits={OWNER_PREVIEW_VISITS} inbox={OWNER_PREVIEW_INBOX} now={OWNER_PREVIEW_NOW} preview
                hrefForBusiness={item => `${BASE}?business=${encodeURIComponent(item.submissionId)}`}
                hrefForVisit={item => `${BASE}?visit=${encodeURIComponent(item._id)}`}
                inboxHref={sectionHref('notifications')} businessesHref={sectionHref('businesses')} visitsHref={sectionHref('visits')}
                addBusinessHref={sectionHref('businesses')} requestVisitHref={sectionHref('visits')} />
                : activeSection === 'visits' ? <>
                    <OwnerPageHeader title={visit ? 'Your shop visit' : 'Shop visits'} subtitle={visit ? 'See the proposed time, field agent and latest status.' : 'Request help and keep track of your field agent’s visit.'}
                        back={!!visit} backHref={sectionHref('visits')} backLabel="All visit requests" preview />
                    {visit ? request ? <OwnerVisitDetailsView request={request} preview /> : <section className="t-card t-card-pad"><h2 className="t-h2">Visit request not available</h2><p className="t-body">Choose one of the fictional visit requests in this preview.</p><a className="t-link" href={sectionHref('visits')}>Back to shop visits</a></section>
                        : <OwnerVisitsView requests={OWNER_PREVIEW_VISITS} hrefForVisit={id => `${BASE}?visit=${encodeURIComponent(id)}`} preview />}
                </> : <>
                    <OwnerPageHeader title="Notifications" subtitle="Your visits, payments and website updates, together." />
                    <OwnerNotificationsView key={eventKey ?? 'inbox'} inbox={OWNER_PREVIEW_INBOX} sites={OWNER_PREVIEW_SITES} preview initialSelectedKey={eventKey} />
                </>}
        </OwnerShellView>
    </PreviewGuard>;
}
