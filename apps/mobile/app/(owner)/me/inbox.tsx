/**
 * Inbox: what is happening with your sites, newest first.
 * Built from owners.me (each site's phase and open changes). Later: a message feed
 * (build ready, change done, payment received) needs owners.inbox and owner push tokens.
 */
import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, EmptyState, ListRow, ScreenShell } from '../../../components/v2';
import { phaseLine } from '../../../lib/v2/ownerFlow';
import { useOwnerSite } from '../../../lib/v2/useOwnerSite';
import { space } from '../../../theme/v2';

export default function Inbox() {
  const router = useRouter();
  const { me } = useOwnerSite();
  const sites = me?.sites ?? [];

  return (
    <ScreenShell title="Inbox" onBack={() => router.back()}>
      {sites.length === 0 ? (
        <EmptyState icon="mail-open-outline" title="Nothing yet" />
      ) : (
        <Card style={{ paddingVertical: space.xs }}>
          {sites.map((s, i) => (
            <ListRow
              key={s.submissionId}
              title={s.businessName}
              subtitle={s.openChangeRequests > 0 ? `${phaseLine(s.phase)} · we are making your change` : phaseLine(s.phase)}
              icon={s.phase === 'live' ? 'checkmark-circle-outline' : 'time-outline'}
              divider={i < sites.length - 1}
            />
          ))}
        </Card>
      )}
      <View style={{ height: space.xl }} />
    </ScreenShell>
  );
}
