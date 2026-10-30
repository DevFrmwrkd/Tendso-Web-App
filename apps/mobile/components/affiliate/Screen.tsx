import React, { Component, type ReactNode } from 'react';
import { View } from 'react-native';
import type { Doc } from '@tendso/convex-client';
import { useMobileAccount } from '../../hooks/useMobileAccount';
import { Banner, Button, Loading, ScreenShell, Text } from '../v2';
import { sampleAffiliate } from './model';
import { affiliateNeedsApproval } from '../../services/accountAccess';
import { PendingAffiliateApproval } from './PendingApproval';

export type AffiliateAccessProps = { account: Doc<'creators'>; isPreview: boolean; isOffline: boolean; isAuthenticated: boolean };

export function AffiliateAccess({ children }: { children: (props: AffiliateAccessProps) => ReactNode }) {
  const state = useMobileAccount();
  if (state.isLoading) return <AffiliateLoading label="Loading your creator account" />;
  const preview = state.isAdmin && state.view === 'affiliate' && state.isPreview;
  const account = preview ? sampleAffiliate : state.account;
  if (!account && state.isOffline) return <AffiliateFrame title="You’re offline" offline><Text variant="bodyLg" tone="ink2">Connect to see your page and sales.</Text></AffiliateFrame>;
  if (!account || account.isDeleted || (!preview && account.role !== 'affiliate')) {
    return <AffiliateFrame title="Creator account"><Text variant="bodyLg" tone="ink2">Sign in with your creator account to see this page.</Text></AffiliateFrame>;
  }
  if (!state.isAuthenticated && !state.isOffline) return <AffiliateLoading label="Connecting your account" />;
  if (affiliateNeedsApproval(account)) return <PendingAffiliateApproval />;
  return <AffiliateBoundary key={`${account._id}-${preview}`}>
    {children({ account, isPreview: preview, isOffline: state.isOffline, isAuthenticated: state.isAuthenticated })}
  </AffiliateBoundary>;
}

/** Tab-screen frame for every creator screen: v2 shell (title, gradient), notices, optional pinned footer. */
export function AffiliateFrame({ title, sub, preview, suspended, offline, footer, floatingFooter = true, children }: { title?: string; sub?: string; preview?: boolean; suspended?: boolean; offline?: boolean; footer?: ReactNode; floatingFooter?: boolean; children: ReactNode }) {
  return <ScreenShell title={title} subtitle={sub} insetBottom={false} tone="neutral" floatingFooter={floatingFooter} footer={footer} contentStyle={{ gap: 16, paddingTop: 16 }}>
    {preview ? <Notice tone="info">Admin preview · Sample data. Account changes and sharing are disabled.</Notice> : null}
    {suspended ? <Notice tone="warn">Your creator account is suspended. Your sales stay visible. Page changes, sharing and payouts are paused.</Notice> : null}
    {offline ? <Notice tone="warn">You’re offline. Connect to refresh your sales and save changes.</Notice> : null}
    {children}
  </ScreenShell>;
}

export function Notice({ children, error = false, tone }: { children: string; error?: boolean; tone?: 'info' | 'warn' | 'ok' | 'danger' }) {
  return <Banner tone={error ? 'danger' : tone ?? 'info'} body={children} />;
}

export function AffiliateLoading({ label, inline = false }: { label: string; inline?: boolean }) {
  return <Loading label={label} fill={!inline} />;
}

export class AffiliateBoundary extends Component<{ children: ReactNode }, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) {
      return <AffiliateFrame title="Could not load this page" footer={<Button title="Try again" onPress={() => this.setState((current) => ({ failed: false, attempt: current.attempt + 1 }))} />}>
        <View><Text variant="bodyLg" tone="ink2">Please check your connection and try again.</Text></View>
      </AffiliateFrame>;
    }
    return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
  }
}
