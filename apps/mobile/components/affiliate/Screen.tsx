import React, { Component, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, Text, View, StyleSheet } from 'react-native';
import type { Doc } from '@tendso/convex-client';
import { useMobileAccount } from '../../hooks/useMobileAccount';
import { Body, Display, Door, Label } from '../ui/primitives';
import { colors, fonts, radius } from '../../theme/tokens';
import { sampleAffiliate } from './model';
import { affiliateNeedsApproval } from '../../services/accountAccess';
import { PendingAffiliateApproval } from './PendingApproval';

export type AffiliateAccessProps = { account: Doc<'creators'>; isPreview: boolean; isOffline: boolean; isAuthenticated: boolean };

export function AffiliateAccess({ children }: { children: (props: AffiliateAccessProps) => ReactNode }) {
  const state = useMobileAccount();
  if (state.isLoading) return <AffiliateLoading label="Loading your affiliate account" />;
  const preview = state.isAdmin && state.view === 'affiliate' && state.isPreview;
  const account = preview ? sampleAffiliate : state.account;
  if (!account && state.isOffline) return <AffiliateFrame title="You’re offline" offline><Body>Connect to view your affiliate page and sales.</Body></AffiliateFrame>;
  if (!account || account.isDeleted || (!preview && account.role !== 'affiliate')) {
    return <AffiliateFrame title="Affiliate account"><Body>Sign in with your affiliate account to see this page.</Body></AffiliateFrame>;
  }
  if (!state.isAuthenticated && !state.isOffline) return <AffiliateLoading label="Connecting your account" />;
  if (affiliateNeedsApproval(account)) return <PendingAffiliateApproval />;
  return <AffiliateBoundary key={`${account._id}-${preview}`}>
    {children({ account, isPreview: preview, isOffline: state.isOffline, isAuthenticated: state.isAuthenticated })}
  </AffiliateBoundary>;
}

export function AffiliateFrame({ title, sub, preview, suspended, offline, children }: { title: string; sub?: string; preview?: boolean; suspended?: boolean; offline?: boolean; children: ReactNode }) {
  return <ScrollView style={styles.screen} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <View style={{ gap: 9 }}><Label>Tendso affiliate</Label><Display size="md">{title}</Display>{sub ? <Body>{sub}</Body> : null}</View>
    {preview ? <Notice>Admin preview · Sample data. Account changes and sharing are disabled.</Notice> : null}
    {suspended ? <Notice>Your affiliate account is suspended. Your sales remain visible. Page changes, sharing, and payouts are paused.</Notice> : null}
    {offline ? <Notice>You’re offline. Connect to refresh your sales and save changes.</Notice> : null}
    {children}
  </ScrollView>;
}

export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <Text accessibilityRole={error ? 'alert' : undefined} accessibilityLiveRegion="polite" style={[styles.notice, error && { color: colors.danger, backgroundColor: colors.dangerBg }]}>{children}</Text>;
}

export function AffiliateLoading({ label }: { label: string }) {
  return <View style={styles.loading}><ActivityIndicator accessibilityLabel={label} color={colors.accent} /><Body>{label}</Body></View>;
}

export class AffiliateBoundary extends Component<{ children: ReactNode }, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <AffiliateFrame title="Could not load this page"><Body>Please check your connection and try again.</Body><Door label="Try again" onPress={() => this.setState((current) => ({ failed: false, attempt: current.attempt + 1 }))} /></AffiliateFrame>;
    return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
  }
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper }, content: { padding: 22, paddingBottom: 40, gap: 22 },
  loading: { flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  notice: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 20, color: colors.accentInk, backgroundColor: colors.accentBg, borderRadius: radius.sm, padding: 14 },
  input: { backgroundColor: colors.paper3, borderWidth: 1, borderColor: colors.ruleStrong, borderRadius: radius.sm, color: colors.ink, fontFamily: fonts.sans, fontSize: 16, padding: 14, minHeight: 50 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
});
