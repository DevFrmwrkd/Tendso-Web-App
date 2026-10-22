/**
 * Choose your design (mock `designPicker` v5): one big card at a time = a real template,
 * swipe, tap → the full real site scrolls, "Use this design". No colour or font knobs here.
 *
 * Cards are the live template previews on the web origin (public/template-previews/*.html).
 * INTEGRATE: when the backend can render a template with this shop's own words and photos
 * (e.g. ownerApp.designPreview), point `previewUri` at that instead.
 */
import React, { useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ScreenShell, Text } from '../../components/v2';
import { SiteFrame } from '../../components/v2/owner/OwnerUI';
import { designsFor, sellKind, sellKindFromServer, type Design } from '../../lib/v2/ownerContent';
import { useChooseDesign, useOwnerSubmission, useSubmitSite, WEB_ORIGIN } from '../../lib/v2/ownerData';
import { ownerIntake, useOwnerIntake } from '../../lib/v2/ownerIntake';
import { STEP_ROUTE } from '../../lib/v2/ownerFlow';
import { uploadQueue } from '../../lib/v2/uploadQueue';
import { useOwnerSite } from '../../lib/v2/useOwnerSite';
import { colors, radius, shadow, space } from '../../theme/v2';

const GAP = 12;
/** Cards render the page at phone width, shrunk. */
const PHONE_W = 390;

const previewUri = (d: Design) => `${WEB_ORIGIN}${d.preview}`;

export default function DesignPicker() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const intake = useOwnerIntake();
  const { id } = useOwnerSite();
  const sub = useOwnerSubmission(id);
  const choose = useChooseDesign();
  const submit = useSubmitSite();
  const kind = sellKind(intake.kind) ?? sellKindFromServer(sub?.businessType, sub?.shotListKey);
  const designs = designsFor(kind.id);

  const cardW = Math.min(300, width - 140);
  const cardH = Math.min(cardW * 2.16, height - insets.top - insets.bottom - 300);
  const side = (width - cardW) / 2;
  const [cur, setCur] = useState(() => Math.max(0, designs.findIndex((d) => d.code === (sub?.templateId ?? intake.design))));
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = useRef<FlatList<Design>>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const k = Math.round(e.nativeEvent.contentOffset.x / (cardW + GAP));
    if (k !== cur && k >= 0 && k < designs.length) setCur(k);
  };

  const use = async (k: number) => {
    if (!id) return;
    const d = designs[k];
    setBusy(true);
    setError(null);
    try {
      ownerIntake.set({ design: d.code });
      await choose({ submissionId: id, templateId: d.code });
      await uploadQueue.drain(); // every answer and photo is saved before we build
      if (uploadQueue.snapshot().failed > 0) {
        uploadQueue.retry();
        await uploadQueue.drain();
      }
      if (uploadQueue.snapshot().failed > 0) {
        throw new Error('Some answers or photos could not upload. Please try again.');
      }
      await submit({ submissionId: id });
      setOpen(null);
      ownerIntake.set({ shots: undefined });
      router.replace(STEP_ROUTE.building as never);
    } catch (e: any) {
      setError(e?.data ?? e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const dots = useMemo(() => designs.map((d, i) => <View key={d.code} style={[styles.dot, i === cur && styles.dotOn]} />), [designs, cur]);

  return (
    <ScreenShell
      title="Choose your design"
      onBack={() => router.back()}
      scroll={false}
      footer={
        <>
          {error ? <Text tone="danger" align="center">{error}</Text> : null}
          <Button title="Use this design" loading={busy} onPress={() => use(cur)} />
        </>
      }
    >
      <FlatList
        ref={list}
        data={designs as Design[]}
        horizontal
        keyExtractor={(d) => d.code}
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -space.gutter, flexGrow: 0 }}
        snapToInterval={cardW + GAP}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: side, gap: GAP }}
        onScroll={onScroll}
        scrollEventThrottle={32}
        initialScrollIndex={cur}
        getItemLayout={(_, i) => ({ length: cardW + GAP, offset: (cardW + GAP) * i, index: i })}
        renderItem={({ item, index }) => {
          const near = Math.abs(index - cur) <= 1;
          return (
            <Pressable
              onPress={() => (index === cur ? setOpen(index) : list.current?.scrollToIndex({ index, animated: true }))}
              accessibilityRole="button"
              accessibilityLabel={`${item.name} design. Open to see the whole site.`}
              style={[styles.card, shadow.object, { width: cardW, height: cardH, opacity: index === cur ? 1 : 0.5, transform: [{ scale: index === cur ? 1 : 0.9 }] }]}
            >
              {near ? (
                <SiteFrame uri={previewUri(item)} interactive={false} scale={cardW / PHONE_W} width={cardW} height={cardH} style={{ borderRadius: 24 }} />
              ) : null}
            </Pressable>
          );
        }}
      />
      <View style={[styles.meta, { marginHorizontal: -space.gutter, paddingHorizontal: side }]}>
        <Text variant="heading" numberOfLines={1} style={{ flex: 1 }}>{designs[cur]?.name}</Text>
        <View style={styles.dots}>{dots}</View>
      </View>

      <Modal visible={open !== null} animationType="slide" onRequestClose={() => setOpen(null)} presentationStyle="fullScreen">
        <View style={[styles.sheet, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.sheetTop}>
            <Pressable onPress={() => setOpen(null)} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
              <Ionicons name="chevron-back" size={24} color={colors.ink} />
            </Pressable>
            <Text variant="heading" numberOfLines={1}>{open !== null ? designs[open].name : ''}</Text>
            <View style={{ width: 48 }} />
          </View>
          {open !== null ? <SiteFrame uri={previewUri(designs[open])} style={styles.full} testID="design-full-site" /> : null}
          <View style={{ paddingHorizontal: space.gutter, gap: space.sm }}>
            {error ? <Text tone="danger" align="center">{error}</Text> : null}
            <Button title="Use this design" loading={busy} onPress={() => open !== null && use(open)} />
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, backgroundColor: colors.card },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: space.lg, gap: space.md },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(12,10,8,0.18)' },
  dotOn: { width: 22, backgroundColor: colors.ink },
  sheet: { flex: 1, backgroundColor: colors.card, gap: space.md },
  sheetTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg },
  back: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center' },
  full: { flex: 1, marginHorizontal: space.md, borderRadius: 18 },
});
