import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
  Keyboard,
  type TextInput,
} from 'react-native';
import { useQuery, useMutation } from 'convex/react';
import { BUSINESS_TYPES, looksLikeConvexId, mapCategoryToBusinessType, toLocalPhDigits } from '../../../services/prospectPrefill';
import { removeSubmission } from '../../../services/submissionsExtra';
import { api } from '@tendso/convex-client';
import type { Id } from '@tendso/convex-client';
import { useLocalSearchParams } from 'expo-router';
import { OfflineBanner } from '../../../components/OfflineBanner';
import { useFormDraftCache } from '../../../hooks/useFormDraftCache';
import { Banner, Button, ChoiceChip, Field, Loading, ScreenShell, Text } from '../../../components/v2';
import { space } from '../../../theme/v2';
import { useGuardedPress } from '../../../hooks/useGuardedPress';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { useCaptureSession } from '../../../hooks/useCaptureSession';
import { CaptureLocationPicker, validCaptureCoordinates, type CaptureCoordinates } from '../../../components/field-agent/CaptureLocationPicker';
import { captureEmailError, normalizeCaptureEmail } from '../../../../../lib/captureEmail';
import { BASE_PRICE, commissionFor } from '@tendso/shared/pricing';
import { readFieldAgentPrice, validFieldAgentPrice } from '../../../services/fieldAgentPrice';

// Keep all existing API values while placing the board's common choices first.
const TYPE_CHOICES = ['Restaurant', 'Barber/Salon', 'Auto Shop', 'Spa/Massage',
  ...BUSINESS_TYPES.filter((type) => !['Restaurant', 'Barber/Salon', 'Auto Shop', 'Spa/Massage'].includes(type))];

type CaptureParams = {
  draftId?: string; prospectLeadId?: string; businessName?: string; phone?: string;
  address?: string; city?: string; category?: string; latitude?: string; longitude?: string;
};
type SavedDetails = {
  businessName: string; businessType: string; ownerName: string; ownerPhone: string;
  ownerEmail?: string; address: string; city: string; coordinates?: CaptureCoordinates; prospectLeadId?: string;
};
type PendingDetails = { creatorId: string; existingDraftId?: string | null; prospectLeadId?: string;
  initialSellPrice?: number; formData: SavedDetails };

export default function SubmitInfoScreen() {
  const capture = useCaptureSession();
  const prefillParams = useLocalSearchParams<CaptureParams>();
  return <SubmitInfoForm key={`${capture.actorKey ?? 'loading'}:${JSON.stringify(prefillParams.draftId ?? null)}`}
    capture={capture} prefillParams={prefillParams} />;
}

