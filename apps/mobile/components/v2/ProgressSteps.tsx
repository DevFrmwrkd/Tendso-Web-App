import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, duration, ease, radius } from '../../theme/v2';

export interface ProgressStepsProps {
  /** Number of segments. The recording and photo flows use 10. */
  total?: number;
  /** 1-based index of the CURRENT step. Steps before it are done. */
  current: number;
  /** `dark` = over the camera (white done, accent current); `light` = on tinted screens (ink done). */
  tone?: 'dark' | 'light';
  /** Spoken as "<label> 4 of 10". */
  label?: string;
  style?: StyleProp<ViewStyle>;
}

const segColors = {
  dark: { done: colors.onDark, cur: colors.accent, todo: colors.onDarkMuted },
  light: { done: colors.ink, cur: colors.accent, todo: colors.bg2 },
} as const;

/**
 * The 10-step bar (mock `.cam-segs`): flat segments, 4pt tall, 4pt gap.
 * Done = white/ink, current = accent FILL, rest = muted. Shows only the bar —
 * no "4 / 10" text (Rule #1); the count is exposed to screen readers instead.
 */
export function ProgressSteps({ total = 10, current, tone = 'light', label = 'Step', style }: ProgressStepsProps) {
  const now = Math.min(Math.max(Math.round(current), 1), total);
  const c = segColors[tone];
  return (
    <View
      style={[styles.row, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${label} ${now} of ${total}`}
      accessibilityValue={{ min: 1, max: total, now }}
    >
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const bg = n < now ? c.done : n === now ? c.cur : c.todo;
        return (
          <View
            key={n}
            testID={`progress-seg-${n}`}
            style={[styles.seg, { backgroundColor: bg }, tone === 'light' && n === now ? styles.curOutline : null]}
          />
        );
      })}
    </View>
  );
}

export interface ProgressBarProps {
  /** 0..1 */
  value: number;
  /** `accent` fills with the accent (selected/progress), default ink. */
  tone?: 'ink' | 'accent';
  label?: string;
  style?: StyleProp<ViewStyle>;
}

/** Thin single bar (mock `.a-progress`): "Progress = one thin bar at the top." */
export function ProgressBar({ value, tone = 'ink', label = 'Progress', style }: ProgressBarProps) {
  const clamped = Math.min(Math.max(value, 0), 1);
  const w = useSharedValue(clamped);
  useEffect(() => {
    w.value = withTiming(clamped, { duration: duration.progress, easing: Easing.bezier(...ease.out) });
  }, [clamped, w]);
  const fill = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View
      style={[styles.bar, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <Animated.View
        style={[
          styles.barFill,
          { backgroundColor: tone === 'accent' ? colors.accent : colors.ink },
          tone === 'accent' ? styles.curOutline : null,
          fill,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, height: 4, alignItems: 'stretch' },
  seg: { flex: 1, borderRadius: 2 },
  // The accent is pale on light backgrounds: give it the mock's hairline of ink so it stays visible.
  curOutline: { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(12,10,8,0.35)' },
  bar: { height: 6, borderRadius: radius.pill, backgroundColor: colors.bg2, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.pill },
});
