import { Tabs, Redirect } from 'expo-router';
import { useMobileAccount } from '../../../hooks/useMobileAccount';
import { usePushNotifications } from '../../../hooks/usePushNotifications';
import { mobileHome } from '../../../services/accountAccess';
import { V2TabBar, type TabBarItem } from '../../../components/v2';

/** Creator tabs (code role `affiliate`), design v2: Home · My page · Sales · Earn · Me. */
const ITEMS: TabBarItem[] = [
  { routeName: 'index', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { routeName: 'page', label: 'My page', icon: 'globe-outline', activeIcon: 'globe' },
  { routeName: 'sales', label: 'Sales', icon: 'receipt-outline', activeIcon: 'receipt' },
  { routeName: 'wallet', label: 'Earn', icon: 'wallet-outline', activeIcon: 'wallet' },
  { routeName: 'profile', label: 'Me', icon: 'person-outline', activeIcon: 'person' },
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
      <Tabs.Screen name="page" />
      <Tabs.Screen name="sales" />
      <Tabs.Screen name="wallet" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
