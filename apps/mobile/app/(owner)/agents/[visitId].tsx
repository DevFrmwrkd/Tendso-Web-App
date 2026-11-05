import React, { useLayoutEffect, useRef, useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Avatar, Banner, Button, Card, Loading, Pill, ScreenShell, Text } from '../../../components/v2';
import { useOwnerSite } from '../../../lib/v2/useOwnerSite';
import { useOwnerVisit, useVisitActions, useVisitOperation, visitPhoneLink, visitSchedule, visitStatusLabel, type VisitId } from '../../../lib/v2/visitRequests';
import { openDirections } from '../../../services/links';
import { space } from '../../../theme/v2';

export default function OwnerVisitStatus() {
  const { visitId } = useLocalSearchParams<{ visitId?: string }>();
  const { userId, sessionId } = useAuth();
  const { me } = useOwnerSite();
  const id = typeof visitId === 'string' && visitId ? visitId as VisitId : null;
  return <VisitStatus key={`${userId ?? ''}:${sessionId ?? ''}:${me?.owner._id ?? ''}:${id ?? ''}`} id={id} ownerId={me?.owner._id} />;
}
function VisitStatus({ id, ownerId }: { id: VisitId | null; ownerId: string | undefined }) {
  const router = useRouter();
  const { userId } = useAuth();
  const visit = useOwnerVisit(id);
  const actions = useVisitActions();
  const operation = useVisitOperation(id ?? 'missing-visit');
  const latest = useRef(visit);
  useLayoutEffect(() => { latest.current = visit; }, [visit]);
  const [notice, setNotice] = useState('');
  const back = () => router.replace('/(owner)/(tabs)/agents' as never);
  if (id && visit === undefined) return <Loading label="Loading your visit" />;
  if (!visit || visit.ownerId !== ownerId || visit.actorClerkId !== userId || visit._id !== id) return <ScreenShell title="Visit not available"
    subtitle="Open a visit request from your own account." onBack={back} footer={<Button title="Your visits" onPress={back} />} />;
  const active = visit.status !== 'completed' && visit.status !== 'cancelled';
  const description = visit.status === 'requested' ? 'The team is arranging a field agent and a proposed time. Your visit is not confirmed yet.'
    : visit.status === 'assigned' ? 'A field agent is assigned. This proposed time is waiting for their acceptance; the visit is not confirmed yet.'
      : visit.status === 'confirmed' ? 'Your field agent accepted the visit. Check the confirmed time below.'
        : visit.status === 'completed' ? 'The field agent marked this visit complete. Shop capture, submission and publication are separate steps.'
          : 'This visit is cancelled. No field agent should travel for this request.';
  const cancel = () => {
    if (operation.busy || operation.offline || !operation.isCurrent()) return;
    Alert.alert('Cancel this visit?', 'The team and assigned field agent will be told. Your business and website stay unchanged.', [
      { text: 'Keep visit', style: 'cancel' }, { text: 'Cancel visit', style: 'destructive', onPress: () => {
        if (!operation.isCurrent() || latest.current?.revision !== visit.revision || latest.current?.status !== visit.status) return;
        void operation.run(() => actions.cancel({ id: visit._id, expectedRevision: visit.revision, clerkId: userId ?? undefined }), result => {
          if (result._id === id && result.actorClerkId === userId && result.ownerId === ownerId) setNotice('Your visit was cancelled.');
        });
      } },
    ]);
  };
  const agentPhone = visitPhoneLink(visit.assignedAgent?.phone);
  return <ScreenShell title={visit.shopName} subtitle="Shop visit request" onBack={back} contentStyle={styles.content}>
    <Pill label={visitStatusLabel(visit.status)} tone={visit.status === 'confirmed' ? 'accent' : 'neutral'} />
    <Banner title={visitStatusLabel(visit.status)} body={description} tone={visit.status === 'cancelled' ? 'warn' : 'neutral'} />
    <Card style={styles.card}><Text variant="heading">{visit.status === 'confirmed' ? 'Confirmed time' : 'Proposed time'}</Text>
      <Text weight="bold">{visitSchedule(visit.scheduledAt)}</Text><Text tone="muted">Your requested preference: {visit.preferredWhen}</Text>
      {visit.status === 'assigned' ? <Text tone="muted">Waiting for the field agent to accept.</Text> : null}</Card>
    {visit.assignedAgent ? <Card style={styles.card}><Text variant="heading">Your field agent</Text>
      <View style={styles.agent}><Avatar uri={visit.assignedAgent.profileImage} name={visit.assignedAgent.name} size={52} />
        <View style={{ flex: 1 }}><Text weight="bold">{visit.assignedAgent.name}</Text><Text tone="muted">{visit.status === 'assigned' ? 'Awaiting acceptance' : visit.status === 'confirmed' ? 'Visit confirmed' : 'Assigned field agent'}</Text></View></View>
      {active && agentPhone ? <Button title="Call field agent" variant="ghost" onPress={() => { void Linking.openURL(agentPhone).catch(() => {}); }} /> : null}
    </Card> : null}
    <Card style={styles.card}><Text variant="heading">Shop location</Text><Text>{visit.address}</Text><Text tone="muted">{visit.city}</Text>
      <Button title="View directions" variant="ghost" onPress={() => { void openDirections({ latitude: visit.coordinates.lat, longitude: visit.coordinates.lng, label: visit.shopName }); }} />
    </Card>
    <Card style={styles.card}><Text variant="heading">Your contact for this visit</Text><Text>{visit.ownerName}</Text><Text>{visit.phone}</Text>
      {visit.email ? <Text tone="muted">{visit.email}</Text> : null}</Card>
    {visit.status === 'cancelled' && visit.cancellationReason ? <Banner title="Cancellation details" body={visit.cancellationReason} /> : null}
    {operation.error ? <Text tone="danger" accessibilityRole="alert">{operation.error}</Text> : null}
    {notice ? <Text accessibilityLiveRegion="polite">{notice}</Text> : null}
    {operation.offline ? <Text tone="muted">Reconnect to manage your visit.</Text> : null}
    {active ? <Button title="Cancel visit" variant="danger" disabled={operation.busy || operation.offline} loading={operation.busy} onPress={cancel} /> : null}
    {!active ? <Button title="Request another visit" onPress={() => router.push('/(owner)/agents/book' as never)} /> : null}
  </ScreenShell>;
}
const styles = StyleSheet.create({ content: { gap: space.lg }, card: { gap: space.sm }, agent: { flexDirection: 'row', gap: space.md, alignItems: 'center' } });
