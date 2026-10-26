import React from 'react';
import { Image, StyleSheet, type ImageSourcePropType } from 'react-native';
import { colors, radius } from '../theme/v2';

interface TrainingPhotoProps {
  source: ImageSourcePropType;
  label: string;
  description?: string;
  height?: number;
}

/** A compact, centered photo that keeps faces and signage inside the frame. */
export function TrainingPhoto({ source, label, description, height = 190 }: TrainingPhotoProps) {
  return (
    <Image
      source={source}
      style={[styles.photo, { height }]}
      resizeMode="contain"
      accessible
      accessibilityRole="image"
      accessibilityLabel={description ?? label}
      accessibilityIgnoresInvertColors
    />
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', borderRadius: radius.cardLg, backgroundColor: colors.bg2 },
});
