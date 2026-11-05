import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Text } from '../v2';
import { colors, space } from '../../theme/v2';

export type CreatorCodeConfirmationProps = {
  visible: boolean;
  code: string;
  busy?: boolean;
  disabled?: boolean;
  error?: string;
  creatingAccount?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Only the affirmative action commits a code; dismissal always returns to the draft. */
export function CreatorCodeConfirmation(props: CreatorCodeConfirmationProps) {
  return props.visible ? <OpenConfirmation {...props} /> : null;
}

function OpenConfirmation({ code, busy = false, disabled = false, error, creatingAccount = false, onConfirm, onCancel }: CreatorCodeConfirmationProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const paddingTop = Math.max(insets.top, space.lg);
  const paddingBottom = Math.max(insets.bottom, space.lg);
  const cancel = () => { if (!busy) onCancel(); };
  return <Modal visible transparent animationType="fade" onRequestClose={cancel}>
    <View testID="creator-code-confirmation" accessibilityViewIsModal style={[styles.modal, { paddingTop, paddingBottom }]}>
      <Pressable accessible={false} importantForAccessibility="no-hide-descendants" style={styles.backdrop} disabled={busy} onPress={cancel} />
      <View style={[styles.dialog, { maxHeight: height - paddingTop - paddingBottom }]} onAccessibilityEscape={cancel}>
        <View style={styles.header}>
          <View style={styles.icon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Ionicons name="lock-closed-outline" size={23} color={colors.ink} /></View>
          <Text variant="heading" accessibilityRole="header" style={styles.title}>Set this code permanently?</Text>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.code}><Text variant="label" tone="muted" align="center">Your creator code</Text><Text variant="title" align="center" selectable>{code}</Text></View>
          <Text variant="body" weight="bold">You won’t be able to change this code afterward.</Text>
          <Text variant="body" tone="muted">Check the spelling before you confirm. Shop owners get 30% off with this code.</Text>
          {disabled && !error && !busy ? <Text variant="label" tone="muted" accessibilityLiveRegion="polite">Checking code availability…</Text> : null}
          {error ? <Text variant="label" tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text> : null}
          <View style={styles.actions}>
            <Button title={creatingAccount ? 'Confirm and create account' : 'Yes, set my code'} loading={busy} disabled={busy || disabled} onPress={() => { if (!busy && !disabled) onConfirm(); }} />
            <Button title="Keep editing" variant="ghost" disabled={busy} onPress={cancel} />
          </View>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  modal: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: space.lg },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(12,10,8,0.42)' },
  dialog: { width: '100%', maxWidth: 440, borderRadius: 28, backgroundColor: colors.card, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.xl, flexShrink: 0 },
  icon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, minWidth: 0 },
  scroll: { flexShrink: 1 },
  body: { paddingHorizontal: space.xl, paddingBottom: space.md, gap: space.md },
  code: { backgroundColor: colors.bg2, borderRadius: 18, padding: space.lg, gap: space.xs },
  actions: { paddingTop: space.sm, gap: space.sm },
});
