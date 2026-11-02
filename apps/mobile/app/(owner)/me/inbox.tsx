import React, { useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { Card, EmptyState, ListRow, ScreenShell } from '../../../components/v2';
import { phaseLine } from '../../../lib/v2/ownerFlow';
import { ownerIntake } from '../../../lib/v2/ownerIntake';
import { ownerSiteRoute } from '../../../lib/v2/ownerNavigation';
import { useOwnerSite } from '../../../lib/v2/useOwnerSite';
import { space } from '../../../theme/v2';

/** A site's current status, with an action that opens that owned site. */
export default function Inbox() {
  const router = useGuardedRouter();
  const { userId } = useAuth();
  const { me } = useOwnerSite();
  const sites = me?.sites ?? [];
  const mounted = useRef(true);
  const scope = ownerIntake.scope();
  const live = useRef({ userId, me });
  live.current = { userId, me };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return <ScreenShell title="Inbox" subtitle="Updates on your websites" onBack={() => router.back()}>
    {sites.length === 0 ? <EmptyState icon="mail-open-outline" title="Nothing yet" /> : <Card style={{ paddingVertical: space.xs }}>
      {sites.map((site, index) => <ListRow key={site.submissionId} title={site.businessName}
        subtitle={site.openChangeRequests > 0 ? `${phaseLine(site.phase)} · we are reviewing your change` : phaseLine(site.phase)}
        icon={site.phase === 'live' ? 'checkmark-circle-outline' : 'time-outline'} divider={index < sites.length - 1}
        accessibilityHint="Opens this website" onPress={() => {
          if (!mounted.current || live.current.userId !== userId || live.current.me?.owner._id !== me?.owner._id
            || !ownerIntake.isCurrent(scope)) return;
          const owned = live.current.me?.sites.find(item => item.submissionId === site.submissionId);
          if (!owned) return;
          ownerIntake.set({ submissionId: owned.submissionId });
          router.push(ownerSiteRoute(owned) as never);
        }} />)}
    </Card>}
  </ScreenShell>;
}
