import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useClerk } from '@clerk/clerk-expo';
import { useMutation } from 'convex/react';
import { api, type Doc } from '@tendso/convex-client';
import {
  DISCOVERY_SOURCES,
  FIELD_AGENT_CITIES,
  normalizeWorkCity,
  type DiscoverySource,
} from '../../../../lib/fieldAgentOnboarding';
import { Banner, Bubble, Button, ChoiceChip, Field, Loading, OptionRow, ScreenShell, Text, TextLink } from '../../components/v2';
import { useMobileAccount } from '../../hooks/useMobileAccount';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { colors, radius, shadow, space } from '../../theme/v2';

type WorkArea = { city: string; latitude?: number; longitude?: number; source: 'city' | 'device' };
const icons: Record<DiscoverySource, React.ComponentProps<typeof Ionicons>['name']> = {
  friend: 'people-outline', facebook: 'logo-facebook', tiktok: 'logo-tiktok',
  shop_website: 'globe-outline', job_post: 'briefcase-outline',
};

function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Location is taking too long. Choose your city below, or try again.')), milliseconds);
    promise.then((result) => { clearTimeout(timer); resolve(result); }, (error: unknown) => { clearTimeout(timer); reject(error); });
  });
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function validWorkCity(value: string) {
  try { return normalizeWorkCity(value); }
  catch { return ''; }
}

/** Only newly enrolled field agents answer these questions. Other account types keep their own flow. */
export default function AgentOnboardingScreen() {
  const mobile = useMobileAccount();
  const router = useGuardedRouter();
  const eligible = mobile.role === 'creator' && !mobile.isPreview && !mobile.isBlocked
    && mobile.account?.fieldAgentOnboardingRequired === true;

  useEffect(() => {
    if (!mobile.isLoading && !mobile.isOffline && !eligible) router.replace('/(app)/(tabs)');
  }, [mobile.isLoading, mobile.isOffline, eligible, router]);

  if (mobile.isLoading || !mobile.account || !eligible) return <Loading />;
  return <OnboardingQuestions key={mobile.account._id} account={mobile.account} offline={mobile.isOffline} />;
}

