import React, { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { CREATOR_CODE_DISCOUNT, formatPHP } from '../../../../packages/shared/pricing';
import { Avatar, Card, Text } from '../v2';
import { colors, radius, space } from '../../theme/v2';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { AffiliateAccess, AffiliateFrame, type AffiliateAccessProps } from './Screen';
import { affiliateName, affiliateUrl, type AffiliatePortal, samplePortal } from './model';

export function AffiliateHomeScreen() {
  return <AffiliateAccess>{props => props.isPreview ? <HomeContent {...props} portal={samplePortal} /> : <LiveHome {...props} />}</AffiliateAccess>;
}

function LiveHome(props: AffiliateAccessProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>();
  const portal = useQuery(api.affiliates.portal, props.isAuthenticated ? selectedMonth ? { month: selectedMonth } : {} : 'skip');
  return <HomeContent {...props} portal={portal} selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />;
}

/** Calendar choices only; each selection loads its own credited income from the portal. */
function recentMonths() {
  const manila = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(manila.getUTCFullYear(), manila.getUTCMonth() - index, 1));
    return {
      key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    };
  });
}

function moneyTextSize(amount: number | undefined, preferred: number, available: number, fontScale: number) {
  const units = [...(amount === undefined ? 'Loading…' : formatPHP(amount))].reduce((sum, character) => sum + (/[.,]/.test(character) ? 0.34 : 0.7), 0);
  return Math.max(16, Math.min(preferred, Math.floor(available / (units * Math.max(1, fontScale)))));
}

function Income({ label, amount, description, icon, onPress, amountSize, stacked }: {
  label: string; amount: number | undefined; description: string;
  icon: React.ComponentProps<typeof Ionicons>['name']; onPress: () => void; amountSize: number; stacked: boolean;
}) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`View ${label.toLowerCase()} earnings`} style={({ pressed }) => [styles.income, stacked && styles.sourceStacked, pressed && styles.sourcePressed]}>
    <View style={styles.sourceLabel}><Ionicons name={icon} size={18} color={colors.accent} /><Text variant="label" tone="onDark">{label}</Text><Ionicons name="chevron-forward" size={16} color={colors.onDark} /></View>
    <Text variant="number" tone="onDark" tabular style={[styles.sourceAmount, { fontSize: amountSize, lineHeight: Math.ceil(amountSize * 1.25) }]}
      accessibilityLabel={amount === undefined ? `From ${label.toLowerCase()}, loading` : `From ${label.toLowerCase()}, ${formatPHP(amount)}`}>
      {amount === undefined ? 'Loading…' : formatPHP(amount)}
    </Text>
    <Text variant="label" tone="onDark" style={styles.sourceDescription}>{description}</Text>
  </Pressable>;
}

