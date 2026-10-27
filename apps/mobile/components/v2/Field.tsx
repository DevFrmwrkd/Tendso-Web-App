import React, { forwardRef, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, shadow, space } from '../../theme/v2';
import { Text } from './Text';

export interface FieldProps extends Omit<TextInputProps, 'style'> {
  /** The accessible label; inside the default card or above an outlined field. */
  label: string;
  /** Outlined sign-in fields put the label above a compact, shadow-free input. */
  variant?: 'card' | 'outlined';
  /** Optional action beside an outlined field's label. */
  labelRight?: React.ReactNode;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  /** Shown under the card in danger colour; also turns the border red. */
  error?: string | null;
  /** One quiet line under the card. */
  helper?: string;
  /** Trailing node inside the card (eye toggle, check, unit). */
  right?: React.ReactNode;
  /** A leading fixed prefix such as "+63". */
  prefix?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Labelled text field. Default white card or compact, shadow-free outline.
 * Label 16, value 18 (Rule #1: nothing under 16). Forwards the ref to the TextInput.
 */
export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { label, variant = 'card', labelRight, icon, error, helper, right, prefix, containerStyle, onFocus, onBlur, onSelectionChange, editable = true, accessibilityLabel, ...input },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput | null>(null);
  const selectionRef = useRef<TextInputProps['selection']>(undefined);
  // UIKit can clear a live field when secureTextEntry changes. A fresh iOS
  // input starts in the desired mode with the controlled password intact.
  const secureMode = Platform.OS === 'ios' && typeof input.value === 'string' && input.secureTextEntry !== undefined
    ? input.secureTextEntry ? 'secure' : 'visible'
    : 'default';
  const previousMode = useRef(secureMode);
  const attachInput = useCallback((node: TextInput | null) => {
    inputRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  }, [ref]);

  useLayoutEffect(() => {
    const changed = previousMode.current !== secureMode;
    previousMode.current = secureMode;
    if (!changed || secureMode === 'default' || !focused || !editable) return;
    const node = inputRef.current;
    if (!node) return;
    node.focus();
    const length = input.value?.length ?? 0;
    const selection = input.selection ?? selectionRef.current;
    const start = Math.min(selection?.start ?? length, length);
    const end = Math.min(selection?.end ?? start, length);
    // Restore once; a persistent selection prop would interfere with typing.
    node.setSelection(start, end);
  }, [secureMode, focused, editable, input.value, input.selection]);
  const outlined = variant === 'outlined';
  return (
    <View style={containerStyle}>
      {outlined ? (
        <View style={styles.labelRow}>
          <Text variant="label" weight="medium" tone="muted">{label}</Text>
          {labelRight}
        </View>
      ) : null}
      <View
        style={[
          styles.card,
          outlined ? styles.outlined : shadow.soft,
          focused ? styles.focus : null,
          error ? styles.error : null,
          !editable ? styles.locked : null,
        ]}
      >
        {icon ? <Ionicons name={icon} size={22} color={colors.ink3} /> : null}
        <View style={styles.body}>
          {!outlined ? (
            <Text variant="label" tone="muted">{label}</Text>
          ) : null}
          <View style={styles.inputRow}>
            {prefix ? (
              <Text variant="bodyLg" weight="semibold" style={styles.prefix}>
                {prefix}
              </Text>
            ) : null}
            <TextInput
              key={secureMode}
              ref={attachInput}
              {...input}
              editable={editable}
              accessibilityLabel={accessibilityLabel ?? label}
              placeholderTextColor={colors.ink3}
              selectionColor={colors.ink}
              onFocus={(e) => {
                if (previousMode.current !== secureMode) return;
                setFocused(true);
                onFocus?.(e);
              }}
              onBlur={(e) => {
                if (previousMode.current !== secureMode) return;
                setFocused(false);
                onBlur?.(e);
              }}
              onSelectionChange={(e) => {
                if (previousMode.current !== secureMode) return;
                selectionRef.current = e.nativeEvent.selection;
                onSelectionChange?.(e);
              }}
              style={styles.input}
            />
          </View>
        </View>
        {right}
      </View>
      {error ? (
        <Text variant="label" tone="danger" style={styles.note} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : helper ? (
        <Text variant="label" tone="muted" weight="medium" style={styles.note}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, minHeight: 24, marginBottom: space.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 72,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm + 2,
    borderRadius: radius.field + 2,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  outlined: { minHeight: 64, paddingVertical: space.lg, borderRadius: radius.card, borderWidth: 1, borderColor: colors.rule },
  focus: { borderColor: colors.ink },
  error: { borderColor: colors.danger },
  locked: { backgroundColor: colors.bg2 },
  body: { flex: 1, minWidth: 0 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  prefix: { marginRight: space.sm },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 28,
    padding: 0,
    fontFamily: fonts.semibold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.ink,
  },
  note: { paddingHorizontal: space.xs, paddingTop: space.sm - 2 },
});
