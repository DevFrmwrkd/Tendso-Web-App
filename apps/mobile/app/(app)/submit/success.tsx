import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useQuery } from 'convex/react';
import { api, type Id } from '@tendso/convex-client';
import { Ionicons } from '@expo/vector-icons';
import { useCaptureSession } from '../../../hooks/useCaptureSession';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { Button, Card, EmptyState, Loading, ScreenShell, Text, formatPeso } from '../../../components/v2';
import { colors, radius, space } from '../../../theme/v2';

type Receipt = { submissionId: string; queued: boolean; sentAt: number; businessName?: string };

export default function SubmitSuccessScreen() {
  const capture = useCaptureSession();
  if (!capture.isReady) return <Loading />;
  if (!capture.actor) return <ScreenShell title="Sign in to see your capture" subtitle="Your saved capture stays with the field-agent account that created it." />;
  return <CaptureReceipt key={capture.actorKey} />;
}

function CaptureReceipt() {
  const capture = useCaptureSession();
  const router = useGuardedRouter();
  const params = useLocalSearchParams<{ queued?: string; submissionId?: string }>();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    void capture.read<Receipt>('submission_last_sent').then(value => {
      if (active && capture.isCurrent()) {
        setReceipt(value && typeof value.submissionId === 'string' && typeof value.queued === 'boolean'
          && Number.isFinite(value.sentAt) ? value : null);
        setLoaded(true);
      }
    }).catch(() => { if (active && capture.isCurrent()) setLoaded(true); });
    return () => { active = false; };
  }, [capture.actorKey, capture.revision]);
  const requestedId = typeof params.submissionId === 'string' && params.submissionId ? params.submissionId : null;
  // An explicit server route identifies this capture. Only the temporary
  // offline marker follows the latest receipt as sync assigns its server id.
  const matchingReceipt = receipt && (!requestedId || requestedId === 'offline_pending' || receipt.submissionId === requestedId)
    ? receipt : null;
  const id = requestedId && requestedId !== 'offline_pending' ? requestedId : matchingReceipt?.submissionId ?? requestedId;
  const raw = useQuery(api.submissions.getById, capture.canQuery && id && id !== 'offline_pending'
    ? { id: id as Id<'submissions'> } : 'skip');
  const submission = raw?.creatorId === capture.actor?.creatorId ? raw : null;
  const received = !!submission && submission.status !== 'draft';
  const pending = matchingReceipt?.queued === true && !received;
  const locallySent = !capture.canQuery && !!id && id !== 'offline_pending' && matchingReceipt?.queued === false;
  const paid = submission?.status === 'paid' || submission?.status === 'completed';
  const built = !!submission?.websiteUrl || ['website_generated', 'deployed', 'pending_payment', 'paid', 'completed'].includes(submission?.status ?? '');
  const name = submission?.businessName || matchingReceipt?.businessName || 'your shop';
  const backToMap = useCallback(() => router.replace('/(app)/(tabs)/' as never), [router]);
  useFocusEffect(useCallback(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { backToMap(); return true; });
    return () => listener.remove();
  }, [backToMap]));
  if (!loaded) return <Loading />;
  if (capture.canQuery && id && id !== 'offline_pending' && raw === undefined) return <Loading />;
  const unavailable = capture.canQuery && id && id !== 'offline_pending'
    && (raw === null || (!!raw && raw.creatorId !== capture.actor?.creatorId));
  if (unavailable || (!pending && !received && !locallySent)) return <ScreenShell title="Your captures" footer={<Button title="Back to the map" onPress={backToMap} />}>
    <EmptyState title={submission?.status === 'draft' ? 'This capture is still a draft' : 'No capture receipt here'}
      body={submission?.status === 'draft' ? 'Check your capture and send it for review when you are ready.' : 'Open your dashboard to check the captures saved to your account.'}
      actionLabel={submission?.status === 'draft' ? 'Review capture' : 'Open dashboard'}
      onAction={() => router.replace((submission?.status === 'draft' ? '/(app)/submit/review' : '/(app)/(tabs)/dashboard') as never)} />
  </ScreenShell>;
  return <ScreenShell contentStyle={styles.content} footer={<View style={styles.actions}>
    <Button title="Back to the map" onPress={backToMap} />
    <Button title="Spot another shop" variant="ghost" onPress={() => router.replace('/(app)/leads/spot' as never)} />
  </View>}>
    <View style={styles.hero}>
      <View style={styles.icon}><Ionicons name={pending ? 'cloud-upload-outline' : 'checkmark'} size={44} color={colors.ink} /></View>
      <Text variant="display" align="center">{pending ? 'Saved on this phone' : `Sent! We’ll build ${name}’s site.`}</Text>
      <Text variant="bodyLg" tone="ink2" align="center">{pending
        ? 'Your capture is queued. Keep Tendso open and connect to upload it.'
        : 'Your photos and the owner’s words are saved. Follow the progress from your dashboard.'}</Text>
    </View>
    <Text variant="label" tone="muted">What happens next</Text>
    <View style={styles.timeline}>
      <ReceiptStep title={pending ? 'Upload your capture' : 'Sent for review'} body={pending ? 'Waiting for a connection' : 'Shop details, photos and interview'} state={pending ? 'now' : 'done'} />
      <ReceiptStep title="We review and build the site" body="From the owner’s words and your photos" state={built ? 'done' : pending ? 'later' : 'now'} />
      <ReceiptStep title="The owner reviews and pays" body="They review their website before paying" state={paid ? 'done' : built ? 'now' : 'later'} />
      <ReceiptStep title={typeof submission?.creatorPayout === 'number' ? `Your commission: ${formatPeso(submission.creatorPayout)}` : 'Your commission'}
        body={paid ? 'Check Earn for the payment and payout status' : 'Commission becomes eligible after the owner pays'} state={paid ? 'now' : 'later'} />
    </View>
  </ScreenShell>;
}

function ReceiptStep({ title, body, state }: { title: string; body: string; state: 'done' | 'now' | 'later' }) {
  return <Card style={styles.step}>
    <View style={[styles.status, state === 'done' ? styles.done : state === 'now' ? styles.now : null]}>
      {state === 'done' ? <Ionicons name="checkmark" size={19} color={colors.ink} />
        : state === 'now' ? <View style={styles.dot} /> : null}
    </View>
    <View style={styles.flex}><Text weight="bold">{title}</Text><Text tone="muted">{body}</Text></View>
  </Card>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { gap: space.xl, paddingTop: space.xxl }, hero: { alignItems: 'center', gap: space.lg },
  icon: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  actions: { gap: space.sm }, timeline: { gap: space.sm }, step: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  status: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: colors.ruleStrong, alignItems: 'center', justifyContent: 'center' },
  done: { backgroundColor: colors.accent, borderColor: colors.accent }, now: { borderColor: colors.ink },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.ink },
});
