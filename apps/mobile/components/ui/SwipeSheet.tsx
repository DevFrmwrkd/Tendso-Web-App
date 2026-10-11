import React, { useEffect } from 'react';
import {
  Modal,
  View,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import {
  GestureHandlerRootView,
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../../theme/tokens';
import { useSheetDim } from './SheetDimHost';

/**
 * A bottom sheet that behaves like its design promises: swipe the sheet down or
 * tap the backdrop to dismiss.
 *
 * The sheet SLIDES up via the Modal's native animationType="slide" — the only
 * thing that reliably animates a sheet in on device (reanimated entrance
 * animations inside a Modal don't show). The dim behind it is NOT in this modal;
 * it's an app-level scrim (SheetDimHost) that fades independently, because a
 * native "slide" would otherwise drag the dim up with the sheet. This modal is
 * transparent, so that app-level dim shows through behind it.
 *
 *  - GestureHandlerRootView INSIDE the Modal: gesture-handler gestures don't fire
 *    in a Modal's separate native view tree without a root there too.
 *  - Backdrop tap always closes (the full-screen Pressable), so even if a gesture
 *    misbehaves on a device the user is never stuck.
 *
 * `dismissable={false}` (e.g. while a request is in flight) freezes both.
 */
export function SwipeSheet({
  visible,
  onClose,
  dismissable = true,
  testID,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  dismissable?: boolean;
  testID?: string;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(0);
  const { show, hide } = useSheetDim();

  // Fade the app-level dim in while open; hide it on close/unmount. Also clear
  // any leftover drag offset so the native slide brings the sheet up from rest.
  useEffect(() => {
    if (!visible) return;
    translateY.value = 0;
    show();
    return hide;
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => {
    if (dismissable) onClose();
  };

  const pan = Gesture.Pan()
    // Only take over on a deliberate downward drag, so taps and typing inside
    // the sheet aren't swallowed.
    .activeOffsetY(12)
    .enabled(dismissable)
    .onUpdate((e) => {
      'worklet';
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      'worklet';
      if (e.translationY > 120 || e.velocityY > 800) {
        // Hand off to onClose — the Modal's native slide-out plays the rest.
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 220 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
      testID={testID}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            {/* Tap-outside-to-dismiss. Transparent — the dim is the app-level
                scrim behind this modal. Sits behind the sheet (later sibling). */}
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={close}
              accessibilityLabel="Dismiss"
            />

            <GestureDetector gesture={pan}>
              <Animated.View
                style={[
                  {
                    backgroundColor: colors.paper,
                    borderTopLeftRadius: radius.xl,
                    borderTopRightRadius: radius.xl,
                    paddingHorizontal: 24,
                    paddingTop: 10,
                    paddingBottom: insets.bottom + 24,
                  },
                  sheetStyle,
                ]}
              >
                {/* Grabber — now functional */}
                <View
                  style={{
                    width: 40,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: colors.rule,
                    alignSelf: 'center',
                    marginBottom: 16,
                  }}
                />
                {children}
              </Animated.View>
            </GestureDetector>
          </View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}
