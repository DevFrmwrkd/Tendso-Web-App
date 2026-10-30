import React, { useState } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import { getCoverImageLayout, type ImageCropPosition } from '../lib/imageCrop';
import { colors, radius } from '../theme/v2';

interface TrainingPhotoProps {
  source: ImageSourcePropType;
  label: string;
  description?: string;
  height?: number;
  cropPosition?: ImageCropPosition;
  style?: StyleProp<ViewStyle>;
}

/** A compact filled banner, framed for the subject rather than a generic center crop. */
export function TrainingPhoto({ source, label, description, height = 190, cropPosition, style }: TrainingPhotoProps) {
  const [frame, setFrame] = useState({ width: 0, height });
  const asset = Image.resolveAssetSource(source);
  const imageLayout = asset ? getCoverImageLayout(asset, frame, cropPosition) : null;

  return (
    <View
      style={[styles.frame, { height }, style]}
      onLayout={({ nativeEvent: { layout } }) => {
        if (layout.width === frame.width && layout.height === frame.height) return;
        setFrame({ width: layout.width, height: layout.height });
      }}
    >
      <Image
        source={source}
        style={[styles.image, imageLayout ?? StyleSheet.absoluteFillObject]}
        resizeMode="cover"
        accessible
        accessibilityRole="image"
        accessibilityLabel={description ?? label}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', borderRadius: radius.cardLg, backgroundColor: colors.bg2, overflow: 'hidden' },
  image: { position: 'absolute' },
});
