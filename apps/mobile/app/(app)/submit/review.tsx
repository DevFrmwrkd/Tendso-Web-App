import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api, type Id } from '@tendso/convex-client';
import { Ionicons } from '@expo/vector-icons';
import { Audio, Video, ResizeMode } from 'expo-av';
import { BASE_PRICE, PRICE_CEILING, WEBSITE_PRICE, commissionFor } from '@tendso/shared/pricing';
import { useCaptureSession } from '../../../hooks/useCaptureSession';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { PriceSlider } from '../../../components/PriceSlider';
import { OfflineBanner } from '../../../components/OfflineBanner';
import { Banner, Button, Card, EmptyState, Field, Loading, ProgressBar, ScreenShell, Text, TextLink, formatPeso } from '../../../components/v2';
import { colors, hit, radius, space } from '../../../theme/v2';
import { captureEmailError, normalizeCaptureEmail } from '../../../../../lib/captureEmail';

type Form = { businessName: string; businessType: string; ownerName: string; ownerPhone: string; ownerEmail?: string; address: string; city: string };
type LocalPhotos = { submissionId: string; photoUris: string[]; existingPhotos: string[] };
type LocalInterview = { submissionId: string; type: 'video' | 'audio'; recordingUri: string; durationSec?: number; attached?: boolean };
type DomainQuote = { valid: boolean; available?: boolean; domain?: string; pricePHP?: number; withinBudget?: boolean;
  reason?: string; error?: string; suggestions?: { domain: string; pricePHP: number; withinBudget: boolean }[] };

export default function SubmitReviewScreen() {
  const capture = useCaptureSession();
  if (!capture.isReady) return <Loading />;
  if (!capture.actor) return <ScreenShell><EmptyState title="Reconnect to open your capture" body="Sign in with your field-agent account to continue." /></ScreenShell>;
  return <ReviewForm key={capture.actorKey} />;
}

