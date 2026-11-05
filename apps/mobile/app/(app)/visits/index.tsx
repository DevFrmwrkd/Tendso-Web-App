import React from 'react';
import { View } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { Banner, Button, Card, EmptyState, ListRow, Loading, ScreenShell, Text } from '../../../components/v2';
import { useMobileAccount } from '../../../hooks/useMobileAccount';
import { useAssignedVisits, visitSchedule, visitStatusLabel } from '../../../lib/v2/visitRequests';
import { space } from '../../../theme/v2';

export default function AssignedVisits() {
  const { userId, sessionId } = useAuth();
  const account = useMobileAccount();
  return <VisitList key={`${userId ?? ''}:${sessionId ?? ''}:${account.account?._id ?? ''}`} />;
}
function VisitList() {
  const router = useRouter();
  const { userId } = useAuth();
  const account = useMobileAccount();
  const allowed = account.role === 'creator' && !account.isBlocked && !account.isPreview
    && !!account.account?.certifiedAt && !account.account.rejectedAt && account.account.clerkId === userId;
  const result = useAssignedVisits(allowed);
  const back = () => router.replace('/(app)/(tabs)/' as never);
  if (!allowed) return <ScreenShell title="Visits unavailable" subtitle="Assigned shop visits are for active certified field agents."
    onBack={back} footer={<Button title="Back to home" onPress={back} />} />;
  if (result === undefined) return <Loading label="Loading assigned visits" />;
  const visits = result && result.actorClerkId === userId && result.agentId === account.account?._id
    ? result.requests.filter(visit => visit.actorClerkId === userId && visit.assignedAgentId === account.account?._id) : [];
  const current = visits.filter(visit => visit.status === 'assigned' || visit.status === 'confirmed');
  const past = visits.filter(visit => visit.status === 'completed' || visit.status === 'cancelled');
  return <ScreenShell title="Shop visits" subtitle="Visits assigned to you by the Tendso team." onBack={back} contentStyle={{ gap: space.lg }}>
    <Banner body="An assigned visit is proposed. Accept it to confirm the time with the owner." />
    {!visits.length ? <EmptyState title="No visits assigned" body="New assignments will appear here." icon="calendar-outline" /> : null}
    {[{ title: 'Upcoming visits', rows: current }, { title: 'Past visits', rows: past }].map(group => group.rows.length ? <View key={group.title} style={{ gap: space.sm }}>
      <Text variant="heading">{group.title}</Text><Card style={{ paddingVertical: space.xs }}>{group.rows.map((visit, index) =>
        <ListRow key={visit._id} title={visit.shopName} subtitle={`${visitStatusLabel(visit.status)}\n${visit.city}\n${visitSchedule(visit.scheduledAt)}`}
          subtitleNumberOfLines={0} icon="calendar-outline" divider={index < group.rows.length - 1}
          onPress={() => router.push({ pathname: '/(app)/visits/[visitId]', params: { visitId: visit._id } } as never)} />)}</Card>
    </View> : null)}
  </ScreenShell>;
}
