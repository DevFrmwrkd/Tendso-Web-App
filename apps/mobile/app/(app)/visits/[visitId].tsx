import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Linking, Modal, Platform, StyleSheet } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Banner, Button, Card, Field, Loading, Pill, ScreenShell, Text } from '../../../components/v2';
import { useMobileAccount } from '../../../hooks/useMobileAccount';
import { useAssignedVisit, useVisitActions, useVisitOperation, visitPhoneLink, visitSchedule, visitStatusLabel, type VisitId } from '../../../lib/v2/visitRequests';
import { openDirections } from '../../../services/links';
import { space } from '../../../theme/v2';

export default function AgentVisitDetail() {
  const { visitId } = useLocalSearchParams<{ visitId?: string }>();
  const { userId, sessionId } = useAuth();
  const account = useMobileAccount();
  const id = typeof visitId === 'string' && visitId ? visitId as VisitId : null;
  return <VisitDetail key={`${userId ?? ''}:${sessionId ?? ''}:${account.account?._id ?? ''}:${id ?? ''}`} id={id} />;
}
function VisitDetail({ id }: { id: VisitId | null }) {
  const router = useRouter();
  const { userId } = useAuth();
  const account = useMobileAccount();
  const allowed = account.role === 'creator' && !account.isBlocked && !account.isPreview
    && !!account.account?.certifiedAt && !account.account.rejectedAt && account.account.clerkId === userId;
  const visit = useAssignedVisit(id, allowed);
  const actions = useVisitActions();
  const operation = useVisitOperation(id ?? 'missing-visit');
  const [agentNote, setAgentNote] = useState(''), [reason, setReason] = useState(''), [notice, setNotice] = useState('');
  const [declineRevision, setDeclineRevision] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer); }, []);
  const latest = useRef(visit);
  useLayoutEffect(() => { latest.current = visit; }, [visit]);
  const back = () => { Keyboard.dismiss(); router.replace('/(app)/visits' as never); };
  if (allowed && id && visit === undefined) return <Loading label="Loading assigned visit" />;
  if (!allowed || !visit || visit._id !== id || visit.actorClerkId !== userId || visit.assignedAgentId !== account.account?._id) return <ScreenShell
    title="Visit not available" subtitle="This visit is not currently assigned to your account." onBack={back} footer={<Button title="Your visits" onPress={back} />} />;
  const active = visit.status === 'assigned' || visit.status === 'confirmed';
  const hasTime = typeof visit.scheduledAt === 'number' && Number.isFinite(visit.scheduledAt) && visit.scheduledAt > 0;
  const future = hasTime && visit.scheduledAt! > now;
  const current = () => operation.isCurrent() && !!latest.current && latest.current._id === visit._id && latest.current.revision === visit.revision
    && latest.current.assignedAgentId === account.account?._id;
  const act = (action: 'accept' | 'complete' | 'decline') => {
    if (!current() || operation.busy || operation.offline || action === 'decline' && reason.trim().length < 2) return;
    if (action === 'accept' && (!hasTime || visit.scheduledAt! <= Date.now())) return;
    if (action === 'complete' && (!hasTime || visit.scheduledAt! > Date.now())) return;
    Keyboard.dismiss();
    const args = { id: visit._id, expectedRevision: visit.revision, clerkId: userId ?? undefined };
    const work = action === 'decline' ? () => actions.decline({ ...args, reason: reason.trim() })
      : () => actions[action]({ ...args, agentNote: agentNote.trim() || undefined });
    void operation.run(work, result => {
      if (result._id !== id || result.actorClerkId !== userId) return;
      if (latest.current && result.revision < latest.current.revision) return;
      if (action === 'decline') { setDeclineRevision(null); router.replace('/(app)/visits' as never); }
      else setNotice(action === 'accept' ? 'Visit accepted.' : 'Visit marked complete. Submit any shop capture separately.');
    });
  };
  const confirm = (action: 'accept' | 'complete') => {
    if (!current() || operation.busy || operation.offline) return;
    Alert.alert(action === 'accept' ? 'Accept this visit?' : 'Mark this visit complete?', action === 'accept'
      ? `${visit.shopName}\n${visitSchedule(visit.scheduledAt)}\nAccept only if you can make this proposed time.`
      : 'This records the visit only. Submit photos and interviews through the capture flow separately.', [
      { text: 'Not now', style: 'cancel' }, { text: action === 'accept' ? 'Accept visit' : 'Mark complete', onPress: () => act(action) },
    ]);
  };
  const phone = visitPhoneLink(visit.phone);
  const declineOpen = declineRevision !== null && declineRevision === visit.revision && visit.status === 'assigned';
  return <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScreenShell title={visit.shopName} subtitle="Assigned shop visit" onBack={back} contentStyle={styles.content}>
      <Pill label={visitStatusLabel(visit.status)} tone={visit.status === 'confirmed' ? 'accent' : 'neutral'} />
      <Banner title={visit.status === 'assigned' ? 'Confirm before travelling' : visitStatusLabel(visit.status)} body={visit.status === 'assigned'
        ? 'Review the proposed time and location. The visit becomes confirmed when you accept.'
        : visit.status === 'confirmed' ? 'You accepted this visit. Contact the owner if you need directions.'
          : visit.status === 'cancelled' ? 'Do not travel for this cancelled visit.' : 'This visit is complete. Website submission and publication are separate.'} />
      <Card style={styles.card}><Text variant="heading">{visit.status === 'assigned' ? 'Proposed time' : 'Visit time'}</Text>
        <Text weight="bold">{visitSchedule(visit.scheduledAt)}</Text><Text tone="muted">Owner’s requested preference: {visit.preferredWhen}</Text></Card>
      {visit.status === 'assigned' && !future ? <Banner tone="warn" title={hasTime ? 'Proposed time has passed' : 'A visit time is needed'}
        body="Ask the Tendso team to set a new proposed time before accepting." /> : null}
      {visit.status === 'confirmed' && future ? <Text tone="muted">You can mark this visit complete at or after the scheduled start time.</Text> : null}
      <Card style={styles.card}><Text variant="heading">Shop location</Text><Text>{visit.address}</Text><Text tone="muted">{visit.city}</Text>
        {active ? <Button title="Directions to shop" variant="ghost" onPress={() => { void openDirections({ latitude: visit.coordinates.lat, longitude: visit.coordinates.lng, label: visit.shopName }); }} /> : null}
      </Card>
      {active ? <Card style={styles.card}><Text variant="heading">Owner contact</Text><Text weight="bold">{visit.ownerName}</Text><Text>{visit.phone}</Text>
        {phone ? <Button title="Call owner" variant="ghost" onPress={() => { void Linking.openURL(phone).catch(() => {}); }} /> : null}
      </Card> : null}
      {active ? <Field label="Visit note (optional)" value={agentNote} onChangeText={setAgentNote} multiline maxLength={1000} editable={!operation.busy}
        helper="For the Tendso team. This is not a shop interview." /> : null}
      {operation.error ? <Text tone="danger" accessibilityRole="alert">{operation.error}</Text> : null}
      {notice ? <Text accessibilityLiveRegion="polite">{notice}</Text> : null}
      {operation.offline ? <Text tone="muted">Reconnect to update this visit.</Text> : null}
      {visit.status === 'assigned' ? <><Button title="Accept visit" disabled={operation.busy || operation.offline || !future} loading={operation.busy} onPress={() => confirm('accept')} />
        <Button title="Decline visit" variant="ghost" disabled={operation.busy || operation.offline} onPress={() => { if (current()) { setReason(''); setDeclineRevision(visit.revision); } }} />
      </> : visit.status === 'confirmed' ? <Button title="Mark visit complete" disabled={operation.busy || operation.offline || !hasTime || future} loading={operation.busy} onPress={() => confirm('complete')} /> : null}
    </ScreenShell>
    <Modal visible={declineOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { if (!operation.busy) setDeclineRevision(null); }}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScreenShell title="Can’t take this visit?" subtitle="Tell the team why so they can arrange another field agent."
          onBack={() => { if (!operation.busy) setDeclineRevision(null); }} footer={<>
            {operation.error ? <Text tone="danger" accessibilityRole="alert">{operation.error}</Text> : null}
            <Button title="Send decline" disabled={operation.busy || operation.offline || reason.trim().length < 2} loading={operation.busy} onPress={() => act('decline')} />
            <Button title="Keep assignment" variant="ghost" disabled={operation.busy} onPress={() => setDeclineRevision(null)} />
          </>}><Field label="Reason for declining" value={reason} onChangeText={setReason} multiline maxLength={500} editable={!operation.busy} /></ScreenShell>
      </KeyboardAvoidingView>
    </Modal>
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({ flex: { flex: 1 }, content: { gap: space.lg }, card: { gap: space.sm } });
