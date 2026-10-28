import { resumeStep, STEP_ROUTE } from './ownerFlow';
import type { SiteSummary } from './ownerTypes';

/** Notification/site-list actions retain the selected owned site. */
export function ownerSiteRoute(site: SiteSummary): string {
  if (site.phase === 'draft') return '/(owner)';
  if (['in_review', 'rejected', 'offline'].includes(site.phase)) return '/(owner)/(tabs)/site';
  return STEP_ROUTE[resumeStep(site.phase)];
}
