import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, ListRow, Text } from '..';
import { OWNER_SAMPLE_DATA } from '../../../lib/v2/ownerFlags';
import { useOwnerVisitRequests, visitSchedule, visitStatusLabel } from '../../../lib/v2/visitRequests';
import { useOwnerSite } from '../../../lib/v2/useOwnerSite';
import { space } from '../../../theme/v2';

export function OwnerVisitList() { return OWNER_SAMPLE_DATA ? null : <VisitList />; }
function VisitList() {
  const router = useRouter();
  const { me } = useOwnerSite();
  const visits = useOwnerVisitRequests();
  if (visits === undefined) return <Text tone="muted">Loading your visit requests…</Text>;
  const own = visits.filter(visit => visit.ownerId === me?.owner._id);
  if (!own.length) return <Card><Text tone="muted">Your visit requests and confirmed times will appear here.</Text></Card>;
  const open = own.filter(visit => visit.status !== 'completed' && visit.status !== 'cancelled');
  const past = own.filter(visit => visit.status === 'completed' || visit.status === 'cancelled');
  return <View style={{ gap: space.lg }}>{[{ title: 'Your visits', items: open }, { title: 'Past visits', items: past }].map(({ title, items }) => {
    return items.length ? <View key={title} style={{ gap: space.sm }}><Text variant="heading">{title}</Text>
      <Card style={{ paddingVertical: space.xs }}>{items.map((visit, index) => <ListRow key={visit._id} title={visit.shopName}
        subtitle={`${visitStatusLabel(visit.status)}${visit.scheduledAt ? `\n${visitSchedule(visit.scheduledAt)}` : ` · Preferred: ${visit.preferredWhen}`}`}
        subtitleNumberOfLines={0} icon="calendar-outline" divider={index < items.length - 1}
        onPress={() => router.push({ pathname: '/(owner)/agents/[visitId]', params: { visitId: visit._id } } as never)} />)}</Card>
    </View> : null;
  })}</View>;
}
