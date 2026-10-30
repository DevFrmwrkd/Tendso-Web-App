import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ScreenShell, Text } from '../v2';
import { SiteFrame } from '../v2/owner/OwnerUI';
import type { Design } from '../../lib/v2/ownerContent';
import { SITE_URL } from '../../services/links';
import { colors, radius, shadow, space } from '../../theme/v2';

const GAP = 12;
const PHONE_WIDTH = 390;
const WEB_ORIGIN = (process.env.EXPO_PUBLIC_WEB_ORIGIN || SITE_URL).replace(/\/$/, '');
const previewUri = (design: Design) => `${WEB_ORIGIN}${design.preview}`;

export type CaptureDesignGalleryProps = {
  designs: readonly Design[];
  selectedCode: string | null;
  onSelect: (code: string) => void;
  onUse: (code: string) => void | Promise<unknown>;
  onBack: () => void;
  busy?: boolean;
  disabled?: boolean;
  error?: string | null;
  isOffline?: boolean;
};

function SamplePreview({ design, offline, width, height, scale = 1, testID }: {
  design: Design; offline: boolean; width?: number; height?: number; scale?: number; testID?: string;
}) {
  const [attempt, setAttempt] = useState(0);
  const [failedRequest, setFailedRequest] = useState<string | null>(null);
  const uri = previewUri(design);
  const request = `${uri}:${attempt}`;
  const failed = failedRequest === request;
  if (offline || failed) return <View style={[styles.previewFallback, width ? { width } : styles.flex, height ? { height } : null]} testID={testID}>
    <Ionicons name={offline ? 'cloud-offline-outline' : 'image-outline'} size={32} color={colors.ink3Text} />
    <Text variant="label" align="center" tone="muted">{offline ? 'Reconnect to preview this sample.' : 'This sample could not load.'}</Text>
    {!offline && width === undefined ? <Pressable accessibilityRole="button" accessibilityLabel={`Retry ${design.name} sample`}
      onPress={() => setAttempt(value => value + 1)} style={styles.retry}>
      <Text variant="label" weight="bold">Try again</Text>
    </Pressable> : null}
  </View>;
  return <SiteFrame key={request} uri={uri} width={width} height={height}
    scale={scale} interactive={width === undefined} samplePreview onPreviewError={() => setFailedRequest(request)}
    style={width === undefined ? styles.flex : undefined} testID={testID} />;
}

