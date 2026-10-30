import React from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../../theme/v2';
import { Text } from './Text';

export interface AvatarProps {
  uri?: string | null;
  /** Used for the initial when there is no photo. */
  name?: string;
  size?: number;
  /** White ring + soft shadow (profile header, map pins). */
  ring?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Round photo, or the first letter on a soft accent tint. */
export function Avatar({ uri, name, size = 44, ring, style }: AvatarProps) {
  const initial = (name ?? '').trim().charAt(0).toUpperCase() || '?';
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={name ? `${name}'s photo` : 'Photo'}
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2 },
        ring ? styles.ring : null,
        style,
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} />
      ) : (
        <Text variant="button" style={{ fontSize: Math.max(16, Math.round(size * 0.4)), lineHeight: Math.round(size * 0.5) }}>
          {initial}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  ring: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#0C0A08',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 3,
  },
});
