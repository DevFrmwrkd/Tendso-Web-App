import { useEffect, useState } from 'react';
import { Platform, View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Stack, useSegments } from 'expo-router';
import { useAuth, useClerk } from '@clerk/clerk-expo';
import { Redirect } from 'expo-router';
import { useMutation } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useNetwork } from '../../providers/NetworkProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMobileAccount } from '../../hooks/useMobileAccount';
import { accountRouteRedirect, affiliateNeedsApproval } from '../../services/accountAccess';
import { clearPendingSignupProfiles } from '../../services/signupProfile';
import { AccountViewSwitcher } from '../../components/AccountViewSwitcher';
import { PendingAffiliateApproval } from '../../components/affiliate/PendingApproval';
import { colors, fonts } from '../../theme/tokens';
import { hasOwnerIntent } from '../../lib/v2/ownerIntake';

const AUTH_CACHE_KEY = 'ndm_was_signed_in';

export default function AppLayout() {
  const { isSignedIn, isLoaded, userId } = useAuth();
  const { isConnected } = useNetwork();
  const { signOut } = useClerk();
  const mobileAccount = useMobileAccount();
  const segments = useSegments();
  const updateLastActive = useMutation(api.creators.updateLastActive);
  const [cachedAuth, setCachedAuth] = useState<boolean | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  // "I have a business" on the welcome screen: a new account with no agent profile is an owner.
  const [ownerIntent, setOwnerIntentState] = useState<boolean | null>(null);
  useEffect(() => { void hasOwnerIntent().then(setOwnerIntentState); }, []);

  // Auto-sync offline data when connectivity returns
  useOfflineSync({
    enabled: mobileAccount.isAuthenticated && !mobileAccount.isOffline && !mobileAccount.isBlocked
      && mobileAccount.role === 'creator' && !mobileAccount.isPreview,
    creatorId: mobileAccount.account?._id,
  });

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
      void clearPendingSignupProfiles().catch(() => {});
      setCachedAuth(false);
    }
  }, [isLoaded, isSignedIn, isConnected]);

  // When offline with cached auth, treat as effectively loaded
  // isConnected must be known (not null) before making routing decisions
  const networkKnown = isConnected !== null;
  const effectivelyLoaded = networkKnown && (isLoaded || (isConnected === false && cachedAuth === true));

  useEffect(() => {
    if (mobileAccount.isAuthenticated && mobileAccount.account && userId && !mobileAccount.isOffline) {
      void updateLastActive({ clerkId: userId }).catch(() => {});
    }
  }, [mobileAccount.isAuthenticated, mobileAccount.account?._id, mobileAccount.isOffline, userId, updateLastActive]);

  if (!effectivelyLoaded || !authChecked) return null;

  // Offline with cached auth → stay in the app (draft mode)
  // Only redirect to login if definitely online and Clerk confirmed not signed in
  const effectivelySignedIn = isSignedIn || (isConnected === false && cachedAuth === true);
  if (!effectivelySignedIn) {
    return <Redirect href="/(auth)/login" />;
  }

  if (mobileAccount.isLoading) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }}>
      <ActivityIndicator accessibilityLabel="Loading account" color={colors.accent} />
    </View>
  );
  // Shop owners have their own app section (replaces the old "Continue on the web" dead end).
  // Agents, creators and admins are routed exactly as before.
  if (!mobileAccount.isOffline && mobileAccount.isOwner) return <Redirect href={'/(owner)' as never} />;
  if (!mobileAccount.isOffline && mobileAccount.account === null) {
    if (ownerIntent === null) return null;
    if (ownerIntent) return <Redirect href={'/(owner)' as never} />;
  }
  if (mobileAccount.isBlocked || (mobileAccount.isOffline && mobileAccount.role !== 'creator')
    || (!mobileAccount.isOffline && mobileAccount.account && !mobileAccount.role)) {
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: 'center', backgroundColor: colors.paper, gap: 16 }}>
        <Text style={{ fontFamily: fonts.serif, fontSize: 28, color: colors.ink }}>
          {mobileAccount.isBlocked ? 'Account unavailable' : mobileAccount.isOffline ? 'Reconnect to continue' : 'Continue on the web'}
        </Text>
        <Text style={{ fontFamily: fonts.sans, color: colors.ink2 }}>
          {mobileAccount.isBlocked ? 'This account is suspended or deleted. Contact support if you need help.'
            : mobileAccount.isOffline ? 'Connect to load your account and tools safely.' : 'This account type uses the Tendso website.'}
        </Text>
        <TouchableOpacity accessibilityRole="button" onPress={() => { void signOut(); }}>
          <Text style={{ fontFamily: fonts.sansBold, color: colors.ink }}>Sign out</Text>
        </TouchableOpacity>
      </View>
    );
  }
  // Keep every deep link, including shared referrals and payouts, outside the
  // navigator until approval. The live account query releases this immediately.
  if (affiliateNeedsApproval(mobileAccount.account)) return <PendingAffiliateApproval />;

  const route = (segments as string[])[1];
  if (!mobileAccount.isOffline && mobileAccount.account === null) {
    if (route !== 'account-setup') return <Redirect href={'/(app)/account-setup' as never} />;
  } else {
    const destination = accountRouteRedirect(mobileAccount.view, route, mobileAccount.isPreview);
    if (destination) return <Redirect href={destination as never} />;
  }

  return (
    <View style={{ flex: 1 }}>
    <AccountViewSwitcher />
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
    </View>
  );
}
