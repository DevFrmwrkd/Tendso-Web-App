import React from 'react';
import { Platform } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useMobileAccount } from '../../../hooks/useMobileAccount';
import { usePushNotifications } from '../../../hooks/usePushNotifications';
import { accountHome, canUseAdminTools } from '../../../components/admin/access';
import { AdminLoading, AdminNotice, AdminScreen, WebAdminLink } from '../../../components/admin/AdminUI';

class AdminQueryBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <AdminScreen title="Admin unavailable"><AdminNotice error>Admin data could not load. Check your connection and account access, then reopen this screen.</AdminNotice><WebAdminLink /></AdminScreen> : this.props.children;
  }
}

export default function NativeAdminLayout() {
  const session = useMobileAccount();
  // Admins get push notifications for new reviews and payouts.
  usePushNotifications(session.account?._id);
  if (session.isLoading) return <AdminLoading message="Checking admin access…" />;
  if (session.isOffline) return <AdminLoading message="Connect to the internet to use admin tools." />;
  if (!session.isAuthenticated) return <Redirect href="/(auth)/login" />;
  if (!canUseAdminTools(session)) return <Redirect href={accountHome(session.account)} />;
  return <AdminQueryBoundary key={session.account!._id}>
    {/* Main sections switch in place. Only opening a detail is a native push. */}
    <Stack screenOptions={{ headerShown: false, animation: 'none', gestureEnabled: false }}>
      <Stack.Screen name="submissions/[id]" options={{
        animation: Platform.OS === 'ios' ? 'default' : 'slide_from_right',
        gestureEnabled: true,
      }} />
    </Stack>
  </AdminQueryBoundary>;
}
