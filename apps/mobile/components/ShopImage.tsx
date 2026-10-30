import React, { useState } from 'react';
import { Image, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../theme/v2';
import { getShopPlaceholder } from '../services/shopPlaceholder';

type Props = {
  uri?: string | null;
  name?: string;
  category?: string | null;
  kind?: string | null;
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  decorative?: boolean;
  onLoad?: () => void;
  onError?: () => void;
};

/** A local illustration keeps missing and broken shop photos useful offline. */
export function ShopImage(props: Props) {
  const uri = props.uri?.trim() || undefined;
  // A new URI gets a fresh error state; a late error from an old image cannot hide it.
  return <ShopImageContent key={uri ?? 'no-photo'} {...props} uri={uri} />;
}

function ShopImageContent({ uri, name = 'Shop', category, kind, width = '100%', height = '100%', borderRadius = 16, style, decorative = false, onLoad, onError }: Props) {
  const [failed, setFailed] = useState(false);
  const fallback = !uri || failed;
  return <View style={[styles.frame, { width, height, borderRadius }, style]}
    accessibilityElementsHidden={decorative} importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}>
    <Image source={fallback ? getShopPlaceholder(category, kind) : { uri }} style={StyleSheet.absoluteFill} resizeMode={fallback ? 'contain' : 'cover'}
      accessible={!decorative} accessibilityRole="image" accessibilityLabel={`${name} ${fallback ? 'photo unavailable' : 'photo'}`}
      onLoad={onLoad} onError={() => { if (!fallback) { setFailed(true); onError?.(); } }} />
  </View>;
}

const styles = StyleSheet.create({ frame: { overflow: 'hidden', flexShrink: 0, backgroundColor: colors.bg2 } });
