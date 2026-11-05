import React from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../../theme/v2';

export interface TendsoMarkProps {
  /** Circle diameter. The mark inside is 2/3 of it. */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** The Tendso ring mark, white on an ink circle (mock `.a-bubble-mark`). Decorative. */
export function TendsoMark({ size = 44, style }: TendsoMarkProps) {
  const inner = Math.round(size * 0.68);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }, style]}
    >
      <Image
        source={require('../../assets/brand/mark-ink-256.png')}
        style={{ width: inner, height: inner, tintColor: colors.onDark }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
});
