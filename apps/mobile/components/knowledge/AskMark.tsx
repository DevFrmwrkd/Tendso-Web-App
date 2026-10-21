import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

/** The Tendso ring mark in ink on a white circle, for use on ink surfaces (mock `.cm-ask`). Decorative. */
export function AskMark({ size = 44 }: { size?: number }) {
  const inner = Math.round(size * 0.68);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Image source={require('../../assets/brand/mark-ink-256.png')} style={{ width: inner, height: inner }} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
});
