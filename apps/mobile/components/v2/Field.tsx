import React, { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
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
  { label, variant = 'card', labelRight, icon, error, helper, right, prefix, containerStyle, onFocus, onBlur, editable = true, accessibilityLabel, ...input },
  ref,
) {
  const [focused, setFocused] = useState(false);
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
    minHeight: 28,
    padding: 0,
    fontFamily: fonts.semibold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.ink,
  },
  note: { paddingHorizontal: space.xs, paddingTop: space.sm - 2 },
});
