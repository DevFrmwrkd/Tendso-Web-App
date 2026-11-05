import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../../theme/v2';

// Stay still until the system preference is known. One subscription serves the screen.
const ReducePressMotion = createContext(true);

export function PressFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    let receivedEvent = false;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (active && !receivedEvent) setReduced(value);
    }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      receivedEvent = true;
      if (active) setReduced(value);
    });
    return () => { active = false; subscription.remove(); };
  }, []);
  return <ReducePressMotion.Provider value={reduced}>{children}</ReducePressMotion.Provider>;
}

type PressFeedbackProps = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  overlayTone?: 'dark' | 'light';
  strength?: number;
};

/** A soft fill over the existing surface; text, geometry and shadows stay still. */
export function PressFeedback({ children, style, disabled, onPressIn, onPressOut, accessibilityState, accessibilityRole = 'button', overlayTone = 'dark', strength = 0.06, ...props }: PressFeedbackProps) {
  const reduced = useContext(ReducePressMotion);
  const progress = useRef(new Animated.Value(0)).current;
  const target = useRef(0);
  const overlayOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(0, Math.min(1, strength))] });
  function highlight(value: number) {
    target.current = value;
    progress.stopAnimation();
    if (reduced) progress.setValue(value);
    else Animated.timing(progress, {
      toValue: value,
      duration: value ? 80 : 140,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }
  useEffect(() => {
    if (disabled) { target.current = 0; progress.stopAnimation(); progress.setValue(0); }
  }, [disabled, progress]);
  useEffect(() => {
    if (reduced) { progress.stopAnimation(); progress.setValue(target.current); }
  }, [reduced, progress]);
  useEffect(() => () => { progress.stopAnimation(); }, [progress]);

  return <Pressable {...props} cssInterop={false} disabled={disabled}
    accessibilityRole={accessibilityRole} accessibilityState={{ ...accessibilityState, disabled: !!disabled }} style={style}
    onPressIn={event => { if (!disabled) { highlight(1); onPressIn?.(event); } }}
    onPressOut={event => { highlight(0); onPressOut?.(event); }}>
    {children}
    <Animated.View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, {
        borderRadius: StyleSheet.flatten(style)?.borderRadius ?? 0,
        backgroundColor: overlayTone === 'light' ? colors.onDark : colors.ink,
        opacity: disabled ? 0 : overlayOpacity,
      }]} />
  </Pressable>;
}
