/**
 * We build it (mock `siteBuilding`): the buddy, "Building your site · About 20 minutes",
 * four steps with real progress from the backend (ownerApp.getBuild, live), then
 * "Ready to check". A push notification also tells the owner when it is ready.
 */
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, ProgressBar, ScreenShell, Text } from '../../components/v2';
import { Buddy } from '../../components/v2/owner/OwnerUI';
import { useBuild } from '../../lib/v2/ownerData';
import { STEP_ROUTE } from '../../lib/v2/ownerFlow';
import { useOwnerSite } from '../../lib/v2/useOwnerSite';
import type { BuildStepKey } from '../../lib/v2/ownerTypes';
import { colors, radius, space } from '../../theme/v2';

const ICON: Record<BuildStepKey, React.ComponentProps<typeof Ionicons>['name']> = {
  reading_interview: 'mic-outline',
  writing_pages: 'create-outline',
  polishing_photos: 'image-outline',
  building_site: 'browsers-outline',
};

export default function Building() {
  const router = useRouter();
  const { id } = useOwnerSite();
  const build = useBuild(id);

  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [bob]);

  const phase = build?.phase;
  const ready = phase === 'ready_to_check' || phase === 'awaiting_payment' || phase === 'publishing' || phase === 'live';
  const changing = phase === 'changes_requested';
  const done = build?.doneCount ?? 0;
  const failed = build?.steps.some((s) => s.status === 'failed');

  const home = () => router.replace(STEP_ROUTE.home as never);

  if (ready) {
    return (
      <ScreenShell
        scroll={false}
        footer={<Button title="Check my site" onPress={() => router.replace(STEP_ROUTE.check as never)} />}
      >
        <View style={styles.center}>
          <View style={styles.okBig}><Ionicons name="checkmark" size={52} color={colors.onAccent} /></View>
          <Text variant="display" align="center" accessibilityRole="header">Ready to check</Text>
          <Text variant="bodyLg" tone="ink2" align="center">Your site is built.</Text>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell scroll={false} footer={<Button title="Back to home" variant="ghost" onPress={home} />}>
      <View style={styles.center}>
        <Animated.View style={{ transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }, { rotate: bob.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-3deg'] }) }] }}>
          <Buddy size={104} />
        </Animated.View>
        <Text variant="display" align="center" accessibilityRole="header">{changing ? 'Making your change' : 'Building your site'}</Text>
        <Text variant="bodyLg" tone="ink2" align="center">{changing ? "We'll tell you when it's ready." : `About ${build?.estimateMinutes ?? 20} minutes`}</Text>
        {!changing ? (
          <>
            <ProgressBar value={0.06 + 0.94 * (done / 4)} tone="accent" label="Build progress" style={styles.bar} />
            <View style={styles.rows}>
              {(build?.steps ?? []).map((s) => {
                const now = s.status === 'running';
                const ok = s.status === 'done';
                return (
                  <View key={s.key} style={[styles.row, (now || ok) && styles.rowOn]} accessible accessibilityLabel={`${s.label}, ${ok ? 'done' : now ? 'working' : 'waiting'}`}>
                    <View style={styles.ic}><Ionicons name={ICON[s.key]} size={20} color={colors.ink} /></View>
                    <Text weight="bold" style={{ flex: 1 }}>{s.label}</Text>
                    {ok ? (
                      <View style={styles.ok}><Ionicons name="checkmark" size={16} color={colors.onAccent} /></View>
                    ) : now ? (
                      <ActivityIndicator color={colors.ink} />
                    ) : s.status === 'failed' ? (
                      <Ionicons name="alert-circle" size={24} color={colors.danger} />
                    ) : null}
                  </View>
                );
              })}
            </View>
            {failed ? <Text tone="ink2" align="center">A step needs a person. We are on it.</Text> : null}
          </>
        ) : null}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  bar: { alignSelf: 'stretch', height: 8, marginTop: space.lg, marginBottom: space.sm },
  rows: { alignSelf: 'stretch', gap: 10, marginTop: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, paddingHorizontal: 14, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.7)', opacity: 0.55 },
  rowOn: { opacity: 1, backgroundColor: colors.card },
  ic: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center' },
  ok: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  okBig: { width: 96, height: 96, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
});