/** Income is credited earnings for the selected month, separate from the Money balance. */
export function HomeContent({ account, isPreview, isOffline, portal, selectedMonth, onMonthChange }: AffiliateAccessProps & {
  portal: AffiliatePortal | undefined; selectedMonth?: string; onMonthChange?: (month: string) => void;
}) {
  const router = useGuardedRouter();
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [error, setError] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [choosingMonth, setChoosingMonth] = useState(false);
  const busy = useRef(false);
  const suspended = account.status !== 'active';
  const disabled = isPreview || suspended;
  const url = account.affiliateHandle ? affiliateUrl(account.affiliateHandle) : null;
  const choices = recentMonths();
  const portalMonth = portal?.month ? new Date(portal.month.start + 8 * 60 * 60 * 1000) : undefined;
  const portalMonthKey = portalMonth ? `${portalMonth.getUTCFullYear()}-${String(portalMonth.getUTCMonth() + 1).padStart(2, '0')}` : undefined;
  const resolvedMonth = selectedMonth ?? portalMonthKey ?? choices[0].key;
  const monthLabel = choices.find(choice => choice.key === resolvedMonth)?.label
    ?? new Date(`${resolvedMonth}-01T00:00:00Z`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  // A previous subscription result must not appear under the newly selected month.
  const income = portalMonthKey === resolvedMonth ? portal?.income : undefined;
  const total = income?.totalThisMonth;
  const stackIncome = width < 375 || fontScale > 1.1 ||
    [income?.directThisMonth, income?.teamThisMonth].some(amount => amount !== undefined && formatPHP(amount).length > 8);
  const heroSize = moneyTextSize(total, 52, width - 92, fontScale);
  const sourceWidth = stackIncome ? width - 92 : (width - 125) / 2;
  const monthParams = { month: resolvedMonth };
  const openSales = () => router.push({ pathname: '/(app)/affiliate/sales', params: monthParams });
  const openAgents = () => router.push({ pathname: '/(app)/(affiliate-tabs)/agents', params: monthParams });
  const share = async () => {
    if (!url || disabled || busy.current) return;
    busy.current = true; setError('');
    try { await Share.share({ message: `${affiliateName(account)} · Get a website for your shop: ${url}`, url }); }
    catch { setError('Could not share your link. Please try again.'); }
    finally { busy.current = false; }
  };
  const copy = async () => {
    if (!url || disabled) return;
    try { await Clipboard.setStringAsync(url); setCopyMessage('Copied.'); }
    catch { setCopyMessage('Could not copy. Please try again.'); }
  };

  return <AffiliateFrame preview={isPreview} suspended={suspended} offline={isOffline}
    footer={<>
      {error ? <Text tone="danger" accessibilityRole="alert">{error}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Share my shop link" accessibilityState={{ disabled: !url || disabled }} onPress={share} disabled={!url || disabled} style={[styles.shareAction, (!url || disabled) && styles.disabled]}><Ionicons name="share-outline" size={22} color={colors.ink} /><Text variant="button" style={styles.shareActionText}>Share my shop link</Text></Pressable>
    </>}>
    <View style={styles.topline}>
      <Pressable onPress={() => router.push('/(app)/(affiliate-tabs)/profile')} accessibilityRole="button" accessibilityLabel="Open my profile" style={styles.greeting}>
        <Avatar uri={account.affiliatePhoto || undefined} name={affiliateName(account)} size={48} />
        <View style={styles.flex}><Text variant="label" tone="muted">Creator home</Text><Text variant="title" accessibilityRole="header" style={styles.greetingText}>Hi, {account.firstName || 'creator'}</Text></View>
      </Pressable>
      <Pressable onPress={() => router.push('/(app)/notifications')} accessibilityRole="button" accessibilityLabel="Notifications" style={styles.round}>
        <Ionicons name="notifications-outline" size={22} color={colors.ink} />
      </Pressable>
    </View>

    <Card variant="dark" style={styles.hero} testID="affiliate-monthly-income">
      <View style={[styles.earningsHeading, (width < 360 || fontScale > 1.2) && styles.headingStacked]}>
        <Text variant="label" tone="onDark" style={styles.heroCaption}>Your earnings</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Change earnings month" accessibilityValue={{ text: monthLabel }} accessibilityState={{ disabled: isPreview || !onMonthChange, expanded: choosingMonth }}
          disabled={isPreview || !onMonthChange} onPress={() => setChoosingMonth(true)} style={({ pressed }) => [styles.monthSwitch, pressed && styles.sourcePressed]}>
          <Text variant="label" tone="onDark" style={styles.monthText}>{monthLabel}</Text><Ionicons name="chevron-down" size={16} color={colors.onDark} />
        </Pressable>
      </View>
      <Text variant="hero" tone="onDark" tabular style={[styles.heroAmount, { fontSize: heroSize, lineHeight: Math.ceil(heroSize * 1.2) }]}
        accessibilityLiveRegion="polite"
        accessibilityLabel={total === undefined ? `${monthLabel} earnings, loading` : `${monthLabel} earnings, ${formatPHP(total)}`}>
        {total === undefined ? 'Loading…' : formatPHP(total)}
      </Text>
      <Text variant="label" tone="onDark" style={styles.heroCaption}>From your link and agents</Text>
      <View style={[styles.incomes, stackIncome && styles.stacked]}>
        <Income label="Your link" amount={income?.directThisMonth} description="Paid website sales" icon="link-outline" onPress={openSales} stacked={stackIncome} amountSize={moneyTextSize(income?.directThisMonth, 27, sourceWidth, fontScale)} />
        <View style={stackIncome ? styles.sourceRuleHorizontal : styles.sourceRule} />
        <Income label="Your agents" amount={income?.teamThisMonth} description="5% team commission" icon="people-outline" onPress={openAgents} stacked={stackIncome} amountSize={moneyTextSize(income?.teamThisMonth, 27, sourceWidth, fontScale)} />
      </View>
    </Card>

    <Text variant="label" tone="muted" style={styles.sectionLabel}>Your tools</Text>
    <View style={[styles.shortcuts, fontScale > 1.2 && styles.stacked]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Sales" onPress={openSales} style={({ pressed }) => [styles.shortcut, fontScale > 1.2 && styles.sourceStacked, pressed && styles.toolPressed]}>
        <View style={styles.toolHeading}><View style={styles.toolIcon}><Ionicons name="receipt-outline" size={22} color={colors.ink} /></View><Ionicons name="arrow-forward" size={19} color={colors.ink2} /></View>
        <Text variant="bodyLg" weight="bold">Sales</Text><Text variant="label" tone="muted">Track shop progress</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="My page" onPress={() => router.push('/(app)/affiliate/page')} style={({ pressed }) => [styles.shortcut, fontScale > 1.2 && styles.sourceStacked, pressed && styles.toolPressed]}>
        <View style={styles.toolHeading}><View style={styles.toolIcon}><Ionicons name="create-outline" size={22} color={colors.ink} /></View><Ionicons name="arrow-forward" size={19} color={colors.ink2} /></View>
        <Text variant="bodyLg" weight="bold">My page</Text><Text variant="label" tone="muted">Edit & preview</Text>
      </Pressable>
    </View>
    <Card variant="lg" style={styles.linkCard}>
      <Text variant="bodyLg" weight="bold">Share with shop owners</Text>
      <Text variant="label" tone="muted">Your link gives {Math.round(CREATOR_CODE_DISCOUNT * 100)}% off.</Text>
      <View style={styles.link}>
        <Ionicons name="link-outline" size={20} color={colors.ink2} />
        <Text selectable variant="label" weight="semibold" style={styles.flex}>{url?.replace(/^https?:\/\//, '') ?? 'Your page link is not available yet.'}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Copy shop link" disabled={!url || disabled} accessibilityState={{ disabled: !url || disabled }} onPress={copy} style={[styles.copyButton, (!url || disabled) && styles.disabled]}>
          <Ionicons name="copy-outline" size={21} color={colors.ink} />
        </Pressable>
      </View>
      {copyMessage ? <Text variant="label" tone="muted" accessibilityLiveRegion="polite">{copyMessage}</Text> : null}
    </Card>

    <Modal visible={choosingMonth} transparent animationType="slide" onRequestClose={() => setChoosingMonth(false)}>
      <View style={styles.monthModal}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close month chooser" onPress={() => setChoosingMonth(false)} style={StyleSheet.absoluteFill} />
        <View style={[styles.monthSheet, { maxHeight: Math.max(160, height - insets.top - space.xl), paddingBottom: Math.max(insets.bottom, space.lg) }]} accessibilityViewIsModal>
          <View style={styles.sheetHeader}><Text variant="title" style={styles.flex} accessibilityRole="header">Earnings month</Text><Pressable accessibilityRole="button" accessibilityLabel="Close earnings month" onPress={() => setChoosingMonth(false)} style={styles.round}><Ionicons name="close" size={24} color={colors.ink} /></Pressable></View>
          <ScrollView accessibilityLabel="Earnings month options" style={styles.monthOptions}>
          {choices.map(choice => <Pressable key={choice.key} accessibilityRole="button" accessibilityLabel={choice.label} accessibilityState={{ selected: resolvedMonth === choice.key }}
            onPress={() => { setChoosingMonth(false); onMonthChange?.(choice.key); }} style={styles.monthOption}>
            <Text style={styles.flex} weight={resolvedMonth === choice.key ? 'bold' : 'regular'}>{choice.label}</Text>
            {resolvedMonth === choice.key ? <Ionicons name="checkmark" size={22} color={colors.ink} /> : null}
          </Pressable>)}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </AffiliateFrame>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  topline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 },
  greeting: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 48 },
  greetingText: { fontSize: 22, lineHeight: 28 },
  round: { minWidth: 48, minHeight: 48, borderRadius: radius.pill, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.rule },
  hero: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 20, borderRadius: radius.tile },
  earningsHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headingStacked: { flexDirection: 'column', alignItems: 'flex-start' },
  monthSwitch: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', maxWidth: '100%', minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.09)' },
  monthText: { flexShrink: 1 },
  heroAmount: { fontSize: 52, lineHeight: 60, letterSpacing: -1.5, marginTop: 12, marginBottom: 4 },
  heroCaption: { opacity: 0.8 },
  incomes: { flexDirection: 'row', alignItems: 'stretch', gap: 16, marginTop: 22, paddingTop: 18, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.16)' },
  stacked: { flexDirection: 'column' },
  income: { flex: 1, minWidth: 0, gap: 6, paddingVertical: 4, borderRadius: 8 },
  sourceStacked: { flex: 0, width: '100%' },
  sourceLabel: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  sourceAmount: { fontSize: 27, lineHeight: 34, letterSpacing: -0.8, marginTop: 4 },
  sourceDescription: { opacity: 0.8 },
  sourceRule: { width: 1, backgroundColor: 'rgba(255,255,255,0.16)' },
  sourceRuleHorizontal: { height: 1, backgroundColor: 'rgba(255,255,255,0.16)' },
  sourcePressed: { opacity: 0.7 },
  sectionLabel: { marginTop: 4, marginBottom: -6 },
  shortcuts: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  shortcut: { flex: 1, minWidth: 0, gap: 6, padding: 16, borderRadius: radius.card, backgroundColor: colors.card },
  toolHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  toolIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg2 },
  toolPressed: { backgroundColor: colors.bg2 },
  linkCard: { padding: 18, gap: 8 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12, paddingRight: 4, paddingVertical: 6, marginTop: 6, backgroundColor: colors.bg2, borderRadius: radius.field },
  copyButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  shareAction: { minHeight: 60, paddingHorizontal: 18, paddingVertical: 12, borderRadius: radius.pill, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  shareActionText: { flexShrink: 1, textAlign: 'center' },
  monthModal: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  monthSheet: { backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: space.gutter },
  monthOptions: { flexShrink: 1 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  monthOption: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.ruleStrong },
});