function OnboardingQuestions({ account, offline }: { account: Doc<'creators'>; offline: boolean }) {
  const router = useGuardedRouter();
  const { signOut } = useClerk();
  const saveWorkArea = useMutation(api.fieldAgentOnboarding.saveWorkArea);
  const complete = useMutation(api.fieldAgentOnboarding.complete);
  const [step, setStep] = useState<1 | 2>(account.workCity ? 2 : 1);
  const [city, setCity] = useState(account.workCity ?? '');
  const [otherCity, setOtherCity] = useState(!!account.workCity && !FIELD_AGENT_CITIES.some((place) => place.name === account.workCity));
  const [deviceArea, setDeviceArea] = useState<WorkArea | null>(account.workLocationSource === 'device'
    ? { city: account.workCity ?? '', latitude: account.workLatitude, longitude: account.workLongitude, source: 'device' } : null);
  const [discoverySource, setDiscoverySource] = useState<DiscoverySource | null>(account.discoverySource ?? null);
  const [referralCode, setReferralCode] = useState('');
  const [busy, setBusy] = useState<'location' | 'save' | 'exit' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locationNote, setLocationNote] = useState<string | null>(null);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const version = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; version.current += 1; };
  }, []);

  const normalizedCity = validWorkCity(city);
  const validCity = normalizedCity.length >= 2 && normalizedCity.length <= 100;
  const disabled = busy !== null || offline;

  async function run(action: 'location' | 'save' | 'exit', operation: (current: () => boolean) => Promise<void>) {
    if (inFlight.current || offline) return;
    inFlight.current = true;
    const request = ++version.current;
    const current = () => mounted.current && version.current === request;
    setBusy(action);
    setError(null);
    try { await operation(current); }
    catch (failure) {
      if (current()) setError(errorMessage(failure, 'Could not save your answer. Please try again.'));
    } finally {
      if (current()) { inFlight.current = false; setBusy(null); }
    }
  }

  function chooseCity(value: string, other = false) {
    if (disabled) return;
    setCity(value);
    setOtherCity(other);
    setDeviceArea(null);
    setLocationNote(null);
    setError(null);
  }

  function locate() {
    void run('location', async (current) => {
      setLocationNote(null);
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!current()) return;
      if (permission.status !== 'granted') {
        setLocationNote('Location access is off. Choose your city below to continue.');
        return;
      }
      const position = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 15_000);
      if (!current()) return;
      const { latitude, longitude } = position.coords;
      if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
        throw new Error('We couldn’t find your location. Choose your city below, or try again.');
      }
      let locatedCity = '';
      try {
        const [place] = await withTimeout(Location.reverseGeocodeAsync({ latitude, longitude }), 5_000);
        locatedCity = validWorkCity(place?.city ?? place?.subregion ?? place?.district ?? '');
      } catch { /* GPS is optional; a manual city is always available. */ }
      if (!current()) return;
      if (!locatedCity) {
        setDeviceArea(null);
        setOtherCity(true);
        setLocationNote('Location found. Enter your city below to continue.');
        return;
      }
      const known = FIELD_AGENT_CITIES.find((place) => place.name.toLowerCase() === locatedCity.toLowerCase());
      const name = known?.name ?? locatedCity;
      setCity(name);
      setOtherCity(!known);
      setDeviceArea({ city: name, latitude, longitude, source: 'device' });
      setLocationNote(null);
    });
  }

  function continueFlow() {
    if (step === 1 && validCity) {
      void run('save', async (current) => {
        await saveWorkArea(deviceArea && deviceArea.city === city
          ? { ...deviceArea, city: normalizedCity } : { city: normalizedCity, source: 'city' });
        if (current()) setStep(2);
      });
    } else if (step === 2 && discoverySource) {
      void run('save', async (current) => {
        await complete({ discoverySource, ...(!account.referredByCode && referralCode.trim()
          ? { referredByCode: referralCode.trim().toUpperCase() } : {}) });
        if (current()) router.replace('/(app)/(tabs)');
      });
    }
  }

  function goBack() {
    if (disabled) return;
    setError(null);
    setStep(1);
  }

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenShell
        onBack={step === 2 ? goBack : undefined}
        progress={step / 2}
        headerRight={<Text variant="label" tone="muted" accessibilityLabel={`Step ${step} of 2`}>{step} / 2</Text>}
        footer={(
          <>
            <Button title="Continue" onPress={continueFlow} loading={busy === 'save'} disabled={disabled || (step === 1 ? !validCity : !discoverySource)} />
            {step === 1 ? <TextLink label="Sign out" tone="muted" onPress={() => { void run('exit', async (current) => { await signOut(); if (current()) router.replace('/'); }); }} /> : null}
          </>
        )}
        testID="agent-onboarding"
      >
        <View style={styles.body}>
          <Bubble
            question={step === 1 ? 'Where do you work?' : 'How did you hear about us?'}
            hint={step === 1 ? 'We’ll show you shops near you first.' : 'Just so we know who to thank.'}
          />
          {offline ? <Banner tone="warn" body="Connect to the internet to save your answers." /> : null}
          {step === 1 ? (
            <>
              <View style={styles.cities} accessibilityLabel="Choose your work city">
                {FIELD_AGENT_CITIES.map((place) => (
                  <ChoiceChip key={place.name} label={place.name} selected={!otherCity && city === place.name} onPress={() => chooseCity(place.name)} />
                ))}
                <ChoiceChip label="Other city" icon="add" selected={otherCity} onPress={() => chooseCity(otherCity ? city : '', true)} />
              </View>
              {otherCity ? <Field label="Your city" placeholder="Enter your city" variant="outlined" value={city} maxLength={100} onChangeText={(value) => chooseCity(value, true)} editable={!disabled} autoCapitalize="words" /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Use my location"
                accessibilityState={{ disabled, busy: busy === 'location' }}
                onPress={locate}
                disabled={disabled}
                style={[styles.location, shadow.soft, disabled ? styles.disabled : null]}
              >
                <Ionicons name="locate-outline" size={24} color={colors.ink} />
                <View style={styles.locationText}>
                  <Text variant="label">{busy === 'location' ? 'Finding your location…' : 'Use my location'}</Text>
                  {deviceArea ? <Text variant="label" tone="muted" weight="medium">{deviceArea.city}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.ink3} />
              </Pressable>
              {locationNote ? <Text variant="label" tone="muted" weight="medium" accessibilityLiveRegion="polite">{locationNote}</Text> : null}
            </>
          ) : (
            <>
              <View style={styles.options}>
                {DISCOVERY_SOURCES.map((source) => (
                  <OptionRow key={source.value} title={source.label} icon={icons[source.value]} selected={discoverySource === source.value} onPress={() => { if (!disabled) { setDiscoverySource(source.value); setError(null); } }} disabled={disabled} />
                ))}
              </View>
              {account.referredByCode ? (
                <View style={styles.referral}>
                  <Ionicons name="gift-outline" size={24} color={colors.ink3} />
                  <View style={styles.locationText}>
                    <Text variant="label" tone="muted" weight="medium">Who sent you?</Text>
                    <Text variant="label">{[account.referredByName, account.referredByCode].filter(Boolean).join(' · ')}</Text>
                  </View>
                </View>
              ) : (
                <Field label="Who sent you? (optional)" icon="gift-outline" placeholder="Enter their referral code" value={referralCode} onChangeText={setReferralCode} autoCapitalize="characters" autoCorrect={false} maxLength={32} editable={!disabled} helper="Have a referral code? We’ll check it when you continue." />
              )}
            </>
          )}
          {error ? <Banner tone="danger" body={error} /> : null}
        </View>
      </ScreenShell>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { gap: space.lg },
  cities: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  options: { gap: space.sm },
  location: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, backgroundColor: colors.card, borderRadius: radius.card },
  locationText: { flex: 1, gap: space.xs },
  referral: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, backgroundColor: colors.card, borderRadius: radius.card },
  disabled: { opacity: 0.5 },
});
