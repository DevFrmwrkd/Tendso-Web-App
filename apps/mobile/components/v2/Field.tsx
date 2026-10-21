import React, { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, shadow, space } from '../../theme/v2';
import { Text } from './Text';

export interface FieldProps extends Omit<TextInputProps, 'style'> {
  /** The label sits inside the white card, above the value (mock `.cc-field`). */
  label: string;
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
 * Labelled text field. White card, soft shadow, 2pt ink border while focused.
 * Label 16, value 18 (Rule #1: nothing under 16). Forwards the ref to the TextInput.
 */
export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { label, icon, error, helper, right, prefix, containerStyle, onFocus, onBlur, editable = true, accessibilityLabel, ...input },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={containerStyle}>
      <View
        style={[
          styles.card,
          shadow.soft,
          focused ? styles.focus : null,
          error ? styles.error : null,
          !editable ? styles.locked : null,
        ]}
      >
        {icon ? <Ionicons name={icon} size={22} color={colors.ink3} /> : null}
        <View style={styles.body}>
          <Text variant="label" tone="muted">
            {label}
          </Text>
          <View style={styles.inputRow}>
            {prefix ? (
              <Text variant="bodyLg" weight="semibold" style={styles.prefix}>
                {prefix}
              </Text>
            ) : null}
            <TextInput
              ref={ref}
              {...input}
              editable={editable}
              accessibilityLabel={accessibilityLabel ?? label}
              placeholderTextColor={colors.ink3}
              selectionColor={colors.ink}
              onFocus={(e) => {
                setFocused(true);
                onFocus?.(e);
              }}
              onBlur={(e) => {
                setFocused(false);
                onBlur?.(e);
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
  focus: { borderColor: colors.ink },
  error: { borderColor: colors.danger },
  locked: { backgroundColor: colors.bg2 },
  body: { flex: 1, minWidth: 0 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  prefix: { marginRight: space.sm },
  input: {
    flex: 1,
    minHeight: 28,
    padding: 0,
    fontFamily: fonts.semibold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.ink,
  },
  note: { paddingHorizontal: space.xs, paddingTop: space.sm - 2 },
});
