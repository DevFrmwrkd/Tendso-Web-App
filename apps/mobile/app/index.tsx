import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetwork } from '../providers/NetworkProvider';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const ONBOARDING_KEY = 'ndm_has_seen_onboarding';

const AUTH_CACHE_KEY = 'ndm_was_signed_in';

export default function Index() {
  const { isLoaded, isSignedIn } = useAuth();
  const { isConnected } = useNetwork();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [cachedAuth, setCachedAuth] = useState<boolean | null>(null);

  // Animation values
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoTranslateY = useRef(new Animated.Value(30)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const badgeTranslateY = useRef(new Animated.Value(30)).current;
  const headlineOpacity = useRef(new Animated.Value(0)).current;
  const headlineTranslateY = useRef(new Animated.Value(40)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslateY = useRef(new Animated.Value(40)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const ctaTranslateY = useRef(new Animated.Value(40)).current;

  // Check if onboarding was already seen + load cached auth
  useEffect(() => {
    const check = async () => {
      try {
        const [seen, authCache] = await Promise.all([
          AsyncStorage.getItem(ONBOARDING_KEY),
          AsyncStorage.getItem(AUTH_CACHE_KEY),
        ]);
        setShowWelcome(seen !== 'true');
        setCachedAuth(authCache === 'true');
      } catch {
        setShowWelcome(true);
        setCachedAuth(false);
      } finally {
        setCheckingOnboarding(false);
      }
    };
    check();
  }, []);

  // Run staggered fade-up animation when welcome screen is shown
  useEffect(() => {
    if (!showWelcome || checkingOnboarding) return;

    const delay = 300;
    const duration = 600;

    Animated.stagger(150, [
      // Logo
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration, useNativeDriver: true }),
        Animated.timing(logoTranslateY, { toValue: 0, duration, useNativeDriver: true }),
      ]),
      // Badge
      Animated.parallel([
        Animated.timing(badgeOpacity, { toValue: 1, duration, useNativeDriver: true }),
        Animated.timing(badgeTranslateY, { toValue: 0, duration, useNativeDriver: true }),
      ]),
      // Headline
      Animated.parallel([
        Animated.timing(headlineOpacity, { toValue: 1, duration, useNativeDriver: true }),
        Animated.timing(headlineTranslateY, { toValue: 0, duration, useNativeDriver: true }),
      ]),
      // Subtitle
      Animated.parallel([
        Animated.timing(subtitleOpacity, { toValue: 1, duration, useNativeDriver: true }),
        Animated.timing(subtitleTranslateY, { toValue: 0, duration, useNativeDriver: true }),
      ]),
      // CTA buttons
      Animated.parallel([
        Animated.timing(ctaOpacity, { toValue: 1, duration, useNativeDriver: true }),
        Animated.timing(ctaTranslateY, { toValue: 0, duration, useNativeDriver: true }),
      ]),
    ]).start();
  }, [showWelcome, checkingOnboarding]);

  const handleGetStarted = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    router.replace('/(auth)/signup');
  };

  const handleLogIn = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    router.replace('/(auth)/login');
  };

  // Wait for network state + cached auth + onboarding check
  const networkKnown = isConnected !== null;
  const effectivelyLoaded = networkKnown && (isLoaded || (isConnected === false && cachedAuth === true));

  if (!effectivelyLoaded || checkingOnboarding) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#E4B05E" />
      </View>
    );
  }

  // Offline with cached auth → go straight to app (keep as draft mode)
  const effectivelySignedIn = isSignedIn || (isConnected === false && cachedAuth === true);

  if (effectivelySignedIn) {
    return <Redirect href={'/(app)/(tabs)/' as any} />;
  }

  // Already seen onboarding → go to login
  if (!showWelcome) {
    return <Redirect href="/(auth)/login" />;
  }

  // Welcome / onboarding screen
  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />

      {/* Dark overlay gradient effect */}
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#0a0a0a',
      }}>
        {/* Decorative top accent */}
        <View style={{
          position: 'absolute', top: -80, right: -80,
          width: 260, height: 260, borderRadius: 130,
          backgroundColor: '#E4B05E15',
        }} />
        <View style={{
          position: 'absolute', top: 60, left: -60,
          width: 180, height: 180, borderRadius: 90,
          backgroundColor: '#E4B05E08',
        }} />
      </View>

      <View style={{
        flex: 1,
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 28,
        justifyContent: 'space-between',
      }}>
        {/* Top: Tendso wordmark (white, on dark welcome bg) */}
        <Animated.View style={{
          flexDirection: 'row', alignItems: 'center',
          opacity: logoOpacity,
          transform: [{ translateY: logoTranslateY }],
        }}>
          <Image
            source={require('../assets/tendso-logo.png')}
            style={{ height: 32, width: 136 }}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Center: Hero content */}
        <View style={{ gap: 20 }}>
          {/* Badge — campaign frame */}
          <Animated.View style={{
            opacity: badgeOpacity,
            transform: [{ translateY: badgeTranslateY }],
          }}>
            <View style={{
              alignSelf: 'flex-start',
              backgroundColor: '#E4B05E',
              borderRadius: 20,
              paddingHorizontal: 14, paddingVertical: 6,
            }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>
                HANDS FULL
              </Text>
            </View>
          </Animated.View>

          {/* Headline */}
          <Animated.View style={{
            opacity: headlineOpacity,
            transform: [{ translateY: headlineTranslateY }],
          }}>
            <Text style={{ fontSize: 42, fontWeight: '900', color: '#fff', lineHeight: 48, letterSpacing: -1 }}>
              Some hands{'\n'}
              don't get to{'\n'}
              <Text style={{ color: '#E4B05E' }}>sit still.</Text>
            </Text>
          </Animated.View>

          {/* Subtitle — the tagline */}
          <Animated.View style={{
            opacity: subtitleOpacity,
            transform: [{ translateY: subtitleTranslateY }],
          }}>
            <Text style={{ fontSize: 15, color: '#a1a1aa', lineHeight: 22 }}>
              The Thinking Ends Here. So the work doesn't.
            </Text>
          </Animated.View>
        </View>

        {/* Bottom: CTA buttons */}
        <Animated.View style={{
          opacity: ctaOpacity,
          transform: [{ translateY: ctaTranslateY }],
          gap: 16,
        }}>
          <TouchableOpacity
            onPress={handleGetStarted}
            activeOpacity={0.85}
            style={{
              backgroundColor: '#E4B05E',
              height: 56, borderRadius: 28,
              alignItems: 'center', justifyContent: 'center',
              shadowColor: '#E4B05E', shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>Get Started</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleLogIn}
            activeOpacity={0.7}
            style={{ alignItems: 'center', paddingVertical: 8 }}
          >
            <Text style={{ color: '#71717a', fontSize: 14 }}>
              Already have an account?{' '}
              <Text style={{ color: '#fff', fontWeight: '700' }}>Log In</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}