function ReviewForm() {
  const capture = useCaptureSession();
  const router = useGuardedRouter();
  const [id, setId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [localForm, setLocalForm] = useState<Form | null>(null);
  const [localPhotos, setLocalPhotos] = useState<LocalPhotos | null>(null);
  const [localInterview, setLocalInterview] = useState<LocalInterview | null>(null);
  const [attachedInterview, setAttachedInterview] = useState<LocalInterview | null>(null);
  const [snapshot, setSnapshot] = useState<(Form & { submissionId: string; creatorId: string }) | null>(null);
  const [photoMeta, setPhotoMeta] = useState<{ submissionId: string; items: { uri?: string; storageId?: string }[] } | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [domainOpen, setDomainOpen] = useState(false);
  const [domain, setDomain] = useState('');
  const [quote, setQuote] = useState<DomainQuote | null>(null);
  const [quotedFor, setQuotedFor] = useState('');
  const [checkingDomain, setCheckingDomain] = useState(false);
  const [sellPrice, setSellPrice] = useState(BASE_PRICE);
  const [videoOpen, setVideoOpen] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const sound = useRef<Audio.Sound | null>(null);
  const playbackBusy = useRef(false);
  const busy = useRef(false);
  const confirmOpen = useRef(false);
  const mounted = useRef(true);
  const quoteVersion = useRef(0);
  const initialized = useRef<string | null>(null);
  const isCurrent = () => mounted.current && capture.isCurrent();
  const canQuery = capture.canQuery && !!id && id !== 'offline_pending';
  const raw = useQuery(api.submissions.getById, canQuery ? { id: id as Id<'submissions'> } : 'skip');
  const submission = raw?.creatorId === capture.actor?.creatorId ? raw : null;
  const pricing = useQuery(api.submissions.getPricingContext, capture.canQuery && capture.actor
    ? { creatorId: capture.actor.creatorId } : 'skip');
  const photoKeys = localPhotos?.existingPhotos ?? submission?.photos ?? [];
  const photoUrls = useQuery(api.files.getMultipleUrls, capture.canQuery && photoKeys.length ? { storageIds: photoKeys } : 'skip');
  const remoteVideo = useQuery(api.files.getUrl, submission?.videoStorageId ? { storageId: submission.videoStorageId } : 'skip');
  const remoteAudio = useQuery(api.files.getUrl, submission?.audioStorageId ? { storageId: submission.audioStorageId } : 'skip');
  const setTier = useMutation(api.submissions.setDomainTier);
  const submit = useMutation(api.submissions.submit);
  const checkDomain = useAction(api.domains.checkDomainAvailability);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; void sound.current?.unloadAsync().catch(() => {}); }; }, []);
  useEffect(() => {
    let active = true;
    void (async () => {
      const [storedId, pendingInfo, pendingPhotos, pendingInterview, storedSnapshot, storedMeta, interviewDraft] = await Promise.all([
        capture.read<string>('current_submission_id'),
        capture.read<{ creatorId: string; existingDraftId?: string; formData: Form }>('submission_pending_sync'),
        capture.read<LocalPhotos>('submission_pending_photos'),
        capture.read<LocalInterview>('submission_pending_interview'),
        capture.read<Form & { submissionId: string; creatorId: string }>('submission_snapshot'),
        capture.read<{ submissionId: string; items: { uri?: string; storageId?: string }[] }>('submission_photo_tasks'),
        capture.read<LocalInterview>('submission_interview_draft'),
      ]);
      if (!active || !isCurrent()) return;
      const target = storedId ?? (pendingInfo?.creatorId === capture.actor?.creatorId ? 'offline_pending' : null);
      setId(target);
      setLocalForm(pendingInfo && pendingInfo.creatorId === capture.actor?.creatorId
        && (target === 'offline_pending' || pendingInfo.existingDraftId === target) ? pendingInfo.formData : null);
      setLocalPhotos(pendingPhotos?.submissionId === target ? pendingPhotos : null);
      setLocalInterview(pendingInterview?.submissionId === target ? pendingInterview : null);
      setSnapshot(storedSnapshot?.submissionId === target && storedSnapshot.creatorId === capture.actor?.creatorId ? storedSnapshot : null);
      setPhotoMeta(storedMeta?.submissionId === target ? storedMeta : null);
      setAttachedInterview(interviewDraft?.submissionId === target && interviewDraft.attached ? interviewDraft : null);
      setHydrated(true);
    })().catch(() => { if (active && isCurrent()) { setError('Could not open your saved capture. Try again.'); setHydrated(true); } });
    return () => { active = false; };
  }, [capture.actorKey, capture.read, capture.revision, capture.canQuery]);
  useEffect(() => {
    if (!submission || initialized.current === submission._id) return;
    initialized.current = submission._id;
    if (submission.requestedDomain) { setDomain(submission.requestedDomain); setDomainOpen(true); }
    if (typeof submission.amount === 'number') {
      setSellPrice(Math.max(BASE_PRICE, Math.min(PRICE_CEILING, submission.amount - (submission.domainCostPHP ?? 0))));
    }
  }, [submission]);
  useEffect(() => {
    if (!pricing) return;
    setSellPrice(value => Math.max(pricing.basePrice, Math.min(pricing.priceCeiling, value)));
  }, [pricing?.basePrice, pricing?.priceCeiling]);
  useEffect(() => {
    const version = ++quoteVersion.current;
    setQuote(null); setQuotedFor(''); setCheckingDomain(false);
    const value = domain.trim().toLowerCase();
    if (!value || !capture.canQuery) return;
    setCheckingDomain(true);
    const timer = setTimeout(() => {
      void checkDomain({ domain: value, maxBudgetPHP: 600 }).then(result => {
        if (isCurrent() && version === quoteVersion.current) { setQuote(result as DomainQuote); setQuotedFor(value); }
      }).catch(() => {
        if (isCurrent() && version === quoteVersion.current) setQuote({ valid: false, error: 'Could not check this address. Try again.' });
      }).finally(() => { if (isCurrent() && version === quoteVersion.current) setCheckingDomain(false); });
    }, 500);
    return () => clearTimeout(timer);
  }, [domain, capture.canQuery, capture.actorKey]);

  const form = localForm ?? submission ?? snapshot;
  const emailError = captureEmailError(form?.ownerEmail);
  const remotePhotos = (photoUrls ?? []).filter((uri): uri is string => !!uri);
  const savedLocalPhotos = (photoMeta?.items ?? []).map(item => item.uri).filter((uri): uri is string => !!uri);
  const photos = [...new Set([...remotePhotos, ...(localPhotos?.photoUris ?? (remotePhotos.length ? [] : savedLocalPhotos))])];
  const photoCount = localPhotos ? localPhotos.photoUris.length + localPhotos.existingPhotos.length : submission?.photos?.length ?? photoMeta?.items.length ?? 0;
  const previewInterview = localInterview ?? attachedInterview;
  const videoUri = previewInterview?.type === 'video' ? previewInterview.recordingUri : remoteVideo;
  const audioUri = previewInterview?.type === 'audio' ? previewInterview.recordingUri : remoteAudio;
  const hasInterview = !!(previewInterview || submission?.videoStorageId || submission?.audioStorageId);
  const wantsDomain = !!domain.trim();
  const validDomain = !wantsDomain || (quotedFor === domain.trim().toLowerCase()
    && !!quote?.valid && !!quote.available && !!quote.withinBudget && typeof quote.pricePHP === 'number');
  const domainCost = wantsDomain && validDomain ? quote?.pricePHP ?? 0 : 0;
  const earnings = commissionFor(sellPrice);
  const priceReady = capture.isOffline || !!pricing;
  const draft = !submission || submission.status === 'draft';
  const ready = !!form && !emailError && photoCount >= 3 && photoCount <= 10 && hasInterview && validDomain && !checkingDomain && priceReady && draft;
  const queued = capture.isOffline || id === 'offline_pending' || !!localForm || !!localPhotos || !!localInterview;
  const editBusiness = () => {
    if (id && isCurrent()) router.push({ pathname: '/(app)/submit/info', params: { draftId: id } } as never);
  };
  const send = async () => {
    if (busy.current || !id || !capture.actor || !isCurrent() || !ready) return;
    if (!capture.isOffline && !capture.canMutate()) return;
    busy.current = true; setSaving(true); setError('');
    try {
      const choice = { submissionId: id, sellPrice, submissionType: wantsDomain ? 'with_custom_domain' as const : 'standard' as const,
        requestedDomain: wantsDomain ? domain.trim().toLowerCase() : undefined, domainPricePHP: domainCost || undefined, savedAt: Date.now() };
      if (queued) {
        await capture.write('submission_pending_submit', choice);
        if (!isCurrent()) return;
        await capture.write('submission_last_sent', { submissionId: id, queued: true, sentAt: Date.now(), businessName: form.businessName });
        if (isCurrent()) router.replace({ pathname: '/(app)/submit/success', params: { queued: 'true', submissionId: id } } as never);
      } else {
        await setTier({ id: id as Id<'submissions'>, submissionType: choice.submissionType, requestedDomain: choice.requestedDomain,
          sellPrice: choice.sellPrice, domainPricePHP: choice.domainPricePHP });
        if (!isCurrent() || !capture.canMutate()) return;
        await submit({ id: id as Id<'submissions'> });
        if (!isCurrent()) return;
        await capture.write('submission_last_sent', { submissionId: id, queued: false, sentAt: Date.now(), businessName: form.businessName });
        await capture.remove('submission_interview_draft'); await capture.remove('submission_photo_tasks');
        await capture.remove('current_submission_id');
        if (isCurrent()) router.replace({ pathname: '/(app)/submit/success', params: { submissionId: id } } as never);
      }
    } catch (cause) { if (isCurrent()) setError(cause instanceof Error ? cause.message : 'Could not send. Your capture is still saved.'); }
    finally { busy.current = false; if (isCurrent()) setSaving(false); }
  };
  const confirm = () => {
    if (confirmOpen.current || busy.current || !ready || !isCurrent()) return;
    confirmOpen.current = true;
    Alert.alert(queued ? 'Save and send when online?' : 'Send this capture for review?',
      `Website price: ${formatPeso(sellPrice + domainCost)}. Your ${formatPeso(earnings)} commission depends on the shop completing payment.`, [
        { text: 'Cancel', style: 'cancel', onPress: () => { confirmOpen.current = false; } },
        { text: queued ? 'Save and queue' : 'Send for review', onPress: () => { confirmOpen.current = false; if (isCurrent()) void send(); } },
      ], { cancelable: true, onDismiss: () => { confirmOpen.current = false; } });
  };
  const playAudio = async () => {
    if (!audioUri || playbackBusy.current || !isCurrent()) return;
    playbackBusy.current = true;
    setAudioLoading(true);
    try {
      if (sound.current) { await sound.current.unloadAsync(); sound.current = null; if (isCurrent()) setAudioPlaying(false); return; }
      const result = await Audio.Sound.createAsync({ uri: audioUri }, { shouldPlay: true });
      if (!isCurrent()) { await result.sound.unloadAsync(); return; }
      sound.current = result.sound; setAudioPlaying(true);
      result.sound.setOnPlaybackStatusUpdate(status => {
        if (status.isLoaded && status.didJustFinish && isCurrent()) {
          sound.current = null; setAudioPlaying(false); void result.sound.unloadAsync().catch(() => {});
        }
      });
    } catch { if (isCurrent()) setError('Could not play this recording.'); }
    finally { playbackBusy.current = false; if (isCurrent()) setAudioLoading(false); }
  };
  if (!hydrated || (canQuery && raw === undefined)) return <Loading />;
  if (!id || !form || (canQuery && raw === null) || (raw && !submission)) return <ScreenShell onBack={() => router.back()}><EmptyState title="Open your capture first"
    body="Your saved shop details are available from the capture form." actionLabel="About the shop" onAction={() => router.replace('/(app)/submit/info' as never)} /></ScreenShell>;
  return <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScreenShell onBack={() => router.back()} title="Check it, then send" contentStyle={styles.content}
      footer={<Button title={queued ? 'Save and queue' : 'Send for review'} onPress={confirm} loading={saving} disabled={!ready || saving} />}>
      <ProgressBar value={1} label="Step 4 of 4" />
      <OfflineBanner />
      {error ? <Banner tone="danger" body={error} /> : null}
      {draft && emailError ? <Banner tone="warn" title="Owner’s email required" body={emailError}
        action={<TextLink label="Edit shop details" disabled={saving} onPress={editBusiness} />} /> : null}
      {!draft ? <><Banner tone="neutral" title="Already sent" body="This capture is being processed. Your details are saved." />
        <Button title="View capture status" variant="ghost" onPress={() => router.replace({ pathname: '/(app)/submit/success', params: { submissionId: id } } as never)} /></> : null}
      <Card style={styles.card}>
        <View style={styles.row}><View style={styles.flex}><Text variant="bodyLg" weight="bold">{form.businessName}</Text><Text tone="muted">{form.businessType}</Text></View>
          <TextLink label="Edit" disabled={saving} onPress={editBusiness} /></View>
        <Text>{form.ownerName} · {form.ownerPhone}</Text>
        {normalizeCaptureEmail(form.ownerEmail) ? <Text tone="muted">{normalizeCaptureEmail(form.ownerEmail)}</Text> : null}
        <Text tone="muted">{[form.address, form.city].filter(Boolean).join(', ')}</Text>
      </Card>
      <Card style={styles.card}>
        <View style={styles.row}><Text weight="bold" style={styles.flex}>{photoCount} photos</Text><TextLink label="Edit photos" disabled={saving} onPress={() => router.push('/(app)/submit/photos' as never)} /></View>
        {photos.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {photos.map((uri, index) => <Image key={`${uri}-${index}`} source={{ uri }} style={styles.thumb} accessibilityLabel={`Shop photo ${index + 1}`} />)}
        </ScrollView> : <Text tone="muted">Add at least three shop photos.</Text>}
      </Card>
      <Card style={styles.card}>
        <View style={styles.row}><Ionicons name={videoUri || submission?.videoStorageId ? 'videocam-outline' : 'mic-outline'} size={22} color={colors.ink} />
          <Text weight="bold" style={styles.flex}>{hasInterview ? 'Interview ready' : 'Interview needed'}</Text>
          {videoUri ? <TextLink label="Play interview" onPress={() => setVideoOpen(true)} />
            : audioUri ? <TextLink label={audioLoading ? 'Loading…' : audioPlaying ? 'Stop interview' : 'Play interview'} onPress={() => { void playAudio(); }} /> : null}</View>
        {submission?.transcript ? <Text tone="ink2">“{submission.transcript.slice(0, 220)}{submission.transcript.length > 220 ? '…' : ''}”</Text>
          : <Text tone="muted">The owner’s words and your photos help us build their site.</Text>}
        <TextLink label="Edit interview" disabled={saving} onPress={() => router.push('/(app)/submit/interview' as never)} />
      </Card>
      <Card style={styles.card}>
        <View style={styles.row}><Ionicons name="globe-outline" size={24} color={colors.ink} /><View style={styles.flex}><Text weight="bold">Website address</Text><Text tone="muted">{wantsDomain ? domain.trim() : 'A Tendso address is included.'}</Text></View>
          <TextLink label={domainOpen ? 'Close' : 'Add custom'} disabled={saving} onPress={() => setDomainOpen(value => !value)} /></View>
        {domainOpen ? <>
          <Field label="Custom domain (optional)" placeholder="yourshop.com" value={domain} onChangeText={setDomain} autoCapitalize="none" autoCorrect={false} editable={!saving && !capture.isOffline} />
          {capture.isOffline ? <Text tone="muted">Connect to check a custom domain. A Tendso address is included.</Text>
            : checkingDomain ? <Text tone="muted">Checking this address…</Text>
              : wantsDomain && quote ? <Text tone={validDomain ? 'ink' : 'danger'}>{validDomain ? `Available · ${formatPeso(domainCost)} added to the website price`
                : quote.error || quote.reason || 'This address is unavailable or exceeds the domain budget.'}</Text> : null}
          {!validDomain ? <TextLink label="Use the included address" onPress={() => { setDomain(''); setDomainOpen(false); }} /> : null}
          {quote?.suggestions?.filter(item => item.withinBudget).slice(0, 3).map(item => <TextLink key={item.domain} label={`${item.domain} · ${formatPeso(item.pricePHP)}`} onPress={() => setDomain(item.domain)} />)}
        </> : null}
      </Card>
      <Card style={styles.card}>
        <View style={styles.row}><Text variant="bodyLg" weight="bold" style={styles.flex}>Your price</Text><Text tone="muted">Lower price, easier yes</Text></View>
        {priceReady ? <PriceSlider floor={pricing?.basePrice ?? BASE_PRICE} ceiling={pricing?.priceCeiling ?? PRICE_CEILING} anchor={WEBSITE_PRICE}
          commissionRate={0.5} initialValue={sellPrice} onChange={setSellPrice} disabled={saving} showEarnings={false} /> : <Loading fill={false} />}
        <View style={styles.row}><View style={[styles.stat, styles.accent]}><Text variant="heading">{formatPeso(earnings)}</Text><Text>You keep after payment</Text></View>
          <View style={styles.stat}><Text variant="heading">{formatPeso(Math.max(0, WEBSITE_PRICE - sellPrice))}</Text><Text>The shop saves</Text></View></View>
        {wantsDomain && validDomain ? <Text weight="bold">Owner total: {formatPeso(sellPrice + domainCost)}</Text> : null}
      </Card>
      {!ready && draft ? <Text tone="muted">{photoCount < 3 ? 'Add at least 3 photos before sending.' : !hasInterview ? 'Record the owner’s interview before sending.' : !validDomain ? 'Choose an available domain or use the included address.' : 'Finish checking the capture before sending.'}</Text> : null}
    </ScreenShell>
    <Modal visible={videoOpen} animationType="slide" onRequestClose={() => setVideoOpen(false)}>
      <ScreenShell title="Interview" onBack={() => setVideoOpen(false)} contentStyle={styles.player}>
        {videoUri ? <Video source={{ uri: videoUri }} style={styles.video} resizeMode={ResizeMode.CONTAIN} useNativeControls shouldPlay
          onError={() => { setVideoOpen(false); setError('Could not play this video.'); }} /> : null}
      </ScreenShell>
    </Modal>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { gap: space.lg }, card: { gap: space.md }, row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  strip: { gap: space.sm }, thumb: { width: 84, height: 94, borderRadius: radius.card, backgroundColor: colors.bg2 },
  stat: { flex: 1, minHeight: hit.min, padding: space.md, backgroundColor: colors.bg2, borderRadius: radius.card, gap: space.xs },
  accent: { backgroundColor: colors.accentSoft }, player: { flex: 1, justifyContent: 'center' }, video: { width: '100%', height: 340 },
});
