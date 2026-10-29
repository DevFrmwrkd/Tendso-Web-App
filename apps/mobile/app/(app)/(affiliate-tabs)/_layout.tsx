import { Tabs, Redirect } from 'expo-router';
import { useMobileAccount } from '../../../hooks/useMobileAccount';
import { usePushNotifications } from '../../../hooks/usePushNotifications';
import { mobileHome } from '../../../services/accountAccess';
import { V2TabBar, type TabBarItem } from '../../../components/v2';
import type { Id } from '@tendso/convex-client';

/** Approved affiliate redesign: four stable tabs; details push onto the app stack. */
const ITEMS: TabBarItem[] = [
  { routeName: 'index', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { routeName: 'agents', label: 'Agents', icon: 'people-outline', activeIcon: 'people' },
  { routeName: 'wallet', label: 'Money', icon: 'wallet-outline', activeIcon: 'wallet' },
  { routeName: 'profile', label: 'Me', icon: 'person-outline', activeIcon: 'person' },
];

function AffiliatePushRegistration({ creatorId }: { creatorId: Id<'creators'> }) {
  usePushNotifications(creatorId);
  return null;
}

export default function AffiliateTabsLayout() {
  const { view, isLoading, account, isPreview, isAuthenticated, isOffline } = useMobileAccount();
  if (isLoading) return null;
  if (view !== 'affiliate') return <Redirect href={mobileHome(view) as never} />;
  return <>
    {!isPreview && isAuthenticated && !isOffline && account?.role === 'affiliate'
      ? <AffiliatePushRegistration key={account._id} creatorId={account._id} /> : null}
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => <V2TabBar state={state} navigation={navigation} items={ITEMS} centerAfter={ITEMS.length} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="agents" />
      <Tabs.Screen name="page" options={{ href: null }} />
      <Tabs.Screen name="sales" options={{ href: null }} />
      <Tabs.Screen name="wallet" />
      <Tabs.Screen name="profile" />
    </Tabs>
  </>;
}
