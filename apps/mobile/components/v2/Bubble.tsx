import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, shadow, space } from '../../theme/v2';
import { TendsoMark } from './TendsoMark';
import { Text } from './Text';

export interface BubbleProps {
  /** The ONE question (19–24pt bold). */
  question: string;
  /** One quiet line under it. */
  hint?: string;
  style?: StyleProp<ViewStyle>;
}

/** "Tendso asks one question" (mock `.a-bubble`): ink mark + a white speech card. */
export function Bubble({ question, hint, style }: BubbleProps) {
  return (
    <View style={[styles.row, style]}>
      <TendsoMark />
      <View style={[styles.card, shadow.soft]}>
        <Text variant="heading" accessibilityRole="header">
          {question}
        </Text>
        {hint ? (
          <Text variant="label" weight="medium" tone="muted">
            {hint}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md - 2 },
  card: {
    flex: 1,
    gap: space.xs,
    backgroundColor: colors.card,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 22,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    paddingHorizontal: space.lg,
    paddingVertical: space.md + 2,
  },
});
