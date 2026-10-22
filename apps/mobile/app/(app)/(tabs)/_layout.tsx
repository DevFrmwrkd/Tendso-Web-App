import { Tabs, useRouter } from 'expo-router';
import { V2TabBar, type TabBarItem } from '../../../components/v2';
import { useGuardedPress } from '../../../hooks/useGuardedPress';
import { useMobileAccount } from '../../../hooks/useMobileAccount';

/**
 * Field-agent tabs (design v2): Home · Learn · [Submit] · Earn · Me.
 *
 * The creator board draws Map · Finds · Submit · Earn · Me. We keep Home and Learn as their own tabs
 * because Home carries the certification gate, the balance and submission summary, the activity feed and
 * push registration, and Learn is the whole Help Center / Field Wiki stack (notification deep links point
 * into it). Nothing is lost; Earn is the old Wallet and Me is the old Profile.
 */
const ITEMS: TabBarItem[] = [
  { routeName: 'index', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { routeName: 'knowledge', label: 'Learn', icon: 'book-outline', activeIcon: 'book' },
  { routeName: 'wallet', label: 'Earn', icon: 'wallet-outline', activeIcon: 'wallet' },
  { routeName: 'profile', label: 'Me', icon: 'person-outline', activeIcon: 'person' },
];

function CustomTabBar({ state, navigation }: any) {
  const { isPreview } = useMobileAccount();
  const router = useRouter();
  // Only the SUBMIT push needs a spam guard (it stacks a new screen). Tab switching is idempotent.
  const goSubmit = useGuardedPress(() => router.push('/(app)/submit/info' as any));

  return (
    <V2TabBar
      state={state}
      navigation={navigation}
      items={ITEMS}
      centerAfter={2}
      center={{
        label: 'Submit',
        icon: 'add',
        onPress: goSubmit,
        disabled: isPreview,
        accessibilityLabel: 'Submit new business',
      }}
    />
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="knowledge" />
      <Tabs.Screen name="wallet" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
