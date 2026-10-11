/**
 * Editorial Paper — UI primitives.
 *
 * Composition over configuration. Each primitive is a thin wrapper around
 * RN core components with the design-system tokens applied. Screens import
 * what they need from this file rather than spelling out NativeWind classes
 * for type / color / radius every time.
 *
 * See theme/tokens.ts for the underlying palette and font tokens.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
  type StyleProp,
  type TextProps,
  type TextInputProps,
  type TouchableOpacityProps,
  type AccessibilityProps,
  type GestureResponderEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, fonts, radius } from '../../theme/tokens';

// ─────────────────────────────────────────────────────────────────────────────
// Display — italic-friendly serif headline (Instrument Serif)
// ─────────────────────────────────────────────────────────────────────────────

type DisplaySize = 'sm' | 'md' | 'lg' | 'xl';

const displaySizes: Record<DisplaySize, { fontSize: number; lineHeight: number; letterSpacing: number }> = {
  sm: { fontSize: 28, lineHeight: 30, letterSpacing: -0.4 },
  md: { fontSize: 40, lineHeight: 42, letterSpacing: -0.6 },
  lg: { fontSize: 56, lineHeight: 56, letterSpacing: -0.8 },
  xl: { fontSize: 72, lineHeight: 70, letterSpacing: -1.0 },
};

type DisplayProps = {
  children: React.ReactNode;
  size?: DisplaySize;
  italic?: boolean;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
};

export function Display({ children, size = 'md', italic = false, color = colors.ink, style, numberOfLines }: DisplayProps) {
  const sz = displaySizes[size];
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          fontFamily: italic ? fonts.serifIt : fonts.serif,
          fontSize: sz.fontSize,
          lineHeight: sz.lineHeight,
          letterSpacing: sz.letterSpacing,
          color,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Body — Onest sans body text
// ─────────────────────────────────────────────────────────────────────────────

type BodySize = 'xs' | 'sm' | 'md' | 'lg';
type BodyWeight = 'regular' | 'medium' | 'bold';

const bodySizes: Record<BodySize, { fontSize: number; lineHeight: number }> = {
  xs: { fontSize: 11, lineHeight: 16 },
  sm: { fontSize: 13, lineHeight: 19 },
  md: { fontSize: 15, lineHeight: 22 },
  lg: { fontSize: 17, lineHeight: 25 },
};

const weightToFamily: Record<BodyWeight, string> = {
  regular: fonts.sans,
  medium: fonts.sansMed,
  bold: fonts.sansBold,
};

type BodyProps = {
  children: React.ReactNode;
  size?: BodySize;
  weight?: BodyWeight;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  /**
   * Makes this run of text tappable. Required for inline links inside a
   * paragraph (terms/privacy, "Learn more"), where a Pressable can't be used
   * because it would break the text flow.
   *
   * Must be forwarded explicitly: this component destructures a fixed prop
   * list rather than spreading rest, so anything not named here is silently
   * dropped — an onPress that simply never fires, with no error to reveal it.
   */
  onPress?: () => void;
  accessibilityRole?: TextProps['accessibilityRole'];
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
};

