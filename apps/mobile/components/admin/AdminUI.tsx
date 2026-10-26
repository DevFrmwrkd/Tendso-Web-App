import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type KeyboardEvent } from 'react-native';
import type { Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { backgroundGradient, colors, fonts, hit, radius, shadow, space } from '../../theme/v2';
import { Chip } from '../v2/Chip';
import { EmptyState } from '../v2/EmptyState';
import { ListRow } from '../v2/ListRow';
import { TendsoMark } from '../v2/TendsoMark';
import { Text } from '../v2/Text';
import { V2TabBar, type TabBarItem } from '../v2/TabBar';
import { openExternalUrl, SITE_URL } from '../../services/links';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';

export const money = (value: number) => `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fullName = (person: { firstName?: string | null; lastName?: string | null; email?: string | null }) =>
  [person.firstName, person.lastName].filter(Boolean).join(' ') || person.email || 'Unnamed account';
export const date = (value?: number | null) => value ? new Date(value).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type AdminSection = 'overview' | 'reviews' | 'accounts' | 'payouts';

export function AdminButton({ label, onPress, disabled = false, busy = false, danger = false, variant = 'primary', icon }: {
  label: string; onPress: () => void | Promise<void>; disabled?: boolean; busy?: boolean; danger?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost'; icon?: IconName;
}) {
  const foreground = danger ? variant === 'primary' ? colors.onDark : colors.danger : colors.ink;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: disabled || busy, busy }}
    disabled={disabled || busy} onPress={onPress} cssInterop={false} style={({ pressed }) => [
      styles.button, variant === 'secondary' && styles.secondaryButton, variant === 'ghost' && styles.ghostButton,
      danger && (variant === 'primary' ? styles.dangerButton : styles.dangerSoftButton),
      (disabled || busy) && { opacity: .45 }, pressed && { opacity: .75 },
    ]}>
    {busy ? <ActivityIndicator color={foreground} /> : <>
      {icon ? <Ionicons name={icon} size={22} color={foreground} /> : null}
      <Text variant="button" align="center" style={[styles.buttonText, { color: foreground }]}>{label}</Text>
    </>}
  </Pressable>;
}

export function AdminText({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return <Text selectable variant="body" tone={muted ? 'muted' : 'ink2'}>{children}</Text>;
}
export function AdminCard({ title, subtitle, right, children }: { title?: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return <View style={[styles.card, shadow.soft]}>
    {title || subtitle || right ? <View style={styles.cardHeading}>
      <View style={styles.cardHeadingText}>
        {title ? <Text variant="heading" accessibilityRole="header">{title}</Text> : null}
        {subtitle ? <AdminText muted>{subtitle}</AdminText> : null}
      </View>
      {right}
    </View> : null}
    {children}
  </View>;
}
export function AdminLoading({ message = 'Loading admin data…', inline = false }: { message?: string; inline?: boolean }) {
  return <View style={[styles.loading, inline && styles.inlineLoading]}><View style={styles.loadingIcon}><ActivityIndicator accessibilityLabel="Loading admin data" color={colors.ink} /></View><AdminText>{message}</AdminText></View>;
}
export function AdminNotice({ children, error = false }: { children: React.ReactNode; error?: boolean }) {
  return <View style={[styles.notice, error && { backgroundColor: colors.dangerBg }]}>
    <Ionicons name={error ? 'alert-circle-outline' : 'information-circle-outline'} size={22} color={error ? colors.danger : colors.ink} />
    <Text variant="label" weight="medium" tone={error ? 'danger' : 'ink2'} accessibilityRole={error ? 'alert' : undefined} accessibilityLiveRegion="polite" style={styles.flex}>{children}</Text>
  </View>;
}
export function AdminField({ label, value, onChangeText, maxLength = 500, multiline = false }: {
  label: string; value: string; onChangeText: (value: string) => void; maxLength?: number; multiline?: boolean;
}) {
  return <View style={{ gap: space.sm }}><Text variant="label" tone="muted">{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText}
    maxLength={maxLength} multiline={multiline} placeholderTextColor={colors.ink3} selectionColor={colors.ink}
    returnKeyType={multiline ? 'default' : 'done'} onSubmitEditing={multiline ? undefined : Keyboard.dismiss}
    autoCorrect={false} textAlignVertical={multiline ? 'top' : 'center'} style={[styles.input, multiline && { minHeight: 112 }]} /></View>;
}
export function AdminTabs<T extends string>({ items, value, onChange }: { items: { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return <View style={styles.tabs}>{items.map(item => <Pressable key={item.value} accessibilityRole="tab" accessibilityLabel={item.label}
    accessibilityState={{ selected: item.value === value }} onPress={() => onChange(item.value)} style={[styles.tab, item.value === value && styles.tabOn]}>
    <Text variant="label" align="center" weight={item.value === value ? 'bold' : 'semibold'} tone={item.value === value ? 'ink' : 'muted'}>{item.label}</Text>
  </Pressable>)}</View>;
}
export function AdminLink({ label, href, subtitle, icon = 'arrow-forward-outline', badge }: { label: string; href: Href; subtitle?: string; icon?: IconName; badge?: string }) {
  const router = useGuardedRouter();
  return <ListRow title={label} titleNumberOfLines={2} subtitle={subtitle} icon={icon} accessibilityLabel={label}
    trailing={badge ? <Chip label={badge} tone="muted" /> : undefined} onPress={() => router.push(href)} />;
}
export function WebAdminLink({ path = '', label = 'Open web admin' }: { path?: string; label?: string }) {
  // Callers provide fixed admin routes or an encoded Convex id, never an external host.
  return <AdminButton label={label} icon="open-outline" variant="secondary" onPress={() => openExternalUrl(`${SITE_URL}/admin${path}`)} />;
}
export function AdminEmptyState(props: { title: string; body?: string; icon?: IconName }) {
  return <View style={[styles.card, shadow.soft]}><EmptyState {...props} /></View>;
}

const NAV_ITEMS: TabBarItem[] = [
  { routeName: 'overview', label: 'Overview', icon: 'grid-outline', activeIcon: 'grid' },
  { routeName: 'reviews', label: 'Reviews', icon: 'checkmark-circle-outline', activeIcon: 'checkmark-circle' },
  { routeName: 'accounts', label: 'Accounts', icon: 'people-outline', activeIcon: 'people' },
  { routeName: 'payouts', label: 'Payouts', icon: 'wallet-outline', activeIcon: 'wallet' },
];
const NAV_ROUTES: Record<AdminSection, Href> = {
  overview: '/(app)/admin', reviews: '/(app)/admin/reviews', accounts: '/(app)/admin/accounts', payouts: '/(app)/admin/payouts',
};

function useAdminKeyboardVisible() {
  const [visible, setVisible] = useState(() => Keyboard.isVisible());
  useEffect(() => {
    // Did events handle Android and a screen mounted midway through an iOS
    // keyboard transition. Will events keep the iOS bar in sync with the keyboard.
    const subscriptions = [
      Keyboard.addListener('keyboardDidShow', () => setVisible(true)),
      Keyboard.addListener('keyboardDidHide', () => setVisible(false)),
    ];
    if (Platform.OS === 'ios') {
      const update = (show: boolean) => (event: KeyboardEvent) => {
        Keyboard.scheduleLayoutAnimation(event);
        setVisible(show);
      };
      subscriptions.push(
        Keyboard.addListener('keyboardWillShow', update(true)),
        Keyboard.addListener('keyboardWillHide', update(false)),
      );
    }
    return () => subscriptions.forEach(subscription => subscription.remove());
  }, []);
  return visible;
}

export function AdminScreen({ title, subtitle, children, home = false, section = 'overview', backHref, backLabel = 'Back to admin overview' }: {
  title: string; subtitle?: string; children: React.ReactNode; home?: boolean; section?: AdminSection; backHref?: Href; backLabel?: string;
}) {
  const router = useGuardedRouter();
  const keyboardVisible = useAdminKeyboardVisible();
  const showBack = !!backHref || (!home && section === 'overview');
  // The admin-only account switcher above the navigator owns the top safe area.
  // V2TabBar owns the bottom inset; the scrolling body needs neither twice.
  return <View style={styles.screen}>
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none" preserveAspectRatio="none">
      <Defs><LinearGradient id="admin-bg" x1={backgroundGradient.start.x} y1={backgroundGradient.start.y} x2={backgroundGradient.end.x} y2={backgroundGradient.end.y}>
        {backgroundGradient.colors.map((color, i) => <Stop key={color} offset={backgroundGradient.locations[i]} stopColor={color} />)}
      </LinearGradient></Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#admin-bg)" />
    </Svg>
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false}>
      {showBack ? <Pressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={() => router.replace(backHref ?? NAV_ROUTES.overview)} style={[styles.back, shadow.soft]}>
        <Ionicons name="arrow-back" size={22} color={colors.ink} />
      </Pressable> : null}
      <View style={styles.heading}>
        <View style={styles.cardHeadingText}>
          <Text variant="display" accessibilityRole="header">{title}</Text>
          {subtitle ? <AdminText>{subtitle}</AdminText> : null}
        </View>
        <TendsoMark size={44} />
      </View>
      {children}
    </ScrollView>
    {keyboardVisible ? null : <V2TabBar items={NAV_ITEMS} state={{ index: NAV_ITEMS.findIndex(item => item.routeName === section), routes: NAV_ITEMS.map(item => ({ name: item.routeName })) }}
      navigation={{ navigate: name => router.replace(NAV_ROUTES[name as AdminSection]) }} />}
  </View>;
}

/** Re-check the current live permission when a native confirmation is accepted. */
export function useAdminAction(allowed: boolean, scope?: string) {
  const currentAllowed = useRef(allowed); currentAllowed.current = allowed;
  const currentScope = useRef(scope); currentScope.current = scope;
  useEffect(() => {
    currentAllowed.current = allowed;
    return () => { currentAllowed.current = false; };
  }, [allowed]);
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  async function run(work: () => Promise<unknown>, success: string) {
    if (!currentAllowed.current || locked.current) return;
    locked.current = true; setBusy(true); setError(null); setNotice(null);
    try { await work(); setNotice(success); } catch (e) { setError(e instanceof Error ? e.message : 'The action failed. Please try again.'); }
    finally { locked.current = false; setBusy(false); }
  }
  function confirm(title: string, message: string, label: string, work: () => Promise<unknown>, success: string, destructive = false) {
    if (!currentAllowed.current || locked.current) return;
    const confirmedScope = currentScope.current;
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: label, style: destructive ? 'destructive' : 'default', onPress: () => {
        if (currentScope.current === confirmedScope) void run(work, success);
      } },
    ]);
  }
  return { busy, error, notice, run, confirm };
}
export function ActionFeedback({ error, notice }: { error: string | null; notice: string | null }) {
  return <>{error && <AdminNotice error>{error}</AdminNotice>}{notice && <AdminNotice>{notice}</AdminNotice>}</>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.gutter, paddingTop: space.xl, paddingBottom: space.xxl, gap: space.lg },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: space.lg, marginBottom: space.sm },
  card: { backgroundColor: colors.card, borderRadius: radius.cardLg, padding: space.lg, gap: space.lg },
  cardHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  cardHeadingText: { flex: 1, minWidth: 0, gap: space.sm },
  button: { minHeight: hit.primary, flexDirection: 'row', gap: space.sm, justifyContent: 'center', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: colors.accent, borderWidth: 1, borderColor: 'transparent' },
  buttonText: { flexShrink: 1 },
  secondaryButton: { backgroundColor: colors.card, borderColor: colors.ruleStrong },
  ghostButton: { backgroundColor: colors.bg2 },
  dangerButton: { backgroundColor: colors.danger },
  dangerSoftButton: { backgroundColor: colors.dangerBg, borderColor: 'transparent' },
  loading: { flex: 1, padding: space.xl, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, gap: space.lg },
  inlineLoading: { flex: 0, minHeight: 160, borderRadius: radius.cardLg, backgroundColor: colors.card },
  loadingIcon: { width: 56, height: 56, borderRadius: radius.pill, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, backgroundColor: colors.accentSoft, padding: space.lg, borderRadius: radius.card },
  input: { minHeight: 60, backgroundColor: colors.card, borderColor: colors.ruleStrong, borderWidth: 1, borderRadius: radius.field, padding: space.lg, fontFamily: fonts.medium, fontSize: 18, lineHeight: 26, color: colors.ink },
  tabs: { flexDirection: 'row', padding: space.xs, gap: space.xs, backgroundColor: colors.bg2, borderRadius: radius.card },
  tab: { flex: 1, minHeight: hit.min, justifyContent: 'center', paddingHorizontal: space.sm, paddingVertical: space.sm, borderRadius: radius.card - space.xs },
  tabOn: { backgroundColor: colors.card, ...shadow.soft },
  back: { width: hit.icon, height: hit.icon, borderRadius: radius.pill, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
});