/** Presentation only: a choice is saved and submitted exclusively by the capture route. */
export function CaptureDesignGallery({ designs, selectedCode, onSelect, onUse, onBack,
  busy = false, disabled = false, error, isOffline = false }: CaptureDesignGalleryProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cardWidth = Math.max(140, Math.min(300, width - 112));
  const cardHeight = Math.max(180, Math.min(cardWidth * 1.8, height - insets.top - insets.bottom - 350));
  const stride = cardWidth + GAP;
  const side = Math.max(0, (width - cardWidth) / 2);
  const catalogKey = designs.map(design => design.code).join('\n');
  const [currentCode, setCurrentCode] = useState<string | null>(() => designs.find(design => design.code === selectedCode)?.code ?? designs[0]?.code ?? null);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [using, setUsing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const list = useRef<FlatList<Design>>(null);
  const mounted = useRef(true);
  const useBusy = useRef(false);
  const reported = useRef<string | null>(null);
  const previousCatalog = useRef(catalogKey);
  const previousStride = useRef(stride);
  const latest = useRef({ designs, currentCode, busy, disabled, onUse });
  latest.current = { designs, currentCode, busy, disabled, onUse };
  const currentIndex = Math.max(0, designs.findIndex(design => design.code === currentCode));
  const current = designs[currentIndex];
  const open = designs.find(design => design.code === previewCode);
  const locked = busy || disabled || using;
  const notice = error || localError;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  // A saved choice can arrive after initial draft hydration. Internal swipes do
  // not programmatically stop their own native momentum when the parent echoes it.
  useEffect(() => {
    const catalog = latest.current.designs;
    const existing = catalog.find(design => design.code === latest.current.currentCode);
    const saved = catalog.find(design => design.code === selectedCode);
    const external = selectedCode !== reported.current;
    const target = (external ? saved ?? existing : existing ?? saved) ?? catalog[0];
    if (target) {
      setCurrentCode(target.code);
      if (external || previousCatalog.current !== catalogKey || previousStride.current !== stride) {
        list.current?.scrollToOffset({ offset: catalog.indexOf(target) * stride, animated: false });
      }
    } else { setCurrentCode(null); }
    previousCatalog.current = catalogKey;
    previousStride.current = stride;
    setPreviewCode(null);
  }, [selectedCode, catalogKey, stride]);

  const select = (index: number, animate = false) => {
    const design = designs[index];
    if (!design || locked || useBusy.current) return;
    setCurrentCode(design.code);
    setLocalError(null);
    if (reported.current !== design.code || selectedCode !== design.code) {
      reported.current = design.code;
      onSelect(design.code);
    }
    if (animate) list.current?.scrollToOffset({ offset: index * stride, animated: true });
  };
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / stride);
    if (designs[index]?.code !== currentCode) select(index);
  };
  const useDesign = async (code: string) => {
    if (useBusy.current || latest.current.busy || latest.current.disabled || !mounted.current
      || !latest.current.designs.some(design => design.code === code)) return;
    useBusy.current = true; setUsing(true); setLocalError(null);
    try { await latest.current.onUse(code); }
    catch (cause) { if (mounted.current) setLocalError(cause instanceof Error ? cause.message : 'Could not save this design. Please try again.'); }
    finally { useBusy.current = false; if (mounted.current) setUsing(false); }
  };
  const closePreview = () => setPreviewCode(null);
  const useButton = (code?: string) => <Button title="Use this design" onPress={() => { if (code) void useDesign(code); }}
    loading={busy || using} disabled={disabled || !code} />;

  return <ScreenShell title="Choose your design" progress={0.8} onBack={() => { if (!locked && !useBusy.current) onBack(); }}
    contentStyle={styles.body} testID="capture-design-gallery" footer={<>
      {notice ? <Text tone="danger" align="center" accessibilityRole="alert">{notice}</Text> : null}
      {useButton(current?.code)}
    </>}>
    <Text variant="label" tone="muted">Step 4 of 5</Text>
    <Text variant="body" tone="ink2">Example photos and text. This shop’s content is added after review.</Text>
    {designs.length ? <>
      <FlatList ref={list} horizontal data={designs as Design[]} keyExtractor={design => design.code}
        testID="capture-design-carousel" scrollEnabled={!locked} showsHorizontalScrollIndicator={false}
        style={styles.carousel} contentContainerStyle={{ paddingHorizontal: side, gap: GAP }}
        snapToInterval={stride} decelerationRate="fast" scrollEventThrottle={32} onScroll={onScroll}
        initialScrollIndex={currentIndex} initialNumToRender={3} windowSize={3}
        getItemLayout={(_, index) => ({ length: stride, offset: stride * index, index })}
        renderItem={({ item, index }) => <Pressable accessibilityRole="button"
          accessibilityLabel={`${item.name} design. Preview sample website.`} accessibilityState={{ selected: index === currentIndex, disabled: locked }}
          disabled={locked} onPress={() => { if (index === currentIndex) setPreviewCode(item.code); else select(index, true); }}
          cssInterop={false} style={({ pressed }) => [styles.card, shadow.object,
            { width: cardWidth, height: cardHeight, opacity: index === currentIndex ? 1 : 0.5 }, pressed && styles.pressed]}>
          {Math.abs(index - currentIndex) <= 1 ? <SamplePreview key={item.code} design={item} offline={isOffline}
            width={cardWidth} height={cardHeight} scale={cardWidth / PHONE_WIDTH} /> : null}
        </Pressable>} />
      <View style={styles.meta}><Text variant="heading" style={styles.flex}>{current?.name}</Text>
        <Text variant="label" tone="muted">{currentIndex + 1} of {designs.length}</Text></View>
      <View style={styles.controls}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous design" disabled={locked || currentIndex === 0}
          onPress={() => select(currentIndex - 1, true)} style={[styles.round, (locked || currentIndex === 0) && styles.disabled]}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} /></Pressable>
        <Text variant="label" tone="muted" style={styles.hint}>Swipe designs. Tap one to see the whole sample.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Next design" disabled={locked || currentIndex >= designs.length - 1}
          onPress={() => select(currentIndex + 1, true)} style={[styles.round, (locked || currentIndex >= designs.length - 1) && styles.disabled]}>
          <Ionicons name="chevron-forward" size={24} color={colors.ink} /></Pressable>
      </View>
    </> : <Text tone="muted">No designs are available for this capture. Go back and reopen the shop.</Text>}

    <Modal visible={!!open} animationType="slide" presentationStyle="fullScreen" onRequestClose={closePreview}>
      {open ? <View style={[styles.sheet, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.md }]}
        accessibilityViewIsModal onAccessibilityEscape={closePreview} testID="capture-design-full-preview">
        <View style={styles.sheetHeader}>
          <Pressable onPress={closePreview} accessibilityRole="button" accessibilityLabel="Close design preview" style={styles.round}>
            <Ionicons name="chevron-back" size={24} color={colors.ink} /></Pressable>
          <Text variant="heading" accessibilityRole="header" style={styles.flex}>{open.name}</Text>
        </View>
        <Text variant="label" tone="muted" style={styles.sampleLabel}>Sample website · Scroll to explore</Text>
        <View style={styles.fullFrame}><SamplePreview key={open.code} design={open} offline={isOffline} testID="capture-design-full-site" /></View>
        <View style={styles.sheetFooter}>
          {notice ? <Text tone="danger" align="center" accessibilityRole="alert">{notice}</Text> : null}
          {useButton(open.code)}
        </View>
      </View> : null}
    </Modal>
  </ScreenShell>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 }, body: { gap: space.md },
  carousel: { marginHorizontal: -space.gutter, flexGrow: 0 },
  card: { borderRadius: radius.cardLg, backgroundColor: colors.card, overflow: 'hidden' }, pressed: { opacity: 0.8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  controls: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  round: { width: 48, height: 48, flexShrink: 0, borderRadius: radius.pill, backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 }, hint: { flex: 1, minWidth: 0, textAlign: 'center' },
  previewFallback: { alignItems: 'center', justifyContent: 'center', padding: space.md, gap: space.sm, backgroundColor: colors.bg2 },
  retry: { minHeight: 48, paddingHorizontal: space.md, justifyContent: 'center' },
  sheet: { flex: 1, backgroundColor: colors.card, gap: space.sm },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.gutter },
  sampleLabel: { paddingHorizontal: space.gutter },
  fullFrame: { flex: 1, minHeight: 100, marginHorizontal: space.md, borderRadius: radius.field, overflow: 'hidden' },
  sheetFooter: { paddingHorizontal: space.gutter, gap: space.sm },
});
