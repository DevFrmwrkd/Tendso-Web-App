import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { View, ActivityIndicator } from 'react-native';

// This handles any unmatched routes (like OAuth callbacks with incorrect paths)
// It redirects to the appropriate screen based on auth state
export default function NotFoundScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;

    // Redirect based on auth state
    if (isSignedIn) {
      router.replace('/(app)/dashboard');
    } else {
      router.replace('/(auth)/login');
    }
  }, [isLoaded, isSignedIn, router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color="#E4B05E" />
    </View>
  );
}
