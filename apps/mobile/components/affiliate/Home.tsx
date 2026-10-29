import React, { useRef, useState } from 'react';
import { Modal, Pressable, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { formatPHP } from '../../../../packages/shared/pricing';
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

function Income({ label, amount, description, icon, onPress, amountSize }: {
  label: string; amount: number | undefined; description: string;
  icon: React.ComponentProps<typeof Ionicons>['name']; onPress: () => void; amountSize: number;
}) {
  return <Card style={styles.income} onPress={onPress} accessibilityLabel={`View ${label.toLowerCase()} earnings`}>
    <View style={styles.sourceLabel}><Ionicons name={icon} size={19} color={colors.ink} /><Text variant="label">{label}</Text></View>
    <Text variant="number" tabular style={[styles.sourceAmount, { fontSize: amountSize, lineHeight: Math.ceil(amountSize * 1.25) }]}
      accessibilityLabel={amount === undefined ? `From ${label.toLowerCase()}, loading` : `From ${label.toLowerCase()}, ${formatPHP(amount)}`}>
      {amount === undefined ? 'Loading…' : formatPHP(amount)}
    </Text>
    <Text variant="label" tone="muted">{description}</Text>
  </Card>;
}

/** Income is credited earnings for the selected month, separate from the Money balance. */
export function HomeContent({ account, isPreview, isOffline, portal, selectedMonth, onMonthChange }: AffiliateAccessProps & {
  portal: AffiliatePortal | undefined; selectedMonth?: string; onMonthChange?: (month: string) => void;
}) {
  const router = useGuardedRouter();
  const { width, fontScale } = useWindowDimensions();
  const stackIncome = width < 360 || fontScale > 1.2 ||
    [portal?.income?.directThisMonth, portal?.income?.teamThisMonth].some(amount => amount !== undefined && formatPHP(amount).length > 8);
  const [error, setError] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [choosingMonth, setChoosingMonth] = useState(false);
  const busy = useRef(false);
  const suspended = account.status !== 'active';
  const disabled = isPreview || suspended;
  const url = account.affiliateHandle ? affiliateUrl(account.affiliateHandle) : null;
  const choices = recentMonths();
  const portalMonth = portal?.month ? new Date(portal.month.start + 8 * 60 * 60 * 1000) : undefined;
  const resolvedMonth = selectedMonth ?? (portalMonth ? `${portalMonth.getUTCFullYear()}-${String(portalMonth.getUTCMonth() + 1).padStart(2, '0')}` : choices[0].key);
  const monthLabel = choices.find(choice => choice.key === resolvedMonth)?.label
    ?? new Date(`${resolvedMonth}-01T00:00:00Z`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const monthName = monthLabel.replace(/ \d{4}$/, '');
  const total = portal?.income?.totalThisMonth;
  const heroSize = moneyTextSize(total, 52, width - 92, fontScale);
  const sourceWidth = (stackIncome ? width - 48 : (width - 58) / 2) - 30;
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
        <Avatar uri={account.affiliatePhoto || undefined} name={affiliateName(account)} size={44} />
        <View style={styles.flex}><Text variant="label" tone="muted">Your creator account</Text><Text variant="title" accessibilityRole="header" style={styles.greetingText}>Hi, {account.firstName || 'creator'}</Text></View>
      </Pressable>
      <Pressable onPress={() => router.push('/(app)/notifications')} accessibilityRole="button" accessibilityLabel="Notifications" style={styles.round}>
        <Ionicons name="notifications-outline" size={22} color={colors.ink} />
      </Pressable>
    </View>

    <Card variant="dark" style={styles.hero} testID="affiliate-monthly-income">
      <Pressable accessibilityRole="button" accessibilityLabel="Change earnings month" accessibilityState={{ disabled: isPreview || !onMonthChange, expanded: choosingMonth }}
        disabled={isPreview || !onMonthChange} onPress={() => setChoosingMonth(true)} style={styles.monthSwitch}>
        <Text variant="label" tone="onDark">{monthLabel}</Text><Ionicons name="chevron-down" size={18} color={colors.onDark} />
      </Pressable>
      <Text variant="hero" tone="onDark" tabular style={[styles.heroAmount, { fontSize: heroSize, lineHeight: Math.ceil(heroSize * 1.2) }]}
        accessibilityLabel={total === undefined ? `${monthLabel} earnings, loading` : `${monthLabel} earnings, ${formatPHP(total)}`}>
        {total === undefined ? 'Loading…' : formatPHP(total)}
      </Text>
      <Text variant="label" tone="onDark" style={styles.heroCaption}>{monthName} earnings</Text>
    </Card>

    <View style={[styles.incomes, stackIncome && styles.stacked]}>
      <Income label="Your link" amount={portal?.income?.directThisMonth} description="Paid website sales" icon="link-outline" onPress={openSales} amountSize={moneyTextSize(portal?.income?.directThisMonth, 27, sourceWidth, fontScale)} />
      <Income label="Your agents" amount={portal?.income?.teamThisMonth} description="5% team commission" icon="people-outline" onPress={openAgents} amountSize={moneyTextSize(portal?.income?.teamThisMonth, 27, sourceWidth, fontScale)} />
    </View>
    <View style={[styles.shortcuts, fontScale > 1.2 && styles.stacked]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Sales" onPress={openSales} style={styles.shortcut}><Text weight="semibold">Sales</Text><Ionicons name="chevron-forward" size={20} color={colors.ink3} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="My page" onPress={() => router.push('/(app)/affiliate/page')} style={styles.shortcut}><Text weight="semibold">My page</Text><Ionicons name="chevron-forward" size={20} color={colors.ink3} /></Pressable>
    </View>
    <View style={styles.link}>
      <Ionicons name="link-outline" size={20} color={colors.ink2} />
      <Text selectable weight="semibold" style={styles.flex}>{url?.replace(/^https?:\/\//, '') ?? 'Your page link is not available yet.'}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Copy shop link" disabled={!url || disabled} accessibilityState={{ disabled: !url || disabled }} onPress={copy} style={[styles.copyButton, (!url || disabled) && styles.disabled]}>
        <Ionicons name="copy-outline" size={21} color={colors.ink} />
      </Pressable>
    </View>
    {copyMessage ? <Text variant="label" tone="muted" accessibilityLiveRegion="polite">{copyMessage}</Text> : null}

    <Modal visible={choosingMonth} transparent animationType="slide" onRequestClose={() => setChoosingMonth(false)}>
      <View style={styles.monthModal}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close month chooser" onPress={() => setChoosingMonth(false)} style={StyleSheet.absoluteFill} />
        <View style={styles.monthSheet} accessibilityViewIsModal>
          <View style={styles.sheetHeader}><Text variant="title" accessibilityRole="header">Earnings month</Text><Pressable accessibilityRole="button" accessibilityLabel="Close earnings month" onPress={() => setChoosingMonth(false)} style={styles.round}><Ionicons name="close" size={24} color={colors.ink} /></Pressable></View>
          {choices.map(choice => <Pressable key={choice.key} accessibilityRole="button" accessibilityLabel={choice.label} accessibilityState={{ selected: monthLabel === choice.label }}
            onPress={() => { setChoosingMonth(false); onMonthChange?.(choice.key); }} style={styles.monthOption}>
            <Text weight={monthLabel === choice.label ? 'bold' : 'regular'}>{choice.label}</Text>
            {monthLabel === choice.label ? <Ionicons name="checkmark" size={22} color={colors.ink} /> : null}
          </Pressable>)}
        </View>
      </View>
    </Modal>
  </AffiliateFrame>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  topline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  greeting: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 48 },
  greetingText: { fontSize: 22, lineHeight: 28 },
  round: { minWidth: 48, minHeight: 48, borderRadius: radius.pill, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  hero: { paddingHorizontal: 22, paddingTop: 15, paddingBottom: 24, borderRadius: 27 },
  monthSwitch: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', minHeight: 44 },
  heroAmount: { fontSize: 52, lineHeight: 60, letterSpacing: -1.5, marginTop: 5 },
  heroCaption: { marginTop: 4, opacity: 0.8 },
  incomes: { flexDirection: 'row', alignItems: 'stretch', gap: 10, marginTop: -5 },
  stacked: { flexDirection: 'column' },
  income: { flex: 1, minWidth: 0, gap: 4, paddingHorizontal: 15, paddingVertical: 18, borderRadius: 22 },
  sourceLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sourceAmount: { fontSize: 27, lineHeight: 34, letterSpacing: -0.8, marginTop: 6 },
  shortcuts: { flexDirection: 'row', gap: 10, marginTop: 1 },
  shortcut: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56, gap: 10, paddingHorizontal: 15, paddingVertical: 15, borderRadius: 18, backgroundColor: colors.bg2 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 6, paddingVertical: 8, borderWidth: 1, borderColor: colors.ruleStrong, borderRadius: 18 },
  copyButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  shareAction: { minHeight: 60, paddingHorizontal: 18, paddingVertical: 12, borderRadius: radius.pill, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  shareActionText: { flexShrink: 1, textAlign: 'center' },
  monthModal: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  monthSheet: { backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: space.gutter, paddingBottom: 36 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  monthOption: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.ruleStrong },
});
