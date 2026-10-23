import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius } from '../../theme/tokens';
import { openExternalUrl, SITE_URL } from '../../services/links';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';

export const money = (value: number) => `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fullName = (person: { firstName?: string | null; lastName?: string | null; email?: string | null }) =>
  [person.firstName, person.lastName].filter(Boolean).join(' ') || person.email || 'Unnamed account';
export const date = (value?: number | null) => value ? new Date(value).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

export function AdminButton({ label, onPress, disabled = false, busy = false, danger = false }: {
  label: string; onPress: () => void | Promise<void>; disabled?: boolean; busy?: boolean; danger?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: disabled || busy, busy }}
    disabled={disabled || busy} onPress={onPress} cssInterop={false} style={({ pressed }) => [styles.button, danger && styles.dangerButton, (disabled || busy) && { opacity: .45 }, pressed && { opacity: .75 }]}>
    {busy ? <ActivityIndicator color={colors.paper3} /> : <Text style={styles.buttonText}>{label}</Text>}
  </Pressable>;
}

export function AdminText({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return <Text selectable style={[styles.text, muted && { color: colors.ink3 }]}>{children}</Text>;
}
export function AdminCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return <View style={styles.card}>{title && <Text style={styles.cardTitle}>{title}</Text>}{children}</View>;
}
export function AdminLoading({ message = 'Loading admin data…' }: { message?: string }) {
  return <View style={styles.loading}><ActivityIndicator accessibilityLabel="Loading admin data" color={colors.ink} /><AdminText>{message}</AdminText></View>;
}
export function AdminNotice({ children, error = false }: { children: React.ReactNode; error?: boolean }) {
  return <Text accessibilityRole={error ? 'alert' : undefined} accessibilityLiveRegion="polite" style={[styles.notice, error && { backgroundColor: colors.dangerBg, color: colors.danger }]}>{children}</Text>;
}
export function AdminField({ label, value, onChangeText, maxLength = 500, multiline = false }: {
  label: string; value: string; onChangeText: (value: string) => void; maxLength?: number; multiline?: boolean;
}) {
  return <View style={{ gap: 8 }}><AdminText>{label}</AdminText><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText}
    maxLength={maxLength} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} style={[styles.input, multiline && { minHeight: 100 }]} /></View>;
}
export function AdminTabs<T extends string>({ items, value, onChange }: { items: { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return <View style={styles.tabs}>{items.map(item => <Pressable key={item.value} accessibilityRole="tab" accessibilityLabel={item.label}
    accessibilityState={{ selected: item.value === value }} onPress={() => onChange(item.value)} style={[styles.tab, item.value === value && { backgroundColor: colors.ink }]}>
    <Text style={[styles.tabText, item.value === value && { color: colors.paper3 }]}>{item.label}</Text>
  </Pressable>)}</View>;
}
export function AdminLink({ label, href }: { label: string; href: Href }) {
  const router = useGuardedRouter();
  return <AdminButton label={label} onPress={() => router.push(href)} />;
}
export function WebAdminLink({ path = '', label = 'Open web admin' }: { path?: string; label?: string }) {
  // Callers provide fixed admin routes or an encoded Convex id, never an external host.
  return <AdminButton label={label} onPress={() => openExternalUrl(`${SITE_URL}/admin${path}`)} />;
}
export function AdminScreen({ title, children, home = false }: { title: string; children: React.ReactNode; home?: boolean }) {
  const router = useGuardedRouter();
  const insets = useSafeAreaInsets();
  return <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, gap: 16 }} keyboardShouldPersistTaps="handled">
    {!home && <Pressable accessibilityRole="button" accessibilityLabel="Back to admin overview" onPress={() => router.replace('/(app)/admin')} style={{ paddingVertical: 12 }}><Text style={styles.link}>← Admin overview</Text></Pressable>}
    <Text style={styles.eyebrow}>Tendso · Admin</Text><Text accessibilityRole="header" style={styles.title}>{title}</Text>{children}
  </ScrollView>;
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
  screen: { flex: 1, backgroundColor: colors.paper },
  title: { fontFamily: fonts.serif, fontSize: 38, lineHeight: 42, color: colors.ink },
  eyebrow: { fontFamily: fonts.monoMed, fontSize: 11, color: colors.ink3, textTransform: 'uppercase', letterSpacing: 1.4 },
  card: { borderWidth: 1, borderColor: colors.rule, backgroundColor: colors.paper3, borderRadius: radius.md, padding: 18, gap: 12 },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.ink },
  text: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, color: colors.ink2 },
  button: { minHeight: 48, justifyContent: 'center', alignItems: 'center', padding: 12, borderRadius: radius.sm, backgroundColor: colors.ink },
  buttonText: { fontFamily: fonts.sansMed, fontSize: 14, color: colors.paper3, textAlign: 'center' },
  dangerButton: { backgroundColor: colors.danger },
  loading: { flex: 1, padding: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, gap: 16 },
  notice: { backgroundColor: colors.accentBg, color: colors.accentInk, padding: 14, borderRadius: radius.sm, fontFamily: fonts.sans, fontSize: 14, lineHeight: 21 },
  input: { backgroundColor: colors.paper3, borderColor: colors.ruleStrong, borderWidth: 1, borderRadius: radius.sm, padding: 14, fontFamily: fonts.sans, fontSize: 15, color: colors.ink },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill, borderColor: colors.ruleStrong, borderWidth: 1 },
  tabText: { fontFamily: fonts.sansMed, fontSize: 14, color: colors.ink },
  link: { fontFamily: fonts.sansMed, color: colors.business, fontSize: 15 },
});
