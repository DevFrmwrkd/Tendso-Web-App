import { useEffect, useCallback, useState, useRef } from 'react';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { View, Image, Text, ActivityIndicator, LogBox } from 'react-native';
import { AppProviders } from '../providers/AppProviders';
import { useNetwork } from '../providers/NetworkProvider';
import { SheetDimHost } from '../components/ui/SheetDimHost';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts as useInstrumentSerifFonts,
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from '@expo-google-fonts/instrument-serif';
import {
  Onest_400Regular,
  Onest_500Medium,
  Onest_700Bold,
} from '@expo-google-fonts/onest';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono';
import {
  GoogleSansFlex_500Medium,
  GoogleSansFlex_700Bold,
} from '@expo-google-fonts/google-sans-flex';
import { colors } from '../theme/tokens';
import '../global.css';

// Ignore the navigation warning from OAuth callbacks with legacy payload format
// This is a development-only warning - the app handles the redirect correctly
LogBox.ignoreLogs([
  'The action \'REPLACE\' with payload',
  'The action "REPLACE" with payload',
  'The action \'REPLACE\'',
]);

// Suppress the console.error for this specific navigation warning in development
if (__DEV__) {
  const originalConsoleError = console.error;
  console.error = (...args) => {
    const message = args[0];
    if (typeof message === 'string' && message.includes('The action \'REPLACE\' with payload')) {
      return; // Suppress this specific error
    }
    originalConsoleError(...args);
  };
}

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

const AUTH_CACHE_KEY = 'ndm_was_signed_in';

function InitialLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const { isConnected } = useNetwork();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  // Editorial Paper fonts (Instrument Serif + Onest + JetBrains Mono) for the
  // redesigned UI. If they fail to load we still render — system fallbacks
  // are declared in theme/tokens.ts.
  const [fontsLoaded] = useInstrumentSerifFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    Onest_400Regular,
    Onest_500Medium,
    Onest_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    // Tendso wordmark — Google Sans Flex on the literal brand surfaces only
    // (certificate banner, footer wordmarks). Body + display copy stays serif/sans.
    GoogleSansFlex_500Medium,
    GoogleSansFlex_700Bold,
  });

  // Track auth transition state to prevent flash
  const [isAuthTransitioning, setIsAuthTransitioning] = useState(false);
  const previousSignedIn = useRef<boolean | null | undefined>(null);
  const [cachedAuth, setCachedAuth] = useState<boolean | null>(null);

  // Load cached auth state on mount
  useEffect(() => {
    AsyncStorage.getItem(AUTH_CACHE_KEY).then((val) => {
      setCachedAuth(val === 'true');
    });
  }, []);

  // When offline with cached auth, treat as effectively loaded so we bypass Clerk gates
  // isConnected === null means we haven't determined network state yet — wait
  // Also gate on fonts so the editorial type lands before the first paint —
  // fall through after 4s if fonts never load (rare, slow network)
  const [fontsTimedOut, setFontsTimedOut] = useState(false);
  useEffect(() => {
    if (fontsLoaded) return;
    const t = setTimeout(() => setFontsTimedOut(true), 4000);
    return () => clearTimeout(t);
  }, [fontsLoaded]);
  const fontsReady = fontsLoaded || fontsTimedOut;
  const networkKnown = isConnected !== null;
  const effectivelyLoaded =
    networkKnown && fontsReady && (isLoaded || (isConnected === false && cachedAuth === true));

  // Safety: if Clerk never loads after 12 seconds, force the app to render anyway
  // (prevents permanent logo screen when Clerk/Convex env mismatch occurs)
  const [forceLoaded, setForceLoaded] = useState(false);
  useEffect(() => {
    if (effectivelyLoaded) return;
    const timer = setTimeout(() => {
      if (!effectivelyLoaded) {
        console.warn('[Layout] Clerk/auth never loaded after 12s — force rendering');
        setForceLoaded(true);
      }
    }, 12000);
    return () => clearTimeout(timer);
  }, [effectivelyLoaded]);

  const readyToRender = effectivelyLoaded || forceLoaded;

  // Hide the native splash screen once we're ready.
  useEffect(() => {
    if (readyToRender) {
      SplashScreen.hideAsync();
    }
  }, [readyToRender]);

  const onLayoutRootView = useCallback(async () => {
    if (readyToRender) {
      await SplashScreen.hideAsync();
    }
  }, [readyToRender]);

  // Detect auth state changes and set transitioning state
  useEffect(() => {
    if (!readyToRender) return;

    // If auth state changed (signed in or out), we're transitioning
    if (previousSignedIn.current !== null && previousSignedIn.current !== isSignedIn) {
      setIsAuthTransitioning(true);
    }
    previousSignedIn.current = isSignedIn;
  }, [readyToRender, isSignedIn]);

  useEffect(() => {
    if (!readyToRender || !navigationState?.key) return;

    const inAuthGroup = segments[0] === '(auth)';

    // When offline with cached auth, treat user as "signed in" for routing purposes
    const effectivelySignedIn = isSignedIn || (isConnected === false && cachedAuth === true);

    if (effectivelySignedIn && inAuthGroup) {
      // User is signed in (or offline with cached auth), redirect to tabs home
      router.replace('/(app)/(tabs)/' as any);
      setTimeout(() => setIsAuthTransitioning(false), 500);
    } else if (!effectivelySignedIn && !inAuthGroup) {
      // Truly not signed in — redirect to login
      router.replace('/(auth)/login');
      setTimeout(() => setIsAuthTransitioning(false), 500);
    } else {
      // Already in correct group, clear transitioning state
      setIsAuthTransitioning(false);
    }
  }, [readyToRender, isSignedIn, segments, navigationState?.key, isConnected, cachedAuth]);

  const showOverlay = !readyToRender || isAuthTransitioning;

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
      {showOverlay && (
        <View style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          justifyContent: 'center',
          alignItems: 'center',
          // Must match the native splash backgroundColor exactly, otherwise the
          // handover from splash to JS flashes.
          backgroundColor: colors.paper,
          paddingHorizontal: 32,
        }}>
          <Image
            // splash-mark, not the app icon: the icon is an opaque black tile
            // (App Store icons may not have alpha), which renders as a hard
            // black square floating on the paper background.
            source={require('../assets/splash-mark.png')}
            style={{ width: 150, height: 150 }}
            resizeMode="contain"
          />
          <Text
            style={{
              marginTop: 20,
              fontFamily: 'InstrumentSerif_400Regular_Italic',
              fontSize: 18,
              lineHeight: 24,
              color: '#3C3F4A',
              textAlign: 'center',
              maxWidth: 280,
            }}
          >
            The Thinking Ends Here. So the work doesn't.
          </Text>
          {isAuthTransitioning && (
            <ActivityIndicator
              size="large"
              color="#E4B05E"
              style={{ marginTop: 24 }}
            />
          )}
        </View>
      )}
    </View>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <SheetDimHost>
        <InitialLayout />
      </SheetDimHost>
    </AppProviders>
  );
}
