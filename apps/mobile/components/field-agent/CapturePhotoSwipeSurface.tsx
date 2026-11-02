import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, PanResponder, StyleSheet, View,
  type GestureResponderEvent, type PanResponderGestureState, type StyleProp, type ViewStyle } from 'react-native';

export type CapturePhotoSwipeSurfaceProps = {
  photoId: string;
  canPrevious: boolean;
  canNext: boolean;
  disabled?: boolean;
  onPrevious: () => void;
  onNext: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

const CLAIM_DISTANCE = 10;
const SWIPE_DISTANCE = 48;
const HORIZONTAL_BIAS = 1.35;
const VERTICAL_CANCEL_DISTANCE = 16;

/** Place around the image only; the parent owns navigation and its controls. */
export function CapturePhotoSwipeSurface(props: CapturePhotoSwipeSurfaceProps) {
  const live = useRef(props);
  live.current = props;
  const mounted = useRef(true);
  const reducedMotion = useRef(true);
  const translateX = useRef(new Animated.Value(0)).current;
  const drag = useRef<{ photoId: string; stateID: number } | null>(null);

  const resetFeedback = (animate = false) => {
    translateX.stopAnimation();
    if (!animate || reducedMotion.current || !mounted.current) translateX.setValue(0);
    else Animated.timing(translateX, { toValue: 0, duration: 140,
      easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  };
  const cancel = () => { drag.current = null; resetFeedback(); };
  const enabled = () => mounted.current && !live.current.disabled && !!live.current.photoId;
  const onePointer = (event: GestureResponderEvent, gesture: PanResponderGestureState) =>
    gesture.numberActiveTouches === 1 && (event.nativeEvent?.touches == null || event.nativeEvent.touches.length === 1);
  const horizontal = (gesture: PanResponderGestureState, distance: number) =>
    Number.isFinite(gesture.dx) && Number.isFinite(gesture.dy)
    && Math.abs(gesture.dx) >= distance && Math.abs(gesture.dx) > Math.abs(gesture.dy) * HORIZONTAL_BIAS;
  const available = (dx: number) => dx < 0 ? live.current.canNext : dx > 0 && live.current.canPrevious;
  const sameDrag = (gesture: PanResponderGestureState) => !!drag.current
    && drag.current.photoId === live.current.photoId && drag.current.stateID === gesture.stateID;
  const responder = useRef<ReturnType<typeof PanResponder.create> | null>(null);
  if (!responder.current) {
    const wantsSwipe = (event: GestureResponderEvent, gesture: PanResponderGestureState) =>
      enabled() && onePointer(event, gesture) && horizontal(gesture, CLAIM_DISTANCE) && available(gesture.dx);
    responder.current = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: wantsSwipe,
      onMoveShouldSetPanResponderCapture: wantsSwipe,
      onPanResponderGrant: (event, gesture) => {
        cancel();
        if (enabled() && onePointer(event, gesture)) drag.current = { photoId: live.current.photoId, stateID: gesture.stateID };
      },
      onPanResponderStart: (event, gesture) => { if (!onePointer(event, gesture)) cancel(); },
      onPanResponderMove: (event, gesture) => {
        if (!sameDrag(gesture)) return;
        if (!enabled() || !onePointer(event, gesture) || !Number.isFinite(gesture.dx) || !Number.isFinite(gesture.dy)
          || (Math.abs(gesture.dy) >= VERTICAL_CANCEL_DISTANCE && Math.abs(gesture.dy) > Math.abs(gesture.dx) * HORIZONTAL_BIAS)) {
          cancel(); return;
        }
        // Native PanResponder resets dx/dy to zero on grant. Small subsequent
        // moves are normal: keep the acquired gesture until release/cancel.
        if (!horizontal(gesture, CLAIM_DISTANCE)) { resetFeedback(); return; }
        translateX.setValue(!reducedMotion.current && available(gesture.dx)
          ? Math.max(-32, Math.min(32, gesture.dx * 0.18)) : 0);
      },
      onPanResponderRelease: (event, gesture) => {
        if (!sameDrag(gesture)) return;
        // Consume first: repeated native releases or synchronous parent renders
        // must not invoke navigation twice for the same finger gesture.
        drag.current = null;
        const remainingTouches = event.nativeEvent?.touches?.length ?? gesture.numberActiveTouches;
        const navigate = enabled() && gesture.numberActiveTouches <= 1 && remainingTouches <= 1
          && horizontal(gesture, SWIPE_DISTANCE) && available(gesture.dx);
        resetFeedback(true);
        if (navigate) {
          if (gesture.dx < 0) live.current.onNext();
          else live.current.onPrevious();
        }
      },
      onPanResponderTerminate: cancel,
      onPanResponderReject: cancel,
      onPanResponderTerminationRequest: () => true,
    });
  }

  useEffect(() => {
    mounted.current = true;
    let active = true;
    let receivedEvent = false;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (active && !receivedEvent) { reducedMotion.current = value; if (value) resetFeedback(); }
    }).catch(() => {});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      if (!active) return;
      receivedEvent = true; reducedMotion.current = value;
      if (value) resetFeedback();
    });
    return () => { active = false; mounted.current = false; cancel(); listener.remove(); };
  }, []);
  useEffect(() => { cancel(); }, [props.photoId, props.disabled]);

  return <View testID="capture-photo-swipe-surface" {...responder.current.panHandlers} style={[styles.surface, props.style]}>
    <Animated.View style={[styles.content, { transform: [{ translateX }] }]}>{props.children}</Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  surface: { flex: 1, overflow: 'hidden' },
  content: { flex: 1 },
});
