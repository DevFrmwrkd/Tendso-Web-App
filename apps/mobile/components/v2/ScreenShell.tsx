import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { backgroundGradient, colors, hit, shadow, space } from '../../theme/v2';
import { ProgressBar } from './ProgressSteps';
import { Text } from './Text';

export interface ScreenShellProps {
  /** The ONE title of the screen (Rule #1: one thing per screen). */
  title?: string;
  /** One quiet line under the title. Optional. */
  subtitle?: string;
  /** Shows the round back button when provided. */
  onBack?: () => void;
  /** Node at the right end of the top row (a round icon button, a text link). */
  headerRight?: React.ReactNode;
  /** Set false on tab screens: the tab bar already covers the home-indicator inset. */
  insetBottom?: boolean;
  /** 0..1 — draws the single thin progress bar at the top. */
  progress?: number;
  /** The one primary action, pinned above the home indicator. Usually a <Button/>. */
  footer?: React.ReactNode;
  /** Optional spacing for the primary-action slot. */
  footerStyle?: StyleProp<ViewStyle>;
  /** Overlay the action on the scrollable content, reserving its measured height. */
  floatingFooter?: boolean;
  /** Scroll the body (default true). Use false for fixed one-question screens. */
  scroll?: boolean;
  /** Optional body ref for bringing a specific form field into view. */
  scrollRef?: React.Ref<ScrollView>;
  /** `dark` = camera / welcome look: ink background, light text, no gradient. */
  tone?: 'tinted' | 'neutral' | 'dark';
  children?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Screen frame: safe area, tinted background (lime wash → warm off-white), one title,
 * body, and one primary-action slot at the bottom (mock `.a-footer`, 24pt gutters).
 */
export function ScreenShell({
  title,
  subtitle,
  onBack,
  headerRight,
  insetBottom = true,
  progress,
  footer,
  footerStyle,
  floatingFooter = false,
  scroll = true,
  scrollRef,
  tone = 'tinted',
  children,
  contentStyle,
  testID,
}: ScreenShellProps) {
  const insets = useSafeAreaInsets();
  const dark = tone === 'dark';
  const [footerHeight, setFooterHeight] = useState(0);
  const floatingBodyInset = floatingFooter && footer ? { paddingBottom: footerHeight + space.lg } : null;

  const header =
    onBack || progress !== undefined || headerRight ? (
      <View style={styles.topRow}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={4}
            style={[styles.back, dark ? styles.backDark : null, !dark ? shadow.soft : null]}
          >
            <Ionicons name="arrow-back" size={22} color={dark ? colors.onDark : colors.ink} />
          </Pressable>
        ) : null}
        {progress !== undefined ? <ProgressBar value={progress} tone="ink" style={styles.topProgress} /> : <View style={styles.flex} />}
        {headerRight}
      </View>
    ) : null;

  const heading =
    title || subtitle ? (
      <View style={styles.heading}>
        {title ? (
          <Text variant="display" tone={dark ? 'onDark' : 'ink'} accessibilityRole="header">
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text variant="bodyLg" tone={dark ? 'onDark' : 'ink2'}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    ) : null;

  const body = scroll ? (
    <ScrollView
      ref={scrollRef}
      style={styles.flex}
      contentContainerStyle={[styles.body, contentStyle, floatingBodyInset]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {heading}
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, styles.body, contentStyle, floatingBodyInset]}>
      {heading}
      {children}
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: dark ? colors.camera : colors.bg }]} testID={testID}>
      {dark || tone === 'neutral' ? null : <GradientBackground />}
      <View style={[styles.flex, { paddingTop: insets.top + space.sm }]}>
        {header}
        {body}
        {footer ? (
          <View pointerEvents={floatingFooter ? 'box-none' : 'auto'}
            onLayout={floatingFooter ? event => { const height = event.nativeEvent.layout.height; setFooterHeight(previous => previous === height ? previous : height); } : undefined}
            style={[styles.footer, { paddingBottom: (insetBottom ? Math.max(insets.bottom, space.lg) : space.lg) + space.sm }, floatingFooter && styles.floatingFooter, footerStyle]}>{footer}</View>
        ) : (
          <View style={{ height: insetBottom ? insets.bottom : 0 }} />
        )}
      </View>
    </View>
  );
}

function GradientBackground() {
  const { colors: stops, locations, start, end } = backgroundGradient;
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" pointerEvents="none">
      <Defs>
        <LinearGradient id="v2bg" x1={start.x} y1={start.y} x2={end.x} y2={end.y}>
          {stops.map((c, i) => (
            <Stop key={c} offset={locations[i]} stopColor={c} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#v2bg)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.gutter,
    minHeight: hit.icon,
  },
  back: {
    width: hit.icon,
    height: hit.icon,
    borderRadius: 999,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backDark: { backgroundColor: 'rgba(255,255,255,0.14)' },
  topProgress: { flex: 1 },
  heading: { gap: space.sm, marginBottom: space.xl },
  body: { paddingHorizontal: space.gutter, paddingTop: space.xl, paddingBottom: space.xl },
  footer: { paddingHorizontal: space.gutter, paddingTop: space.lg, gap: space.sm },
  floatingFooter: { position: 'absolute', bottom: 0, left: 0, right: 0 },
});