function SubmitInfoForm({ capture, prefillParams }: {
  capture: ReturnType<typeof useCaptureSession>; prefillParams: CaptureParams;
}) {
  const router = useGuardedRouter();
  // Set when arriving from Discover's "Start with these details". prospectLeadId
  // is present only for legacy-leads rows — see startInterview in discover.tsx.
  const explicitDraft = prefillParams.draftId != null;
  const requestedDraftId = typeof prefillParams.draftId === 'string'
    && (prefillParams.draftId === 'offline_pending' || looksLikeConvexId(prefillParams.draftId))
    ? prefillParams.draftId : null;
  const goBack = useGuardedPress(() => router.back());

  const creator = useQuery(
    api.creators.getByClerkId,
    capture.canQuery && capture.actor ? { clerkId: capture.actor.clerkId } : 'skip'
  );

  const newestDraft = useQuery(
    api.submissions.getDraftByCreatorId,
    !explicitDraft && capture.canQuery && capture.actor ? { creatorId: capture.actor.creatorId } : 'skip'
  );
  const requestedDraft = useQuery(
    api.submissions.getById,
    explicitDraft && capture.canQuery && requestedDraftId && requestedDraftId !== 'offline_pending'
      ? { id: requestedDraftId as Id<'submissions'> } : 'skip'
  );
  const existingDraft = explicitDraft ? requestedDraft : newestDraft;

  const createSubmission = useMutation(api.submissions.create);
  const updateSubmission = useMutation(api.submissions.update);
  const discardDraft = useMutation(removeSubmission);

  const { saveDraft, loadDraft, clearDraft } = useFormDraftCache(capture.actor);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const emailInput = useRef<TextInput | null>(null);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [coordinates, setCoordinates] = useState<CaptureCoordinates | undefined>();
  const [choosingLocation, setChoosingLocation] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [unavailableDraft, setUnavailableDraft] = useState(false);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const mounted = useRef(true);
  const initializing = useRef(false);
  const saving = useRef(false);
  const initialSellPrice = useRef<number | null>(null);
  const isCurrent = () => mounted.current && capture.isCurrent();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  // Carried through to submissions.create/update so the backend attaches this
  // interview to the scraped lead instead of inserting a duplicate.
  const [prospectLeadId, setProspectLeadId] = useState<string | undefined>(
    typeof prefillParams.prospectLeadId === 'string' ? prefillParams.prospectLeadId : undefined,
  );
  // The collision Alert fires from an effect that returns WITHOUT setting
  // `initialized`, so a dependency changing identity (clearDraft is not
  // guaranteed stable) would re-run it and stack a second dialog on the first.
  const collisionPrompted = useRef(false);
  // A business name is what makes this a real prefill — prospectLeadId alone is
  // absent for pool and scrape-modal rows, which still deserve the prefill.
  const hasPrefill = useMemo(
    () => Boolean((prefillParams.businessName ?? '').trim()),
    [prefillParams.businessName],
  );

  /** Apply the scraped details passed in from Discover. */
  const applyPrefill = useCallback(() => {
    setBusinessName(prefillParams.businessName ?? '');
    setOwnerPhone(toLocalPhDigits(prefillParams.phone));
    setAddress(prefillParams.address ?? '');
    setCity(prefillParams.city ?? '');
    const point = prefillParams.latitude?.trim() && prefillParams.longitude?.trim()
      ? { lat: Number(prefillParams.latitude), lng: Number(prefillParams.longitude) } : undefined;
    setCoordinates(validCaptureCoordinates(point) ? point : undefined);
    // '' when Outscraper's free-text category matches nothing — the required
    // check then makes the creator pick, rather than storing a confident guess.
    setBusinessType(mapCategoryToBusinessType(prefillParams.category));
    // Owner name and email are deliberately NOT prefilled: the scrape knows the
    // business, not the person, and a wrong owner name is worse than a blank one.
  }, [prefillParams.businessName, prefillParams.phone, prefillParams.address, prefillParams.city, prefillParams.category,
    prefillParams.latitude, prefillParams.longitude]);

  // A review repair must open that exact capture. Untagged form caches and the
  // newest server draft may belong to another business, so neither is a fallback.
  useEffect(() => {
    if (!explicitDraft || initialized || initializing.current || !capture.isReady || !capture.actor || !isCurrent()) return;
    if (!requestedDraftId) { setUnavailableDraft(true); return; }
    if (!capture.isOffline && !capture.canQuery) return;
    if (capture.canQuery && requestedDraftId !== 'offline_pending' && requestedDraft === undefined) return;
    initializing.current = true;
    void (async () => {
      try {
        if (capture.canQuery && requestedDraftId !== 'offline_pending'
          && (!requestedDraft || requestedDraft.creatorId !== capture.actor?.creatorId || requestedDraft.status !== 'draft')) {
          if (isCurrent()) setUnavailableDraft(true);
          return;
        }
        const [pending, snapshot, storedId] = await Promise.all([
          capture.read<PendingDetails>('submission_pending_sync'),
          capture.read<SavedDetails & { submissionId: string; creatorId: string }>('submission_snapshot'),
          capture.read<string>('current_submission_id'),
        ]);
        if (!isCurrent()) return;
        const matchingPending = pending && pending.creatorId === capture.actor?.creatorId && pending.formData
          && (requestedDraftId === 'offline_pending'
            ? storedId === 'offline_pending' && (!pending.existingDraftId || pending.existingDraftId === 'offline_pending')
            : pending.existingDraftId === requestedDraftId) ? pending : null;
        const matchingSnapshot = snapshot && snapshot.creatorId === capture.actor?.creatorId
          && snapshot.submissionId === requestedDraftId ? snapshot : null;
        const data = matchingPending?.formData
          ?? (capture.canQuery && requestedDraftId !== 'offline_pending' ? requestedDraft : matchingSnapshot);
        if (!data) { setUnavailableDraft(true); return; }
        setUnavailableDraft(false);
        setBusinessName(data.businessName || ''); setBusinessType(data.businessType || '');
        setOwnerName(data.ownerName || ''); setOwnerPhone(data.ownerPhone || '');
        setOwnerEmail(data.ownerEmail || ''); setAddress(data.address || ''); setCity(data.city || '');
        setCoordinates(validCaptureCoordinates(data.coordinates) ? data.coordinates : undefined);
        setProspectLeadId(matchingPending?.prospectLeadId ?? data.prospectLeadId);
        setSelectedDraftId(requestedDraftId === 'offline_pending' ? null : requestedDraftId);
        await capture.write('current_submission_id', requestedDraftId);
        if (isCurrent()) setInitialized(true);
      } catch {
        if (isCurrent()) setUnavailableDraft(true);
      } finally { initializing.current = false; }
    })();
  }, [explicitDraft, requestedDraftId, requestedDraft, initialized, capture.actorKey, capture.isReady, capture.canQuery, capture.isOffline]);

  // Keep server drafts first, then this account's cached form. A new shop must
  // never silently reuse a draft whose lead link is set once on the server.
  useEffect(() => {
    if (explicitDraft) return;
    if (initialized || initializing.current || !capture.isReady || !capture.actor || !isCurrent()) return;
    if (!capture.isOffline && existingDraft === undefined) return;
    initializing.current = true;
    void (async () => {
      try {
        const localForm = existingDraft ? null : await loadDraft();
        if (!isCurrent()) return;
        const pending = capture.isOffline && !existingDraft && !localForm
          ? await capture.read<{
            creatorId: string; existingDraftId?: string | null; prospectLeadId?: string;
            formData: { businessName: string; businessType: string; ownerName: string; ownerPhone: string;
              ownerEmail?: string; address: string; city: string; coordinates?: CaptureCoordinates };
          }>('submission_pending_sync') : null;
        if (!isCurrent()) return;
        const cached = localForm ?? (pending && pending.creatorId === capture.actor?.creatorId && pending.formData
          ? { ...pending.formData, ownerEmail: pending.formData.ownerEmail ?? '', prospectLeadId: pending.prospectLeadId } : null);
        if (!isCurrent()) return;
        const data = existingDraft ?? cached;
        const cachedId = cached ? pending?.existingDraftId ?? await capture.read<string>('current_submission_id') : null;
        if (!isCurrent()) return;
        const draftId = existingDraft?._id ?? (capture.isOffline && cachedId && cachedId !== 'offline_pending' ? cachedId : null);
        const sameBusiness = hasPrefill && data
          && (data.businessName || '').trim().toLowerCase() === (prefillParams.businessName || '').trim().toLowerCase();
        const loadExisting = async () => {
          if (!isCurrent()) return;
          if (data) {
            setBusinessName(data.businessName || ''); setBusinessType(data.businessType || '');
            setOwnerName(data.ownerName || ''); setOwnerPhone(data.ownerPhone || '');
            setOwnerEmail(data.ownerEmail || ''); setAddress(data.address || ''); setCity(data.city || '');
            setCoordinates(validCaptureCoordinates(data.coordinates) ? data.coordinates : undefined);
            setProspectLeadId(data.prospectLeadId ?? (sameBusiness ? prefillParams.prospectLeadId : undefined));
          }
          setSelectedDraftId(draftId);
          if (draftId) await capture.write('current_submission_id', draftId);
          if (isCurrent()) setInitialized(true);
        };
        const differentBusiness = data && hasPrefill && !sameBusiness;
        if (differentBusiness) {
          if (collisionPrompted.current) return;
          collisionPrompted.current = true;
          Alert.alert('Finish your other interview?',
            `You have an unfinished interview for ${data.businessName || 'another business'}. Starting ${prefillParams.businessName || 'this one'} will discard it.`, [
              { text: `Continue ${data.businessName || 'it'}`, style: 'cancel', onPress: () => {
                void loadExisting().catch(() => { if (isCurrent()) setError('Could not reopen your saved interview. Please try again.'); });
              } },
              { text: 'Start this one', style: 'destructive', onPress: async () => {
                if (!isCurrent() || saving.current) return;
                saving.current = true; setLoading(true);
                try {
                  if (draftId) {
                    if (!capture.canMutate()) throw new Error('Reconnect before discarding your saved interview.');
                    await discardDraft({ id: draftId as Id<'submissions'> });
                    if (!isCurrent()) return;
                  }
                  await capture.remove('current_submission_id');
                  await capture.remove('submission_pending_sync');
                  await capture.remove('submission_pending_photos');
                  await capture.remove('submission_pending_interview');
                  await capture.remove('submission_pending_submit');
                  await capture.remove('submission_photo_tasks');
                  await capture.remove('submission_interview_draft');
                  await clearDraft();
                  if (!isCurrent()) return;
                  initialSellPrice.current = null;
                  setSelectedDraftId(null); setOwnerName(''); setOwnerEmail('');
                  applyPrefill();
                  setProspectLeadId(typeof prefillParams.prospectLeadId === 'string' ? prefillParams.prospectLeadId : undefined);
                  setInitialized(true);
                } catch (cause) {
                  if (!isCurrent()) return;
                  await loadExisting();
                  if (isCurrent()) setError(cause instanceof Error ? cause.message : 'Could not discard the saved interview. Your other draft is still here.');
                } finally {
                  saving.current = false;
                  if (isCurrent()) setLoading(false);
                }
              } },
            ]);
          return;
        }
        if (data) await loadExisting();
        else {
          if (hasPrefill) applyPrefill();
          setSelectedDraftId(null); setInitialized(true);
        }
      } catch {
        if (isCurrent()) setError('Could not load your saved details. Reopen this capture to try again.');
      } finally { initializing.current = false; }
    })();
  }, [explicitDraft, capture.actorKey, capture.isReady, capture.isOffline, existingDraft, initialized, loadDraft, hasPrefill, applyPrefill,
    prefillParams.businessName, prefillParams.prospectLeadId, discardDraft, clearDraft]);

  // Auto-save form fields to local cache (debounced)
  useEffect(() => {
    if (!initialized || !isCurrent()) return;
    saveDraft({
      businessName,
      businessType,
      ownerName,
      ownerPhone,
      ownerEmail,
      address,
      city,
      ...(coordinates ? { coordinates } : {}),
      prospectLeadId,
    });
  }, [businessName, businessType, ownerName, ownerPhone, ownerEmail, address, city, coordinates, prospectLeadId, initialized, saveDraft]);

  const handleNext = async () => {
    if (saving.current || !initialized || !capture.actor || !isCurrent()) return;
    setError(null);
    if (!capture.isOffline && (!capture.canMutate() || creator?._id !== capture.actor.creatorId)) {
      setError('Reconnect to save this capture for your account.');
      return;
    }

    if (!businessName.trim() || !businessType || !ownerName.trim() || !ownerPhone.trim() || !address.trim() || !city.trim()) {
      setError('Please fill in all required fields');
      return;
    }
    const invalidEmail = captureEmailError(ownerEmail);
    setEmailError(invalidEmail);
    if (invalidEmail) { emailInput.current?.focus(); return; }

    const formData = {
      businessName: businessName.trim(),
      businessType,
      ownerName: ownerName.trim(),
      ownerPhone: ownerPhone.trim(),
      ownerEmail: normalizeCaptureEmail(ownerEmail),
      address: address.trim(),
      city: city.trim(),
      ...(validCaptureCoordinates(coordinates) ? { coordinates } : {}),
    };

    saving.current = true; setLoading(true);
    // Freeze the preference once for a new capture. Resuming any established
    // capture keeps its original price, even if Earn's preference changed.
    let capturedPrice: number;
    try {
      if (initialSellPrice.current === null) {
        const [pending, snapshot, storedId] = await Promise.all([
          capture.read<PendingDetails>('submission_pending_sync'),
          capture.read<{ submissionId: string; creatorId: string; initialSellPrice?: number }>('submission_snapshot'),
          capture.read<string>('current_submission_id'),
        ]);
        if (!isCurrent()) return;
        const target = selectedDraftId ?? 'offline_pending';
        const ownsPending = pending?.creatorId === capture.actor.creatorId
          && (selectedDraftId ? pending.existingDraftId === selectedDraftId
            : storedId === 'offline_pending' && (!pending.existingDraftId || pending.existingDraftId === 'offline_pending'));
        const ownsSnapshot = snapshot?.creatorId === capture.actor.creatorId && snapshot.submissionId === target;
        const serverPrice = selectedDraftId && existingDraft?._id === selectedDraftId
          && existingDraft.creatorId === capture.actor.creatorId && typeof existingDraft.amount === 'number'
          ? validFieldAgentPrice(existingDraft.amount - (existingDraft.domainCostPHP ?? 0)) : null;
        const savedPrice = serverPrice ?? (ownsPending ? validFieldAgentPrice(pending.initialSellPrice) : null)
          ?? (ownsSnapshot ? validFieldAgentPrice(snapshot.initialSellPrice) : null);
        initialSellPrice.current = savedPrice ?? (selectedDraftId || ownsPending || ownsSnapshot
          ? BASE_PRICE : await readFieldAgentPrice(capture.actor));
        if (!isCurrent()) return;
      }
      capturedPrice = initialSellPrice.current;
    } catch {
      if (isCurrent()) { setError('Could not load your capture price. Try again.'); setLoading(false); }
      saving.current = false;
      return;
    }
    // Offline writes stay with the cached, signed-in field agent. The source
    // lead is retained so reconnecting does not create a duplicate shop.
    if (capture.isOffline) {
      try {
        await capture.write('submission_pending_sync', {
          formData,
          creatorId: capture.actor.creatorId,
          existingDraftId: selectedDraftId,
          prospectLeadId,
          initialSellPrice: capturedPrice,
          savedAt: Date.now(),
        });
        if (!isCurrent()) return;
        await capture.write('submission_snapshot', { submissionId: selectedDraftId ?? 'offline_pending', creatorId: capture.actor.creatorId,
          ...formData, initialSellPrice: capturedPrice });
        if (!isCurrent()) return;
        await capture.write('current_submission_id', selectedDraftId ?? 'offline_pending');
        if (!isCurrent()) return;
        await clearDraft();
        if (isCurrent()) router.push('/(app)/submit/photos');
      } catch (err) {
        if (isCurrent()) setError('Failed to save data locally');
      } finally {
        saving.current = false;
        if (isCurrent()) setLoading(false);
      }
      return;
    }

    try {
      let submissionId: string;

      // Only sent when we actually have one. Omitting the key entirely matters:
      // a Convex object validator rejects unknown args, so on a deployment that
      // predates prospectLeadId this keeps ordinary submissions working.
      const link = prospectLeadId ? { prospectLeadId: prospectLeadId as Id<'leads'> } : {};

      if (!capture.canMutate()) return;
      if (selectedDraftId) {
        await updateSubmission({
          id: selectedDraftId as Id<'submissions'>,
          ...formData,
          ...link,
        });
        submissionId = selectedDraftId;
      } else {
        submissionId = await createSubmission({
          creatorId: capture.actor.creatorId,
          ...formData,
          ...link,
          amount: capturedPrice,
          creatorPayout: commissionFor(capturedPrice),
        });
      }
      if (!isCurrent()) return;
      // Remember a successful create even if a later local write fails. A
      // retry must update that draft, rather than create a second interview.
      setSelectedDraftId(submissionId);
      await capture.write('submission_snapshot', { submissionId, creatorId: capture.actor.creatorId, ...formData, initialSellPrice: capturedPrice });
      if (!isCurrent()) return;
      await capture.write('current_submission_id', submissionId);
      if (!isCurrent()) return;
      await clearDraft();
      if (!isCurrent()) return;
      await capture.remove('submission_pending_sync');
      if (isCurrent()) router.push('/(app)/submit/photos');
    } catch (err: any) {
      console.error('Error saving business info:', err);
      if (isCurrent()) setError(err.message || 'Failed to save business information');
    } finally {
      saving.current = false;
      if (isCurrent()) setLoading(false);
    }
  };

  // Offline access is already scoped by the app layout; do not block local drafts
  // on an unavailable live Clerk or Convex response.
  if ((!capture.isReady && !capture.actor) || (!initialized && capture.canQuery && creator === undefined)) {
    return <Loading label="Loading shop details…" />;
  }
  if (!capture.actor) return <ScreenShell onBack={goBack} title="Capture unavailable">
    <Banner tone="warn" body="Sign in with your certified field-agent account to start a capture." />
  </ScreenShell>;
  if (explicitDraft && unavailableDraft) return <ScreenShell onBack={goBack} title="Capture unavailable">
    <Banner tone="warn" body="This draft is unavailable for your account. Reconnect or return to your capture to try again. Your saved media is unchanged." />
    <Button title="Go back" variant="ghost" onPress={goBack} />
  </ScreenShell>;
  if (explicitDraft && !initialized) return <Loading label="Loading shop details…" />;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.root}>
      <ScreenShell
        title="About the shop"
        subtitle="The basics first. Photos and the interview come next."
        onBack={goBack}
        progress={0.25}
        headerRight={<Text variant="label" tone="muted">1 / 4</Text>}
        contentStyle={styles.content}
        footer={<Button title={loading ? 'Saving…' : capture.isOffline ? 'Save & continue offline' : 'Continue to photos'}
          loading={loading} disabled={loading || !initialized} onPress={handleNext}
          accessibilityLabel="Continue to photos step" />}
      >
        <OfflineBanner />
        {error ? <Banner tone="danger" body={error} /> : null}

        <Field label="Business name" icon="storefront-outline" placeholder="Shop name"
          value={businessName} onChangeText={setBusinessName} editable={!loading}
          autoCapitalize="words" returnKeyType="next" />

        <View style={styles.typeSection}>
          <Text variant="label" tone="muted">Business type</Text>
          <View style={styles.types}>
            {TYPE_CHOICES.map((type) => <ChoiceChip key={type} label={type} selected={businessType === type}
              disabled={loading} onPress={() => setBusinessType(type)} />)}
          </View>
        </View>

        <Field label="Owner’s full name" icon="person-outline" placeholder="Full name"
          value={ownerName} onChangeText={setOwnerName} editable={!loading}
          autoCapitalize="words" textContentType="name" returnKeyType="next" />
        <Field label="Owner’s mobile" icon="call-outline" prefix="+63" placeholder="917 123 4567"
          value={ownerPhone} onChangeText={(value) => setOwnerPhone(value.replace(/[^0-9]/g, ''))}
          keyboardType="phone-pad" textContentType="telephoneNumber" maxLength={15} editable={!loading} />
        <Field ref={emailInput} label="Owner’s email" icon="mail-outline" placeholder="owner@example.com" maxLength={320}
          value={ownerEmail} onChangeText={(value) => { setOwnerEmail(value); if (emailError) setEmailError(captureEmailError(value)); }}
          error={emailError} helper="Required so the owner can access their website." keyboardType="email-address"
          autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" editable={!loading} returnKeyType="next" />
        <Field label="Address" icon="location-outline" placeholder="Street and barangay"
          value={address} onChangeText={setAddress} autoCapitalize="words" editable={!loading} returnKeyType="next" />
        <Button title={coordinates ? 'Edit map location' : 'Choose on map'} variant="ghost" icon="map-outline"
          disabled={loading || !initialized} onPress={() => {
            if (!isCurrent() || saving.current) return;
            Keyboard.dismiss(); setChoosingLocation(true);
          }} />
        {coordinates ? <Text variant="label" tone="muted">Changing the address does not move the pin. Use Edit map location to move it.</Text> : null}
        <Field label="City" icon="business-outline" placeholder="City or municipality"
          value={city} onChangeText={setCity} autoCapitalize="words" editable={!loading} returnKeyType="done" />
      </ScreenShell>
      {choosingLocation ? <CaptureLocationPicker coordinates={coordinates} address={address} city={city}
        isOffline={capture.isOffline} isCurrent={isCurrent}
        onClose={() => { if (isCurrent()) setChoosingLocation(false); }}
        onConfirm={(location) => {
          if (!isCurrent() || saving.current || !validCaptureCoordinates(location.coordinates)) return;
          setCoordinates(location.coordinates); setAddress(location.address); setCity(location.city); setChoosingLocation(false);
        }} /> : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: space.md, paddingBottom: space.xl },
  typeSection: { gap: space.sm },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
