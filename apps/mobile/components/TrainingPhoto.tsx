import React, { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './v2/Text';
import { colors, hit, radius, space } from '../theme/v2';

interface TrainingPhotoProps {
  source: ImageSourcePropType;
  label: string;
  description?: string;
}

/** Instructional photos retain their full frame, including faces and signage. */
export function TrainingPhoto({ source, label, description }: TrainingPhotoProps) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const asset = Image.resolveAssetSource(source);
  const aspectRatio = asset?.width > 0 && asset?.height > 0 ? asset.width / asset.height : 4 / 3;
  const close = () => setOpen(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`View full image: ${label}`}
        accessibilityHint="Opens the full photo."
        cssInterop={false}
        style={({ pressed }) => [styles.photoButton, { opacity: pressed ? 0.8 : 1 }]}
      >
        <Image
          source={source}
          style={[styles.photo, { aspectRatio }]}
          resizeMode="contain"
          accessibilityLabel={description ?? label}
          accessibilityIgnoresInvertColors
        />
        <View style={styles.expand} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name="expand-outline" size={18} color={colors.onDark} />
        </View>
      </Pressable>

      {open ? (
        <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={close}>
          <StatusBar style="light" />
          <View style={[styles.viewer, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.md }]} accessibilityViewIsModal>
            <View style={styles.viewerHeader}>
              <Text variant="heading" tone="onDark" style={styles.title}>{label}</Text>
              <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close full image" style={styles.close}>
                <Ionicons name="close" size={26} color={colors.onDark} />
              </Pressable>
            </View>
            <View style={styles.imageFrame}>
              <Image source={source} style={styles.fullPhoto} resizeMode="contain" accessibilityLabel={`Full image: ${label}`} accessibilityIgnoresInvertColors />
            </View>
            {description ? <Text variant="label" weight="medium" tone="onDark" style={styles.description}>{description}</Text> : null}
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  photoButton: { width: '100%', borderRadius: radius.cardLg, overflow: 'hidden', backgroundColor: colors.bg2 },
  photo: { width: '100%' },
  expand: { position: 'absolute', right: space.sm, bottom: space.sm, width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  viewer: { flex: 1, backgroundColor: colors.camera },
  viewerHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.gutter },
  title: { flex: 1 },
  close: { width: hit.icon, height: hit.icon, alignItems: 'center', justifyContent: 'center' },
  imageFrame: { flex: 1, minHeight: 0, marginVertical: space.md },
  fullPhoto: { width: '100%', height: '100%' },
  description: { paddingHorizontal: space.gutter, paddingTop: space.xs },
});
