import { STEP_ROUTE } from './ownerFlow';
import type { SiteSummary } from './ownerTypes';

/** Notification/site-list actions retain the selected owned site. */
export function ownerSiteRoute(site: SiteSummary): string {
  switch (site.phase) {
    // The index hydrates this selected draft and resumes its saved intake step.
    case 'draft': return '/(owner)';
    case 'building':
    case 'changes_requested': return STEP_ROUTE.building;
    case 'ready_to_check': return STEP_ROUTE.check;
    case 'awaiting_payment': return STEP_ROUTE.pay;
    case 'publishing': return STEP_ROUTE.live;
    // Cold-start routing intentionally sends a live owner to Today. An explicit
    // business action instead opens that business, preserving its selection.
    case 'live':
    case 'in_review':
    case 'rejected':
    case 'offline':
    default: return '/(owner)/(tabs)/site';
  }
}
