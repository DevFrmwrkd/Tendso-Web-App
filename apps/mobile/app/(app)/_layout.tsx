import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Redirect } from 'expo-router';
import { useMutation } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useNetwork } from '../../providers/NetworkProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_CACHE_KEY = 'ndm_was_signed_in';

export default function AppLayout() {
  const { isSignedIn, isLoaded, userId } = useAuth();
  const { isConnected } = useNetwork();
  const updateLastActive = useMutation(api.creators.updateLastActive);
  const [cachedAuth, setCachedAuth] = useState<boolean | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Auto-sync offline data when connectivity returns
  useOfflineSync();

  // Load cached auth state on mount
  useEffect(() => {
    AsyncStorage.getItem(AUTH_CACHE_KEY).then((val) => {
      setCachedAuth(val === 'true');
      setAuthChecked(true);
    });
  }, []);

  // Cache auth state when signed in
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      AsyncStorage.setItem(AUTH_CACHE_KEY, 'true');
      setCachedAuth(true);
    }
  }, [isLoaded, isSignedIn]);

  // Clear cache on explicit sign-out (only when definitely online + Clerk confirmed not signed in)
  // isConnected must be explicitly true (not null/unknown) to avoid race condition
  useEffect(() => {
    if (isLoaded && !isSignedIn && isConnected === true) {
      AsyncStorage.removeItem(AUTH_CACHE_KEY);
      setCachedAuth(false);
    }
  }, [isLoaded, isSignedIn, isConnected]);

  // When offline with cached auth, treat as effectively loaded
  // isConnected must be known (not null) before making routing decisions
  const networkKnown = isConnected !== null;
  const effectivelyLoaded = networkKnown && (isLoaded || (isConnected === false && cachedAuth === true));

  useEffect(() => {
    if (isSignedIn && userId) {
      updateLastActive({ clerkId: userId });
    }
  }, [isSignedIn, userId]);

  if (!effectivelyLoaded || !authChecked) return null;

  // Offline with cached auth → stay in the app (draft mode)
  // Only redirect to login if definitely online and Clerk confirmed not signed in
  const effectivelySignedIn = isSignedIn || (isConnected === false && cachedAuth === true);
  if (!effectivelySignedIn) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // iOS: native UINavigationController push — the previous screen is
        // revealed underneath with parallax + shadow + dimming, and the
        // interactive edge-swipe pop comes for free. This is the "solid,
        // real-app" feel. Android keeps the standard slide-from-right push.
        animation: Platform.OS === 'ios' ? 'default' : 'slide_from_right',
      }}
    >
      {/* Submit wizard — a deliberate linear flow. Disable the edge-swipe pop
          so a stray gesture can't drop the user back a step and lose picked
          photos, interrupt an in-progress recording, or swipe back INTO the
          completed flow from the success screen. Every step still has its own
          on-screen back arrow (router.back()), so the user is never trapped. */}
      {/* Reached via <Redirect> for a social sign-up missing a name. Disable the
          edge-swipe so it can't be dismissed without entering one. */}
      <Stack.Screen name="complete-profile" options={{ gestureEnabled: false }} />
      <Stack.Screen name="submit/info" options={{ gestureEnabled: false }} />
      <Stack.Screen name="submit/photos" options={{ gestureEnabled: false }} />
      <Stack.Screen name="submit/interview" options={{ gestureEnabled: false }} />
      <Stack.Screen name="submit/review" options={{ gestureEnabled: false }} />
      <Stack.Screen name="submit/success" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
