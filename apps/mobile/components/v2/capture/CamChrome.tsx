/**
 * The glass pieces both camera screens share (mock css/screens.css "CAMERA SCREENS v4"):
 * no outlines anywhere, no white panels, text low like subtitles with a shadow only.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors, fonts, hit } from '../../../theme/v2';
import { levelLineDegrees } from './level';

const GLASS = 'rgba(0,0,0,0.28)';

export function TopShade({ height = 170 }: { height?: number }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { height, bottom: undefined }]}>
      <Svg width="100%" height={height}>
        <Defs>
          <LinearGradient id="camTopShade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000" stopOpacity={0.42} />
            <Stop offset="1" stopColor="#000" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height={height} fill="url(#camTopShade)" />
      </Svg>
    </View>
  );
}

export function BottomShade({ height = 320 }: { height?: number }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { top: undefined, height }]}>
      <Svg width="100%" height={height}>
        <Defs>
          <LinearGradient id="camBottomShade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000" stopOpacity={0} />
            <Stop offset="1" stopColor="#000" stopOpacity={0.38} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height={height} fill="url(#camBottomShade)" />
      </Svg>
    </View>
  );
}

export function GlassButton({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      cssInterop={false}
      style={({ pressed }) => [styles.glassBtn, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={icon} size={22} color="#fff" />
    </Pressable>
  );
}

export function GlassPill({ children, onPress, label, style }: { children: React.ReactNode; onPress?: () => void; label?: string; style?: StyleProp<ViewStyle> }) {
  const body = <View style={[styles.glassPill, style]}>{children}</View>;
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8}>
      {body}
    </Pressable>
  );
}

export function PillText({ children }: { children: React.ReactNode }) {
  return <Text style={styles.pillText}>{children}</Text>;
}

/** The only framing help: a short line that turns straight (and accent) when level. */
export function LevelLine({ roll, good, strong }: { roll: number; good: boolean; strong: boolean }) {
  const deg = good ? 0 : levelLineDegrees(roll);
  return (
    <View pointerEvents="none" style={[styles.level, { opacity: strong ? 0.9 : 0.4 }]} accessibilityElementsHidden>
      <View style={styles.levelSide} />
      <View style={[styles.levelMid, { backgroundColor: good ? colors.accent : '#fff', transform: [{ rotate: `${deg}deg` }] }]} />
      <View style={styles.levelSide} />
    </View>
  );
}

/** The hint chip under the level. Accent fill + check when good. */
export function HintChip({ text, good, icon = 'phone-portrait-outline', visible = true }: {
  text: string;
  good: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  visible?: boolean;
}) {
  const fade = useRef(new Animated.Value(visible ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: visible ? 1 : 0, duration: 400, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true }).start();
  }, [visible, fade]);
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.hint, { opacity: fade, backgroundColor: good ? colors.accent : 'rgba(0,0,0,0.34)' }]}
    >
      <Ionicons name={good ? 'checkmark' : icon} size={18} color={good ? colors.onAccent : '#fff'} />
      <Text style={[styles.hintText, { color: good ? colors.onAccent : '#fff' }]} numberOfLines={1}>
        {text}
      </Text>
    </Animated.View>
  );
}

/** Subtitle text: white, shadow only, no box. */
export const subtitle = StyleSheet.create({
  big: {
    fontFamily: fonts.extrabold,
    fontSize: 30,
    lineHeight: 35,
    letterSpacing: -0.6,
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  small: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  count: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
});

/** A white "flash" when a photo is taken (80 ms). */
export function useFlash() {
  const v = useRef(new Animated.Value(0)).current;
  const fire = () => {
    v.setValue(0.85);
    Animated.timing(v, { toValue: 0, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  };
  const node = <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#fff', opacity: v }]} />;
  return { fire, node };
}

const styles = StyleSheet.create({
  glassBtn: {
    width: hit.icon,
    height: hit.icon,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GLASS,
  },
  glassPill: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: GLASS,
  },
  pillText: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20, color: '#fff', fontVariant: ['tabular-nums'] },
  level: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    marginTop: -1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  levelSide: { width: 22, height: 1.5, borderRadius: 1, backgroundColor: '#fff' },
  levelMid: { width: 60, height: 2, borderRadius: 1 },
  hint: {
    position: 'absolute',
    top: '50%',
    marginTop: 26,
    alignSelf: 'center',
    height: 40,
    paddingLeft: 12,
    paddingRight: 16,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  hintText: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20 },
});
