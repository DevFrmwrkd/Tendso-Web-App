import React, { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { ScreenShell, Text } from '../v2';
import { hit, space } from '../../theme/v2';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { Notice } from './Screen';

export type AffiliateToolFrameProps = {
  title?: string;
  preview?: boolean;
  suspended?: boolean;
  offline?: boolean;
  footer?: ReactNode;
  avoidKeyboard?: boolean;
  children: ReactNode;
};

/** Pushed creator tools keep the navigation stack, including the tab that opened them. */
export function AffiliateToolFrame({ title, preview, suspended, offline, footer, avoidKeyboard = false, children }: AffiliateToolFrameProps) {
  const router = useGuardedRouter();
  function back() {
    if (router.canGoBack?.()) router.back();
    else router.replace('/(app)/(affiliate-tabs)');
  }
  const frame = <ScreenShell onBack={back} tone="neutral" floatingFooter footer={footer} contentStyle={styles.content}
    headerRight={title ? <View pointerEvents="none" style={styles.title}><Text variant="bodyLg" weight="bold" align="center" accessibilityRole="header" numberOfLines={1}>{title}</Text></View> : undefined}>
    {preview ? <Notice tone="info">Admin preview · Sample data. Account changes and sharing are disabled.</Notice> : null}
    {suspended ? <Notice tone="warn">Your creator account is suspended. Your sales stay visible. Page changes, sharing and payouts are paused.</Notice> : null}
    {offline ? <Notice tone="warn">You’re offline. Connect to refresh your sales and save changes.</Notice> : null}
    {children}
  </ScreenShell>;
  return avoidKeyboard ? <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>{frame}</KeyboardAvoidingView> : frame;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: space.lg },
  title: { position: 'absolute', left: space.gutter + hit.icon + space.sm, right: space.gutter + hit.icon + space.sm },
});
