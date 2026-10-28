import React from 'react';
import { useRouter } from 'expo-router';
import { Card, EmptyState, ListRow, ScreenShell } from '../../../components/v2';
import { phaseLine } from '../../../lib/v2/ownerFlow';
import { ownerIntake } from '../../../lib/v2/ownerIntake';
import { ownerSiteRoute } from '../../../lib/v2/ownerNavigation';
import { useOwnerSite } from '../../../lib/v2/useOwnerSite';
import { space } from '../../../theme/v2';

/** A site's current status, with an action that opens that owned site. */
export default function Inbox() {
  const router = useRouter();
  const { me } = useOwnerSite();
  const sites = me?.sites ?? [];
  return <ScreenShell title="Inbox" subtitle="Updates on your websites" onBack={() => router.back()}>
    {sites.length === 0 ? <EmptyState icon="mail-open-outline" title="Nothing yet" /> : <Card style={{ paddingVertical: space.xs }}>
      {sites.map((site, index) => <ListRow key={site.submissionId} title={site.businessName}
        subtitle={site.openChangeRequests > 0 ? `${phaseLine(site.phase)} · we are reviewing your change` : phaseLine(site.phase)}
        icon={site.phase === 'live' ? 'checkmark-circle-outline' : 'time-outline'} divider={index < sites.length - 1}
        accessibilityHint="Opens this website" onPress={() => {
          if (!me?.sites.some(owned => owned.submissionId === site.submissionId)) return;
          ownerIntake.set({ submissionId: site.submissionId });
          router.push(ownerSiteRoute(site) as never);
        }} />)}
    </Card>}
  </ScreenShell>;
}
