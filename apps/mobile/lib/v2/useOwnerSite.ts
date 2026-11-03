import { useOwnerMe, newestSite } from './ownerData';
import { ownerIntake, useOwnerIntake } from './ownerIntake';
import type { OwnerMe, SiteSummary, SubmissionId } from './ownerTypes';

/**
 * The site the owner screens work on: the draft this phone started, else the
 * newest site on the account.
 */
export function useOwnerSite(): {
  me: OwnerMe | null | undefined;
  site: SiteSummary | null;
  id: SubmissionId | null;
  isNewBusiness: boolean;
} {
  const me = useOwnerMe();
  const intake = useOwnerIntake();
  const isNewBusiness = intake.newBusiness === true;
  const fromIntake = intake.submissionId ? me?.sites.find((s) => s.submissionId === intake.submissionId) ?? null : null;
  const attaching = ownerIntake.isAwaitingBusiness(intake.submissionId);
  const site = isNewBusiness || (attaching && !fromIntake) ? null : fromIntake ?? newestSite(me);
  // A local id is a selection, never evidence that this login owns the draft.
  return { me, site, id: site?.submissionId ?? null, isNewBusiness };
}

export function firstName(me: OwnerMe | null | undefined): string {
  return (me?.owner.name || '').trim().split(/\s+/)[0] || '';
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Morning';
  if (h < 18) return 'Afternoon';
  return 'Evening';
}
