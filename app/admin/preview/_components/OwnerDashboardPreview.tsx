"use client";

import { SiteList, SiteNotAvailable, SiteOverview } from '@/app/my-business/_components/OwnerHome';
import { OwnerPageHeader, OwnerShellView } from '@/components/shells/OwnerShell';
import { OWNER_PREVIEW_SITES } from '../_lib/ownerPreviewData';
import { PreviewGuard } from './PreviewGuard';
import { PreviewNotice } from './PreviewNotice';

/** Current owner presentation with local fixtures, without the live owner auth hook. */
export function OwnerDashboardPreview({ business }: { business?: string }) {
    const site = business ? OWNER_PREVIEW_SITES.find(item => item.submissionId === business) : undefined;
    return <PreviewGuard role="owner">
        <OwnerShellView name="Alex Santos" preview>
            <PreviewNotice view="Business owner" />
            <OwnerPageHeader title={site?.businessName ?? (business ? 'Business preview' : 'Your businesses')}
                subtitle="Check your websites, pick up where you left off and see what needs you next."
                back={!!business} preview />
            {business ? site ? <SiteOverview site={site} preview /> : <SiteNotAvailable preview />
                : <SiteList sites={OWNER_PREVIEW_SITES} preview />}
        </OwnerShellView>
    </PreviewGuard>;
}
