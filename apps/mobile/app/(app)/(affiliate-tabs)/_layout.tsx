import { Tabs, Redirect } from 'expo-router';
import { useMobileAccount } from '../../../hooks/useMobileAccount';
import { usePushNotifications } from '../../../hooks/usePushNotifications';
import { mobileHome } from '../../../services/accountAccess';
import { V2TabBar, type TabBarItem } from '../../../components/v2';

/** Creator board: Home · Agents · Money. Other tools stay reachable from Home. */
const ITEMS: TabBarItem[] = [
  { routeName: 'index', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { routeName: 'agents', label: 'Agents', icon: 'people-outline', activeIcon: 'people' },
  { routeName: 'wallet', label: 'Money', icon: 'wallet-outline', activeIcon: 'wallet' },
];

export default function AffiliateTabsLayout() {
  const { view, isLoading, account } = useMobileAccount();
  // Creators get push notifications too (sale paid, field agent joined, payout sent).
  usePushNotifications(account?._id);
  if (isLoading) return null;
  if (view !== 'affiliate') return <Redirect href={mobileHome(view) as never} />;
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => <V2TabBar state={state} navigation={navigation} items={ITEMS} centerAfter={ITEMS.length} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="agents" />
      <Tabs.Screen name="page" options={{ href: null }} />
      <Tabs.Screen name="sales" options={{ href: null }} />
      <Tabs.Screen name="wallet" />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
