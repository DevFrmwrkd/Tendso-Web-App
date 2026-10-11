import React, { useEffect, useState } from 'react';
import { ClerkProvider, useClerk as useClerkSignOut } from '@clerk/clerk-expo';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexReactClient } from 'convex/react';
import { useAuth, useClerk } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NetworkProvider } from './NetworkProvider';

let NetInfoModule: any = null;
try {
  NetInfoModule = require('@react-native-community/netinfo').default;
} catch {}


// Environment variables - set via eas.json env or EAS secrets for production builds
const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL;
const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!CONVEX_URL) {
  throw new Error("Missing EXPO_PUBLIC_CONVEX_URL environment variable. Set it in eas.json or .env.local");
}
if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error("Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY environment variable. Set it in eas.json or .env.local");
}

const convex = new ConvexReactClient(CONVEX_URL);

// Token cache for Clerk using SecureStore
const tokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (err) {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (err) {
      console.error('Failed to save token:', err);
    }
  },
  async clearToken(key: string) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (err) {
      console.error('Failed to clear token:', err);
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// AppErrorBoundary
// Catches errors thrown during render — including Convex `useQuery` calls that
// throw server errors like "Not authenticated" or "Schema validation failed".
// Without this, a single bad query in any screen takes down the entire app
// (FATAL EXCEPTION → process death). This boundary catches the throw and shows
// a recovery screen with a Sign out option so the user can re-auth or escape.
// ─────────────────────────────────────────────────────────────────────────────

type ErrorBoundaryProps = { children: React.ReactNode };
type ErrorBoundaryState = { hasError: boolean; error: Error | null };

class AppErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AppErrorBoundary] caught:', error?.message);
    console.error('[AppErrorBoundary] component stack:', info?.componentStack);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onRetry={this.reset} />;
    }
    return this.props.children;
  }
}

function ErrorFallback({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  const { signOut } = useClerkSignOut();
  const message = error?.message ?? 'Unknown error';
  const isAuthError = /not authenticated|auth provider|no auth provider/i.test(message);

  const handleSignOut = async () => {
    try {
      await AsyncStorage.multiRemove(['ndm_just_certified', 'ndm_just_quiz_passed', 'ndm_was_signed_in']);
      await signOut();
    } catch {}
    onRetry();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F5EE', justifyContent: 'center', paddingHorizontal: 24 }}>
      <ScrollView contentContainerStyle={{ alignItems: 'center' }}>
        <View style={{
          width: 64, height: 64, borderRadius: 32,
          backgroundColor: '#F3D7CF', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
        }}>
          <Text style={{ fontSize: 32, color: '#B43A1F' }}>!</Text>
        </View>
        <Text style={{ fontSize: 28, fontWeight: '800', color: '#1B1C24', textAlign: 'center', marginBottom: 10 }}>
          {isAuthError ? 'Auth refresh needed' : 'Something went wrong'}
        </Text>
        <Text style={{ fontSize: 14, color: '#3C3F4A', textAlign: 'center', lineHeight: 20, marginBottom: 18, maxWidth: 320 }}>
          {isAuthError
            ? "Your session couldn't be verified. Sign out and back in to refresh your auth token."
            : "The app hit an unexpected error. You can try again, or sign out and back in to reset."}
        </Text>
        <View style={{
          backgroundColor: '#EFEBE0', borderRadius: 12, padding: 12,
          maxWidth: 360, width: '100%', marginBottom: 22,
        }}>
          <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, color: '#7A7E8A', letterSpacing: 0.4 }}>
            {message.slice(0, 240)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleSignOut}
          style={{
            backgroundColor: '#1B1C24', paddingHorizontal: 22, paddingVertical: 14,
            borderRadius: 18, marginBottom: 12, minWidth: 220, alignItems: 'center',
          }}
        >
          <Text style={{ color: '#FCFAF5', fontSize: 15, fontWeight: '600' }}>Sign out and try again</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onRetry}
          style={{
            paddingHorizontal: 22, paddingVertical: 12,
            borderRadius: 18, borderWidth: 1, borderColor: '#1B1C24', minWidth: 220, alignItems: 'center',
          }}
        >
          <Text style={{ color: '#1B1C24', fontSize: 14, fontWeight: '500' }}>Retry without signing out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function ConvexClerkProviderInner({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <AppErrorBoundary>{children}</AppErrorBoundary>
    </ConvexProviderWithClerk>
  );
}

function ClerkLoadedWithFallback({ children }: { children: React.ReactNode }) {
  const { loaded } = useClerk();
  const [showTimeout, setShowTimeout] = useState(false);
  const [forceRender, setForceRender] = useState(false);

  useEffect(() => {
    if (loaded) return;

    let cancelled = false;

    // If offline with cached auth, bypass Clerk load wait immediately
    const checkOfflineAuth = async () => {
      try {
        if (NetInfoModule) {
          const state = await NetInfoModule.fetch();
          if (!state.isConnected && !cancelled) {
            const cached = await AsyncStorage.getItem('ndm_was_signed_in');
            if (cached === 'true' && !cancelled) {
              console.log('Offline with cached auth — bypassing Clerk load wait');
              setForceRender(true);
              return;
            }
          }
        }
      } catch {}
    };
    checkOfflineAuth();

    const warningTimer = setTimeout(() => {
      if (!cancelled) {
        setShowTimeout(true);
        console.log('Clerk is taking longer than expected to load...');
      }
    }, 5000);

    // Absolute fallback for any scenario where Clerk never loads
    const forceTimer = setTimeout(() => {
      if (!cancelled) {
        console.log('Clerk failed to load after 10s, force rendering...');
        setForceRender(true);
      }
    }, 10000);

    return () => {
      cancelled = true;
      clearTimeout(warningTimer);
      clearTimeout(forceTimer);
    };
  }, [loaded]);

  if (!loaded && !forceRender) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#E4B05E" />
        {showTimeout && (
          <Text style={{ marginTop: 16, color: '#666' }}>Loading authentication...</Text>
        )}
      </View>
    );
  }

  return <>{children}</>;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider>
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
        <ClerkLoadedWithFallback>
          <ConvexClerkProviderInner>
            <NetworkProvider>
              {children}
            </NetworkProvider>
          </ConvexClerkProviderInner>
        </ClerkLoadedWithFallback>
      </ClerkProvider>
    </SafeAreaProvider>
  );
}
