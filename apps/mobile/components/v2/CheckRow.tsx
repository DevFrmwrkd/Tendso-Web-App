import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, space } from '../../theme/v2';
import { Text } from './Text';

export type CheckState = 'todo' | 'done' | 'now' | 'ok' | 'bad';

export interface CheckRowProps {
  title: string;
  subtitle?: string;
  /** todo = empty ring, done / ok = accent tick, now = the current step (ink outline), bad = red cross. */
  state?: CheckState;
  /** Short trailing word ("Now", "Fix") or node (chevron). */
  right?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Checklist row (mock `.a-check`): steps, lessons, status timelines. Done rows are muted with the
 * title struck through only when `state="done"`; `ok` keeps the title normal (a checked field).
 */
export function CheckRow({ title, subtitle, state = 'todo', right, onPress, style }: CheckRowProps) {
  const done = state === 'done' || state === 'ok';
  const body = (
    <>
      <View style={[styles.circle, done ? styles.circleDone : null, state === 'ok' ? styles.circleOk : null, state === 'now' ? styles.circleNow : null, state === 'bad' ? styles.circleBad : null]}>
        {done ? <Ionicons name="checkmark" size={14} color={colors.onAccent} /> : null}
        {state === 'bad' ? <Ionicons name="close" size={14} color="#FFFFFF" /> : null}
        {state === 'now' ? <View style={styles.dot} /> : null}
      </View>
      <View style={styles.text}>
        <Text
          variant="body"
          weight="semibold"
          tone={state === 'done' ? 'muted' : 'ink'}
          style={state === 'done' ? { textDecorationLine: 'line-through' } : null}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text variant="label" weight="medium" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {typeof right === 'string' ? (
        <Text variant="label" weight="bold" tone="muted">
          {right}
        </Text>
      ) : (
        right
      )}
    </>
  );
  const rowStyle: StyleProp<ViewStyle> = [styles.row, shadow.soft, state === 'now' ? styles.rowNow : null, style];
  if (!onPress) {
    return (
      <View style={rowStyle} accessible accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}>
        {body}
      </View>
    );
  }
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title} style={rowStyle}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 64,
    paddingVertical: space.md,
    paddingHorizontal: space.lg - 2,
    borderRadius: radius.card - 2,
    backgroundColor: colors.card,
  },
  rowNow: { borderWidth: 2, borderColor: colors.ink },
  circle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.ruleStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleDone: { backgroundColor: colors.accent, borderColor: colors.ink },
  circleOk: { borderColor: colors.accent },
  circleNow: { borderColor: colors.ink },
  circleBad: { backgroundColor: colors.danger, borderColor: colors.danger },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ink },
  text: { flex: 1, gap: 2 },
});
