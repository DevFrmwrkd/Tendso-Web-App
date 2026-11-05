import React, { useCallback, useEffect } from 'react';
import { AccessibilityInfo, BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { useUser, useClerk } from '@clerk/clerk-expo';
import { useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useFocusEffect } from 'expo-router';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { Avatar, Card, CheckRow, ScreenShell, Text } from '../../components/v2';
import { colors, hit, radius, shadow, space } from '../../theme/v2';

function timeAgo(ts: number | null | undefined): string {
  if (!ts) return '';
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function PendingReviewScreen() {
  const router = useGuardedRouter();
  const { user } = useUser();
  const { signOut } = useClerk();

  const creator = useQuery(
    api.creators.getByClerkId,
    user ? { clerkId: user.id } : 'skip'
  );

  const [reduceMotion, setReduceMotion] = React.useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  // Block back navigation while on this screen (hard gate)
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => true; // swallow
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [])
  );

  // Auto-route away when the admin acts:
  //   - certifiedAt set → approved → bounce to home
  //   - rejectedAt set → rejected → bounce to /verification-rejected
  useEffect(() => {
    if (!creator) return;
    if ((creator as any).certifiedAt) {
      AsyncStorage.removeItem('ndm_just_quiz_passed');
      router.replace('/(app)/(tabs)/' as any);
    } else if ((creator as any).rejectedAt) {
      AsyncStorage.removeItem('ndm_just_quiz_passed');
      router.replace('/(app)/verification-rejected' as any);
    }
  }, [creator, router]);

  const handleSignOut = async () => {
    try {
      await AsyncStorage.removeItem('ndm_just_quiz_passed');
      await signOut();
      router.replace('/(auth)/login' as any);
    } catch {}
  };

  // Calm motion: the content fades in once, the hourglass breathes slowly.
  const enter = useSharedValue(0);
  const breathe = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      enter.value = 1;
      return;
    }
    enter.value = withTiming(1, { duration: 500 });
    breathe.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1400, easing: Easing.inOut(Easing.cubic) }),
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.cubic) }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(enter);
      cancelAnimation(breathe);
    };
  }, [reduceMotion]);

  const enterStyle = useAnimatedStyle(() => ({ opacity: enter.value }));
  const breatheStyle = useAnimatedStyle(() => ({ transform: [{ scale: breathe.value }] }));

  const firstName = (creator as any)?.firstName ?? '';
  const quizPassedAt = (creator as any)?.quizPassedAt as number | undefined;
  const profileImage = (creator as any)?.profileImage as string | undefined;
  const photo = profileImage && /^https?:/.test(profileImage) ? profileImage : user?.imageUrl;

  return (
    <ScreenShell
      headerRight={
        <Pressable
          onPress={handleSignOut}
          accessibilityLabel="Sign out"
          accessibilityRole="button"
          style={[styles.signOut, shadow.soft]}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.ink} />
          <Text variant="label" weight="bold">Sign out</Text>
        </Pressable>
      }
      footer={
        <Card variant="tint" style={styles.notice}>
          <Ionicons name="notifications-outline" size={24} color={colors.ink} />
          <Text variant="label" tone="ink2" style={styles.noticeText}>
            You can close the app. We'll send a notification when you're in.
          </Text>
        </Card>
      }
    >
      <Animated.View style={enterStyle}>
        <View style={styles.hero}>
          <View>
            <Avatar uri={photo} name={firstName} size={112} ring />
            <Animated.View style={[styles.badge, breatheStyle]}>
              <Ionicons name="hourglass-outline" size={20} color={colors.onAccent} />
            </Animated.View>
          </View>
          <Text variant="title" align="center" accessibilityRole="header">We're checking your details</Text>
          <Text variant="bodyLg" tone="ink2" align="center">
            {firstName ? `Hi ${firstName}. ` : ''}It takes less than a day.
          </Text>
        </View>
        <View style={styles.steps}>
          <CheckRow title="Profile sent" state="done" />
          <CheckRow title="Training and quiz" subtitle={quizPassedAt ? `Passed ${timeAgo(quizPassedAt)}` : undefined} state="done" />
          <CheckRow title="Team checks your details" subtitle="Usually within 24 hours" state="now" right="Now" />
          <CheckRow title="Start finding shops" subtitle="Your map opens" state="todo" />
        </View>
      </Animated.View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: hit.icon,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
  },
  hero: { alignItems: 'center', gap: space.md, marginBottom: space.xl, paddingHorizontal: space.sm },
  badge: {
    position: 'absolute',
    right: -6,
    bottom: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  steps: { gap: space.sm },
  notice: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  noticeText: { flex: 1 },
});
