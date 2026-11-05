import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent,
  type NativeSyntheticEvent, type StyleProp, type ViewStyle } from 'react-native';

export type CapturePhotoPagerProps = {
  photoIds: readonly string[];
  selectedPhotoId: string;
  disabled?: boolean;
  onSelectPhoto: (id: string) => void;
  onInteractionChange?: (busy: boolean) => void;
  renderPhoto: (id: string) => React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

type Drag = { idsKey: string; selectedId: string; width: number; released: boolean };
const QUIET_SCROLL_MS = 160;

/** Native image-area paging. Header and photo actions stay outside this view. */
export function CapturePhotoPager(props: CapturePhotoPagerProps) {
  const ids = [...new Set(props.photoIds.filter(Boolean))];
  const idsKey = JSON.stringify(ids);
  const live = useRef({ ...props, ids, idsKey });
  live.current = { ...props, ids, idsKey };
  const [size, setSize] = useState({ width: 0, height: 0 });
  const dimensions = useRef(size);
  const scroll = useRef<ScrollView>(null);
  const mounted = useRef(true);
  const drag = useRef<Drag | null>(null);
  const interacting = useRef(false);
  const offset = useRef(0);
  const quietTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconcileFrame = useRef<number | null>(null);
  const clearTimer = () => { if (quietTimer.current !== null) clearTimeout(quietTimer.current); quietTimer.current = null; };
  const clearFrame = () => { if (reconcileFrame.current !== null) cancelAnimationFrame(reconcileFrame.current); reconcileFrame.current = null; };
  const interaction = (busy: boolean) => {
    if (interacting.current === busy) return;
    interacting.current = busy; live.current.onInteractionChange?.(busy);
  };
  const alignSelected = () => {
    const index = Math.max(0, live.current.ids.indexOf(live.current.selectedPhotoId));
    const x = index * dimensions.current.width;
    offset.current = x;
    if (dimensions.current.width > 0) scroll.current?.scrollTo({ x, y: 0, animated: false });
  };
  const cancel = (align = true) => { clearTimer(); clearFrame(); drag.current = null; interaction(false); if (align) alignSelected(); };
  const currentDrag = () => mounted.current && !live.current.disabled && !!drag.current
    && drag.current.idsKey === live.current.idsKey && drag.current.selectedId === live.current.selectedPhotoId
    && drag.current.width === dimensions.current.width;
  const settle = (x: number) => {
    if (!currentDrag() || !Number.isFinite(x)) { cancel(); return; }
    const index = Math.max(0, Math.min(live.current.ids.length - 1, Math.round(x / dimensions.current.width)));
    const id = live.current.ids[index];
    clearTimer(); drag.current = null;
    offset.current = index * dimensions.current.width;
    scroll.current?.scrollTo({ x: offset.current, y: 0, animated: false });
    try { if (id && id !== live.current.selectedPhotoId) live.current.onSelectPhoto(id); }
    finally { interaction(false); }
    // A controlled parent may decline a stale selection. Restore its latest ID
    // after React commits; never leave the image and destructive actions apart.
    clearFrame();
    reconcileFrame.current = requestAnimationFrame(() => { reconcileFrame.current = null; if (mounted.current) alignSelected(); });
  };
  const scheduleSettlement = () => {
    clearTimer();
    quietTimer.current = setTimeout(() => { quietTimer.current = null; settle(offset.current); }, QUIET_SCROLL_MS);
  };
  const scrollOffset = (event: NativeSyntheticEvent<NativeScrollEvent>) => event.nativeEvent.contentOffset?.x;
  const begin = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!mounted.current || live.current.disabled || live.current.ids.length < 2 || dimensions.current.width <= 0) return;
    clearTimer(); clearFrame();
    drag.current = { idsKey: live.current.idsKey, selectedId: live.current.selectedPhotoId, width: dimensions.current.width, released: false };
    const x = scrollOffset(event); if (Number.isFinite(x)) offset.current = x;
    interaction(true);
  };
  const moved = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!currentDrag()) return;
    const x = scrollOffset(event); if (Number.isFinite(x)) offset.current = x;
    if (drag.current?.released) scheduleSettlement();
  };
  const ended = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!currentDrag()) { if (mounted.current) cancel(); return; }
    const x = scrollOffset(event); if (Number.isFinite(x)) offset.current = x;
    drag.current!.released = true;
    // iOS can finish a tiny/canceled drag without momentum callbacks. Scroll
    // events postpone this fallback while real native deceleration continues.
    scheduleSettlement();
  };
  const momentumEnded = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!drag.current) { if (mounted.current) alignSelected(); return; }
    if (!drag.current.released) return; // A previous fling can finish as the next drag starts.
    const x = scrollOffset(event); settle(Number.isFinite(x) ? x : offset.current);
  };
  const layout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
    if (width === dimensions.current.width && height === dimensions.current.height) return;
    cancel(false); dimensions.current = { width, height }; setSize({ width, height });
  };

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; cancel(false); }; }, []);
  useEffect(() => { cancel(); }, [idsKey, props.selectedPhotoId, props.disabled, size.width, size.height]);
  const selectedIndex = Math.max(0, ids.indexOf(props.selectedPhotoId));
  return <View testID="capture-photo-pager" style={[styles.surface, props.style]} onLayout={layout}>
    <ScrollView ref={scroll} testID="capture-photo-pager-scroll" style={styles.surface} horizontal pagingEnabled
      directionalLockEnabled bounces={false} alwaysBounceHorizontal={false} scrollsToTop={false}
      showsHorizontalScrollIndicator={false} scrollEnabled={!props.disabled && ids.length > 1}
      pinchGestureEnabled={false} minimumZoomScale={1} maximumZoomScale={1}
      contentInsetAdjustmentBehavior="never" scrollEventThrottle={16}
      contentOffset={{ x: selectedIndex * size.width, y: 0 }}
      onScrollBeginDrag={begin} onScroll={moved} onScrollEndDrag={ended}
      onMomentumScrollBegin={ended} onMomentumScrollEnd={momentumEnded}
      onContentSizeChange={() => { if (!interacting.current) alignSelected(); }}>
      {size.width > 0 && size.height > 0 ? ids.map(id => <View key={id} testID={`capture-photo-page-${id}`}
        style={{ width: size.width, height: size.height }} collapsable={false}
        accessibilityElementsHidden={id !== props.selectedPhotoId}
        importantForAccessibility={id === props.selectedPhotoId ? 'auto' : 'no-hide-descendants'}>
        {props.renderPhoto(id)}
      </View>) : null}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({ surface: { flex: 1, minHeight: 0 } });
