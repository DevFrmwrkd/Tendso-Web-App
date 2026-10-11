import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  BackHandler,
  AccessibilityInfo,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  withSpring,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

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

  // ===== Animation shared values =====
  const heroOpacity = useSharedValue(0);
  const heroTranslateY = useSharedValue(30);
  const listOpacity = useSharedValue(0);
  const listTranslateY = useSharedValue(30);

  const magnifierRotate = useSharedValue(0);
  const check1Opacity = useSharedValue(0);
  const check2Opacity = useSharedValue(0);
  const check3Opacity = useSharedValue(0);
  const check1Scale = useSharedValue(0.5);
  const check2Scale = useSharedValue(0.5);
  const check3Scale = useSharedValue(0.5);

  const avatar1Y = useSharedValue(0);
  const avatar2Y = useSharedValue(0);
  const avatar3Y = useSharedValue(0);

  const sparkle1Opacity = useSharedValue(0);
  const sparkle2Opacity = useSharedValue(0);
  const sparkle3Opacity = useSharedValue(0);

  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.6);

  useEffect(() => {
    // Hero card entrance
    heroOpacity.value = withTiming(1, { duration: 500 });
    heroTranslateY.value = withSpring(0, { damping: 14, stiffness: 90 });
    listOpacity.value = withDelay(200, withTiming(1, { duration: 500 }));
    listTranslateY.value = withDelay(200, withSpring(0, { damping: 14, stiffness: 90 }));

    if (reduceMotion) return;

    // Continuous animations
    magnifierRotate.value = withRepeat(
      withTiming(360, { duration: 6000, easing: Easing.inOut(Easing.cubic) }),
      -1,
      false,
    );

    // Avatars float wave pattern
    avatar1Y.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 800, easing: Easing.inOut(Easing.cubic) }),
        withTiming(4, { duration: 800, easing: Easing.inOut(Easing.cubic) }),
      ),
      -1,
      true,
    );
    avatar2Y.value = withDelay(
      400,
      withRepeat(
        withSequence(
          withTiming(-4, { duration: 800, easing: Easing.inOut(Easing.cubic) }),
          withTiming(4, { duration: 800, easing: Easing.inOut(Easing.cubic) }),
        ),
        -1,
        true,
      ),
    );
    avatar3Y.value = withDelay(
      800,
      withRepeat(
        withSequence(
          withTiming(-4, { duration: 800, easing: Easing.inOut(Easing.cubic) }),
          withTiming(4, { duration: 800, easing: Easing.inOut(Easing.cubic) }),
        ),
        -1,
        true,
      ),
    );

    // Checkmarks cascade in (then loop after a pause)
    const checkLoop = (sv: typeof check1Opacity, scale: typeof check1Scale, delay: number) =>
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 300, easing: Easing.out(Easing.back(2)) }),
            withTiming(1, { duration: 3500 }),
            withTiming(0, { duration: 200 }),
            withTiming(0, { duration: 1000 }),
          ),
          -1,
          false,
        ),
      );
    const scaleLoop = (sv: typeof check1Scale, delay: number) =>
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1.2, { duration: 200, easing: Easing.out(Easing.back(2)) }),
            withTiming(1, { duration: 200 }),
            withTiming(1, { duration: 3300 }),
            withTiming(0.5, { duration: 200 }),
            withTiming(0.5, { duration: 1000 }),
          ),
          -1,
          false,
        ),
      );
    check1Opacity.value = checkLoop(check1Opacity, check1Scale, 600);
    check2Opacity.value = checkLoop(check2Opacity, check2Scale, 1200);
    check3Opacity.value = checkLoop(check3Opacity, check3Scale, 1800);
    check1Scale.value = scaleLoop(check1Scale, 600);
    check2Scale.value = scaleLoop(check2Scale, 1200);
    check3Scale.value = scaleLoop(check3Scale, 1800);

    // Sparkles twinkle randomly
    const twinkle = (sv: typeof sparkle1Opacity, delay: number) =>
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 500 }),
            withTiming(0, { duration: 500 }),
            withTiming(0, { duration: 1200 }),
          ),
          -1,
          false,
        ),
      );
    sparkle1Opacity.value = twinkle(sparkle1Opacity, 0);
    sparkle2Opacity.value = twinkle(sparkle2Opacity, 700);
    sparkle3Opacity.value = twinkle(sparkle3Opacity, 1400);

    // Pulsing "review in progress" dot
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.4, { duration: 800, easing: Easing.inOut(Easing.cubic) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.cubic) }),
      ),
      -1,
      true,
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800 }),
        withTiming(0.6, { duration: 800 }),
      ),
      -1,
      true,
    );

    return () => {
      cancelAnimation(magnifierRotate);
      cancelAnimation(avatar1Y);
      cancelAnimation(avatar2Y);
      cancelAnimation(avatar3Y);
      cancelAnimation(check1Opacity);
      cancelAnimation(check2Opacity);
      cancelAnimation(check3Opacity);
      cancelAnimation(sparkle1Opacity);
      cancelAnimation(sparkle2Opacity);
      cancelAnimation(sparkle3Opacity);
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
    };
  }, [reduceMotion]);

  const heroStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
    transform: [{ translateY: heroTranslateY.value }],
  }));
  const listStyle = useAnimatedStyle(() => ({
    opacity: listOpacity.value,
    transform: [{ translateY: listTranslateY.value }],
  }));
  const magnifierStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${magnifierRotate.value}deg` }],
  }));
  const check1Style = useAnimatedStyle(() => ({
    opacity: check1Opacity.value,
    transform: [{ scale: check1Scale.value }],
  }));
  const check2Style = useAnimatedStyle(() => ({
    opacity: check2Opacity.value,
    transform: [{ scale: check2Scale.value }],
  }));
  const check3Style = useAnimatedStyle(() => ({
    opacity: check3Opacity.value,
    transform: [{ scale: check3Scale.value }],
  }));
  const avatar1Style = useAnimatedStyle(() => ({
    transform: [{ translateY: avatar1Y.value }],
  }));
  const avatar2Style = useAnimatedStyle(() => ({
    transform: [{ translateY: avatar2Y.value }],
  }));
  const avatar3Style = useAnimatedStyle(() => ({
    transform: [{ translateY: avatar3Y.value }],
  }));
  const sparkle1Style = useAnimatedStyle(() => ({ opacity: sparkle1Opacity.value }));
  const sparkle2Style = useAnimatedStyle(() => ({ opacity: sparkle2Opacity.value }));
  const sparkle3Style = useAnimatedStyle(() => ({ opacity: sparkle3Opacity.value }));
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
    transform: [{ scale: pulseScale.value }],
  }));

  const firstName = (creator as any)?.firstName ?? '';
  const quizPassedAt = (creator as any)?.quizPassedAt as number | undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF3E0' }}>
      {/* Header — only sign-out as escape */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}
      >
        <TouchableOpacity
          onPress={handleSignOut}
          accessibilityLabel="Sign out"
          accessibilityRole="button"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 16,
            backgroundColor: '#fff',
            borderWidth: 1,
            borderColor: '#e4e4e7',
          }}
        >
          <Ionicons name="log-out-outline" size={14} color="#52525b" />
          <Text style={{ color: '#52525b', fontSize: 12, fontWeight: '600', marginLeft: 4 }}>
            Sign out
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingBottom: 40,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* === HERO ILLUSTRATION === */}
        <Animated.View
          style={[
            {
              width: '100%',
              maxWidth: 340,
              alignItems: 'center',
              marginBottom: 24,
            },
            heroStyle,
          ]}
        >
          <View
            style={{
              width: 240,
              height: 180,
              backgroundColor: '#fff',
              borderRadius: 28,
              shadowColor: '#E4B05E',
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.15,
              shadowRadius: 20,
              elevation: 6,
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Background gradient-ish dots */}
            <View
              style={{
                position: 'absolute',
                top: -30,
                right: -30,
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor: '#F5E4C0',
                opacity: 0.5,
              }}
            />
            <View
              style={{
                position: 'absolute',
                bottom: -40,
                left: -40,
                width: 140,
                height: 140,
                borderRadius: 70,
                backgroundColor: '#F5E4C0',
                opacity: 0.5,
              }}
            />

            {/* Document with checkmarks */}
            <View
              style={{
                width: 120,
                height: 90,
                backgroundColor: '#fff',
                borderWidth: 2,
                borderColor: '#E4B05E',
                borderRadius: 12,
                padding: 10,
                marginBottom: 4,
              }}
            >
              <View style={{ height: 6, width: 50, backgroundColor: '#F5E4C0', borderRadius: 3, marginBottom: 8 }} />
              {[check1Style, check2Style, check3Style].map((s, i) => (
                <Animated.View
                  key={i}
                  style={[
                    { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
                    s,
                  ]}
                >
                  <Ionicons name="checkmark-circle" size={12} color="#E4B05E" />
                  <View
                    style={{
                      height: 4,
                      width: 60,
                      backgroundColor: '#a7f3d0',
                      borderRadius: 2,
                      marginLeft: 4,
                    }}
                  />
                </Animated.View>
              ))}
            </View>

            {/* Magnifying glass overlay */}
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  top: 18,
                  right: 24,
                },
                magnifierStyle,
              ]}
            >
              <Ionicons name="search" size={28} color="#C89548" />
            </Animated.View>

            {/* Sparkles */}
            <Animated.View style={[{ position: 'absolute', top: 14, right: 60 }, sparkle1Style]}>
              <Text style={{ fontSize: 14 }}>✨</Text>
            </Animated.View>
            <Animated.View style={[{ position: 'absolute', top: 50, right: 14 }, sparkle2Style]}>
              <Text style={{ fontSize: 10 }}>✨</Text>
            </Animated.View>
            <Animated.View style={[{ position: 'absolute', top: 24, right: 100 }, sparkle3Style]}>
              <Text style={{ fontSize: 12 }}>✨</Text>
            </Animated.View>
          </View>

          {/* Floating avatars below the card */}
          <View
            style={{
              flexDirection: 'row',
              marginTop: -22,
              gap: 12,
            }}
          >
            {[avatar1Style, avatar2Style, avatar3Style].map((s, i) => (
              <Animated.View
                key={i}
                style={[
                  {
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: ['#E4B05E', '#C89548', '#C89548'][i],
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 3,
                    borderColor: '#fff',
                    shadowColor: '#E4B05E',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 6,
                    elevation: 4,
                  },
                  s,
                ]}
              >
                <Ionicons
                  name={['person', 'happy', 'person'][i] as any}
                  size={20}
                  color="#fff"
                />
              </Animated.View>
            ))}
          </View>
        </Animated.View>

        {/* === COPY === */}
        <Animated.View style={[{ width: '100%', maxWidth: 340 }, heroStyle]}>
          <Text
            style={{
              fontSize: 26,
              fontWeight: '900',
              color: '#5C3A0F',
              textAlign: 'center',
              marginBottom: 10,
            }}
          >
            We're reviewing your application
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: '#C89548',
              textAlign: 'center',
              lineHeight: 22,
              marginBottom: 24,
              paddingHorizontal: 8,
            }}
          >
            {firstName ? `Hi ${firstName}, our` : 'Our'} team is carefully going through your quiz results. You're almost ready to start interviewing businesses.
          </Text>
        </Animated.View>

        {/* === ETA CARD === */}
        <Animated.View
          style={[
            {
              width: '100%',
              maxWidth: 340,
              backgroundColor: '#fff',
              borderRadius: 16,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#F5E4C0',
              marginBottom: 14,
            },
            listStyle,
          ]}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: '#F5E4C0',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <Ionicons name="time-outline" size={20} color="#C89548" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#71717a', letterSpacing: 0.6 }}>
              ESTIMATED REVIEW TIME
            </Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#5C3A0F', marginTop: 2 }}>
              Within 24 hours
            </Text>
          </View>
        </Animated.View>

        {/* === PROGRESS CHECKLIST === */}
        <Animated.View
          style={[
            {
              width: '100%',
              maxWidth: 340,
              backgroundColor: '#fff',
              borderRadius: 16,
              padding: 4,
              borderWidth: 1,
              borderColor: '#F5E4C0',
              marginBottom: 18,
            },
            listStyle,
          ]}
        >
          {/* Step 1 — done */}
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f4f4f5' }}>
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: '#E4B05E',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Ionicons name="checkmark" size={14} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#5C3A0F' }}>
                Quiz passed
              </Text>
              {quizPassedAt && (
                <Text style={{ fontSize: 11, color: '#71717a', marginTop: 1 }}>
                  {timeAgo(quizPassedAt)}
                </Text>
              )}
            </View>
          </View>

          {/* Step 2 — in progress */}
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f4f4f5' }}>
            <Animated.View
              style={[
                {
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: '#fbbf24',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                },
                pulseStyle,
              ]}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />
            </Animated.View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#5C3A0F' }}>
                Admin review in progress
              </Text>
              <Text style={{ fontSize: 11, color: '#71717a', marginTop: 1 }}>
                Our team is verifying your account
              </Text>
            </View>
          </View>

          {/* Step 3 — pending */}
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: '#f4f4f5',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
                borderWidth: 1.5,
                borderColor: '#d4d4d8',
              }}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#a1a1aa' }}>
                Account activated
              </Text>
              <Text style={{ fontSize: 11, color: '#a1a1aa', marginTop: 1 }}>
                Start submitting & earning
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* === BOTTOM REASSURANCE === */}
        <Animated.View
          style={[
            {
              width: '100%',
              maxWidth: 340,
              flexDirection: 'row',
              alignItems: 'flex-start',
              padding: 14,
              backgroundColor: '#FBF3E0',
              borderRadius: 12,
              borderLeftWidth: 3,
              borderLeftColor: '#E4B05E',
            },
            listStyle,
          ]}
        >
          <Text style={{ fontSize: 18, marginRight: 10 }}>💌</Text>
          <Text style={{ flex: 1, fontSize: 12, color: '#C89548', lineHeight: 18 }}>
            We'll send you a notification the moment you're approved. You can close the app and we'll let you know when you're in.
          </Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
