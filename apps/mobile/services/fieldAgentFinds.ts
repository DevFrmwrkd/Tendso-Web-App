import { isCreatorAccount } from '../../../lib/accounts';
import { distanceKm, findKind, type CommunityFind, type FindKind } from './fieldAgentMap';
import { validMapCoordinate, type MapSearchArea } from './workArea';

export type WorkspaceAccount = {
  role?: string; firstName?: string; lastName?: string;
  certifiedAt?: number; rejectedAt?: number; quizPassedAt?: number;
};

/** Every entry to Map/Finds/Spot respects the same certification flow. */
export function fieldAgentWorkspaceRedirect(account: WorkspaceAccount): string | null {
  if (!isCreatorAccount(account)) return account.role === 'affiliate' ? '/(app)/(affiliate-tabs)/'
    : account.role === 'admin' ? '/(app)/admin' : '/(app)/account-unavailable';
  if (!account.firstName?.trim() && !account.lastName?.trim()) return '/(app)/complete-profile';
  if (account.certifiedAt) return null;
  if (account.rejectedAt) return '/(app)/verification-rejected';
  return account.quizPassedAt ? '/(app)/pending-review' : '/(app)/training';
}

export function currentMonthEarnings(
  earnings: readonly { amount: number; status?: string; createdAt?: number; _creationTime?: number }[],
  now = Date.now(),
): number {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit',
  });
  const month = (date: number) => formatter.format(new Date(date));
  const current = month(now);
  return earnings.reduce((total, earning) => {
    const when = earning.createdAt ?? earning._creationTime;
    return Number.isFinite(earning.amount) && when != null && Number.isFinite(new Date(when).getTime())
      && ['available', 'withdrawn'].includes(earning.status ?? '') && month(when) === current
      ? total + earning.amount : total;
  }, 0);
}

export type FindFilter = 'all' | 'near' | 'needs' | FindKind;

/** Address-only legacy leads still belong in the feed; only Near me requires coordinates. */
export function filterCommunityFinds(
  leads: readonly CommunityFind[], filter: FindFilter, search: string, area: MapSearchArea | null,
): CommunityFind[] {
  const needle = search.trim().toLocaleLowerCase();
  const nearbyDistance = (lead: CommunityFind) => {
    const point = { latitude: lead.businessLatitude as number, longitude: lead.businessLongitude as number };
    return area && validMapCoordinate(point) ? distanceKm(area, point) : null;
  };
  const rows = leads.filter((lead) => {
    if (needle && ![lead.businessName, lead.businessAddress, lead.businessCity,
      lead.spottedBy?.displayName, lead.submittedBy?.displayName].some((value) => value?.toLocaleLowerCase().includes(needle))) return false;
    if (filter === 'needs') return lead.needsWebsite === true && lead.hasLiveWebsite !== true;
    if (filter === 'near') { const km = nearbyDistance(lead); return km != null && km <= 5; }
    return filter === 'all' || (lead.communityKind ?? findKind(lead.businessType)) === filter;
  });
  return rows.sort((a, b) => filter === 'near'
    ? (nearbyDistance(a) ?? Infinity) - (nearbyDistance(b) ?? Infinity)
    : (b.spottedAt ?? b.createdAt ?? 0) - (a.spottedAt ?? a.createdAt ?? 0));
}

export function findWebsiteLabel(lead: CommunityFind): string {
  if (lead.hasLiveWebsite === true) return 'Live';
  if (lead.needsWebsite === true) return 'Needs a site';
  return lead.needsWebsite === false ? 'Has a website' : 'Check for a website';
}
