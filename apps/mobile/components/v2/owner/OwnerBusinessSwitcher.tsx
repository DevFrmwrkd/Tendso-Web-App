import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banner, Button, Text } from '../../v2';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { ownerIntake } from '../../../lib/v2/ownerIntake';
import { OWNER_SAMPLE_DATA } from '../../../lib/v2/ownerFlags';
import { phaseLine } from '../../../lib/v2/ownerFlow';
import type { OwnerMe, SiteSummary, SubmissionId } from '../../../lib/v2/ownerTypes';
import { colors, hit, radius, shadow, space } from '../../../theme/v2';

type Props = { me: OwnerMe | null | undefined; site: SiteSummary | null; isNewBusiness?: boolean };
type Opening = { epoch: number };

/** Account-level business selection, shared by Today and My site. */
export function OwnerBusinessSwitcher(props: Props) {
  const { userId } = useAuth();
  const actorId = userId ?? (OWNER_SAMPLE_DATA ? 'sample-owner' : null);
  return <BusinessMenu key={`${actorId ?? 'signed-out'}:${props.me?.owner._id ?? ''}`} {...props} actorId={actorId} />;
}

function BusinessMenu({ me, site, isNewBusiness = false, actorId }: Props & { actorId: string | null }) {
  const router = useGuardedRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [opening, setOpening] = useState<Opening | null>(null);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  const activeOpening = useRef<Opening | null>(null);
  const choosing = useRef(false);
  const live = useRef({ actorId, me, isNewBusiness });
  live.current = { actorId, me, isNewBusiness };
  const epoch = ownerIntake.scope();
  const sites = Array.isArray(me?.sites) ? me.sites : [];
  const openDrafts = sites.filter(item => item.contentSource === 'owner_app' && item.phase === 'draft').length;
  const atLimit = openDrafts >= 3;
  const label = isNewBusiness ? 'New business' : site?.businessName || 'Your businesses';
  const canOpen = !!actorId && !!me?.owner._id;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; activeOpening.current = null; }; }, []);
  useEffect(() => {
    if (opening && !ownerIntake.isCurrent(opening.epoch)) {
      activeOpening.current = null;
      setOpening(null);
    }
  }, [opening, epoch]);

  const close = () => {
    activeOpening.current = null;
    if (mounted.current) setOpening(null);
  };
  const current = () => mounted.current && !!actorId && live.current.actorId === actorId
    && live.current.me?.owner._id === me?.owner._id && !!opening
    && activeOpening.current === opening && ownerIntake.isCurrent(opening.epoch);
  const open = () => {
    if (!mounted.current || !canOpen || activeOpening.current) return;
    choosing.current = false;
    setError('');
    const next = { epoch: ownerIntake.scope() };
    activeOpening.current = next;
    setOpening(next);
  };
  const choose = (id: SubmissionId) => {
    if (!current() || choosing.current) return;
    const owned = live.current.me?.sites.find(item => item.submissionId === id);
    if (!owned) { setError('This business is no longer available. Choose another one.'); return; }
    choosing.current = true;
    try {
      ownerIntake.selectBusiness(owned.submissionId);
      close();
      if (owned.phase === 'draft') router.push('/(owner)');
    } catch {
      choosing.current = false;
      if (mounted.current) setError('Could not switch businesses. Please try again.');
    }
  };
  const add = () => {
    if (!current() || choosing.current) return;
    const drafts = live.current.me?.sites.filter(item => item.contentSource === 'owner_app' && item.phase === 'draft').length ?? 0;
    if (drafts >= 3) return;
    choosing.current = true;
    try {
      if (!live.current.isNewBusiness) ownerIntake.beginBusiness();
      close();
      router.push('/(owner)/start/sell');
    } catch {
      choosing.current = false;
      if (mounted.current) setError('Could not start another business. Please try again.');
    }
  };

  return <>
    <Pressable cssInterop={false} onPress={open} disabled={!canOpen} accessibilityRole="button"
      accessibilityLabel={`Current business: ${label}. Switch business`}
      accessibilityHint="Choose one of your businesses or add another"
      accessibilityState={{ expanded: !!opening, disabled: !canOpen }}
      style={({ pressed }) => [styles.trigger, shadow.soft, pressed && styles.triggerPressed]}>
      <View style={styles.triggerIcon}><Ionicons name="storefront-outline" size={22} color={colors.ink} /></View>
      <Text variant="body" weight="semibold" numberOfLines={2} style={styles.flex}>{label}</Text>
      <Ionicons name="chevron-down" size={20} color={colors.ink2} />
    </Pressable>
    <Modal visible={!!opening} transparent animationType="fade" presentationStyle="overFullScreen" onRequestClose={close}>
      <View style={[styles.overlay, { paddingTop: Math.max(insets.top, space.xl), paddingBottom: Math.max(insets.bottom, space.xl) }]}>
        <Pressable onPress={close} style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Dismiss business menu" />
        <View accessibilityViewIsModal style={[styles.popup, { maxHeight: Math.max(200, height - Math.max(insets.top, space.xl) - Math.max(insets.bottom, space.xl) - space.lg) }]}>
          <View style={styles.header}>
            <View style={styles.flex}>
              <Text variant="heading" accessibilityRole="header">Your businesses</Text>
              <Text variant="label" weight="medium" tone="muted">Choose the business you want to manage.</Text>
            </View>
            <Pressable cssInterop={false} onPress={close} accessibilityRole="button" accessibilityLabel="Close business menu" hitSlop={4} style={styles.close}>
              <Ionicons name="close" size={22} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.list} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
            <View accessibilityRole="radiogroup" style={styles.rows}>
              {sites.map(item => {
                const selected = !isNewBusiness && site?.submissionId === item.submissionId;
                return <Pressable cssInterop={false} key={item.submissionId} onPress={() => choose(item.submissionId)} accessibilityRole="radio"
                  accessibilityLabel={`${item.businessName}, ${phaseLine(item.phase)}`} accessibilityState={{ checked: selected }}
                  style={({ pressed }) => [styles.business, selected && styles.selected, pressed && styles.businessPressed]}>
                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected ? <Ionicons name="checkmark" size={19} color={colors.ink} /> : null}
                  </View>
                  <View style={styles.businessText}>
                    <Text variant="body" weight="bold">{item.businessName}</Text>
                    <View style={styles.status}>
                      <View style={[styles.dot, item.phase === 'live' && styles.liveDot]} />
                      <Text variant="label" weight="medium" tone="muted">{phaseLine(item.phase)}</Text>
                    </View>
                  </View>
                </Pressable>;
              })}
            </View>
            {sites.length === 0 ? <Text tone="ink2" style={styles.empty}>Your businesses will appear here.</Text> : null}
            {error ? <Banner tone="danger" body={error} /> : null}
          </ScrollView>
          <View style={styles.footer}>
            {atLimit ? <Banner tone="warn" title="3 drafts in progress" body="Finish one before adding another business. You can still switch between your businesses." /> : null}
            <Button title="Add business" icon="add" onPress={add} disabled={atLimit}
              accessibilityHint={atLimit ? 'Finish an existing draft before adding another business' : 'Start a separate website for another business'} />
          </View>
        </View>
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  trigger: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, minHeight: hit.primary, borderRadius: radius.card,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.rule },
  triggerPressed: { backgroundColor: colors.bg2 },
  triggerIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, paddingHorizontal: space.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.scrim },
  popup: { width: '100%', maxWidth: 520, flexShrink: 1, borderRadius: radius.tile, backgroundColor: colors.bg, overflow: 'hidden', ...shadow.object },
  header: { padding: space.xl, paddingBottom: space.lg, flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  close: { width: hit.icon, height: hit.icon, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg2 },
  scroll: { flexShrink: 1 },
  list: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.md },
  rows: { gap: space.sm },
  business: { minHeight: 80, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.card,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.rule },
  selected: { backgroundColor: colors.accentSoft, borderColor: colors.ink },
  businessPressed: { backgroundColor: colors.bg2 },
  radio: { width: 28, height: 28, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.ruleStrong, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { backgroundColor: colors.accent, borderColor: colors.ink },
  businessText: { flex: 1, minWidth: 0, gap: space.xs },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.ink3Text },
  liveDot: { backgroundColor: colors.accent, borderWidth: 1, borderColor: colors.ink },
  empty: { padding: space.md },
  footer: { padding: space.lg, paddingTop: space.md, gap: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.ruleStrong },
});
