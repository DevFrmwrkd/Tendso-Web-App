import React, { createContext, useContext, useCallback, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

/**
 * App-level scrim for bottom sheets.
 *
 * Why this exists: a bottom sheet lives in a React Native <Modal>. We want the
 * sheet to SLIDE up (only the Modal's native animationType="slide" does that
 * reliably on device — reanimated entrance animations inside a Modal don't show)
 * while the dim behind it FADES in over the whole screen. A single Modal can't
 * do both — native "slide" drags the dim up with the sheet.
 *
 * So the dim is rendered HERE, at the app root, OUTSIDE the Modal, and fades with
 * plain reanimated (which works fine outside a Modal). The sheet's Modal is
 * transparent, so this dim shows through behind it. Ref-counted, so overlapping
 * sheets don't fight over it.
 */
const SheetDimContext = createContext<{ show: () => void; hide: () => void } | null>(null);

export function useSheetDim() {
  // No-op fallback when no host is mounted (e.g. under jest) so SwipeSheet still
  // renders without a provider.
  return useContext(SheetDimContext) ?? { show: () => {}, hide: () => {} };
}

export function SheetDimHost({ children }: { children: React.ReactNode }) {
  const opacity = useSharedValue(0);
  const count = useRef(0);

  const show = useCallback(() => {
    count.current += 1;
    opacity.value = withTiming(1, { duration: 200 });
  }, [opacity]);

  const hide = useCallback(() => {
    count.current = Math.max(0, count.current - 1);
    // Fade out a touch slower than the Modal's native slide-out (~300ms on iOS)
    // so the sheet never sits on an already-undimmed screen on the way down.
    if (count.current === 0) opacity.value = withTiming(0, { duration: 300 });
  }, [opacity]);

  const dimStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <SheetDimContext.Provider value={{ show, hide }}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.38)' }, dimStyle]}
      />
    </SheetDimContext.Provider>
  );
}
