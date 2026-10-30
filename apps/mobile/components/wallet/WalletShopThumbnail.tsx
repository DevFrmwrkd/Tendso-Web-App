import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/v2';

export function WalletShopThumbnail({ url, name, icon = 'storefront-outline' }: {
  url?: string | null; name: string; icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (url && url !== failedUrl) return <Image key={url} source={{ uri: url }} resizeMode="cover" style={styles.photo}
    accessible accessibilityRole="image" accessibilityLabel={`${name} photo`}
    onError={() => setFailedUrl(url)} />;
  return <View style={[styles.photo, styles.fallback]} accessible accessibilityRole="image" accessibilityLabel={`${name} photo unavailable`}>
    <Ionicons name={icon} size={22} color={colors.ink} />
  </View>;
}

const styles = StyleSheet.create({
  photo: { width: 44, height: 44, flexShrink: 0, borderRadius: 14, backgroundColor: colors.bg2 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
