/**
 * First launch: the welcome choice (design v2, mock js/screens.js `welcome`).
 * "I have a business" → the owner app (email code sign-up).
 * "I want to earn"    → the existing field-agent sign-up, unchanged.
 * Signed-in people skip this; returning signed-out people go to their sign-in.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter, useLocalSearchParams, Redirect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useNetwork } from '../providers/NetworkProvider';
import { Button, Text } from '../components/v2';
import { Buddy } from '../components/v2/owner/OwnerUI';
import { colors, space } from '../theme/v2';
import { hasOwnerIntent, setOwnerIntent } from '../lib/v2/ownerIntake';

const ONBOARDING_KEY = 'ndm_has_seen_onboarding';
const AUTH_CACHE_KEY = 'ndm_was_signed_in';

const WALL = [
  [require('../assets/v2/owner/kind-barber.jpg'), require('../assets/v2/owner/kind-craft.jpg'), require('../assets/v2/owner/kind-salon.jpg')],
  [require('../assets/v2/owner/kind-repair.jpg'), require('../assets/v2/owner/kind-shop.jpg'), require('../assets/v2/owner/how-friend.jpg')],
  [require('../assets/v2/owner/kind-salon.jpg'), require('../assets/v2/owner/kind-barber.jpg'), require('../assets/v2/owner/kind-food.jpg')],
];

export default function Index() {
  const { isLoaded, isSignedIn } = useAuth();
  const { isConnected } = useNetwork();
  const router = useRouter();
  const { welcome } = useLocalSearchParams<{ welcome?: string }>();
  const insets = useSafeAreaInsets();

  const [checking, setChecking] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [ownerBefore, setOwnerBefore] = useState(false);
  const [cachedAuth, setCachedAuth] = useState<boolean | null>(null);
  // Explicit navigation may reopen the choice without erasing first-launch
  // history, account state or an owner's saved work. Auth still wins below.
  const shouldShowWelcome = showWelcome || welcome === '1';

  useEffect(() => {
    (async () => {
      try {
        const [seen, authCache, owner] = await Promise.all([
          AsyncStorage.getItem(ONBOARDING_KEY),
          AsyncStorage.getItem(AUTH_CACHE_KEY),
          hasOwnerIntent(),
        ]);
        setShowWelcome(seen !== 'true');
        setCachedAuth(authCache === 'true');
        setOwnerBefore(owner);
      } catch {
        setShowWelcome(true);
        setCachedAuth(false);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!shouldShowWelcome || checking) return;
    Animated.timing(fade, { toValue: 1, duration: 600, delay: 150, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true }).start();
  }, [shouldShowWelcome, checking, fade]);

  const seen = () => AsyncStorage.setItem(ONBOARDING_KEY, 'true').catch(() => {});

  const business = async () => {
    await seen();
    await setOwnerIntent(true);
    router.replace('/(auth)/owner');
  };
  const earn = async () => {
    await seen();
    await setOwnerIntent(false);
    router.replace('/(auth)/signup');
  };
  const logIn = async () => {
    await seen();
    router.replace('/(auth)/login');
  };

  const networkKnown = isConnected !== null;
  const effectivelyLoaded = networkKnown && (isLoaded || (isConnected === false && cachedAuth === true));

  if (!effectivelyLoaded || checking) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.ink} />
      </View>
    );
  }

  const effectivelySignedIn = isSignedIn || (isConnected === false && cachedAuth === true);
  if (effectivelySignedIn) return <Redirect href={'/(app)/(tabs)/' as any} />;
  if (!shouldShowWelcome) return <Redirect href={ownerBefore ? '/(auth)/owner' : '/(auth)/login'} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="dark" />
      <PhotoWall />
      <Animated.View
        style={[
          styles.bottom,
          { paddingBottom: insets.bottom + space.lg, opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] },
        ]}
      >
        <Buddy size={92} />
        <Text variant="hero" align="center" accessibilityRole="header">
          Your shop online.
        </Text>
        <Text variant="bodyLg" tone="ink2" align="center">
          Made from your phone.
        </Text>
        <View style={styles.buttons}>
          <Button title="I have a business" onPress={business} />
          <Button title="I want to earn" variant="ghost" onPress={earn} />
        </View>
        <Pressable onPress={logIn} accessibilityRole="button" hitSlop={8} style={styles.link}>
          <Text weight="bold" align="center">
            I already have an account
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/** Three slow columns of real shops (mock `.w2-wall`). */
function PhotoWall() {
  const { width } = useWindowDimensions();
  const colW = (width - space.md * 4) / 3;
  const tileH = colW * 1.3;
  const loop = tileH * 3 + space.md * 3;
  const anims = useRef(WALL.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const runs = anims.map((a, i) =>
      Animated.loop(Animated.timing(a, { toValue: 1, duration: 26000 + i * 5000, easing: Easing.linear, useNativeDriver: true })),
    );
    runs.forEach((r) => r.start());
    return () => runs.forEach((r) => r.stop());
  }, [anims]);
  return (
    <View style={styles.wall} pointerEvents="none" accessibilityElementsHidden>
      {WALL.map((col, i) => (
        <View key={i} style={{ width: colW, overflow: 'hidden' }}>
          <Animated.View
            style={{
              gap: space.md,
              marginTop: i === 1 ? -tileH * 0.4 : 0,
              transform: [{ translateY: anims[i].interpolate({ inputRange: [0, 1], outputRange: i === 1 ? [-loop, 0] : [0, -loop] }) }],
            }}
          >
            {[...col, ...col].map((src, k) => (
              <Image key={k} source={src} style={{ width: colW, height: tileH, borderRadius: 20 }} />
            ))}
          </Animated.View>
        </View>
      ))}
      <Svg style={styles.wallFade} width="100%" height={120} pointerEvents="none">
        <Defs>
          <LinearGradient id="wallFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.bg} stopOpacity={0} />
            <Stop offset="1" stopColor={colors.bg} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height={120} fill="url(#wallFade)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wall: { ...StyleSheet.absoluteFillObject, bottom: '38%', flexDirection: 'row', gap: space.md, paddingHorizontal: space.md, overflow: 'hidden' },
  wallFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.gutter, alignItems: 'center', gap: space.sm, backgroundColor: colors.bg, paddingTop: space.md },
  buttons: { alignSelf: 'stretch', gap: space.md, marginTop: space.lg },
  link: { minHeight: 48, justifyContent: 'center', marginTop: space.xs },
});