export function Body({
  children,
  size = 'md',
  weight = 'regular',
  color = colors.ink2,
  style,
  numberOfLines,
  onPress,
  accessibilityRole,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: BodyProps) {
  const sz = bodySizes[size];
  return (
    <Text
      numberOfLines={numberOfLines}
      onPress={onPress}
      // Without this, tapping an inline link flashes the whole enclosing
      // paragraph, not just the link.
      suppressHighlighting={onPress ? true : undefined}
      accessibilityRole={accessibilityRole ?? (onPress ? 'link' : undefined)}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={[
        {
          fontFamily: weightToFamily[weight],
          fontSize: sz.fontSize,
          lineHeight: sz.lineHeight,
          color,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Label — Mono uppercase eyebrow (JetBrains Mono)
// ─────────────────────────────────────────────────────────────────────────────

type LabelProps = {
  children: React.ReactNode;
  size?: 'xs' | 'sm';
  color?: string;
  tracking?: number;
  style?: StyleProp<TextStyle>;
};

export function Label({ children, size = 'xs', color = colors.ink3, tracking = 1.4, style }: LabelProps) {
  const fontSize = size === 'xs' ? 11 : 13;
  return (
    <Text
      style={[
        {
          fontFamily: fonts.monoMed,
          fontSize,
          lineHeight: fontSize + 4,
          color,
          letterSpacing: tracking,
          textTransform: 'uppercase',
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Door — the big primary "door" button (NEO LAB pattern)
//
// Three variants:
//   - solid: ink-filled (default primary action)
//   - accent: emerald-filled (earning / personal moment)
//   - ghost:  bordered, transparent (secondary)
// ─────────────────────────────────────────────────────────────────────────────

type DoorVariant = 'solid' | 'accent' | 'ghost';

type DoorProps = TouchableOpacityProps & {
  label: string;
  caption?: string;             // mono eyebrow above the label
  variant?: DoorVariant;
  loading?: boolean;
  rightIcon?: React.ReactNode;  // defaults to an arrow
  containerStyle?: StyleProp<ViewStyle>;
};

const doorPalettes: Record<DoorVariant, { bg: string; border: string; fg: string; captionFg: string }> = {
  solid:  { bg: colors.ink,         border: colors.ink,         fg: colors.paper3, captionFg: 'rgba(255,255,255,0.6)' },
  accent: { bg: colors.accentSolid, border: colors.accentSolid, fg: '#fff',        captionFg: 'rgba(255,255,255,0.7)' },
  ghost:  { bg: 'transparent',      border: colors.ink,         fg: colors.ink,    captionFg: colors.ink3 },
};

export function Door({
  label,
  caption,
  variant = 'solid',
  loading,
  rightIcon,
  containerStyle,
  disabled,
  onPress,
  ...rest
}: DoorProps) {
  const pal = doorPalettes[variant];
  const lockRef = useRef(false);
  const mountedRef = useRef(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const unlock = useCallback(() => {
    if (!mountedRef.current) return;
    lockRef.current = false;
    setBusy(false);
  }, []);

  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      if (lockRef.current || disabled || loading) return;
      lockRef.current = true;
      setBusy(true);
      try {
        const result = onPress?.(e) as unknown;
        if (result && typeof (result as { then?: unknown }).then === 'function') {
          Promise.resolve(result).finally(() => setTimeout(unlock, 400));
        } else {
          setTimeout(unlock, 700);
        }
      } catch (err) {
        // Synchronous failure: fully reset (lock + busy visual) and rethrow.
        unlock();
        throw err;
      }
    },
    [disabled, loading, onPress, unlock],
  );

  const isDisabled = disabled || loading || busy;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={isDisabled}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 16,
          paddingHorizontal: 22,
          backgroundColor: pal.bg,
          borderColor: pal.border,
          borderWidth: 1,
          borderRadius: radius.md,
          opacity: isDisabled ? 0.55 : 1,
        },
        containerStyle,
      ]}
      {...rest}
      onPress={handlePress}
    >
      <View style={{ flex: 1 }}>
        {caption && (
          <Text
            style={{
              fontFamily: fonts.monoMed,
              fontSize: 10,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              color: pal.captionFg,
              marginBottom: 2,
            }}
          >
            {caption}
          </Text>
        )}
        <Text
          style={{
            fontFamily: fonts.sansMed,
            fontSize: 16,
            color: pal.fg,
            letterSpacing: -0.2,
          }}
        >
          {loading ? 'Loading…' : label}
        </Text>
      </View>
      {busy || loading ? (
        <ActivityIndicator color={pal.fg} style={{ marginLeft: 12 }} />
      ) : (
        rightIcon ?? (
          <Ionicons name="arrow-forward" size={18} color={pal.fg} style={{ marginLeft: 12 }} />
        )
      )}
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card — paper3 surface with rule border, default r-md radius
// ─────────────────────────────────────────────────────────────────────────────

type CardProps = {
  children: React.ReactNode;
  padded?: boolean;
  large?: boolean;            // bumps radius to lg
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, padded = true, large = false, style }: CardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.paper3,
          borderColor: colors.rule,
          borderWidth: 1,
          borderRadius: large ? radius.lg : radius.md,
          padding: padded ? 16 : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pill — pressable mono-labeled chip (replaces filter chips)
// ─────────────────────────────────────────────────────────────────────────────

type PillProps = {
  label: string;
  active?: boolean;
  onPress?: () => void;
  leftIcon?: React.ReactNode;
} & AccessibilityProps;

export function Pill({ label, active = false, onPress, leftIcon, ...a11y }: PillProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      {...a11y}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 14,
        backgroundColor: active ? colors.ink : colors.paper3,
        borderColor: active ? colors.ink : colors.ruleStrong,
        borderWidth: 1,
        borderRadius: radius.pill,
      }}
    >
      {leftIcon}
      <Text
        style={{
          fontFamily: fonts.monoMed,
          fontSize: 11,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          color: active ? colors.paper3 : colors.ink2,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LiveDot — pulsing live-green indicator (real-time / live data marker)
// ─────────────────────────────────────────────────────────────────────────────

export function LiveDot({ size = 7, color = colors.live }: { size?: number; color?: string }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(2.4, { duration: 1400, easing: Easing.out(Easing.cubic) }),
        withTiming(2.4, { duration: 0 }),
      ),
      -1,
      false,
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 1400, easing: Easing.out(Easing.cubic) }),
        withTiming(0.55, { duration: 0 }),
      ),
      -1,
      false,
    );
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
          ringStyle,
        ]}
      />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Avatar — round avatar with serif initial fallback
// ─────────────────────────────────────────────────────────────────────────────

type AvatarProps = {
  name?: string | null;
  size?: number;
  bg?: string;
  fg?: string;
};

export function Avatar({ name, size = 40, bg = colors.ink3, fg = colors.paper3 }: AvatarProps) {
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: fonts.serif,
          fontSize: size * 0.45,
          lineHeight: size * 0.55,
          color: fg,
        }}
      >
        {initial}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule — horizontal divider line
// ─────────────────────────────────────────────────────────────────────────────

export function Rule({ strong = false, style }: { strong?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        {
          height: StyleSheet.hairlineWidth || 1,
          backgroundColor: strong ? colors.ruleStrong : colors.rule,
          width: '100%',
        },
        style,
      ]}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EditorialInput — paper-styled text input wrapper
// Used by auth + form screens. Accepts standard TextInput as a child so
// each screen can wire onChangeText / value / props.
// ─────────────────────────────────────────────────────────────────────────────

type EditorialInputFrameProps = {
  label?: string;
  rightAdornment?: React.ReactNode;
  children: React.ReactNode;
  focused?: boolean;
};

export function EditorialInputFrame({ label, rightAdornment, children, focused }: EditorialInputFrameProps) {
  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.paper3,
          borderColor: focused ? colors.ink : colors.rule,
          borderWidth: 1,
          borderRadius: radius.sm,
          paddingHorizontal: 14,
          height: 52,
        }}
      >
        <View style={{ flex: 1 }}>{children}</View>
        {rightAdornment}
      </View>
      {label && (
        <View style={{ marginTop: 6, paddingHorizontal: 4 }}>
          <Label>{label}</Label>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EditorialField — convenience wrapper combining icon + input + label + error
// for the editorial form pattern used in auth screens.
// ─────────────────────────────────────────────────────────────────────────────

type EditorialFieldProps = TextInputProps & {
  icon?: keyof typeof Ionicons.glyphMap;
  label?: string;
  error?: string;
  rightAdornment?: React.ReactNode;
};

export function EditorialField({ icon, label, error, rightAdornment, ...textInputProps }: EditorialFieldProps) {
  const hasError = !!error;
  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.paper3,
          borderColor: hasError ? colors.danger : colors.rule,
          borderWidth: 1,
          borderRadius: radius.sm,
          paddingHorizontal: 14,
          height: 54,
        }}
      >
        {icon && (
          <Ionicons name={icon} size={18} color={hasError ? colors.danger : colors.ink3} style={{ marginRight: 10 }} />
        )}
        <TextInput
          style={{ flex: 1, fontFamily: fonts.sans, fontSize: 15, color: colors.ink }}
          placeholderTextColor={colors.ink3}
          {...textInputProps}
        />
        {rightAdornment}
      </View>
      {(label || error) && (
        <View style={{ marginTop: 6, paddingHorizontal: 4 }}>
          <Label color={hasError ? colors.danger : colors.ink3}>
            {hasError ? error!.toUpperCase() : label ?? ''}
          </Label>
        </View>
      )}
    </View>
  );
}
